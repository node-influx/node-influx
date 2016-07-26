import Host from "./host";
import backoffs from "./backoff";
import * as request from "request";
import * as _ from "lodash";

/**
 * Status codes that will cause a host to be marked as "failed" if we get
 * them from a request to Influx.
 * @type {Array}
 */
enum resubmitErrorCodes {
  'ETIMEDOUT',
  'ESOCKETTIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'EHOSTUNREACH'
}

/**
 * @typedef {Object} PoolOptions an options object passed to instantiate
 *     or configure a pool of Influx connections.
 * @property {Object} [options.failoverTimeout=60000] the length of time a
 *     host should be removed for upon a connection error
 * @property {Number} [options.maxRetries=2] number of times we should retry
 *     running a query before calling back with an error
 * @property {Object} [options.requestTimeout=30000] the length of time after
 *     which HTTP requests will error if they do not receive a response
 * @property {Function} [options.request] function called to make an HTTP
 *     request, defaults to the `request` module
 * @property {Object} [options.backoff] configuration for the backoff strategy
 *     used when connections fail. It contains a `kind` with other config
 *     data for the specific kind.
 * @property {String} [options.backoff.kind] the name of the backoff strategy
 *     used.
 */

interface PoolOptions {
  /**
   * The length of time a host should be removed for upon a connection error,
   * given in milliseconds. Defaults to 60000ms.
   */
  failoverTimeout: number;

  /**
   * The length of time after which HTTP requests will error
   * if they do not receive a response.
   */
  requestTimeout: number;

  /**
   * Number of times we should retry running a query
   * before calling back with an error.
   */
  maxRetries: number;

  /**
   * Request instance to use for talking to Influx.
   */
  request: request.RequestAPI<request.Request, request.CoreOptions, request.RequiredUriUrl>;

  /**
   * Options to configure the backoff policy for the pool.
   */
  backoff: {
    /**
     * Name of the backoff strategy to use.
     */
    kind: string;

    /**
     * A list of other options to pass into the strategy.
     */
    [propName: string]: any;
  };
}

/**
 *
 * The Pool maintains a list available Influx hosts and dispatches requests
 * to them. If there are errors connecting to hosts, it will disable that
 * host for a period of time.
 */
class Pool {

  private options: PoolOptions;
  private index: number;
  private requestOptions: request.CoreOptions;

  private hostsAvailable: Array<Host>;
  private hostsDisabled: Array<Host>;

  /**
   * Creates a new Pool instance.
   * @param {PoolOptions} options
   */
  constructor (options: PoolOptions) {
    this.options = <PoolOptions>_.defaults(options, {
      requestTimeout: 30 * 1000,
      maxRetries: 2,
      request: request,
      backoff: {
        kind: 'exponential',
        initial: 300,
        random: 1,
        max: 10 * 1000
      }
    });

    this.index = 0;
    this.hostsAvailable = [];
    this.hostsDisabled = [];
    this.requestOptions = { timeout: this.options.requestTimeout };
  }

  /**
   * Sets the length of time after which HTTP requests will error if they
   * do not receive a response.
   */
  setRequestTimeout (value: number): Pool {
    this.requestOptions.timeout = value
    return this;
  }

  /**
   * Returns a list of currently active hosts.
   * @return {Host[]}
   */
  getHostsAvailable(): Array<Host> {
    return this.hostsAvailable.slice();
  }

  /**
   * Returns a list of hosts that are currently disabled due to network
   * errors.
   * @return {Host[]}
   */
  getHostsDisabled(): Array<Host> {
    return this.hostsDisabled.slice();
  }

  /**
   * Inserts a new host to the pool.
   */
  addHost(url: string): Host {
    const bconfig = this.options.backoff;
    const backoff = backoffs[bconfig.kind](bconfig);

    const host = new Host(url, backoff);
    this.hostsAvailable.push(host);
    return host;
  }

  /**
   * Returns true if there's any host available to by queried.
   * @return {Boolean}
   */
  hostIsAvailable(): boolean {
    return this.hostsAvailable.length > 0;
  }

  /**
   * Returns the next available host for querying.
   * @return {Host}
   */
  private getHost(): Host {
    const available = this.hostsAvailable;
    const host = available[this.index];
    this.index = (this.index + 1) % available.length;
    return host;
  }

  /**
   * Re-enables the provided host, returning it to the pool to query.
   * @param  {Host} host
   */
  private enableHost(host: Host) {
    _.remove(this.hostsDisabled, host);
    this.hostsAvailable.push(host);
  }

  /**
   * Disables the provided host, removing it from the query pool. It will be
   * re-enabled after a backoff interval
   * @param  {Host} host
   */
  private disableHost(host: Host) {
    _.remove(this.hostsAvailable, host);
    this.hostsDisabled.push(host);
    this.index %= Math.max(1, this.hostsAvailable.length);

    setTimeout(() => this.enableHost(host), host.fail());
  }

  /**
   * Runs a request
   * @param  {Object}   options
   * @param  {Function} callback
   */
  _request (options: request.CoreOptions, callback: request.RequestCallback, retries: number = 0) {
    if (!this.hostIsAvailable()) {
      return callback(new ServiceNotAvailableError('No host available'));
    }

    const host = this.getHost();
    _.defaults(options, this.requestOptions);

    options.baseUrl = host.url;

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
