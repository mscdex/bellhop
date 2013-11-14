var ITERATIONS = 50000;

var Pubsub = require('../lib/main').Pubsub;

var pub, sub, b = 0, benches, opts = { skipWriteTick: true };
function init(name) {
  var count = 0, benchName = ITERATIONS + ' events (' + name + ')';
  pub = new Pubsub(opts);
  sub = new Pubsub(opts);
  sub.on('*', function() {
    if (++count === ITERATIONS) {
      console.timeEnd(benchName);
      ++b;
      setImmediate(next);
    }
  });
  pub.pipe(sub);
  console.time(benchName);
}
function next() {
  benches[b] && benches[b]();
}
setImmediate(next);


benches = [
  function() {
    init('no args');
    for (var i = 0; i < ITERATIONS; ++i)
      pub.events.emit('foo');
  },
  function() {
    init('3 short strings');
    for (var i = 0; i < ITERATIONS; ++i)
      pub.events.emit('foo', 'abc', 'def', 'ghi');
  },
  function() {
    init('3 longer strings');
    for (var i = 0; i < ITERATIONS; ++i) {
      pub.events.emit('foo', 'Donec sit amet volutpat sapien.',
                             'Aliquam molestie augue nec felis ultrices auctor. Nullam sagittis, nisl.',
                             'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Cras cursus fermentum nibh, ac pharetra lectus.');
    }
  },
  function() {
    init('3 regexps');
    var bar = /bar/g, baz = /^baz$/i, blah = /^blah/gmi;
    for (var i = 0; i < ITERATIONS; ++i)
      pub.events.emit('foo', bar, baz, blah);
  },
  function() {
    init('3 functions');
    function bar() { console.log('bar'); }
    function baz() { console.log('baz'); }
    function blah() { console.log('blah'); }
    for (var i = 0; i < ITERATIONS; ++i)
      pub.events.emit('foo', bar, baz, blah);
  },
  function() {
    init('5 numeric values');
    for (var i = 0; i < ITERATIONS; ++i)
      pub.events.emit('foo', 5, 10.5, Infinity, -Infinity, NaN);
  }
];
