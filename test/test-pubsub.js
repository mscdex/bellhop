var Pubsub = require('../lib/main').Pubsub;

var path = require('path'),
    assert = require('assert');

var t = 0,
    group = path.basename(__filename, '.js') + '/';

var tests = [
  { test: function(client1, client2, next) {
      var self = this;
      client1.events.on('foo', function() {
        assert(arguments.length === 0,
               makeMsg(self, 'Unexpected event arguments'));
        next();
      });
      client2.events.emit('foo');
    },
    what: 'Emit (no args)'
  },
  { test: function(client1, client2, next) {
      var self = this;
      client1.events.on('foo', function(a, b, c) {
        assert(arguments.length === 3,
               makeMsg(self, 'Wrong event argument count'));
        assert(a === 5 && b === true && c === 'Hello World',
               makeMsg(self, 'Wrong event arguments'));
        next();
      });
      client2.events.emit('foo', 5, true, 'Hello World');
    },
    what: 'Emit (simple args)'
  },
  { test: function(client1, client2, next) {
      var self = this;
      client1.events.on('foo', function(a, b, c, d) {
        assert(arguments.length === 4,
               makeMsg(self, 'Wrong event argument count'));
        assert(a === 5 && b === true && c === 'Hello World' && d === null,
               makeMsg(self, 'Wrong event arguments'));
        next();
      });
      client2.events.emit('foo', 5, true, 'Hello World', null);
    },
    what: 'Emit (many args)'
  },
  { test: function(client1, client2, next) {
      var self = this;
      client1.events.on('foo', function(fn) {
        assert(arguments.length === 1,
               makeMsg(self, 'Wrong event argument count'));
        assert(typeof fn === 'function',
               makeMsg(self, 'Wrong event argument type'));
        next();
      });
      client2.events.emit('foo', function() { console.dir(arguments); });
    },
    what: 'Emit (complex arg)'
  },
  { test: function(client1, client2, next) {
      var self = this;
      client1.events.on('foo', function(obj) {
        assert(arguments.length === 1,
               makeMsg(self, 'Wrong event argument count'));
        assert(typeof obj === 'object'
               && Object.keys(obj).length === 1
               && typeof obj.fn === 'function',
               makeMsg(self, 'Wrong event argument types'));
        next();
      });
      client2.events.emit('foo', { fn: function() { console.dir(arguments); } });
    },
    what: 'Emit (nested complex arg)'
  },
];

function next() {
  var tst;
  if (tst = tests[t]) {
    ++t;
    var client1 = new Pubsub(),
        client2 = new Pubsub();
    client1.pipe(client2).pipe(client1);
    tst.test.call(tst.what, client1, client2, next);
  }
}
next();

function makeMsg(what, msg) {
  return '[' + group + what + ']: ' + msg;
}

process.on('exit', function() {
  assert(t === tests.length,
         '[' + group + '_exit]: Only ran ' + (t - 1) + '/' + tests.length + ' tests');
});