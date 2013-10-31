var util = require('util');

var RE_FNARGS = /([^\s,]+)/g;

var ID_OBJECT = 0,
    ID_ARRAY = 0.1,
    ID_DATE = 0.2,
    ID_BUFFER = 0.3,
    ID_FUNCTION = 0.4,
    ID_REGEXP = 0.5,
    ID_NAN = 0.6,
    ID_PINF = 0.7,
    ID_NINF = 0.8,
    ID_ERROR = 0.9,
    ID_TYPEERROR = 0.91,
    ID_RANGEERROR = 0.92,
    ID_SYNTAXERROR = 0.93,
    ID_EVALERROR = 0.94,
    ID_REFERENCEERROR = 0.95,
    ID_URIERROR = 0.96;
exports.serializeArgs = function serializeArgs(args) {
// Known issues:
//    - Non-plain objects (e.g. Date, RegExp, Error, Function) do not have their
//      properties check for needed serialization
  var typeinfo = [], v, fns, fnargs, fnbody, mods, keys, j, lenj, obj, ti;
  for (var i = 0, len = args.length; i < len; ++i) {
    v = args[i];
    if (util.isDate(v)) {
      typeinfo.push(i + ID_DATE);
      args[i] = (isFinite(v.valueOf())
                 ? v.getUTCFullYear() + '-'
                   + padDigit(v.getUTCMonth() + 1) + '-'
                   + padDigit(v.getUTCDate()) + 'T'
                   + padDigit(v.getUTCHours()) + ':'
                   + padDigit(v.getUTCMinutes()) + ':'
                   + padDigit(v.getUTCSeconds()) + 'Z'
                 : null);
    } else if (util.isRegExp(v)) {
      typeinfo.push(i + ID_REGEXP);
      mods = v.toString();
      mods = mods.substring(mods.lastIndexOf('/') + 1);
      if (mods)
        args[i] = [v.source, mods, v.lastIndex];
      else
        args[i] = [v.source, v.lastIndex];
    } else if (Buffer.isBuffer(v))
      typeinfo.push(i + ID_BUFFER);
    else if (v === Infinity)
      typeinfo.push(i + ID_PINF);
    else if (v === -Infinity)
      typeinfo.push(i + ID_NINF);
    else if (typeof v === 'number' && isNaN(v))
      typeinfo.push(i + ID_NAN);
    else if (typeof v === 'function') {
      typeinfo.push(i + ID_FUNCTION);
      fns = v.toString();
      fnargs = fns.substring(fns.indexOf('(') + 1, fns.indexOf(')'))
                  .match(RE_FNARGS);
      fnbody = fns.substring(fns.indexOf('{') + 1, fns.lastIndexOf('}'));
      if (fnargs && fnargs.length)
        args[i] = [fnargs, fnbody];
      else
        args[i] = fnbody;
    } else if (v instanceof Error) {
      if (v instanceof TypeError)
        typeinfo.push(i + ID_TYPEERROR);
      else if (v instanceof RangeError)
        typeinfo.push(i + ID_RANGEERROR);
      else if (v instanceof SyntaxError)
        typeinfo.push(i + ID_SYNTAXERROR);
      else if (v instanceof ReferenceError)
        typeinfo.push(i + ID_REFERENCEERROR);
      else if (v instanceof EvalError)
        typeinfo.push(i + ID_EVALERROR);
      else if (v instanceof URIError)
        typeinfo.push(i + ID_URIERROR);
      keys = Object.getOwnPropertyNames(v);
      obj = {};
      for (j = 0, lenj = keys.length; j < lenj; ++j)
        obj[keys[j]] = v[keys[j]];
      args[i] = obj;
    } else if (typeof v === 'object' && v) {
      if (Array.isArray(v)) {
        ti = serializeArgs(v);
        if (ti.length) {
          typeinfo.push(i + ID_ARRAY);
          args[i] = [ti, v];
        }
      } else {
        keys = Object.keys(v);
        obj = [];
        for (j = 0, lenj = keys.length; j < lenj; ++j) {
          obj.push(keys[j]);
          obj.push(v[keys[j]]);
        }
        ti = serializeArgs(obj);
        if (ti.length) {
          typeinfo.push(i + ID_OBJECT);
          args[i] = [ti, obj];
        }
      }
    }
  }
  return typeinfo;
};
exports.unserializeArgs = function unserializeArgs(typeinfo, args) {
  var v, t, id, j, lenj, keys, obj;
  for (var i = 0, len = typeinfo.length; i < len; ++i) {
    v = typeinfo[i];
    t = v | 0;
    id = Math.round((v - t) * 10) / 10;

    if (id === ID_OBJECT) {
      obj = args[t];
      unserializeArgs(obj[0], obj[1]);
      obj = obj[1];
      v = {};
      for (j = 0, lenj = obj.length; j < lenj; j += 2)
        v[obj[j]] = obj[j + 1];
      args[t] = v;
    } else if (id === ID_ARRAY) {
      obj = args[t];
      unserializeArgs(obj[0], obj[1]);
      args[t] = obj[1];
    } else if (id === ID_DATE)
      args[t] = new Date(args[t]);
    else if (id === ID_REGEXP) {
      if (args[t].length === 2) {
        v = new RegExp(v[0]);
        v.lastIndex = v[1];
      } else {
        v = new RegExp(v[0], v[1]);
        v.lastIndex = v[2];
      }
      args[t] = v;
    } else if (id === ID_BUFFER)
      args[t] = new Buffer(args[t]);
    else if (id === ID_PINF)
      args[t] = Infinity;
    else if (id === ID_NINF)
      args[t] = -Infinity;
    else if (id === ID_NAN)
      args[t] = NaN;
    else if (id === ID_FUNCTION) {
      v = args[t];
      if (Array.isArray(v))
        args[t] = new Function(v[0], v[1]);
      else
        args[t] = new Function('', v);
    } else if (id >= ID_ERROR) {
      if (id === ID_TYPEERROR)
        v = new TypeError();
      else if (id === ID_RANGEERROR)
        v = new RangeError();
      else if (id === ID_SYNTAXERROR)
        v = new SyntaxError();
      else if (id === ID_REFERENCEERROR)
        v = new ReferenceError();
      else if (id === ID_EVALERROR)
        v = new EvalError();
      else if (id === ID_URIERROR)
        v = new URIError();
      obj = args[t];
      keys = Object.keys(obj);
      for (j = 0, lenj = keys.length; j < lenj; ++j)
        v[keys[j]] = obj[keys[j]];
      args[t] = v;
    }
  }
};

function padDigit(n) {
  return (n < 10 ? '0' + n : n);
}
