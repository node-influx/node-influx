
var request = require('request');
var url     = require('url');
var _       = require('underscore');

var InfluxDB = function(host, port, username, password) {

  this.options = {
    host:     host     || 'localhost',
    port:     port     || 8086,
    username: username || 'root',
    password: password || 'root'
  };

  return this;
};

InfluxDB.prototype._parseCallback = function(callback) {
  return function(err, res, body) {
    if(err) {
      return callback(err);
    }
    if(res.statusCode === 401) {
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
  }, callback);
};

InfluxDB.prototype.getDatabaseNames = function(callback) {
  request({
    url: this.url('dbs'),
    json: true
  }, this._parseCallback(function(err, dbs) {
    if(err) {
      return callback(err, dbs);
    }
    return callback(err, _.map(dbs, function(db) { return db.name; }));
  }));
};

InfluxDB.prototype.createUser = function(databaseName, username, password, callback) {
  request.post({
    url: this.url('db/' + databaseName + '/users'),
    data: {
      username: username,
      password: password
    }
  }, callback);
};

InfluxDB.prototype.readPoint = function(fieldNames, seriesNames, callback) {
  var query = 'SELECT ' + fieldNames + ' FROM ' + seriesNames;
  var seriesUrl = this.url('db/' + this.database + '/series', {
    q: encodeURIComponent(query)
  });
};

InfluxDB.prototype.writePoints = function(seriesName, values, options, callback) {
  if(typeof options === 'function') {
    callback = options;
    options  = {};
  }
  var datum = { points: [], name: seriesName, columns: [] };
  point     = [];

  _.each(values, function(k, v) {
    point.push(v);
    datum.columns.push(k);
  });

  datum.points.push(point);
  data = [datum];

  request.post({
    uri: this.seriesUrl(this.options.database),
    body: JSON.stringify(data)
  }, this._parseCallback(callback));
};

InfluxDB.prototype.seriesUrl  = function(databaseName, query) {
  return this.url('db/' + databaseName + '/series');
};



module.exports = InfluxDB;