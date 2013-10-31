var path = require('path');
require('fs').readdirSync(__dirname + '/types').forEach(function(f) {
  exports[path.basename(f, '.js')] = require('./types/' + f);
});