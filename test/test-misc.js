var Pubsub = require('../lib/main').Pubsub,
    RPC = require('../lib/main').RPC;

var path = require('path'),
    assert = require('assert');

var t = 0,
    group = path.basename(__filename, '.js') + '/';

var tests = [
  { test: function() {
      var rpccalls = 0,
          events = 0,
          rpcServer = new RPC(),
          rpcClient = new RPC(),
          pub = new Pubsub(),
          sub = new Pubsub();

      rpcClient.pipe(rpcServer);
      rpcClient.pipe(sub);

      pub.pipe(sub);
      pub.pipe(rpcServer);

      rpcServer.add(function foo() {
        ++rpccalls;
      });

      sub.on('*', function() {
        ++events;
      });

      rpcClient.send('foo');
      pub.events.emit('foo');

      setImmediate(function() {
        assert(rpccalls === 1, makeMsg(this, 'Wrong RPC call count: ' + rpccalls));
        assert(events === 1, makeMsg(this, 'Wrong event count: ' + events));

        ++t;
        next();
      });
    },
    what: 'Pipe to RPC and Pubsub'
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