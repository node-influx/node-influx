
var request = require('request');
var url     = require('url');
var _       = require('underscore');

var InfluxDB = function(host, port, username, password, database) {

  this.options = {
    host:     host     || 'localhost',
    port:     port     || 8086,
    username: username || 'root',
    password: password || 'root',
    database: database
  };

  return this;
};

InfluxDB.prototype._parseCallback = function(callback) {
  return function(err, res, body) {
    if(err) {
      return callback(err);
    }
    if(res.statusCode < 200 || res.statusCode >= 300) {
      return callback(new Error(body));
    }
    return callback(null, body);
  };
};


InfluxDB.prototype.url = function(database, query) {
  return url.format({
    protocol: 'http:',
    hostname: this.options.host,
    port: this.options.port,
    pathname: database,
    query: _.extend({
      u: this.options.username,
      p: this.options.password
    }, query || {})
  });
};

InfluxDB.prototype.createDatabase = function(databaseName, callback) {
  request.post({
    url: this.url('db'),
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      name: databaseName
    }, null),
  }, this._parseCallback(callback));
};

InfluxDB.prototype.deleteDatabase = function(databaseName, callback) {
  request({
    method: 'DELETE',
    url:this.url('db/' + databaseName)
  }, this._parseCallback(callback));
};

InfluxDB.prototype.getDatabaseNames = function(callback) {
  request({
    url: this.url('db'),
    json: true
  }, this._parseCallback(function(err, dbs) {
    if(err) {
      return callback(err, dbs);
    }
    return callback(err, _.map(dbs, function(db) { return db.name; }));
  }));
};


InfluxDB.prototype.getSeriesNames = function(databaseName,callback) {
    request({
        url: this.url('db/' + databaseName + '/series', {q: 'list series'}),
        json: true
    }, this._parseCallback(function(err, series) {
        if(err) {
            return callback(err, series);
        }
        return callback(err, _.map(series, function(series) { return series.name; }));
    }));
};



InfluxDB.prototype.createUser = function(databaseName, username, password, callback) {
    request.post({
    url: this.url('db/' + databaseName + '/users'),
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      name: username,
      password: password
    }, null)
  }, this._parseCallback(callback));
};

InfluxDB.prototype.writePoint = function(seriesName, values, options, callback) {
  if(typeof options === 'function') {
    callback = options;
    options  = {};
  }
  var datum = { points: [], name: seriesName, columns: [] };
  point     = [];

  var query = options.query || {};

  _.each(values, function(v, k) {
    if(k === 'time' && v instanceof Date) {
      v = v.valueOf();
      query.time_precision = 'm';
    }
    point.push(v);
    datum.columns.push(k);
  });

  datum.points.push(point);
  data = [datum];
  request.post({
    uri: this.seriesUrl(this.options.database, query),
    headers: {
      'content-type': 'application/json'
    },
    pool : 'undefined' != typeof options.pool ? options.pool : {},
    body: JSON.stringify(data)
  }, this._parseCallback(callback));
};

InfluxDB.prototype.readPoints = function(query, callback) {
  request({
    url: this.url('db/' + this.options.database + '/series', { q: query }),
    json: true
  }, this._parseCallback(callback));
};

InfluxDB.prototype.seriesUrl  = function(databaseName, query) {
  return this.url('db/' + databaseName + '/series');
};


var createClient = function() {
  var args = arguments;
  var client = function () { return InfluxDB.apply(this, args); };
  client.prototype = InfluxDB.prototype;
  return new client();
};


var parseResult = function(res) {
  return _.map(res.points, function(point) {
    var objectPoint = {};
    _.each(res.columns, function(name, n) {
      objectPoint[name] = point[n];
    });
    return objectPoint;
  });
};

module.exports = createClient;
module.exports.parseResult = parseResult;
module.exports.InfluxDB = InfluxDB;