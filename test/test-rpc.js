var RPC = require('../lib/main').RPC;

var path = require('path'),
    assert = require('assert');

var t = 0,
    group = path.basename(__filename, '.js') + '/';

var tests = [
  { test: function(server, client, next) {
      var self = this;
      function foo() {}
      server.add(foo);
      assert.deepEqual(server.methods,
                       { foo: foo },
                       makeMsg(self, 'Wrong (number of) methods set'));
      server.remove(foo);
      assert.deepEqual(server.methods,
                       {},
                       makeMsg(self, 'Wrong (number of) methods set'));
      next();
    },
    what: 'remove()'
  },
  { test: function(server, client, next) {
      var self = this;
      server.add(function multiply(a, b, cb) {
        assert(typeof cb === 'function',
               makeMsg(self, 'Missing callback'));
        cb(a * b);
      });

      var fn = client.generate('multiply');
      fn(5, 6, function(result) {
        assert(result === 30,
               makeMsg(self, 'Wrong function result'));
        next();
      });
    },
    what: 'Basic function + response'
  },
  { test: function(server, client, next) {
      var self = this;
      server.add(function multiply(a, b, cb) {
        assert(cb === undefined,
               makeMsg(self, 'Unexpected callback'));
        next();
      });

      var fn = client.generate('multiply');
      fn(5, 6);
    },
    what: 'Basic function + no response'
  },
  { test: function(server, client, next) {
      var self = this;
      server.add(function map(a, mapper, cb) {
        assert(typeof cb === 'function',
               makeMsg(self, 'Missing callback'));
        cb(a.map(mapper));
      });

      var fn = client.generate('map');
      fn([1, 2, 3, 4, 5], function(n) {
        return n * 2;
      }, function(result) {
        assert.deepEqual(result,
                         [2, 4, 6, 8, 10],
                         makeMsg(self, 'Wrong function result'));
        next();
      });
    },
    what: 'Complex function + response'
  },
  { test: function(server, client, next) {
      var self = this;
      server.add(function map(a, mapper, cb) {
        assert(cb === undefined,
               makeMsg(self, 'Unexpected callback'));
        next();
      });

      var fn = client.generate('map');
      fn([1, 2, 3, 4, 5], function(n) {
        return n * 2;
      });
    },
    what: 'Complex function + no response'
  },
];

function next() {
  var tst;
  if (tst = tests[t]) {
    ++t;
    var server = new RPC(),
        client = new RPC();
    server.pipe(client).pipe(server);
    tst.test.call(tst.what, server, client, next);
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