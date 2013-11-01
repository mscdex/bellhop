
Description
===========

A node.js module that exposes streams for doing Pubsub and RPC.

Serialization of types unsupported by JSON is also an option and is enabled by default.
It should also be noted that properties of "non-plain objects" (e.g. Dates, Functions, Errors, RegExps) are not checked for needed serialization.


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


var add = RPC_Client.makeRemoteFn('add'),
    serverDate = RPC_Client.makeRemoteFn('serverDate'),
    customCalc = RPC_Client.makeRemoteFn('customCalc');

add(5, 5, function(result) {
  console.log('add() result = ' + result);
});
serverDate(function(date) {
  console.log('serverDate() date UNIX timestamp: ' + date.getTime());
});
customCalc(function() {
  console.log('Look at me, I am running on the server!');
}, function() {
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

    * **highWaterMark** - _integer_ - High water mark to use for this stream (Default: Duplex stream default).

    * Additionally `options` is passed to the underlying Xfer instance, allowing for configuration of Xfer too if needed (not common).

* **makeRemoteFn**(< _string_ >remoteFuncName) - _function_ - Returns a function that can be used when calling a particular remote function. This makes things easier than using send() manually. The return value of the returned function is similar to that of Writable.write() and indicates if the high water mark has been reached.

* **send**([< _mixed_ >arg1, ..., < _mixed_ >argn, ]< _string_ >remoteFuncName[, < _function_ >callback]) - _(boolean)_ - Calls the function identified by `remoteFuncName` (with optional arguments). The return value is similar to that of Writable.write() and indicates if the high water mark has been reached.

* **add**(< _function_ >method[, < _string_ >methodName]) - _(void)_ - Adds a function that can be called by others. `methodName` is optional if `method` is a named function, however you can always override the name with `methodName`. The last argument passed to the function is the callback to call in case the other side requested a response. The return value of the callback is similar to that of Writable.write() and indicates if the high water mark has been reached.

* **remove**([< _function_ >method][, < _string_ >methodName]) - _(void)_ - Removes a function previously added via add(). The removal process first checks `methodName`, then `method` for a name, and if those two are not set then *all* instances of that function are removed.


Pubsub properties
-----------------

* **events** - _EventEmitter_ - This is the event emitter object used to emit events to others and to receive events from others.

Pubsub methods
--------------

* **(constructor)**([< _object_ >options]) - Creates and returns a new Pubsub instance with the following valid `options`:

    * **serialize** - _boolean_ - Manually serialize objects that JSON does not support (well)? (Default: true).

    * **highWaterMark** - _integer_ - High water mark to use for this stream (Default: Duplex stream default).

    * Additionally `options` is passed to the underlying Xfer instance, allowing for configuration of Xfer too if needed (not common).