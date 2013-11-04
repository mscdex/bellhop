var utils = require('../lib/utils'),
    serializeArgs = utils.serializeArgs;

var path = require('path'),
    assert = require('assert');

var group = path.basename(__filename, '.js') + '/';

[
  { source: [1, 'string', true, null],
    test: function(source) {
      var typeinfo = serializeArgs(source);
      assert.deepEqual(typeinfo,
                       [],
                       makeMsg(this, 'Unexpected typeinfo'));
      assert.deepEqual(source,
                       [1, 'string', true, null],
                       makeMsg(this, 'Unexpected serialization'));
    },
    what: 'JSON-compatible types'
  },
  { source: [new Date(1383273825730)],
    test: function(source) {
      var typeinfo = serializeArgs(source);
      assert.deepEqual(typeinfo,
                       [utils.ID_DATE],
                       makeMsg(this, 'Wrong typeinfo'));
      assert.deepEqual(source,
                       ['2013-11-01T02:43:45.730Z'],
                       makeMsg(this, 'Bad serialization'));
    },
    what: 'Date'
  },
  { source: [function foo(a, b) { console.log('Hello World!'); }],
    test: function(source) {
      var typeinfo = serializeArgs(source);
      assert.deepEqual(typeinfo,
                       [utils.ID_FUNCTION],
                       makeMsg(this, 'Wrong typeinfo'));
      assert.deepEqual(source,
                       [[['a', 'b'], " console.log('Hello World!'); "]],
                       makeMsg(this, 'Bad serialization'));
    },
    what: 'Function (args)'
  },
  { source: [function foo() { console.log('Hello World!'); }],
    test: function(source) {
      var typeinfo = serializeArgs(source);
      assert.deepEqual(typeinfo,
                       [utils.ID_FUNCTION],
                       makeMsg(this, 'Wrong typeinfo'));
      assert.deepEqual(source,
                       [" console.log('Hello World!'); "],
                       makeMsg(this, 'Bad serialization'));
    },
    what: 'Function (no args)'
  },
  { source: [/^Hello World$/gi],
    test: function(source) {
      var typeinfo = serializeArgs(source);
      assert.deepEqual(typeinfo,
                       [utils.ID_REGEXP],
                       makeMsg(this, 'Wrong typeinfo'));
      assert.deepEqual(source,
                       [['^Hello World$', 'gi', 0]],
                       makeMsg(this, 'Bad serialization'));
    },
    what: 'RegExp (flags)'
  },
  { source: [/^Hello World$/],
    test: function(source) {
      var typeinfo = serializeArgs(source);
      assert.deepEqual(typeinfo,
                       [utils.ID_REGEXP],
                       makeMsg(this, 'Wrong typeinfo'));
      assert.deepEqual(source,
                       [['^Hello World$', 0]],
                       makeMsg(this, 'Bad serialization'));
    },
    what: 'RegExp (no flags)'
  },
  { source: [/Hello World/gi],
    test: function(source) {
      source[0].exec('hello world hello world');
      source[0].exec('hello world hello world');
      var typeinfo = serializeArgs(source);
      assert.deepEqual(typeinfo,
                       [utils.ID_REGEXP],
                       makeMsg(this, 'Wrong typeinfo'));
      assert.deepEqual(source,
                       [['Hello World', 'gi', 23]],
                       makeMsg(this, 'Bad serialization'));
    },
    what: 'RegExp (lastIndex > 0)'
  },
  { source: [new Buffer([0,1,2,3,4])],
    test: function(source) {
      // Buffer is toJSON'ed by stringify(), so no inline replace is done by
      // serializeArgs
      var typeinfo = serializeArgs(source);
      assert.deepEqual(typeinfo,
                       [utils.ID_BUFFER],
                       makeMsg(this, 'Wrong typeinfo'));
      assert.deepEqual(source,
                       [new Buffer([0,1,2,3,4])],
                       makeMsg(this, 'Unexpected serialization'));
    },
    what: 'Buffer'
  },
  { source: [Infinity],
    test: function(source) {
      // stringify() changes +/-Infinity to null and we do no inline replace
      var typeinfo = serializeArgs(source);
      assert.deepEqual(typeinfo,
                       [utils.ID_PINF],
                       makeMsg(this, 'Wrong typeinfo'));
      assert.deepEqual(source,
                       [Infinity],
                       makeMsg(this, 'Unexpected serialization'));
    },
    what: 'Positive Infinity'
  },
  { source: [-Infinity],
    test: function(source) {
      // stringify() changes +/-Infinity to null and we do no inline replace
      var typeinfo = serializeArgs(source);
      assert.deepEqual(typeinfo,
                       [utils.ID_NINF],
                       makeMsg(this, 'Wrong typeinfo'));
      assert.deepEqual(source,
                       [-Infinity],
                       makeMsg(this, 'Unexpected serialization'));
    },
    what: 'Positive Infinity'
  },
  { source: [NaN],
    test: function(source) {
      // stringify() changes NaN to null and we do no inline replace
      var typeinfo = serializeArgs(source);
      assert.deepEqual(typeinfo,
                       [utils.ID_NAN],
                       makeMsg(this, 'Wrong typeinfo'));
      assert(source[0].toString() === 'NaN',
             makeMsg(this, 'Unexpected serialization'));
    },
    what: 'NaN'
  },
  { source: [new Error('foo')],
    test: function(source) {
      var typeinfo = serializeArgs(source);
      assert.deepEqual(typeinfo,
                       [utils.ID_ERROR],
                       makeMsg(this, 'Wrong typeinfo'));
      assert(typeof source[0].stack === 'string' && source[0].stack.length,
             makeMsg(this, 'Missing stack'));
      assert(source[0].message === 'foo',
             makeMsg(this, 'Mismatched error message'));
    },
    what: 'Error'
  },
  { source: [{ date: new Date(1383273825730) }],
    test: function(source) {
      var typeinfo = serializeArgs(source);
      assert.deepEqual(typeinfo,
                       [utils.ID_OBJECT],
                       makeMsg(this, 'Wrong typeinfo'));
      assert.deepEqual(source,
                       [[[1 + utils.ID_DATE],['date', '2013-11-01T02:43:45.730Z']]],
                       makeMsg(this, 'Bad serialization'));
    },
    what: 'Object with Date'
  },
  { source: [[ new Date(1383273825730) ]],
    test: function(source) {
      var typeinfo = serializeArgs(source);
      assert.deepEqual(typeinfo,
                       [utils.ID_ARRAY],
                       makeMsg(this, 'Wrong typeinfo'));
      assert.deepEqual(source,
                       [[[utils.ID_DATE],['2013-11-01T02:43:45.730Z']]],
                       makeMsg(this, 'Bad serialization'));
    },
    what: 'Array with Date'
  },
  { source: [{ foo: 'bar', toJSON: function() { return 'Hello World!'; } }],
    test: function(source) {
      var origFn = source[0].toJSON,
          typeinfo = serializeArgs(source);
      assert.deepEqual(typeinfo,
                       [],
                       makeMsg(this, 'Unexpected typeinfo'));
      assert.deepEqual(source,
                       [{ foo: 'bar',
                          toJSON: origFn
                       }],
                       makeMsg(this, 'Unexpected serialization'));
    },
    what: 'Object with existing toJSON method'
  },
].forEach(function(v) {
  v.test.call(v.what, v.source);
});

function makeMsg(what, msg) {
  return '[' + group + what + ']: ' + msg;
}
