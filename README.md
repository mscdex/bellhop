
Description
===========

A node.js module that exposes streams for doing Pubsub and RPC.

Notes:

 * Serialization of types unsupported by JSON is an option and is enabled by default.
 
 * Properties of "non-plain objects" (e.g. Dates, Functions, Errors, RegExps) are not checked for needed serialization.

 * Circular references are not detected.

 * RPC-specific:

     * Callback functions follow the error-first argument pattern. Any arguments after the error argument are values returned by the other side.

     * All functions returned by `generate()` will assume that a function passed as the last argument will be a callback to be executed when the server responds. If you need to pass a function to the other side, make sure a non-function value separates it and the optional callback **OR** you can use `send()` directly instead. Examples:

        ```javascript
        // ....
        var map = RPC_Client.generate('map');

        // no callback/response (THIS IS WRONG, the mapper function will not be sent to the other side and will be used as a callback instead)
        map([0, 1, 2, 3, 4], function(n) { return n * 2; });

        // no callback/response
        map(function(n) { return n * 2; }, [0, 1, 2, 3, 4]);

        // callback/response requested
        map(function(n) { return n * 2; }, [0, 1, 2, 3, 4], function(result) { console.log('Result: ' + result); });

        // OR always use `send()` directly if you want/need the mapper function to always be the second argument:

        // no callback/response
        RPC_Client.send([0, 1, 2, 3, 4], function(n) { return n * 2; }, 'map');

        // callback/response requested
        RPC_Client.send([0, 1, 2, 3, 4], function(n) { return n * 2; }, 'map', function(result) {
          console.log('Result: ' + result);
        });
        ```


Requirements
============

* [node.js](http://nodejs.org/) -- v0.10.0 or newer


Install
============

    npm install bellhop


Examples
========

* Simple RPC (no intermediate medium/stream):

```javascript
var RPC = require('bellhop').RPC;

var RPC_Server = new RPC(),
    RPC_Client = new RPC();

RPC_Server.add(function add(a, b) {
  var cb = arguments[arguments.length - 1];
  cb && cb(a + b);
});
RPC_Server.add(function serverDate() {
  var cb = arguments[arguments.length - 1];
  cb && cb(new Date());
});
RPC_Server.add(function customCalc(fn) {
  var cb = arguments[arguments.length - 1];
  cb && cb(fn());
});


var add = RPC_Client.generate('add'),
    serverDate = RPC_Client.generate('serverDate'),
    customCalc = RPC_Client.generate('customCalc');

add(5, 5, function(err, result) {
  console.log('add() result = ' + result);
});
serverDate(function(err, date) {
  console.log('serverDate() date UNIX timestamp: ' + date.getTime());
});
customCalc(function() {
  console.log('Look at me, I am running on the server!');
}, function(err) {
  console.log('customCalc() Finished executing function on server');
});


RPC_Client.pipe(RPC_Server).pipe(RPC_Client);


// Example output:
//
// add() result = 10
// serverDate() date UNIX timestamp: 1383242166000
// Look at me, I am running on the server!
// customCalc() Finished executing function on server
```

* Simple Pubsub (no intermediate medium/stream):

```javascript
var Pubsub = require('bellhop').Pubsub;

var Pubsub1 = new Pubsub(),
    Pubsub2 = new Pubsub();

Pubsub1.events.on('today', function(date) {
  console.log('Today is: ' + date);
});

Pubsub2.events.emit('today', new Date());

Pubsub1.pipe(Pubsub2).pipe(Pubsub1);


// Example output:
//
// Today is: Thu Oct 31 2013 14:02:00 GMT-0400 (Eastern Daylight Time)
```


API
===

All types are _Duplex_ streams.

RPC methods
-----------

* **(constructor)**([< _object_ >options]) - Creates and returns a new RPC instance with the following valid `options`:

    * **serialize** - _boolean_ - Manually serialize objects that JSON does not support (well)? (Default: true).

    * **ignoreInvalidCall** - _boolean_ - Do not send error responses to incoming function call requests for invalid methods (Default: false).

    * **highWaterMark** - _integer_ - High water mark to use for this stream (Default: Duplex stream default).

    * Additionally `options` is passed to the underlying [Xfer](https://github.com/mscdex/xfer) instance, allowing for configuration of Xfer too if needed (not common).

* **generate**(< _string_ >remoteFuncName) - _function_ - Returns a function that can be used when calling a particular remote function. This makes things easier than using send() manually. The return value of the returned function is similar to that of Writable.write() and indicates if the high water mark has been reached.

* **send**([< _mixed_ >arg1, ..., < _mixed_ >argn, ]< _string_ >remoteFuncName[, < _function_ >callback]) - _(boolean)_ - Calls the function identified by `remoteFuncName` (with optional arguments). The return value is similar to that of Writable.write() and indicates if the high water mark has been reached.

* **add**(< _function_ >method[, < _string_ >methodName]) - _(void)_ - Adds a function that can be called by others. `methodName` is optional if `method` is a named function, however you can always override the name with `methodName`. The last argument passed to the function is the callback to call in case the other side requested a response. The return value of the callback is similar to that of Writable.write() and indicates if the high water mark has been reached.

* **remove**([< _function_ >method][, < _string_ >methodName]) - _(void)_ - Removes a function previously added via add(). The removal process first checks `methodName`, then `method` for a name, and if those two are not set then *all* instances of that function are removed.


Pubsub properties
-----------------

* **events** - _EventEmitter_ - This is the event emitter object used to emit events to others and to receive events from others.

Pubsub (special) events
-----------------------

* __*__(< _mixed_ >event[, < _mixed_ >arg1, ..., < _mixed_ >argn]) - Emitted for every event for use as a "catch-all."

Pubsub methods
--------------

* **(constructor)**([< _object_ >options]) - Creates and returns a new Pubsub instance with the following valid `options`:

    * **serialize** - _boolean_ - Manually serialize objects that JSON does not support (well)? (Default: true).

    * **highWaterMark** - _integer_ - High water mark to use for this stream (Default: Duplex stream default).

    * Additionally `options` is passed to the underlying [Xfer](https://github.com/mscdex/xfer) instance, allowing for configuration of Xfer too if needed (not common).
