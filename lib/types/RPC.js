var inherits = require('util').inherits,
    DuplexStream = require('stream').Duplex,
    inspect = require('util').inspect,
    StringDecoder = require('string_decoder').StringDecoder;

var utils = require('../utils'),
    VERSION = utils.VERSION;

var TYPE_CALL = 0x02,
    TYPE_CALL_NOSER = 0x03,
    TYPE_RESP = 0x04,
    TYPE_RESP_NOSER = 0x05,
    TYPE_ERR_NOTFOUND = 0x06,
    MAX_ID = Math.pow(2, 53),
    RE_FUNCNAME = /function\s+([^\s\(]+)/;

function RPC(opts) {
  if (!(this instanceof RPC))
    return new RPC();

  if (opts && typeof opts.highWaterMark === 'number')
    DuplexStream.call(this, { highWaterMark: opts.highWaterMark });
  else
    DuplexStream.call(this);

  this.state = 'version';
  this.type = 0;
  this.valid = false;
  this.buffer = '';
  this.decoder = new StringDecoder('utf8');

  this.serialize = (opts && typeof opts.serialize === 'boolean'
                    ? opts.serialize
                    : true);
  this.debug = (opts && typeof opts.debug === 'function' ? opts.debug : false);
  this.ignoreInvalidCall = (opts && opts.ignoreInvalidCall) || false;

  this.this = (opts && opts.this !== undefined ? opts.this : {});
  this.reqs = {};
  this.methods = {};
  this.id = 1;
}
inherits(RPC, DuplexStream);

RPC.prototype._read = function(n) {};

// send('myfunc');
// or: send('myfunc', mycallback);
// or: send('arg1', 'arg2', 'myfunc');
// or: send('arg1', 'arg2', 'myfunc', mycallback);
RPC.prototype.send = function() {
  var args = [], argulen = arguments.length, i = 0, cb, len, fnName, r;

  if (argulen === 0)
    throw new Error('Missing function name');
  if (typeof arguments[argulen - 1] === 'function') {
    if (argulen === 1 || typeof arguments[argulen - 2] !== 'string')
      throw new Error('Missing function name');
    this.reqs[this.id] = cb = arguments[argulen - 1];
    fnName = arguments[argulen - 2];
    len = argulen - 2;
  } else if (argulen > 1 && typeof arguments[argulen - 2] === 'string') {
    fnName = arguments[argulen - 2];
    len = argulen - 2;
  } else if (typeof arguments[argulen - 1] === 'string') {
    fnName = arguments[argulen - 1];
    len = argulen - 1;
  }

  for (; i < len; ++i)
    args.push(arguments[i]);

  if (args.length) {
    var typeinfo;
    if (!this.serialize || !(typeinfo = utils.serializeArgs(args)).length) {
      r = this._send(TYPE_CALL_NOSER,
                     JSON.stringify([cb ? this.id : 0, fnName, args]));
    } else {
      r = this._send(TYPE_CALL,
                     JSON.stringify([cb ? this.id : 0, fnName, typeinfo, args]));
    }
  } else
    r = this._send(TYPE_CALL_NOSER, JSON.stringify([cb ? this.id : 0, fnName]));

  if (cb && ++this.id === MAX_ID)
    this.id = 1;

  return r;
};

RPC.prototype.generate = function(fnName) {
  var self = this;
  if (typeof fnName !== 'string')
    throw new TypeError('Function name must be a string');
  return function() {
    var args = [], argulen = arguments.length, i = 0, len, cb, r;

    if (argulen && typeof arguments[argulen - 1] === 'function') {
      cb = arguments[argulen - 1];
      len = argulen - 1;
    } else
      len = argulen;

    for (; i < len; ++i)
      args.push(arguments[i]);

    if (len === 0)
      r = self.send(fnName, cb);
    else if (len === 1)
      r = self.send(args[0], fnName, cb);
    else if (len === 2)
      r = self.send(args[0], args[1], fnName, cb);
    else if (len === 3)
      r = self.send(args[0], args[1], args[2], fnName, cb);
    else {
      args.push(fnName);
      args.push(cb);
      r = self.send.apply(self, args);
    }

    return r;
  };
};

RPC.prototype.add = function(fn, fnName) {
  var i, len, v, name;

  if (typeof fn === 'object') {
    if (Array.isArray(fn)) {
      for (i = 0, len = fn.length; i < len; ++i) {
        v = fn[i];
        if (typeof v === 'function')
          this.add(v);
      }
    } else {
      var keys = Object.keys(fn);
      for (i = 0, len = keys.length; i < len; ++i) {
        v = fn[keys[i]];
        if (typeof v === 'function')
          this.add(v, keys[i]);
      }
    }
    return;
  }

  name = fnName;
  if (!name)
    name = getFuncName(fn);
  if (typeof name !== 'string' || !name.length)
    throw new Error('Missing function name');
  if (typeof fn !== 'function')
    throw new Error('Missing function');
  this.methods[name] = fn;
};

RPC.prototype.remove = function(fn, fnName) {
  var i, len, v, name;

  if (typeof fn === 'object') {
    if (Array.isArray(fn)) {
      for (i = 0, len = fn.length; i < len; ++i) {
        v = fn[i];
        if (typeof v === 'function')
          this.remove(v);
      }
    } else {
      var keys = Object.keys(fn);
      for (i = 0, len = keys.length; i < len; ++i) {
        v = fn[keys[i]];
        if (typeof v === 'function')
          this.remove(v, keys[i]);
      }
    }
    return;
  }

  name = fnName;
  if (!name && typeof fn === 'function')
    name = getFuncName(fn);
  if (!name && typeof fn === 'string') {
    name = fn;
    fn = undefined;
  }
  if (typeof name === 'string' && name.length)
    delete this.methods[name];
  else if (typeof fn === 'function') {
    var methods = this.methods,
        names = Object.keys(methods);
    for (i = 0, len = names.length; i < len; ++i) {
      if (methods[names[i]] === fn)
        delete methods[names[i]];
    }
  }
};

RPC.prototype._write = function(chunk, encoding, cb) {
  var i = 0, len = chunk.length, type = 0;

  if (this.state === 'data')
    i = this._findLF(chunk, 0, len);

  while (i < len) {
    if (this.state === 'version') {
      if (chunk[i] !== 0x01)
        return this.emit('error',
                         new Error('Unsupported packet version: ' + chunk[i]));
      this.state = 'type';
    } else if (this.state === 'type') {
      type = chunk[i];
      this.type = type;
      this.valid = (type === TYPE_CALL || type === TYPE_CALL_NOSER
                    || type === TYPE_RESP || type === TYPE_RESP_NOSER
                    || type === TYPE_ERR_NOTFOUND);
      this.state = 'data';
    } else {
      i = this._findLF(chunk, i, len);
      continue;
    }
    ++i;
  }
  cb();
};

RPC.prototype._findLF = function(chunk, i, len) {
  var start = i;
  for (; i < len; ++i) {
    if (chunk[i] === 0x0A) {
      if (this.valid) {
        if (i > start)
          this.buffer += this.decoder.write(chunk.slice(start, i));
        this._parse(JSON.parse(this.buffer));
        this.buffer = '';
      }
      this.state = 'version';
      return i + 1;
    }
  }
  if (this.valid) {
    if (start === 0)
      this.buffer += this.decoder.write(chunk);
    else
      this.buffer += this.decoder.write(chunk.slice(start));
  }
  return len;
};

RPC.prototype._parse = function(obj) {
  if (this.type === TYPE_RESP || this.type === TYPE_RESP_NOSER)
    this._parseResp(obj);
  else if (this.type === TYPE_ERR_NOTFOUND)
    this._parseErr(obj);
  else
    this._parseReq(obj);
};

RPC.prototype._parseReq = function(obj) {
  var id = obj[0],
      args,
      argslen = 0,
      typeinfo,
      fn,
      wantsResponse = (id > 0),
      objlen = obj.length,
      self = this;

  if (objlen === 3) {
    args = obj[2];
    argslen = args.length;
  } else if (objlen === 4) {
    typeinfo = obj[2];
    args = obj[3];
    argslen = args.length;
  }

  this.debug && this.debug('DEBUG: ['
                           + (id === 0 ? 'N/A' : id)
                           + '] RPC request: ' + inspect(obj));

  if (fn = this.methods[obj[1]]) {
    var cb;
    if (wantsResponse) {
      cb = function() {
        var cbargs = [];
        for (var i = 0, len = arguments.length; i < len; ++i)
          cbargs.push(arguments[i]);
        return self._sendResponse(id, cbargs);
      };
    }
    this.debug && this.debug('DEBUG: ['
                             + (id === 0 ? 'N/A' : id)
                             + '] RPC request args: '
                             + inspect(args, false, 10));
    if (argslen && this.type === TYPE_CALL && typeinfo)
      utils.unserializeArgs(typeinfo, args);

    if (argslen === 0)
      fn.call(this.this, cb);
    else if (argslen === 1)
      fn.call(this.this, args[0], cb);
    else if (argslen === 2)
      fn.call(this.this, args[0], args[1], cb);
    else if (argslen === 3)
      fn.call(this.this, args[0], args[1], args[2], cb);
    else {
      args.push(cb);
      fn.apply(this.this, args);
    }
  } else if (!this.ignoreInvalidCall) {
    if (wantsResponse)
      this._send(TYPE_ERR_NOTFOUND, JSON.stringify(id));
    else
      this._send(TYPE_ERR_NOTFOUND, JSON.stringify([id, obj[1]]));
  }
};

RPC.prototype._parseErr = function(obj) {
  var fn;

  if (typeof obj === 'number' && (fn = this.reqs[obj])) {
    // we sent an invalid request that did request a response
    // obj === id
    fn(new Error('Invalid remote method'));
  } else {
    var err;
    if (Array.isArray(obj) && obj.length === 2) {
      // we sent an invalid request that did not request a response
      // obj === [0, 'badFnName']
      err = new Error('Invalid remote method: ' + obj[1]);
      err.methodName = obj[1];
    } else
      err = new Error('Invalid remote method (malformed error notification)');
    this.emit('error', err);
  }
};

RPC.prototype._parseResp = function(obj) {
  var id, args, argslen = 0, fn, typeinfo;

  if (typeof obj === 'number') {
    if (fn = this.reqs[obj]) {
      id = obj;
      delete this.reqs[id];
    }
  } else if (fn = this.reqs[obj[0]]) {
    id = obj[0];
    if (obj.length === 2)
      args = obj[1];
    else {
      typeinfo = obj[1];
      args = obj[2];
    }
    argslen = args.length;
    delete this.reqs[id];
  }

  this.debug && this.debug('DEBUG: ['
                           + (id === undefined ? '??' : id)
                           + '] RPC response: ' + inspect(obj));

  if (!fn)
    return;

  if (argslen && this.type === TYPE_RESP && typeinfo) {
    this.debug && this.debug('DEBUG: ['
                             + id
                             + '] RPC (serialized) response args: '
                             + inspect(args, false, 10));
    utils.unserializeArgs(typeinfo, args);
  }

  this.debug && this.debug('DEBUG: ['
                           + id
                           + '] RPC response args: '
                           + inspect(args, false, 10));

  if (argslen === 0)
    fn(null);
  else if (argslen === 1)
    fn(null, args[0]);
  else if (argslen === 2)
    fn(null, args[0], args[1]);
  else if (argslen === 3)
    fn(null, args[0], args[1], args[2]);
  else {
    args.unshift(null);
    fn.apply(null, args);
  }
};

// request:
//  [id, fnName]
//  or: [id, fnName, args]
//  or: [id, fnName, typeinfo, args]
// response:
//  id
//  or: [id, args]
//  or: [id, typeinfo, args]

RPC.prototype._send = function(type, payload) {
  var data = String.fromCharCode(VERSION);
  data += String.fromCharCode(type);
  data += payload;
  data += '\n';
  return this.push(data);
};

RPC.prototype._sendResponse = function(id, args) {
  /*var payload = String.fromCharCode(VERSION);
  
  if (args.length) {
    var typeinfo;
    if (!this.serialize || !(typeinfo = utils.serializeArgs(args)).length) {
      payload += String.fromCharCode(TYPE_RESP_NOSER);
      payload += JSON.stringify([id, args]);
    } else {
      payload += String.fromCharCode(TYPE_RESP);
      payload += JSON.stringify([id, typeinfo, args]);
    }
  } else {
    payload += String.fromCharCode(TYPE_RESP_NOSER);
    payload += JSON.stringify(id);
  }

  payload += '\n';

  return this.push(payload);*/
  if (args.length) {
    var typeinfo;
    if (!this.serialize || !(typeinfo = utils.serializeArgs(args)).length)
      return this._send(TYPE_RESP_NOSER, JSON.stringify([id, args]));
    else
      return this._send(TYPE_RESP, JSON.stringify([id, typeinfo, args]));
  } else
    return this._send(TYPE_RESP_NOSER, JSON.stringify(id));
};

function getFuncName(fn) {
  var name = fn.name, m;
  if (!name && (m = RE_FUNCNAME.exec(fn.toString())))
    name = m[1];
  return name;
}

module.exports = RPC;
