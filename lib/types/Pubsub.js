var inherits = require('util').inherits,
    DuplexStream = require('stream').Duplex,
    EventEmitter = require('events').EventEmitter,
    StringDecoder = require('string_decoder').StringDecoder;

var utils = require('../utils'),
    VERSION = utils.VERSION;

var TYPE_PUB = 0x00,
    TYPE_PUB_NOSER = 0x01;

function Pubsub(opts) {
  if (!(this instanceof Pubsub))
    return new Pubsub();

  if (opts && typeof opts.highWaterMark === 'number')
    DuplexStream.call(this, { highWaterMark: opts.highWaterMark });
  else
    DuplexStream.call(this);

  var self = this;
  this.state = 'version';
  this.type = 0;
  this.buffer = '';
  this.decoder = new StringDecoder('utf8');

  this.events = new EventEmitter();
  this.events._emit = this.events.emit;
  this.events.emit = function() {
    self.send.apply(self, arguments);
  };
  this.events._broadcast = 0;
  this.on('newListener', function(ev, fn) {
    if (ev === '*')
      ++self.events._broadcast;
  });
  this.on('removeListener', function(ev, fn) {
    if (ev === '*')
      --self.events._broadcast;
  });

  this.serialize = (opts && typeof opts.serialize === 'boolean'
                    ? opts.serialize
                    : true);
  this.debug = (opts && typeof opts.debug === 'function' ? opts.debug : false);
}
inherits(Pubsub, DuplexStream);

Pubsub.prototype._read = function(n) {};

Pubsub.prototype.send = function() {
  if (arguments.length === 0)
    throw new Error('Missing event name');

  var ev = arguments[0],
      args = [],
      typeinfo;

  for (var i = 1, len = arguments.length; i < len; ++i)
    args.push(arguments[i]);

  var payload = String.fromCharCode(VERSION);

  if (args.length
      && this.serialize
      && (typeinfo = utils.serializeArgs(args)).length) {
    payload += String.fromCharCode(TYPE_PUB);
    payload += JSON.stringify([ev, typeinfo, args]);
  } else {
    payload += String.fromCharCode(TYPE_PUB_NOSER);
    if (args.length)
      payload += JSON.stringify([ev, args]);
    else
      payload += JSON.stringify([ev]);
  }

  payload += '\n';

  return this.push(payload);
};

Pubsub.prototype._write = function(chunk, encoding, cb) {
  var i = 0, len = chunk.length;

  if (this.state === 'data')
    i = this._findLF(chunk, 0, len);

  while (i < len) {
    if (this.state === 'version') {
      if (chunk[i] !== VERSION)
        return this.emit('error',
                         new Error('Unsupported packet version: ' + chunk[i]));
      this.state = 'type';
    } else if (this.state === 'type') {
      if (chunk[i] !== TYPE_PUB && chunk[i] !== TYPE_PUB_NOSER)
        return this.emit('error',
                         new Error('Invalid packet type: ' + chunk[i]));
      this.type = chunk[i];
      this.state = 'data';
    } else {
      i = this._findLF(chunk, i, len);
      continue;
    }
    ++i;
  }
  cb();
};

Pubsub.prototype._findLF = function(chunk, i, len) {
  var start = i;
  for (; i < len; ++i) {
    if (chunk[i] === 0x0A) {
      if (i > start)
        this.buffer += this.decoder.write(chunk.slice(start, i));
      this._parse(JSON.parse(this.buffer));
      this.buffer = '';
      this.state = 'version';
      return i + 1;
    }
  }
  if (start === 0)
    this.buffer += this.decoder.write(chunk);
  else
    this.buffer += this.decoder.write(chunk.slice(start));
  return len;
};

Pubsub.prototype._parse = function(obj) {
  var ev, argslen = 0, args, typeinfo;
  ev = obj[0];
  if (obj.length === 2) {
    args = obj[1];
    argslen = args.length;
  } else if (obj.length === 3) {
    typeinfo = obj[1];
    args = obj[2];
    argslen = args.length;
  }

  if (argslen && this.type === TYPE_PUB && typeinfo)
    utils.unserializeArgs(typeinfo, args);

  if (argslen === 0) {
    this.events._emit(ev);
    this.events._broadcast && this.emit('*', ev);
  } else if (argslen === 1) {
    this.events._emit(ev, args[0]);
    this.events._broadcast && this.emit('*', ev, args[0]);
  } else if (argslen === 2) {
    this.events._emit(ev, args[0], args[1]);
    this.events._broadcast && this.emit('*', ev, args[0], args[1]);
  } else if (argslen === 3) {
    this.events._emit(ev, args[0], args[1], args[2]);
    this.events._broadcast && this.emit('*', ev, args[0], args[1], args[2]);
  } else {
    args.unshift(ev);
    this.events._emit.apply(this.events, args);
    if (this.events._broadcast) {
      args.unshift('*');
      this.emit.apply(this, args);
    }
  }
};

module.exports = Pubsub;
