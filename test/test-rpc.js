var RPC = require('../lib/main').RPC;

var path = require('path'),
    assert = require('assert');

var t = 0,
    group = path.basename(__filename, '.js') + '/';

var tests = [
  { test: function() {
      var self = this,
          server = new RPC(),
          client = new RPC();
      server.pipe(client).pipe(server);

      function foo() {}
      server.add(foo);
      assert.deepEqual(server.methods,
                       { foo: foo },
                       makeMsg(self, 'Wrong (number of) methods set'));
      server.remove(foo);
      assert.deepEqual(server.methods,
                       {},
                       makeMsg(self, 'Wrong (number of) methods set'));
      ++t;
      next();
    },
    what: 'remove()'
  },
  { test: function() {
      var self = this,
          server = new RPC(),
          client = new RPC();
      server.pipe(client).pipe(server);

      function foo() {}
      function bar() {}
      function baz() {}
      server.add(foo);
      server.add(bar);
      server.add(baz);
      assert.deepEqual(server.methods,
                       { foo: foo, bar: bar, baz: baz },
                       makeMsg(self, 'Wrong (number of) methods set'));
      server.remove([ foo, bar, baz ]);
      assert.deepEqual(server.methods,
                       {},
                       makeMsg(self, 'Wrong (number of) methods set'));
      ++t;
      next();
    },
    what: 'remove(array)'
  },
  { test: function() {
      var self = this,
          server = new RPC(),
          client = new RPC();
      server.pipe(client).pipe(server);

      function foo1() {}
      function bar1() {}
      function baz1() {}
      server.add(foo1, 'foo');
      server.add(bar1, 'bar');
      server.add(baz1, 'baz');
      assert.deepEqual(server.methods,
                       { foo: foo1, bar: bar1, baz: baz1 },
                       makeMsg(self, 'Wrong (number of) methods set'));
      server.remove({ foo: foo1, bar: bar1, baz: baz1 });
      assert.deepEqual(server.methods,
                       {},
                       makeMsg(self, 'Wrong (number of) methods set'));
      ++t;
      next();
    },
    what: 'remove(object)'
  },
  { test: function() {
      var self = this,
          server = new RPC(),
          client = new RPC();
      server.pipe(client).pipe(server);

      function foo() {}
      function bar() {}
      function baz() {}
      server.add([ foo, bar, baz, 5, [ function() {} ] ]);
      assert.deepEqual(server.methods,
                       { foo: foo, bar: bar, baz: baz },
                       makeMsg(self, 'Wrong (number of) methods set'));
      ++t;
      next();
    },
    what: 'add(array)'
  },
  { test: function() {
      var self = this,
          server = new RPC(),
          client = new RPC(),
          funcs = {
            foo: function() {},
            bar: function() {},
            baz: function() {}
          };
      server.pipe(client).pipe(server);

      server.add({
        foo: funcs.foo,
        bar: funcs.bar,
        baz: funcs.baz,
        num: 5,
        arr: [function() {}]
      });
      assert.deepEqual(server.methods,
                       funcs,
                       makeMsg(self, 'Wrong (number of) methods set'));
      ++t;
      next();
    },
    what: 'add(object)'
  },
  { test: function() {
      var self = this,
          server = new RPC(),
          client = new RPC();
      server.pipe(client).pipe(server);

      server.add(function multiply(a, b, cb) {
        assert(typeof cb === 'function', makeMsg(self, 'Missing callback'));
        cb(a * b);
      });

      var fn = client.generate('multiply');
      fn(5, 6, function(err, result) {
        assert(!err, makeMsg(self, 'Unexpected error: ' + err));
        assert(result === 30, makeMsg(self, 'Wrong function result'));
        ++t;
        next();
      });
    },
    what: 'Basic function + response'
  },
  { test: function() {
      var self = this,
          server = new RPC(),
          client = new RPC();
      server.pipe(client).pipe(server);

      server.add(function multiply(a, b, c, d, cb) {
        assert(typeof cb === 'function', makeMsg(self, 'Missing callback'));
        cb(a * b * c * d);
      });

      var fn = client.generate('multiply');
      fn(1, 2, 3, 4, function(err, result) {
        assert(!err, makeMsg(self, 'Unexpected error: ' + err));
        assert(result === 24, makeMsg(self, 'Wrong function result'));
        ++t;
        next();
      });
    },
    what: 'Basic function + response (many args)'
  },
  { test: function() {
      var self = this,
          server = new RPC(),
          client = new RPC();
      server.pipe(client).pipe(server);

      server.add(function multiply(a, b, cb) {
        assert(a === 5 && b === 6, makeMsg(self, 'Wrong function arguments'));
        assert(cb === undefined, makeMsg(self, 'Unexpected callback'));
        ++t;
        process.nextTick(next);
      });

      client.on('error', function(err) {
        assert(!err, makeMsg(self, 'Unexpected error: ' + err));
      });
      var fn = client.generate('multiply');
      fn(5, 6);
    },
    what: 'Basic function + no response'
  },
  { test: function() {
      var self = this,
          server = new RPC(),
          client = new RPC();
      server.pipe(client).pipe(server);

      server.add(function map(a, mapper, cb) {
        assert(typeof cb === 'function', makeMsg(self, 'Missing callback'));
        cb(a.map(mapper));
      });

      var fn = client.generate('map');
      fn([1, 2, 3, 4, 5], function(n) {
        return n * 2;
      }, function callback(err, result) {
        assert(!err, makeMsg(self, 'Unexpected error: ' + err));
        assert.deepEqual(result,
                         [2, 4, 6, 8, 10],
                         makeMsg(self, 'Wrong function result'));
        ++t;
        next();
      });
    },
    what: 'Complex function + response'
  },
  { test: function() {
      var self = this,
          server = new RPC(),
          client = new RPC();
      server.pipe(client).pipe(server);

      server.add(function map(mapper, a, cb) {
        assert(typeof mapper === 'function', makeMsg(self, 'Bad argument'));
        assert(cb === undefined, makeMsg(self, 'Unexpected callback'));
        ++t;
        next();
      });

      var fn = client.generate('map');
      fn(function(n) {
        return n * 2;
      }, [1, 2, 3, 4, 5]);
    },
    what: 'Complex function + no response'
  },
  { test: function() {
      var self = this,
          thisVal = { node: 'rules!' },
          server = new RPC({ this: thisVal }),
          client = new RPC();
      server.pipe(client).pipe(server);

      server.add(function foo() {
        assert(arguments.length === 1, makeMsg(self, 'Bad arguments count'));
        assert(arguments[0] === undefined, makeMsg(self, 'Unexpected callback'));
        assert(this === thisVal, makeMsg(self, 'Unexpected \'this\' value'));
        ++t;
        next();
      });

      client.generate('foo')();
    },
    what: 'Remote method with custom \'this\''
  },
  { test: function() {
      var self = this,
          server = new RPC(),
          client = new RPC();
      server.pipe(client).pipe(server);

      server.add(function foo() {
        assert(arguments.length === 1, makeMsg(self, 'Bad arguments count'));
        assert(arguments[0] === undefined, makeMsg(self, 'Unexpected callback'));
        ++t;
        next();
      });

      client.send('foo');
    },
    what: 'send(\'event\')'
  },
];

function next() {
  var tst;
  if (tst = tests[t])
    tst.test.call(tst.what);
}
next();

function makeMsg(what, msg) {
  return '[' + group + what + ']: ' + msg;
}

process.on('exit', function() {
  assert(t === tests.length,
         '[' + group + '_exit]: Only finished ' + t + '/' + tests.length + ' tests');
});