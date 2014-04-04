
var request = require('request');
var url     = require('url');
var _       = require('underscore');

var InfluxDB = function(host, port, username, password, database, logFunction) {

  this.options = {
    host                : host     || 'localhost',
    port                : port     || 8086,
    username            : username || 'root',
    password            : password || 'root',
    database            : database,
    depreciatedLogging  : ((process.env.NODE_ENV === undefined || 'development') || logFunction)
                          ? logFunction || console.log : false
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
    }, null)
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
    // if database defined on connection level use it unless overwritten
    if ( this.options.database && typeof databaseName == "function" ) {
      callback = databaseName;
      databaseName = this.options.database;
    }

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

InfluxDB.prototype.updateUser = function (databaseName, userName, options, callback)
{
    request.post({
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
          query.time_precision = 'm';
        }
        point.push(v);
      });
      datum.points.push(point);
    });
    data.push(datum);
  });

  request.post({
    uri: this.seriesUrl(this.options.database),
    headers: {
      'content-type': 'application/json'
    },
    pool : 'undefined' != typeof options.pool ? options.pool : {},
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
  request({
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
    request({
        url: this.url('db/' + databaseName + '/series/' + seriesName),
        method : 'DELETE',
        json: true
    }, this._parseCallback(callback));
};

InfluxDB.prototype.getContinuousQueries = function(databaseName,callback)
{
    if ('function' === typeof databaseName)
    {
        callback=databaseName;
        databaseName = this.options.database;
    }
    request({
        url: this.url('db/' + databaseName + '/continuous_queries'),
        json: true
    }, this._parseCallback(callback));
}


InfluxDB.prototype.dropContinuousQuery  = function(databaseName, queryID, callback) {
    if ('function' === typeof queryID)
    {
        callback=queryID;
        queryID = databaseName;
        databaseName = this.options.database;
    }
    request({
        url: this.url('db/' + databaseName + '/continuous_queries/' + queryID ),
        method : 'DELETE',
        json: true
    }, this._parseCallback(callback));
};

// legacy function
InfluxDB.prototype.readPoints = function(query, callback) {
    if (this.options.depreciatedLogging) this.options.depreciatedLogging('influx.readPoints() has been depreciated, please use influx.query()');
    this.query(query,callback);
};

InfluxDB.prototype.seriesUrl  = function(databaseName) {
  if ( !databaseName ) databaseName = this.options.database;
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