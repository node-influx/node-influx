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

/**
 * Backslash-escape commas, equal signs and spaces per
 * https://docs.influxdata.com/influxdb/v1.0/write_protocols/line_protocol_tutorial/#special-characters-and-keywords
 * @param {string} s
 * @returns {string}
 */
function escape (s) {
  return s.replace(/[,= ]/g, '\\$&')
}

function parseOptionsUrl (url_) {
  var parsed = url.parse(url_)

  var options = {
    host: parsed.hostname,
    port: parsed.port,
    protocol: parsed.protocol
  }

  if (parsed.auth) {
    var authSplit = parsed.auth.split(':')
    if (authSplit.length !== 2) throw new Error('Invalid authentication: ' + parsed.auth)
    options.username = authSplit[0]
    options.password = authSplit[1]
  }

  if (parsed.pathname.length > 1) options.database = parsed.pathname.slice(1)

  return options
}

/**
 * Figure out if the user passed an options object or not.
 * This only exists because we're not using ES6 default parameters.
 * @param options
 * @param callback
 * @returns {{callback: (*|_.noop), options: (*|{})}}
 */
function resolveOptCallback (options, callback) {
  if (typeof options === 'function') {
    callback = options
    options = {}
  }

  return {
    callback: callback || _.noop,
    options: options || {}
  }
}

var InfluxDB = function (options) {
  if (typeof options === 'string') options = parseOptionsUrl(options)
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
      if (typeof host === 'string') host = parseOptionsUrl(host)
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
        tmp = _.chain(tmp).concat(rows).value()
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
      var errorMessage
      if (!body) {
        errorMessage = 'No body received with status code ' + res.statusCode + ' from Influx.'
      } else if (body.error) {
        errorMessage = body.error
      } else if (typeof body === 'object') {
        errorMessage = JSON.stringify(body)
      } else {
        errorMessage = body
      }

      return callback(new Error(errorMessage))
    }

    // Look for errors in the response body
    if (_.isObject(body) && body.results && _.isArray(body.results)) {
      for (var i = 0; i <= body.results.length; ++i) {
        if (body.results[i] && body.results[i].error && body.results[i].error !== '') {
          return callback(new Error(body.results[i].error))
        }
      }
    }
    if (body === undefined) {
      return callback(new Error('body is undefined'))
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
  var args = resolveOptCallback(options, callback)

  this.request.get({
    url: this.url('query', args.options, {q: query}),
    json: true
  }, this._parseCallback(args.callback))
}

/**
 * Send a POST request. Used for commands that have side effects, e.g.
 * 'CREATE DATABASE' or 'DROP USER'. GET is now deprecated for these.
 * @param query
 * @param options
 * @param callback
 */
InfluxDB.prototype.updateDB = function (query, options, callback) {
  var args = resolveOptCallback(options, callback)

  this.request.post({
    url: this.url('query', args.options, {q: query}),
    json: true
  }, this._parseCallback(args.callback))
}

// creates a new database
InfluxDB.prototype.createDatabase = function (databaseName, callback) {
  this.updateDB('create database "' + databaseName + '"', callback)
}

InfluxDB.prototype.dropDatabase = function (databaseName, callback) {
  this.updateDB('drop database "' + databaseName + '"', callback)
}

InfluxDB.prototype.getDatabaseNames = function (callback) {
  this.queryDB('show databases', function (err, results) {
    if (err) {
      return callback(err, results)
    }

    var names = _.get(results, '[0].series[0].values')
    if (!_.isArray(names)) {
      return callback(new Error('bad response from server', results))
    }

    callback(null, names.map(function (dbarray) {
      if (_.isArray(dbarray)) {
        return dbarray[0]
      }
    }))
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

    // Influx version 0.11 changed the SHOW SERIES format. Support both versions.
    if (_.get(results[0].series[0], 'columns')) {
      results = _(results[0].series) // v0.11
        .map('values')
        .flattenDepth(2)
        .map(function (value) { return value.split(',', 1)[0] })
        .uniq()
        .value()
    } else {
      results = _.map(results[0].series, 'name') // < v0.11
    }

    return callback(err, results)
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
  this.updateDB('drop measurement "' + measurementName + '"', callback)
}

InfluxDB.prototype.dropSeries = function (seriesId, callback) {
  this.updateDB('drop series ' + seriesId, callback)
}

InfluxDB.prototype.getUsers = function (callback) {
  var self = this

  // TODO strip unused arguments from quoery. Now we have:
  // query?u=...&p=...&q=show%20users&precision=ms&db=...&rp=...
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
  this.updateDB(query, callback)
}

InfluxDB.prototype.setPassword = function (username, password, callback) {
  this.updateDB('set password for "' + username + '" = \'' + password + "'", callback)
}

InfluxDB.prototype.grantPrivilege = function (privilege, databaseName, userName, callback) {
  this.updateDB('grant ' + privilege + ' on "' + databaseName + '" to "' + userName + '"', callback)
}

InfluxDB.prototype.revokePrivilege = function (privilege, databaseName, userName, callback) {
  this.updateDB('revoke ' + privilege + ' on "' + databaseName + '" from "' + userName + '"', callback)
}

InfluxDB.prototype.grantAdminPrivileges = function (userName, callback) {
  this.updateDB('grant all privileges to "' + userName + '"', callback)
}

InfluxDB.prototype.revokeAdminPrivileges = function (userName, callback) {
  this.updateDB('revoke all privileges from "' + userName + '"', callback)
}

InfluxDB.prototype.dropUser = function (username, callback) {
  this.updateDB('drop user "' + username + '"', callback)
}

InfluxDB.prototype._createKeyValueString = function (object) {
  var output = []
  var clone = _.clone(object)
  delete clone.time
  _.forOwn(clone, function (value, key) {
    if (typeof value === 'string') {
      output.push(escape(key) + '="' + value.replace(/"/g, '\\"') + '"')  // For string field values use a backslash character to escape double quotes
    } else {
      output.push(escape(key) + '=' + value)
    }
  })
  return output.join(',')
}

/**
 * Return a sorted string of comma-separated key=value tags, with escaped values
 * @param object
 * @returns {string}
 * @private
 */
InfluxDB.prototype._createKeyTagString = function (object) {
  var output = []
  _.forOwn(object, function (value, key) {
    if (typeof value === 'string') {
      output.push(escape(key) + '=' + escape(value))
    } else {
      output.push(escape(key) + '=' + value)
    }
  })
  // "For best performance you should sort tags by key before sending them to the database."
  return output.sort().join(',')
}

InfluxDB.prototype._prepareValues = function (series) {
  var self = this
  var output = []
  _.forEach(series, function (fields, seriesName) {
    _.each(fields, function (points) {
      var line = seriesName.replace(/ /g, '\\ ').replace(/,/g, '\\,')
      if (points[1] && _.isObject(points[1]) && _.keys(points[1]).length > 0) {
        line += ',' + self._createKeyTagString(points[1])
      }

      if (_.isObject(points[0])) {
        var timestamp = null
        if (points[0].time) {
          timestamp = points[0].time
        }
        line += ' ' + self._createKeyValueString(points[0])
        if (timestamp) {
          if (timestamp instanceof Date) {
            line += ' ' + timestamp.getTime()
          } else if (/^[0-9]+$/.test(timestamp)) {
            line += ' ' + timestamp  // UNIX timestamp
          } else {
            line += ' ' + new Date(timestamp).getTime()  // hopefully an RFC3339 string
          }
        }
      } else {
        if (typeof points[0] === 'string') {
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
  var args = resolveOptCallback(options, callback)

  if (!args.options.database) {
    args.options.database = this.options.database
  }

  if (!args.options.precision) {
    args.options.precision = this.options.timePrecision
  }

  this.request.post({
    url: this.url('write', args.options),
    pool: typeof args.options.pool !== 'undefined' ? args.options.pool : undefined,
    body: this._prepareValues(series)
  }, this._parseCallback(args.callback))
}

InfluxDB.prototype.writePoint = function (seriesName, fields, tags, options, callback) {
  this.writePoints(seriesName, [[fields, tags]], options, callback)
}

InfluxDB.prototype.writePoints = function (seriesName, points, options, callback) {
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

  var query = 'CREATE CONTINUOUS QUERY ' + queryName + ' ON "' + databaseName + '" BEGIN ' +
    queryString +
    ' END'
  this.updateDB(query, callback)
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
  this.updateDB('DROP CONTINUOUS QUERY "' + queryName + '" ON "' + databaseName + '"', callback)
}

InfluxDB.prototype.createRetentionPolicy = function (rpName, databaseName, duration, replication, isDefault, callback) {
  var query = 'create retention policy "' + rpName +
    '" on "' + databaseName +
    '" duration ' + duration +
    ' replication ' + replication
  if (isDefault) {
    query += ' default'
  }

  this.updateDB(query, callback)
}

InfluxDB.prototype.getRetentionPolicies = function (databaseName, callback) {
  this.queryDB('show retention policies on "' + databaseName + '"', callback)
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

  this.updateDB(query, callback)
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
