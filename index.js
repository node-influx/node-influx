var InfluxRequest = require('./lib/InfluxRequest.js')
var url = require('url')
var _ = require('lodash')

var defaultOptions = {
  hosts: [],
  disabled_hosts: [],
  username: 'root',
  password: 'root',
  port: 8086,
  protocol: 'http',
  depreciatedLogging: (process.env.NODE_ENV === undefined || 'development') ? console.log : false,
  failoverTimeout: 60000,
  requestTimeout: null,
  maxRetries: 2,
  timePrecision: 'ms'
}

var InfluxDB = function (options) {
  this.options = _.extend(_.clone(defaultOptions), options)

  this.request = new InfluxRequest({
    failoverTimeout: this.options.failoverTimeout,
    maxRetries: this.options.maxRetries,
    requestTimeout: this.options.requestTimeout
  })

  if ((!_.isArray(this.options.hosts) || this.options.hosts.length === 0) && typeof this.options.host === 'string') {
    this.request.addHost(this.options.host, this.options.port, this.options.protocol)
  }
  if (_.isArray(this.options.hosts) && this.options.hosts.length > 0) {
    var self = this
    _.each(this.options.hosts, function (host) {
      var port = host.port || self.options.port
      var protocol = host.protocol || self.options.protocol
      self.request.addHost(host.host, port, protocol)
    })
  }

  return this
}

InfluxDB.prototype._parseResults = function (response, callback) {
  var results = []
  _.each(response, function (result) {
    var tmp = []
    if (result.series) {
      _.each(result.series, function (series) {
        var rows = _.map(series.values, function (values) {
          return _.extend(_.zipObject(series.columns, values), series.tags)
        })
        tmp = _.chain(tmp).concat(rows).sort('time').value()
      })
    }
    results.push(tmp)
  })
  return callback(null, results)
}

InfluxDB.prototype._parseCallback = function (callback) {
  return function (err, res, body) {
    if (typeof callback === 'undefined') return
    if (err) {
      return callback(err)
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      return callback(new Error(body))
    }

    if (_.isObject(body) && body.results && _.isArray(body.results)) {
      for (var i = 0;i <= body.results.length;++i) {
        if (body.results[i] && body.results[i].error && body.results[i].error !== '') {
          return callback(new Error(body.results[i].error))
        }
      }
    }
    return callback(null, body.results)
  }
}

InfluxDB.prototype.setRequestTimeout = function (value) {
  return this.request.setRequestTimeout(value)
}

InfluxDB.prototype.setFailoverTimeout = function (value) {
  return this.request.setFailoverTimeout(value)
}

// possible options:
// {db: databaseName,  rp: retentionPolicy, precision: timePrecision}
InfluxDB.prototype.url = function (endpoint, options, query) {
  // prepare the query object
  var queryObj = _.extend({
    u: this.options.username,
    p: this.options.password
  }, options || {}, query || {})

  // add the global configuration if they are set and not provided by the options
  if (this.options.timePrecision && !queryObj.precision) {
    queryObj.precision = this.options.timePrecision
  }
  if (this.options.database && !queryObj.db) {
    queryObj.db = this.options.database
  }
  if (this.options.retentionPolicy && !queryObj.rp) {
    queryObj.rp = this.options.retentionPolicy
  }

  return url.format({
    pathname: endpoint,
    query: queryObj
  })
}

// Prepares and sends the actual request
InfluxDB.prototype.queryDB = function (query, options, callback) {
  if (typeof options === 'function') {
    callback = options
    options = undefined
  }

  this.request.get({
    url: this.url('query', options, {q: query}),
    json: true
  }, this._parseCallback(callback))
}

// creates a new database
InfluxDB.prototype.createDatabase = function (databaseName, callback) {
  this.queryDB('create database "' + databaseName + '"', callback)
}

InfluxDB.prototype.dropDatabase = function (databaseName, callback) {
  this.queryDB('drop database "' + databaseName + '"', callback)
}

InfluxDB.prototype.getDatabaseNames = function (callback) {
  this.queryDB('show databases', function (err, results) {
    if (err) {
      return callback(err, results)
    }
    return callback(err, _.map(results[0].series[0].values, function (dbarray) {return dbarray[0]}))
  })
}

InfluxDB.prototype.getMeasurements = function (callback) {
  this.queryDB('show measurements', callback)
}

InfluxDB.prototype.getSeriesNames = function (measurementName, callback) {
  var query = 'show series'

  // if no measurement name is given
  if (typeof measurementName === 'function') {
    callback = measurementName
  } else {
    query = query + ' from "' + measurementName + '"'
  }

  this.queryDB(query, function (err, results) {
    if (err) {
      return callback(err, results)
    }
    return callback(err, _.map(results[0].series, function (series) {return series.name}))
  })

}

InfluxDB.prototype.getSeries = function (measurementName, callback) {
  var query = 'show series'

  // if no measurement name is given
  if (typeof measurementName === 'function') {
    callback = measurementName
  } else {
    query = query + ' from "' + measurementName + '"'
  }

  this.queryDB(query, function (err, results) {
    if (err) {
      return callback(err, results)
    }
    return callback(err, results[0].series)
  })

}

InfluxDB.prototype.dropMeasurement = function (measurementName, callback) {
  this.queryDB('drop measurement "' + measurementName + '"', callback)
}

InfluxDB.prototype.dropSeries = function (seriesId, callback) {
  this.queryDB('drop series ' + seriesId, callback)
}

InfluxDB.prototype.getUsers = function (callback) {
  var self = this

  this.queryDB('show users', function (err, results) {
    if (err) {
      return callback(err, results)
    }
    return self._parseResults(results, function (err, results) {
      return callback(err, results[0])
    })
  // return callback(err, results[0].series[0].values)
  })
}

InfluxDB.prototype.createUser = function (username, password, isAdmin, callback) {
  if (typeof isAdmin === 'function') {
    callback = isAdmin
    isAdmin = false
  }
  var query = 'create user "' + username + '" with password \'' + password + "'"
  if (isAdmin) {
    query += ' with all privileges'
  }
  this.queryDB(query, callback)
}

InfluxDB.prototype.setPassword = function (username, password, callback) {
  this.queryDB('set password for "' + username + '" = \'' + password + "'", callback)
}

InfluxDB.prototype.grantPrivilege = function (privilege, databaseName, userName, callback) {
  this.queryDB('grant ' + privilege + ' on "' + databaseName + '" to "' + userName + '"', callback)
}

InfluxDB.prototype.revokePrivilege = function (privilege, databaseName, userName, callback) {
  this.queryDB('revoke ' + privilege + ' on "' + databaseName + '" from "' + userName + '"', callback)
}

InfluxDB.prototype.grantAdminPrivileges = function (userName, callback) {
  this.queryDB('grant all privileges to "' + userName + '"', callback)
}

InfluxDB.prototype.revokeAdminPrivileges = function (userName, callback) {
  this.queryDB('revoke all privileges from "' + userName + '"', callback)
}

InfluxDB.prototype.dropUser = function (username, callback) {
  this.queryDB('drop user "' + username + '"', callback)
}

InfluxDB.prototype._createKeyValueString = function (object) {
  return _.map(object, function (value, key) {
    if(typeof value === 'string') {
      return key + '="' + value + '"'
    } else {
      return key + '=' + value
    }
  }).join(',')
}

InfluxDB.prototype._createKeyTagString = function (object) {
  return _.map(object, function (value, key) {
    return key + '=' + value
  }).join(',')
}

InfluxDB.prototype._prepareValues = function (series) {
  var output = []
  _.forEach(series, function (values, seriesName) {
    _.each(values, function (points) {
      var line = seriesName
      if (points[1] && _.isObject(points[1]) && _.keys(points[1]).length > 0) {
        line += ',' + this._createKeyTagString(points[1])
      }

      if (_.isObject(points[0])) {
        var timestamp = null
        if (points[0].time) {
          timestamp = points[0].time
          delete (points[0].time)
        }
        line += ' ' + this._createKeyValueString(points[0])
        if (timestamp) {
          if (timestamp instanceof Date) {
            line += ' ' + timestamp.getTime()
          } else {
            line += ' ' + timestamp
          }
        }
      } else {
        if(typeof points[0] === 'string') {
          line += ' value="' + points[0] + '"'
        } else {
          line += ' value=' + points[0]
        }
      }
      output.push(line)
    }, this)
  }, this)
  return output.join('\n')
}

InfluxDB.prototype.writeSeries = function (series, options, callback) {
  if (typeof options === 'function') {
    callback = options
    options = {}
  }

  if (!options.database) {
    options.database = this.options.database
  }

  if (!options.precision) {
    options.precision = this.options.timePrecision
  }

  this.request.post({
    url: this.url('write', options),
    pool: typeof options.pool !== 'undefined' ? options.pool : {},
    body: this._prepareValues(series)
  }, this._parseCallback(callback))
}

InfluxDB.prototype.writePoint = function (seriesName, values, tags, options, callback) {
  if (typeof options === 'function') {
    callback = options
    options = {}
  }
  var data = {}
  data[seriesName] = [[values, tags]]
  this.writeSeries(data, options, callback)
}

InfluxDB.prototype.writePoints = function (seriesName, points, options, callback) {
  if (typeof options === 'function') {
    callback = options
    options = {}
  }
  var data = {}
  data[seriesName] = points
  this.writeSeries(data, options, callback)
}

InfluxDB.prototype.query = function (databaseName, query, callback) {
  if (typeof query === 'function') {
    callback = query
    query = databaseName
    databaseName = this.options.database
  }
  var self = this

  this.queryDB(query, {db: databaseName}, function (err, results) {
    if (err) {
      return callback(err, results)
    }
    return self._parseResults(results, function (err, results) {
      return callback(err, results)
    })
  })
}

InfluxDB.prototype.queryRaw = function (databaseName, query, callback) {
  if (typeof query === 'function') {
    callback = query
    query = databaseName
    databaseName = this.options.database
  }
  this.queryDB(query, {db: databaseName}, callback)
}

InfluxDB.prototype.createContinuousQuery = function (queryName, queryString, databaseName, callback) {
  if (typeof databaseName === 'function') {
    callback = databaseName
    databaseName = this.options.database
  }

  var query = 'CREATE CONTINUOUS QUERY ' + queryName + ' ON ' + databaseName + ' BEGIN ' +
    queryString +
    ' END'
  this.queryDB(query, callback)
}

InfluxDB.prototype.getContinuousQueries = function (callback) {
  var self = this
  this.queryDB('SHOW CONTINUOUS QUERIES', function (err, result) {
    if (err) return callback(err)
    self._parseResults(result, callback)
  })
}

InfluxDB.prototype.dropContinuousQuery = function (queryName, databaseName, callback) {
  if (typeof databaseName === 'function') {
    callback = databaseName
    databaseName = this.options.database
  }
  this.queryDB('DROP CONTINUOUS QUERY "' + queryName + '" ON "' + databaseName + '"', callback)
}

InfluxDB.prototype.createRetentionPolicy = function (rpName, databaseName, duration, replication, isDefault, callback) {
  var query = 'create retention policy "' + rpName +
    '" on "' + databaseName +
    '" duration ' + duration +
    ' replication ' + replication
  if (isDefault) {
    query += ' default'
  }

  this.queryDB(query, callback)
}

InfluxDB.prototype.getRetentionPolicies = function (databaseName, callback) {
  this.queryDB('show retention policies "' + databaseName + '"', callback)
}

InfluxDB.prototype.alterRetentionPolicy = function (rpName, databaseName, duration, replication, isDefault, callback) {
  var query = 'alter retention policy "' + rpName +
    '" on "' + databaseName + '"'
  if (duration) {
    query += ' duration ' + duration
  }
  if (replication) {
    query += ' replication ' + replication
  }
  if (isDefault) {
    query += ' default'
  }

  this.queryDB(query, callback)
}

InfluxDB.prototype.getHostsAvailable = function () {
  return this.request.getHostsAvailable()
}

InfluxDB.prototype.getHostsDisabled = function () {
  return this.request.getHostsDisabled()
}

var createClient = function () {
  var args = arguments
  var Client = function () { return InfluxDB.apply(this, args) }
  Client.prototype = InfluxDB.prototype
  return new Client()
}

module.exports = createClient
module.exports.InfluxDB = InfluxDB
module.exports.defaultOptions = defaultOptions
