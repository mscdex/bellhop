
Description
===========

A node.js module that exposes streams for doing Pubsub and RPC.


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

// Server

RPC_Server.add({
  add: function(a, b, cb) {
    cb(a + b);
  },
  serverDate: function(cb) {
    cb(new Date());
  },
  log: function(fn, cb) {
    cb(fn());
  }
});

// Client

RPC_Client.send(5, 5, 'add', function(err, result) {
  console.log('add() result = ' + result);
});
RPC_Client.send('serverDate', function(err, date) {
  console.log('serverDate() date UNIX timestamp: ' + date.getTime());
});
RPC_Client.send(function() {
  console.log('Look at me, I am running on the server!');
}, 'log', function(err) {
  console.log('log() Finished executing function on server');
});

// simple in-process RPC
RPC_Client.pipe(RPC_Server).pipe(RPC_Client);


// Example output:
//
// Look at me, I am running on the server!
// add() result = 10
// serverDate() date UNIX timestamp: 1384958692554
// log() Finished executing function on server
```

* RPC over HTTP:

```javascript
var http = require('http');
var RPC = require('bellhop').RPC;

function multiply(a, b, cb) {
  cb(a * b);
}

var TOTAL = 10, count = 0;

http.createServer(function(req, res) {
  var RPC_Server = new RPC();
  RPC_Server.add(multiply);
  req.pipe(RPC_Server).pipe(res);
  if (++count === TOTAL)
    this.close();
}).listen(8080, function() {
  console.log('HTTP RPC server listening');

  for (var i = 0; i < TOTAL; ++i) {
    (function(n) {
      var RPC_Client = new RPC(),
          req = http.request({
            host: '127.0.0.1',
            port: 8080,
            method: 'POST'
          }, function(res) {
            res.pipe(RPC_Client);
          });
      RPC_Client.pipe(req);
      RPC_Client.send(2, n, 'multiply', function(err, result) {
        console.log('Result = ' + result);
        req.socket.end();
      });
    })(i);
  }
});

// Output:
//
// HTTP RPC server listening
// Result = 0
// Result = 2
// Result = 4
// Result = 6
// Result = 8
// Result = 10
// Result = 12
// Result = 14
// Result = 16
// Result = 18
```

* RPC over HTTP (reusing the same RPC server stream with [Conveyor](https://github.com/mscdex/conveyor)):

```javascript
var http = require('http');
var Conveyor = require('conveyor'),
    RPC = require('bellhop').RPC;

var RPC_Server = new RPC(),
    c = new Conveyor(RPC_Server);

RPC_Server.add(function multiply(a, b) {
  var cb = arguments[arguments.length - 1];
  cb && cb(a * b);
});

var TOTAL = 10, count = 0;

http.createServer(function(req, res) {
  if (++count === TOTAL)
    this.close();
  c.push(req, res);
}).listen(8080, function() {
  console.log('HTTP RPC server listening');

  for (var i = 0; i < TOTAL; ++i) {
    (function(n) {
      var RPC_Client = new RPC(),
          req = http.request({
            host: '127.0.0.1',
            port: 8080,
            method: 'POST'
          }, function(res) {
            res.pipe(RPC_Client);
          });
      RPC_Client.pipe(req);
      RPC_Client.send(2, n, 'multiply', function(err, result) {
        console.log('Result = ' + result);
        req.socket.end();
      });
    })(i);
  }
});

// Output:
//
// HTTP RPC server listening
// Result = 0
// Result = 2
// Result = 4
// Result = 6
// Result = 8
// Result = 10
// Result = 12
// Result = 14
// Result = 16
// Result = 18
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

// simple in-process Pubsub
Pubsub1.pipe(Pubsub2).pipe(Pubsub1);

// Example output:
//
// Today is: Thu Oct 31 2013 14:02:00 GMT-0400 (Eastern Daylight Time)
```

* Simple Pubsub over TCP:

```javascript
var net = require('net');

var Pubsub = require('bellhop').Pubsub;

var PubsubRecvr = new Pubsub(),
    PubsubSender = new Pubsub();

net.createServer(function(sock) {
  this.close();
  PubsubSender.pipe(sock);
  PubsubSender.events.emit('today', new Date());
}).listen(9000, '127.0.0.1');

var sock = new net.Socket();
sock.pipe(PubsubRecvr);
PubsubRecvr.events.on('today', function(date) {
  console.log('Today is: ' + date);
  sock.end();
});
sock.connect(9000, '127.0.0.1');

// Example output:
//
// Today is: Thu Nov 14 2013 07:52:01 GMT-0500 (Eastern Standard Time)
```

* RPC AND Pubsub over the same TCP socket:

```javascript
var net = require('net');

var Pubsub = require('bellhop').Pubsub,
    RPC = require('bellhop').RPC;

var rpcServer = new RPC(),
    rpcClient = new RPC(),
    pub = new Pubsub(),
    sub = new Pubsub();

// Servers

rpcServer.add(function foo() {
  console.log('Got RPC');
});

sub.events.on('bar', function() {
  console.log('Got event');
});

net.createServer(function(sock) {
  this.close();
  sock.pipe(rpcServer);
  sock.pipe(sub);
}).listen(9000, '127.0.0.1');

// Clients

var sock = new net.Socket();
rpcClient.pipe(sock);
pub.pipe(sock);

sock.connect(9000, '127.0.0.1', function() {
  rpcClient.send('foo');
  pub.events.emit('bar');
  sock.end();
});

// Output:
//
// Got RPC
// Got event
```


Benchmarks
==========

Benchmarks can be found in `bench/`.

Pubsub benchmark (as of 11/14/2013) for Core i7-3770k, Windows 7 x64, node v0.10.22:

```
50000 events (no args): 327ms
50000 events (3 short strings): 389ms
50000 events (3 longer strings): 433ms
50000 events (3 regexps): 654ms
50000 events (3 functions): 874ms
50000 events (5 numeric values): 470ms
```


API
===

All types are _Duplex_ streams.

RPC methods
-----------

* **(constructor)**([< _object_ >options]) - Creates and returns a new RPC instance with the following valid `options`:

    * **serialize** - _boolean_ - Automatically serialize objects that JSON does not support (well)? (Default: true).

    * **ignoreInvalidCall** - _boolean_ - Do not send error responses to incoming function call requests for invalid methods (Default: false).

    * **highWaterMark** - _integer_ - High water mark to use for this stream (Default: Duplex stream default).

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


Notes
=====

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