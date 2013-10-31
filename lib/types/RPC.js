var inherits = require('util').inherits,
    DuplexStream = require('stream').Duplex,
    inspect = require('util').inspect;

var Xfer = require('xfer');

var utils = require('../utils');

var TYPE_CALL = 0x02,
    TYPE_CALL_NOSER = 0x03,
    TYPE_RESP = 0x04,
    TYPE_RESP_NOSER = 0x05,
    MAX_ID = Math.pow(2, 53),
    EMPTY_READFN = function(n) {};

function RPC(opts) {
  if (!(this instanceof RPC))
    return new RPC();

  if (opts && typeof opts.highWaterMark === 'number')
    DuplexStream.call(this, { highWaterMark: opts.highWaterMark });
  else
    DuplexStream.call(this);

  var self = this;

  this.xfer = new Xfer(opts);
  this.xfer.on('*', function(type, stream) {
    if (!stream ||
        (type !== TYPE_CALL && type !== TYPE_CALL_NOSER
         && type !== TYPE_RESP && type !== TYPE_RESP_NOSER)) {
      stream && stream.resume();
      return;
    }
    self._parse(type, stream);
  });
  this.xfer.on('data', function(d) {
    self.push(d);
  });
  this.serialize = (opts && typeof opts.serialize === 'boolean'
                    ? opts.serialize
                    : true);
  this.debug = (opts && typeof opts.debug === 'function' ? opts.debug : false);
  this.reqs = {};
  this.methods = {};
  this.id = 1;
  this._read = EMPTY_READFN;
}
inherits(RPC, DuplexStream);

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
  } else if (typeof arguments[argulen - 1] === 'string') {
    fnName = arguments[argulen - 1];
    len = argulen - 1;
  }

  for (; i < len; ++i)
    args.push(arguments[i]);

  if (args.length) {
    var typeinfo;
    if (!this.serialize || !(typeinfo = utils.serializeArgs(args)).length) {
      r = this.xfer.send(TYPE_CALL_NOSER,
                         JSON.stringify([cb ? this.id : 0, fnName, args]));
    } else {
      r = this.xfer.send(TYPE_CALL,
                         JSON.stringify([cb ? this.id : 0,
                                         fnName,
                                         typeinfo,
                                         args]));
    }
  } else {
    r = this.xfer.send(TYPE_CALL_NOSER,
                       JSON.stringify([cb ? this.id : 0, fnName]));
  }

  if (cb && ++this.id === MAX_ID)
    this.id = 1;

  return r;
};

RPC.prototype.makeRemoteFn = function(fnName) {
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
    else
      r = self.apply(self, args.concat([fnName, cb]));

    return r;
  };
};

RPC.prototype.add = function(fn, fnName) {
  var name = fnName;
  if (!name)
    name = fn.name;
  if (typeof name !== 'string' || !name.length)
    throw new Error('Missing function name');
  if (typeof fn !== 'function')
    throw new Error('Missing function');
  this.methods[name] = fn;
};

RPC.prototype.remove = function(fn, fnName) {
  var name = fnName;
  if (!name)
    name = fn.name;
  if (!name && typeof fn === 'string') {
    name = fn;
    fn = undefined;
  }
  if (typeof name === 'string' && name.length)
    delete this.methods[name];
  else if (typeof fn === 'function') {
    var methods = this.methods,
        names = Object.keys(methods);
    for (var i = 0, len = names.length; i < len; ++i) {
      if (methods[names[i]] === fn)
        delete methods[names[i]];
    }
  }
};

RPC.prototype._write = function(chunk, encoding, cb) {
  this.xfer.write(chunk, encoding, cb);
};

// request:
//  [id, fnName]
//  or: [id, fnName, args]
//  or: [id, fnName, typeinfo, args]
// response:
//  id
//  or: [id, args]
//  or: [id, typeinfo, args]
RPC.prototype._parse = function(type, stream) {
  var buf = '', self = this;
  stream.on('data', function(d) {
    buf += d;
  });
  stream.on('end', function() {
    var obj = JSON.parse(buf), id, argslen, args, fn, typeinfo;
    if (type === TYPE_RESP || type === TYPE_RESP_NOSER) {
      if (typeof obj === 'number') {
        if (fn = self.reqs[obj]) {
          id = obj;
          argslen = 0;
          delete self.reqs[id];
        }
      } else if (fn = self.reqs[obj[0]]) {
        id = obj[0];
        if (obj.length === 2)
          args = obj[1];
        else {
          typeinfo = obj[1];
          args = obj[2];
        }
        argslen = args.length;
        delete self.reqs[id];
      }

      self.debug&&self.debug('DEBUG: ['
                             + (id === undefined ? '??' : id)
                             + '] RPC raw response: ' + inspect(buf));

      if (!fn)
        return;

      if (argslen && type === TYPE_RESP && typeinfo) {
        self.debug&&self.debug('DEBUG: ['
                               + id
                               + '] RPC (serialized) response args: '
                               + inspect(args, false, 10));
        utils.unserializeArgs(typeinfo, args);
      }

      self.debug&&self.debug('DEBUG: ['
                             + id
                             + '] RPC response args: '
                             + inspect(args, false, 10));

      if (argslen === 0)
        fn();
      else if (argslen === 1)
        fn(args[0]);
      else if (argslen === 2)
        fn(args[0], args[1]);
      else if (argslen === 3)
        fn(args[0], args[1], args[2]);
      else
        fn.apply(null, args);
    } else {
      id = obj[0];
      var wantsResponse = (id > 0),
          objlen = obj.length;

      if (objlen === 2)
        argslen = 0;
      else if (objlen === 3) {
        args = obj[2];
        argslen = args.length;
      } else if (objlen === 4) {
        typeinfo = obj[2];
        args = obj[3];
        argslen = args.length;
      }

      self.debug&&self.debug('DEBUG: ['
                             + (id === 0 ? 'N/A' : id)
                             + '] RPC raw request: ' + inspect(buf));

      if (fn = self.methods[obj[1]]) {
        var cb;
        if (wantsResponse) {
          cb = function() {
            var cbargs = [];
            for (var i = 0, len = arguments.length; i < len; ++i)
              cbargs.push(arguments[i]);
            return self._sendResponse(id, cbargs);
          };
        }
        self.debug&&self.debug('DEBUG: ['
                               + (id === 0 ? 'N/A' : id)
                               + '] RPC request args: '
                               + inspect(args, false, 10));
        if (argslen && type === TYPE_CALL && typeinfo)
          utils.unserializeArgs(typeinfo, args);

        if (argslen === 0)
          fn(cb);
        else if (argslen === 1)
          fn(args[0], cb);
        else if (argslen === 2)
          fn(args[0], args[1], cb);
        else if (argslen === 3)
          fn(args[0], args[1], args[2], cb);
        else {
          args.push(cb);
          fn.apply(null, args);
        }
      }
    }
  });
};

RPC.prototype._sendResponse = function(id, args) {
  var r;
  if (args.length) {
    var typeinfo;
    if (!this.serialize || !(typeinfo = utils.serializeArgs(args)).length)
      r = this.xfer.send(TYPE_RESP_NOSER, JSON.stringify([id, args]));
    else
      r = this.xfer.send(TYPE_RESP, JSON.stringify([id, typeinfo, args]));
  } else
    r = this.xfer.send(TYPE_RESP_NOSER, JSON.stringify(id));

  return r;
};

module.exports = RPC;
