'use strict'

const Host = require('./host')
const Backoffs = require('./backoff')
const request = require('request')
const url = require('url')
const _ = require('lodash')

/**
 * Status codes that will cause a host to be marked as "failed" if we get
 * them from a request to Influx.
 * @type {Array}
 */
const resubmitErrorCodes = [
  'ETIMEDOUT',
  'ESOCKETTIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'EHOSTUNREACH'
]

/**
 *
 * The Pool maintains a list available Influx hosts and dispatches requests
 * to them. If there are errors connecting to hosts, it will disable that
 * host for a period of time.
 */
class Pool {
  /**
   * Creates a new Pool instance.
   * @param {Object} options
   * @param {Object} [options.failoverTimeout=60000] the length of time a
   * host should be removed for upon a connection error
   * @param {Number} [options.maxRetries=2] number of times we should retry
   * running a query before calling back with an error
   * @param {Object} [options.requestTimeout=30000] the length of time after
   * which HTTP requests will error if they do not receive a response
   * @param {Function} [options.request] function called to make an HTTP
   * request, defaults to the `request` module
   * @param {Object} [options.backoff] configuration for the backoff strategy
   * used when connections fail. It contains a `kind` with other config
   * data for the specific kind.
   * @param {String} [options.backoff.kind] the name of the backoff strategy
   * used.
   */
  constructor (options) {
    this.options = _.defaults(options, {
      failoverTimeout: 60 * 1000,
      requestTimeout: 30 * 1000,
      maxRetries: 2,
      request: request,
      backoff: {
        kind: 'exponential',
        initial: 300,
        random: 1,
        max: 10 * 1000
      }
    })

    this.index = 0
    this.hostsAvailable = []
    this.hostsDisabled = []
    this.defaultRequestOptions = { timeout: this.options.requestTimeout }
  }

  /**
   * Sets the length of time a host should be removed from the pool for
   * if we get a connection error to it.
   * @param {Number} value given in milliseconds
   * @return {Number}
   */
  setFailoverTimeout (value) {
    this.options.failoverTimeout = value
    return value
  }

  /**
   * Sets the length of time after which HTTP requests will error if they
   * do not receive a response.
   * @param  {Number} value given in milliseconds
   * @return {Number}
   */
  setRequestTimeout (value) {
    this.defaultRequestOptions.timeout = value
    return value
  }

  /**
   * Returns a list of currently active hosts.
   * @return {Host[]}
   */
  getHostsAvailable () {
    return this.hostsAvailable
  }

  /**
   * Returns a list of hosts that are currently disabled due to network
   * errors.
   * @return {Host[]}
   */
  getHostsDisabled () {
    return this.hostsDisabled
  }

  /**
   * Inserts a new host to the pool.
   * @param  {String} hostname
   * @param  {Number} port
   * @param  {String} protocol either "http" or "https"
   * @return {Host}
   */
  addHost (hostname, port, protocol) {
    const hostUrl = url.format({
      protocol: host.protocol,
      hostname: host.name,
      port: host.port
    })
    const bconfig = this.options.backoff
    const backoff = new Backoffs[bconfig.kind](bconfig)

    const host = new Host(hostUrl, backoff)
    this.hostsAvailable.push(host)
    return host
  }

  /**
   * Returns true if there's any host available to by queried.
   * @return {Boolean}
   */
  hostIsAvailable () {
    return !!this.hostsAvailable[this.index]
  }

  /**
   * Returns the next available host for querying.
   * @return {Host}
   */
  getHost () {
    const available = this.hostsAvailable
    const host = available[this.index]
    this.index = (this.index + 1) % available.length
    return host
  }

  /**
   * Re-enables the provided host, returning it to the pool to query.
   * @param  {Host} host
   */
  enableHost (host) {
    _.remove(this.hostsDisabled, host)
    this.hostsAvailable.push(host)
  }

  /**
   * Disables the provided host, removing it from the query pool. It will be
   * re-enabled after a backoff interval
   * @param  {Host} host
   */
  disableHost (host) {
    _.remove(this.hostsAvailable, host)
    this.hostsDisabled.push(host)
    this.index %= this.hostsAvailable.length

    setTimeout(() => this.enableHost(host), host.backoff())
  }

  _request (options, callback) {
    if (!this.hostIsAvailable) {
      return callback(new Error('No host available'))
    }

    const host = this.getHost()
    const requestOptions = _.assign({ retries: 0 }, this.defaultRequestOptions, options)

    requestOptions.baseUrl = host.url
    requestOptions.retries++
    this.options.request(requestOptions, (err, response, body) => {
      if (!err) {
        host.success()
        return callback(err, response, body)
      }

      this._handleRequestError(err, host, requestOptions, callback)
    })
  }

  _handleRequestError (err, host, requestOptions, callback) {
    if (resubmitErrorCodes.indexOf(err.code) !== -1) {
      this.disableHost(host)
      if (this.options.maxRetries >= requestOptions.retries && this.hostIsAvailable()) {
        return this._request(requestOptions, callback)
      }
    }

    return callback(err)
  }

  /**
   * Runs a GET request against an Influx server.
   * @param  {Object}   options  options for the `request` library. Note that
   * the baseUrl for the host will be set automatically.
   * @param  {Function} callback
   */
  get (options, callback) {
    this._request(options, callback)
  }

  /**
   * Runs a POST request against an Influx server.
   * @param  {Object}   options  options for the `request` library. Note that
   * the baseUrl for the host will be set automatically.
   * @param  {Function} callback
   */
  post (options, callback) {
    options.method = 'POST'
    this._request(options, callback)
  }
}

module.exports = Pool
