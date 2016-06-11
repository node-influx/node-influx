'use strict'

const Backoffs = require('./backoff')
const Host = require('./host')
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
 * @typedef {Object} PoolOptions an options object passed to instantiate
 *     or configure a pool of Influx connections.
 * @param {Object} [options.failoverTimeout=60000] the length of time a
 *     host should be removed for upon a connection error
 * @param {Number} [options.maxRetries=2] number of times we should retry
 *     running a query before calling back with an error
 * @param {Object} [options.requestTimeout=30000] the length of time after
 *     which HTTP requests will error if they do not receive a response
 * @param {Function} [options.request] function called to make an HTTP
 *     request, defaults to the `request` module
 * @param {Object} [options.backoff] configuration for the backoff strategy
 *     used when connections fail. It contains a `kind` with other config
 *     data for the specific kind.
 * @param {String} [options.backoff.kind] the name of the backoff strategy
 *     used.
 */

/**
 *
 * The Pool maintains a list available Influx hosts and dispatches requests
 * to them. If there are errors connecting to hosts, it will disable that
 * host for a period of time.
 */
class Pool {

  /**
   * Creates a new Pool instance.
   * @param {PoolOptions} options
   */
  constructor (options) {
    this.options = _.defaults(options, {
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

    this._index = 0
    this._hostsAvailable = []
    this._hostsDisabled = []
    this._defaultRequestOptions = { timeout: this.options.requestTimeout }
  }

  /**
   * Sets the length of time after which HTTP requests will error if they
   * do not receive a response.
   * @param  {Number} value given in milliseconds
   * @return {Number}
   */
  setRequestTimeout (value) {
    this._defaultRequestOptions.timeout = value
    return value
  }

  /**
   * Returns a list of currently active hosts.
   * @return {Host[]}
   */
  getHostsAvailable () {
    return this._hostsAvailable.slice()
  }

  /**
   * Returns a list of hosts that are currently disabled due to network
   * errors.
   * @return {Host[]}
   */
  getHostsDisabled () {
    return this._hostsDisabled.slice()
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
      protocol,
      hostname,
      port
    })
    const bconfig = this.options.backoff
    const backoff = new Backoffs[bconfig.kind](bconfig)

    const host = new Host(hostUrl, backoff)
    this._hostsAvailable.push(host)
    return host
  }

  /**
   * Returns true if there's any host available to by queried.
   * @return {Boolean}
   */
  hostIsAvailable () {
    return !!this._hostsAvailable[this._index]
  }

  /**
   * Returns the next available host for querying.
   * @return {Host}
   */
  getHost () {
    const available = this._hostsAvailable
    const host = available[this._index]
    this._index = (this._index + 1) % available.length
    return host
  }

  /**
   * Re-enables the provided host, returning it to the pool to query.
   * @param  {Host} host
   */
  enableHost (host) {
    _.remove(this._hostsDisabled, host)
    this._hostsAvailable.push(host)
  }

  /**
   * Disables the provided host, removing it from the query pool. It will be
   * re-enabled after a backoff interval
   * @param  {Host} host
   */
  disableHost (host) {
    _.remove(this._hostsAvailable, host)
    this._hostsDisabled.push(host)
    this._index %= Math.max(1, this._hostsAvailable.length)

    setTimeout(() => this.enableHost(host), host.fail())
  }

  /**
   * Runs a request
   * @param  {Object}   options
   * @param  {Function} callback
   */
  _request (options, callback) {
    if (!this.hostIsAvailable()) {
      return callback(new ServiceNotAvailableError('No host available'))
    }

    const host = this.getHost()
    const requestOptions = _.assign({ retries: 0 }, this._defaultRequestOptions, options)

    requestOptions.baseUrl = host.url
    requestOptions.retries++

    this.options.request(requestOptions, (err, response, body) => {
      // Resolve an error if we get a >500 status code. Note that we *exclude*
      // 500 error codes. Sometimes malformed queries to influx cause panics,
      // and trying to retry those queries on other hosts would just lead
      // to a domino effect of crashing servers.
      if (!err && response.statusCode > 500) {
        err = new ServiceNotAvailableError(response.statusMessage)
      }

      if (!err) {
        host.success()
        return callback(err, response, body)
      }

      this._handleRequestError(err, host, requestOptions, callback)
    })
  }

  _handleRequestError (err, host, requestOptions, callback) {
    if (resubmitErrorCodes.indexOf(err.code) !== -1 || err instanceof ServiceNotAvailableError) {
      this.disableHost(host)
      if (this.options.maxRetries >= requestOptions.retries && this.hostIsAvailable()) {
        return this._request(requestOptions, callback)
      }
    }

    return callback(err)
  }

  /**
   * Runs a GET request against an Influx server.
   * @param {Object} options  options for the `request` library. Note that
   *     the baseUrl for the host will be set automatically.
   * @param {Function} callback
   */
  get (options, callback) {
    this._request(options, callback)
  }

  /**
   * Runs a POST request against an Influx server.
   * @param {Object} options  options for the `request` library. Note that
   *      baseUrl for the host will be set automatically.
   * @param {Function} callback
   */
  post (options, callback) {
    options.method = 'POST'
    this._request(options, callback)
  }
}

/**
 * An ServiceNotAvailableError is returned as an error from requests that
 * result in a > 500 error code.
 */
class ServiceNotAvailableError extends Error {
}

module.exports = Pool
module.exports.ServiceNotAvailableError = ServiceNotAvailableError
