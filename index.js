
var influxRequest = require('./lib/InfluxRequest.js');
var url           = require('url');
var _             = require('underscore');

var defaultOptions = {
  hosts               : [],
  disabled_hosts      : [],
  username            : 'root',
  password            : 'root',
  port                : 8086,
  protocol            : 'http',
  depreciatedLogging  : (process.env.NODE_ENV === undefined || 'development') ? console.log : false,
  failoverTimeout     : 60000,
  requestTimeout      : null,
  maxRetries          : 2,
  timePrecision       : 'ms'
};

var InfluxDB = function(options) {

  this.options = _.extend(_.clone(defaultOptions), options);

  this.request = new influxRequest({
    failoverTimeout   : this.options.failoverTimeout,
    maxRetries        : this.options.maxRetries,
    requestTimeout    : this.options.requestTimeout
  });

  if ( (!_.isArray(this.options.hosts) || 0 === this.options.hosts.length ) && 'string' === typeof this.options.host)
  {
    this.request.addHost(this.options.host, this.options.port, this.options.protocol);
  }
  if (_.isArray(this.options.hosts) && 0 < this.options.hosts.length)
  {
    var self = this;
    _.each(this.options.hosts,function(host){
      var port = host.port || self.options.port;
      var protocol = host.protocol || self.options.protocol;
      self.request.addHost(host.host, port, protocol);
    });
  }

  return this;
};

InfluxDB.prototype._parseCallback = function(callback) {
  return function(err, res, body) {
    if ('undefined' === typeof callback) return;
    if(err) {
      return callback(err);
    }
    if(res.statusCode < 200 || res.statusCode >= 300) {
      return callback(new Error(body));
    }
    return callback(null, body);
  };
};

InfluxDB.prototype.setRequestTimeout = function (value)
{
  return this.request.setRequestTimeout(value);
};

InfluxDB.prototype.setFailoverTimeout = function (value)
{
  return this.request.setFailoverTimeout(value);
};


InfluxDB.prototype.url = function(database, query) {

  return url.format({
    pathname: database,
    query: _.extend({
      u: this.options.username,
      p: this.options.password,
      time_precision: this.options.timePrecision
    }, query || {})
  });
};

InfluxDB.prototype.createDatabase = function(databaseName, options, callback) {
  if (typeof callback === 'undefined') {
      callback = options;
      options = {};
  }

  this.request.post({
    url: this.url('cluster/database_configs/' + databaseName),
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(options, null)
  }, this._parseCallback(callback));
};

InfluxDB.prototype.deleteDatabase = function(databaseName, callback) {
  this.request.get({
    method: 'DELETE',
    url:this.url('db/' + databaseName)
  }, this._parseCallback(callback));
};

InfluxDB.prototype.getDatabaseNames = function(callback) {
  this.request.get({
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
  // if database defined on connection level use it unless overwritten
  if ( this.options.database && typeof databaseName === 'function' ) {
    callback = databaseName;
    databaseName = this.options.database;
  }

  this.request.get({
    url: this.url('db/' + databaseName + '/series', {q: 'list series'}),
    json: true
  }, this._parseCallback(function(err, results) {
    if(err) {
      return callback(err, results);
    }
    return callback(err, _.map(results[0].points, function(series) { return series[1]; }));
  }));
};


InfluxDB.prototype.getUsers = function(databaseName, callback) {
  this.request.get({
    url: this.url('db/' + databaseName + '/users'),
    json: true
  }, this._parseCallback(callback));
};

InfluxDB.prototype.getUser = function(databaseName, username, callback) {
  this.request.get({
    url: this.url('db/' + databaseName + '/users/' + username),
    json: true
  }, this._parseCallback(callback));
};

InfluxDB.prototype.createUser = function(databaseName, username, password, callback) {
  this.request.post({
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

InfluxDB.prototype.updateUser = function (databaseName, userName, options, callback)
{
  this.request.post({
    url: this.url('db/' + databaseName + '/users/' + userName),
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(options, null)
  }, this._parseCallback(callback));
};

InfluxDB.prototype.writeSeries = function(series, options, callback) {
  if(typeof options === 'function') {
    callback = options;
    options  = {};
  }
  if ('undefined' === typeof options) options = {};

  var query = options.query || {};
  var data = [];

  _.each(series, function(dataPoints, seriesName) {
    var datum = { points: [], name: seriesName, columns: [] };
    // Collect column names first
    var columns = {};
    _.each(dataPoints, function(values) {
      _.each(values, function(_, k) {
        columns[k] = true;
      });
    });
    datum.columns = _.keys(columns);
    // Add point values with null where needed
    _.each(dataPoints, function(values) {
      var point = [];
      _.each(datum.columns, function(k) {
        var v = typeof values[k] === 'undefined' ? null : values[k];
        if(k === 'time' && v instanceof Date) {
          v = v.valueOf();
          query.time_precision = 'ms';
        }
        point.push(v);
      });
      datum.points.push(point);
    });
    data.push(datum);
  });

  this.request.post({
    url: this.seriesUrl(options.database,query),
    headers: {
      'content-type': 'application/json'
    },
    pool : 'undefined' !== typeof options.pool ? options.pool : {},
    body: JSON.stringify(data)
  }, this._parseCallback(callback));
};

InfluxDB.prototype.writePoint = function(seriesName, values, options, callback) {
  var data = {};
  data[seriesName] = [values];
  this.writeSeries(data, options, callback);
};

InfluxDB.prototype.writePoints = function(seriesName, points, options, callback) {
  var data = {};
  data[seriesName] = points;
  this.writeSeries(data, options, callback);
};

InfluxDB.prototype.query = function(query, callback) {
  this.request.get({
    url: this.url('db/' + this.options.database + '/series', { q: query }),
    json: true
  }, this._parseCallback(callback));
};

InfluxDB.prototype.dropSeries  = function(databaseName, seriesName, callback) {
  if ('function' === typeof seriesName)
  {
    callback=seriesName;
    seriesName = databaseName;
    databaseName = this.options.database;
  }
  this.request.get({
    url: this.url('db/' + databaseName + '/series/' + seriesName),
    method : 'DELETE',
    json: true
  }, this._parseCallback(callback));
};

InfluxDB.prototype.getContinuousQueries = function(databaseName,callback)
{
  if ('function' === typeof databaseName)
  {
    callback = databaseName;
    databaseName = this.options.database;
  }
  this.request.get({
    url: this.url('db/' + databaseName + '/series', { q: 'list continuous queries' }),
    json: true
  }, this._parseCallback(callback));
};


InfluxDB.prototype.dropContinuousQuery  = function(databaseName, queryID, callback) {
  if ('function' === typeof queryID)
  {
    callback=queryID;
    queryID = databaseName;
    databaseName = this.options.database;
  }
  this.request.get({
    url: this.url('db/' + databaseName + '/series', { q: 'drop continuous query '+queryID }),
    json: true
  }, this._parseCallback(callback));
};


InfluxDB.prototype.getShardSpaces = function(databaseName, callback) {
  if ('function' === typeof databaseName) {
    callback = databaseName;
    databaseName = this.options.database;
  }
  this.request.get({
    url: this.url('cluster/shard_spaces'),
    json: true
  }, this._parseCallback(function(err, shards) {
    if (err) return callback(err, shards);
    callback(null, _.where(shards, {database: databaseName}));
  }));
};


InfluxDB.prototype.createShardSpace = function(databaseName, shardSpace, callback) {
  if ('function' === typeof shardSpace) {
    callback = shardSpace;
    shardSpace = databaseName;
    databaseName = this.options.database;
  }
  this.request.post({
    url: this.url('cluster/shard_spaces/' + databaseName),
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(shardSpace, null)
  }, this._parseCallback(callback));
};


InfluxDB.prototype.updateShardSpace = function(databaseName, shardSpaceName, options, callback) {
  if ('function' === typeof options) {
    callback = options;
    options = shardSpaceName;
    shardSpaceName = databaseName;
    databaseName = this.options.database;
  }
  this.request.post({
    url: this.url('cluster/shard_spaces/' + databaseName + '/' + shardSpaceName),
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(options, null)
  }, this._parseCallback(callback));
};


InfluxDB.prototype.deleteShardSpace = function(databaseName, shardSpaceName, callback) {
  if ('function' === typeof shardSpaceName) {
    callback = shardSpaceName;
    shardSpaceName = databaseName;
    databaseName = this.options.database;
  }
  this.request.get({
    method: 'DELETE',
    url: this.url('cluster/shard_spaces/' + databaseName + '/' + shardSpaceName)
  }, this._parseCallback(callback));
};


InfluxDB.prototype.seriesUrl  = function(databaseName,query) {
  if ( !databaseName ) databaseName = this.options.database;
  return this.url('db/' + databaseName + '/series',query);
};

InfluxDB.prototype.getHostsAvailable = function()
{
  return this.request.getHostsAvailable();
};

InfluxDB.prototype.getHostsDisabled = function()
{
  return this.request.getHostsDisabled();
};

var createClient = function() {
  var args = arguments;
  var Client = function () { return InfluxDB.apply(this, args); };
  Client.prototype = InfluxDB.prototype;
  return new Client();
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
module.exports.defaultOptions = defaultOptions;
