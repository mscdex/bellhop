var inherits = require('util').inherits,
    DuplexStream = require('stream').Duplex,
    EventEmitter = require('events').EventEmitter;

var Xfer = require('xfer');

var utils = require('../utils');

var TYPE_PUB = 0x00,
    TYPE_PUB_NOSER = 0x01,
    EMPTY_READFN = function(n) {};

function PubSub(opts) {
  if (!(this instanceof PubSub))
    return new PubSub();

  if (opts && typeof opts.highWaterMark === 'number')
    DuplexStream.call(this, { highWaterMark: opts.highWaterMark });
  else
    DuplexStream.call(this);

  var self = this;

  this.xfer = new Xfer(opts);
  this.xfer.on('*', function(type, stream) {
    if (!stream || (type !== TYPE_PUB && type !== TYPE_PUB_NOSER)) {
      stream && stream.resume();
      return;
    }
    self._parse(type, stream);
  });
  this.xfer.on('data', function(d) {
    self.push(d);
  });

  this.events = new EventEmitter();
  this.events._emit = this.events.emit;
  this.events.emit = function() {
    self.send.apply(self, arguments);
  };

  this.serialize = (opts && typeof opts.serialize === 'boolean'
                    ? opts.serialize
                    : true);
  this.debug = (opts && typeof opts.debug === 'function' ? opts.debug : false);
  this._read = EMPTY_READFN;
}
inherits(PubSub, DuplexStream);

PubSub.prototype.send = function() {
  if (arguments.length === 0)
    throw new Error('Missing event name');

  var ev = arguments[0],
      args = [],
      typeinfo, r;

  for (var i = 1, len = arguments.length; i < len; ++i)
    args.push(arguments[i]);

  if (args.length
      && this.serialize
      && (typeinfo = utils.serializeArgs(args)).length)
    r = this.xfer.send(TYPE_PUB, JSON.stringify([ev, typeinfo, args]));
  else if (args.length)
    r = this.xfer.send(TYPE_PUB_NOSER, JSON.stringify([ev, args]));
  else
    r = this.xfer.send(TYPE_PUB_NOSER, JSON.stringify([ev]));

  return r;
};

PubSub.prototype._write = function(chunk, encoding, cb) {
  this.xfer.write(chunk, encoding, cb);
};

PubSub.prototype._parse = function(type, stream) {
  var buf = '', self = this;
  stream.on('data', function(d) {
    buf += d;
  });
  stream.on('end', function() {
    var obj = JSON.parse(buf), ev, argslen = 0, args, typeinfo;
    ev = obj[0];
    if (obj.length === 2) {
      args = obj[1];
      argslen = args.length;
    } else if (obj.length === 3) {
      typeinfo = obj[1];
      args = obj[2];
      argslen = args.length;
    }

    if (argslen && type === TYPE_PUB && typeinfo)
      utils.unserializeArgs(typeinfo, args);

    if (argslen === 0)
      self.events._emit(ev);
    else if (argslen === 1)
      self.events._emit(ev, args[0]);
    else if (argslen === 2)
      self.events._emit(ev, args[0], args[1]);
    else if (argslen === 3)
      self.events._emit(ev, args[0], args[1], args[2]);
    else {
      args.unshift(ev);
      self.events._emit.apply(self.events.emit, args);
    }
  });
};

module.exports = PubSub;
