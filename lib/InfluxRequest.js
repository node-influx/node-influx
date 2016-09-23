var got = require('got')
var _ = require('lodash')
var url = require('url')

var resubmitErrorCodes = ['ETIMEDOUT', 'ESOCKETTIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EHOSTUNREACH']

function InfluxRequest (options) {
  if (!options) options = {}
  this.index = 0
  this.hostsAvailable = []
  this.hostsDisabled = []
  this.defaultRequestOptions = {
    timeout: null
  }
  this.setRequestTimeout(options.requestTimeout)
  // our custom options
  this.options = {
    failoverTimeout: options.failoverTimeout || 60000,
    maxRetries: options.maxRetries || 2
  }
}

InfluxRequest.prototype.setFailoverTimeout = function (value) {
  this.options.failoverTimeout = value
  return value
}

InfluxRequest.prototype.setRequestTimeout = function (value) {
  this.defaultRequestOptions.timeout = value
  return value
}

InfluxRequest.prototype.getHostsAvailable = function () {
  return this.hostsAvailable
}

InfluxRequest.prototype.getHostsDisabled = function () {
  return this.hostsDisabled
}

InfluxRequest.prototype.addHost = function (hostname, port, protocol) {
  this.hostsAvailable.push({
    name: hostname,
    port: port,
    protocol: protocol,
    available: true,
    timeout: 0
  })
}

InfluxRequest.prototype.hostIsAvailable = function () {
  return !!this.hostsAvailable[this.index]
}

InfluxRequest.prototype.getHost = function () {
  var host = this.hostsAvailable[this.index]
  ++this.index
  this.checkIndex()
  return host
}

InfluxRequest.prototype.checkIndex = function () {
  if (this.index >= this.hostsAvailable.length) {
    this.index = 0
  }
}

InfluxRequest.prototype.filterHosts = function (hosts, host) {
  return _.filter(hosts, function (aHost) {
    return !(aHost.name === host.name && aHost.port === host.port)
  })
}

InfluxRequest.prototype.enableHost = function (host) {
  this.hostsDisabled = this.filterHosts(this.hostsDisabled, host)
  this.hostsAvailable.push(host)
}

InfluxRequest.prototype.disableHost = function (host) {
  var self = this
  this.hostsAvailable = this.filterHosts(this.hostsAvailable, host)
  this.hostsDisabled.push(host)
  this.checkIndex()
  setTimeout(function () {
    self.enableHost(host)
  }, this.options.failoverTimeout)
}

InfluxRequest.prototype.url = function (host, path) {
  return url.format({
    protocol: host.protocol,
    hostname: host.name,
    port: host.port
  }) + '/' + path
}

InfluxRequest.prototype._request = function (options, callback) {
  var self = this
  var host = this.getHost()

  if (!host) {
    return callback(new Error('No host available'))
  }

  var requestOptions = _.extend({retries: 0, host: host}, this.defaultRequestOptions, options)

  // need to store the original path, in case we need to re-submit the request onError and change the host
  if (!requestOptions.originalUrl) requestOptions.originalUrl = requestOptions.url
  requestOptions.url = this.url(host, requestOptions.originalUrl)
  requestOptions.retries++  // TODO request() would ignore the `.retries` option (which is needed by _parseErrorCallback), but got() does have a 'retries' option
  got(requestOptions.url, requestOptions).then(function (response) {
    return callback(null, response, response.body)
  }).catch(function (error) {
    if (resubmitErrorCodes.indexOf(error.code) !== -1) {
      self.disableHost(requestOptions.host)
      if (self.options.maxRetries >= requestOptions.retries && self.hostIsAvailable()) {
        return self._request(requestOptions, callback)
      }
    }
    return callback(error)
  })
}

InfluxRequest.prototype.get = function (options, callback) {
  this._request(options, callback)
}

InfluxRequest.prototype.post = function (options, callback) {
  options.method = 'POST'
  this._request(options, callback)
}

module.exports = InfluxRequest
