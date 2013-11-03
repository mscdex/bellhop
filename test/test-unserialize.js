var utils = require('../lib/utils'),
    serializeArgs = utils.serializeArgs,
    unserializeArgs = utils.unserializeArgs;

var path = require('path'),
    util = require('util'),
    assert = require('assert');

var group = path.basename(__filename, '.js') + '/';

[
  { source: [1, 'string', true, null],
    test: function(source) {
      var typeinfo = serializeArgs(source);
      unserializeArgs(typeinfo, source);

      assert.deepEqual(source,
                       [1, 'string', true, null],
                       makeMsg(this, 'Bad unserialization'));
    },
    what: 'JSON-compatible types (no serialization)'
  },
  { source: [new Date(1383273825730)],
    test: function(source) {
      var typeinfo = serializeArgs(source);
      unserializeArgs(typeinfo, source);

      assert(util.isDate(source[0]),
             makeMsg(this, 'Bad type'));
      assert(source[0].getTime() === 1383273825730,
             makeMsg(this, 'Bad unserialization'));
    },
    what: 'Date'
  },
  { source: [function foo(a, b) { console.log('Hello World!'); }],
    test: function(source) {
      var typeinfo = serializeArgs(source);
      unserializeArgs(typeinfo, source);

      assert(typeof source[0] === 'function',
             makeMsg(this, 'Bad type'));
      assert.equal(source[0].toString(),
                   "function anonymous(a,b) {\n console.log('Hello World!'); \n}",
                   makeMsg(this, 'Bad unserialization'));
    },
    what: 'Function (args)'
  },
  { source: [function foo() { console.log('Hello World!'); }],
    test: function(source) {
      var typeinfo = serializeArgs(source);
      unserializeArgs(typeinfo, source);

      assert(typeof source[0] === 'function',
             makeMsg(this, 'Bad type'));
      assert.equal(source[0].toString(),
                   "function anonymous() {\n console.log('Hello World!'); \n}",
                   makeMsg(this, 'Bad unserialization'));
    },
    what: 'Function (no args)'
  },
  { source: [/^Hello World$/gi],
    test: function(source) {
      var typeinfo = serializeArgs(source);
      unserializeArgs(typeinfo, source);

      assert(util.isRegExp(source[0]),
             makeMsg(this, 'Bad type'));
      assert(source[0].source === '^Hello World$',
             makeMsg(this, 'Bad unserialization - RegExp source wrong'));
      assert(source[0].ignoreCase === true,
             makeMsg(this, 'Bad unserialization - Wrong ignoreCase flag'));
      assert(source[0].global === true,
             makeMsg(this, 'Bad unserialization - Wrong global flag'));
      assert(source[0].multiline === false,
             makeMsg(this, 'Bad unserialization - Wrong multiline flag'));
      assert(source[0].lastIndex === 0,
             makeMsg(this, 'Bad unserialization - Wrong lastIndex value'));
    },
    what: 'RegExp (flags)'
  },
  { source: [/^Hello World$/],
    test: function(source) {
      var typeinfo = serializeArgs(source);
      unserializeArgs(typeinfo, source);

      assert(util.isRegExp(source[0]),
             makeMsg(this, 'Bad type'));
      assert(source[0].source === '^Hello World$',
             makeMsg(this, 'Bad unserialization - RegExp source wrong'));
      assert(source[0].ignoreCase === false,
             makeMsg(this, 'Bad unserialization - Wrong ignoreCase flag'));
      assert(source[0].global === false,
             makeMsg(this, 'Bad unserialization - Wrong global flag'));
      assert(source[0].multiline === false,
             makeMsg(this, 'Bad unserialization - Wrong multiline flag'));
      assert(source[0].lastIndex === 0,
             makeMsg(this, 'Bad unserialization - Wrong lastIndex value'));
    },
    what: 'RegExp (no flags)'
  },
  { source: [/Hello World/gi],
    test: function(source) {
      source[0].exec('hello world hello world');
      source[0].exec('hello world hello world');
      var typeinfo = serializeArgs(source);
      unserializeArgs(typeinfo, source);

      assert(util.isRegExp(source[0]),
             makeMsg(this, 'Bad type'));
      assert(source[0].source === 'Hello World',
             makeMsg(this, 'Bad unserialization - RegExp source wrong'));
      assert(source[0].ignoreCase ===  true,
             makeMsg(this, 'Bad unserialization - Wrong ignoreCase flag'));
      assert(source[0].global === true,
             makeMsg(this, 'Bad unserialization - Wrong global flag'));
      assert(source[0].multiline === false,
             makeMsg(this, 'Bad unserialization - Wrong multiline flag'));
      assert(source[0].lastIndex === 23,
             makeMsg(this, 'Bad unserialization - Wrong lastIndex value'));
    },
    what: 'RegExp (lastIndex > 0)'
  },
  { source: [new Buffer([0,1,2,3,4])],
    test: function(source) {
      var typeinfo = serializeArgs(source);
      unserializeArgs(typeinfo, source);

      assert(Buffer.isBuffer(source[0]),
             makeMsg(this, 'Bad type'));
      assert.deepEqual(source[0],
                       new Buffer([0,1,2,3,4]),
                       makeMsg(this, 'Bad unserialization'));
    },
    what: 'Buffer'
  },
  { source: [Infinity],
    test: function(source) {
      var typeinfo = serializeArgs(source);
      unserializeArgs(typeinfo, source);

      assert(typeof source[0] === 'number',
             makeMsg(this, 'Bad type'));
      assert.deepEqual(source,
                       [Infinity],
                       makeMsg(this, 'Bad unserialization'));
    },
    what: 'Positive Infinity'
  },
  { source: [-Infinity],
    test: function(source) {
      var typeinfo = serializeArgs(source);
      unserializeArgs(typeinfo, source);

      assert(typeof source[0] === 'number',
             makeMsg(this, 'Bad type'));
      assert.deepEqual(source,
                       [-Infinity],
                       makeMsg(this, 'Bad unserialization'));
    },
    what: 'Positive Infinity'
  },
  { source: [NaN],
    test: function(source) {
      var typeinfo = serializeArgs(source);
      unserializeArgs(typeinfo, source);

      assert(typeof source[0] === 'number',
             makeMsg(this, 'Bad type'));
      assert(isNaN(source[0]),
             makeMsg(this, 'Bad unserialization'));
    },
    what: 'NaN'
  },
  { source: [new Error('foo')],
    test: function(source) {
      var stack = source[0].stack,
          typeinfo = serializeArgs(source);
      unserializeArgs(typeinfo, source);

      assert(source[0] instanceof Error,
             makeMsg(this, 'Bad type'));
      assert(source[0].stack === stack,
             makeMsg(this, 'Bad unserialization - Wrong stack'));
      assert(source[0].message === 'foo',
             makeMsg(this, 'Bad unserialization - Wrong message'));
    },
    what: 'Error'
  },
  { source: [{ date: new Date(1383273825730) }],
    test: function(source) {
      var typeinfo = serializeArgs(source);
      unserializeArgs(typeinfo, source);

      assert(typeof source[0] === 'object',
             makeMsg(this, 'Bad type'));
      assert(util.isDate(source[0].date),
             makeMsg(this, 'Bad unserialization - Bad type'));
      assert(source[0].date.getTime() === 1383273825730,
             makeMsg(this, 'Bad unserialization - Wrong value'));
    },
    what: 'Object with Date'
  },
  { source: [[ new Date(1383273825730) ]],
    test: function(source) {
      var typeinfo = serializeArgs(source);
      unserializeArgs(typeinfo, source);

      assert(Array.isArray(source[0]),
             makeMsg(this, 'Bad type'));
      assert(util.isDate(source[0][0]),
             makeMsg(this, 'Bad unserialization - Bad type'));
      assert(source[0][0].getTime() === 1383273825730,
             makeMsg(this, 'Bad unserialization - Wrong value'));
    },
    what: 'Array with Date'
  },
].forEach(function(v) {
  v.test.call(v.what, v.source);
});

function makeMsg(what, msg) {
  return '[' + group + what + ']: ' + msg;
}
