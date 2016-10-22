import { BackoffStrategy } from "./backoff/backoff";
import { ExponentialBackoff } from "./backoff/exponential";
import { Host } from "./host";

import * as http from "http";
import * as https from "https";
import * as querystring from "querystring";
import * as urlModule from "url";

/**
 * Status codes that will cause a host to be marked as "failed" if we get
 * them from a request to Influx.
 * @type {Array}
 */
const resubmitErrorCodes = [
  "ETIMEDOUT",
  "ESOCKETTIMEDOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "EHOSTUNREACH",
];

export interface PoolOptions {

  /**
   * Number of times we should retry running a query
   * before calling back with an error.
   */
  maxRetries?: number;

  /**
   * The length of time after which HTTP requests will error
   * if they do not receive a response.
   */
  requestTimeout?: number;

  /**
   * Options to configure the backoff policy for the pool. Defaults
   * to using exponential backoff.
   */
  backoff?: BackoffStrategy;

}

export interface PoolRequestOptions {

  /**
   * Request method.
   */
  method: "GET" | "POST";

  /**
   * Path to hit on the database server, must begin with a leading slash.
   */
  path: string;

  /**
   * Query string to be appended to the request path.
   */
  query?: any;

  /**
   * Request body to include.
   */
  body?: string;

  /**
   * For internal use only, a counter of the number of times we've retried
   * running this request.
   */
  retries?: number;

}

/**
 * An ServiceNotAvailableError is returned as an error from requests that
 * result in a > 500 error code.
 */
export class ServiceNotAvailableError extends Error {}

/**
 * An RequestError is returned as an error from requests that
 * result in a 300 <= error code <= 500.
 */
export class RequestError extends Error {

  public static from(
    req: http.ClientRequest,
    res: http.IncomingMessage,
    callback: (e: RequestError) => void
  ) {
      let body = "";
      res.on("data", str => body = body + str.toString());
      res.on("end", () => callback(new RequestError(req, res, body)));
  }

  constructor(public req: http.ClientRequest, public res: http.IncomingMessage, body: string) {
    super(`A ${res.statusCode} ${res.statusMessage} error occurred: ${body}`);
  }
}

/**
 * Creates a function generation that returns a wrapper which only allows
 * through the first call of any function that it generated.
 */
function doOnce(): (<T>(arg: T) => (<T>(arg: T) => any)) {
  let handled = false;

  return fn => {
    return arg => {
      if (handled) {
        return;
      }
      handled = true;
      fn(arg);
    };
  };
}

export interface PingStats {
  url: urlModule.Url;
  res: http.ServerResponse;
  online: boolean;
  rtt: number;
  version: string;
}

const request = (
  options: http.RequestOptions,
  callback: (res: http.IncomingMessage) => void
): http.ClientRequest => {
  if (options.protocol === "https:") {
    return https.request(options, callback);
  } else {
    return http.request(options, callback);
  }
};

/**
 *
 * The Pool maintains a list available Influx hosts and dispatches requests
 * to them. If there are errors connecting to hosts, it will disable that
 * host for a period of time.
 */
export class Pool {

  private options: PoolOptions;
  private index: number;
  private timeout: number;

  private hostsAvailable: Set<Host>;
  private hostsDisabled: Set<Host>;

  /**
   * Creates a new Pool instance.
   * @param {PoolOptions} options
   */
  constructor (options: PoolOptions) {
    this.options = Object.assign({
      backoff: new ExponentialBackoff({
        initial: 300,
        max: 10 * 1000,
        random: 1,
      }),
      maxRetries: 2,
      requestTimeout: 30 * 1000,
    }, options);

    this.index = 0;
    this.hostsAvailable = new Set<Host>();
    this.hostsDisabled = new Set<Host>();
    this.timeout = this.options.requestTimeout;
  }

  /**
   * Returns a list of currently active hosts.
   * @return {Host[]}
   */
  public getHostsAvailable(): Array<Host> {
    return Array.from(this.hostsAvailable);
  }

  /**
   * Returns a list of hosts that are currently disabled due to network
   * errors.
   * @return {Host[]}
   */
  public getHostsDisabled(): Array<Host> {
    return Array.from(this.hostsDisabled);
  }

  /**
   * Inserts a new host to the pool.
   */
  public addHost(url: string): Host {
    const host = new Host(url, this.options.backoff.reset());
    this.hostsAvailable.add(host);
    return host;
  }

  /**
   * Returns true if there"s any host available to by queried.
   * @return {Boolean}
   */
  public hostIsAvailable(): boolean {
    return this.hostsAvailable.size > 0;
  }

  /**
   * Makes a request and calls back with the response, parsed as JSON.
   * An error is returned on a non-2xx status code or on a parsing exception.
   */
  public json(options: PoolRequestOptions): Promise<any> {
    return this.text(options).then(res => JSON.parse(res));
  }

  /**
   * Makes a request and resolves with the plain text response,
   * if possible. An error is raised on a non-2xx status code.
   */
  public text(options: PoolRequestOptions): Promise<string> {
    return new Promise((resolve, reject) => {
      this.stream(options, (err, res) => {
        if (err) {
          return reject(err);
        }

        let output = "";
        res.on("data", str => output = output + str.toString());
        res.on("end", () => resolve(output));
      });
    });
  }

  /**
   * Makes a request and discards any response body it receives.
   * An error is returned on a non-2xx status code.
   */
  public discard(options: PoolRequestOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      this.stream(options, (err, res) => {
        if (err) {
          return reject(err);
        }

        res.on("data", () => { /* ignore */ });
        res.on("end", () => resolve());
      });
    });
  }

  /**
   * Ping sends out a request to all available Influx servers, reporting on
   * their response time and version number.
   */
  public ping(timeout: number, path: string = "/ping"): Promise<PingStats[]> {
    let todo: Promise<number>[] = [];

    [...this.hostsAvailable, ...this.hostsDisabled].forEach(host => {
      const start = Date.now();
      const url = host.url;
      const once = doOnce();

      return todo.push(new Promise(resolve => {
        const req = request(<any> { // <any> DefinitelyTyped has not update defs yet
          hostname: url.hostname,
          method: "GET",
          path,
          port: Number(url.port),
          protocol: url.protocol,
          timeout,
        }, once((res: http.IncomingMessage) => {
          resolve({
            url,
            res,
            online: res.statusCode < 300,
            rtt: Date.now() - start,
            version: res.headers["x-influxdb-version"],
          });
        }));

        const fail = once(() => {
          resolve({
            online: false,
            res: null,
            rtt: Infinity,
            url,
            version: null,
          });
        });

        // Support older Nodes and polyfills which don't allow .timeout() in
        // the request options, wrapped in a conditional for even worse
        // polyfills. See: https://github.com/node-influx/node-influx/issues/221
        if (typeof req.setTimeout === "function") {
          req.setTimeout(timeout, fail);
        }

        req.on("timeout", fail);
        req.on("error", fail);
        req.end();
      }));
    });

    return Promise.all(todo);
  }

  /**
   * Makes a request and calls back with the IncomingMessage stream,
   * if possible. An error is returned on a non-2xx status code.
   */
  public stream(
    options: PoolRequestOptions,
    callback: (err: Error, res: http.IncomingMessage) => void
  ) {
    if (!this.hostIsAvailable()) {
      return callback(new ServiceNotAvailableError("No host available"), null);
    }

    let path = options.path;
    if (options.query) {
      path += "?" + querystring.stringify(options.query);
    }

    const once = doOnce();
    const host = this.getHost();
    const req = request(<any> { // <any> DefinitelyTyped has not update defs yet
      headers: { "content-length": options.body ? options.body.length : 0 },
      hostname: host.url.hostname,
      method: options.method,
      path,
      port: Number(host.url.port),
      protocol: host.url.protocol,
      timeout: this.timeout,
    }, once((res: http.IncomingMessage) => {
      if (res.statusCode >= 500) {
        return this.handleRequestError(
          new ServiceNotAvailableError(res.statusMessage),
          host, options, callback
        );
      }

      if (res.statusCode >= 300) {
        return RequestError.from(req, res, err => callback(err, res));
      }

      host.success();
      return callback(undefined, res);
    }));

    // Handle network or HTTP parsing errors:
    req.on("error", once(err => {
      this.handleRequestError(err, host, options, callback);
    }));

    // Handle timeouts:
    req.on("timeout", once(() => {
      this.handleRequestError(
        new ServiceNotAvailableError("Request timed out"),
        host, options, callback
      );
    }));

    // Support older Nodes and polyfills which don't allow .timeout() in the
    // request options, wrapped in a conditional for even worse polyfills. See:
    // https://github.com/node-influx/node-influx/issues/221
    if (typeof req.setTimeout === "function") {
      req.setTimeout(this.timeout);
    }

    // Write out the body:
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  }

  /**
   * Returns the next available host for querying.
   * @return {Host}
   */
  private getHost(): Host {
    const available = Array.from(this.hostsAvailable);
    const host = available[this.index];
    this.index = (this.index + 1) % available.length;
    return host;
  }

  /**
   * Re-enables the provided host, returning it to the pool to query.
   * @param  {Host} host
   */
  private enableHost(host: Host) {
    this.hostsDisabled.delete(host);
    this.hostsAvailable.add(host);
  }

  /**
   * Disables the provided host, removing it from the query pool. It will be
   * re-enabled after a backoff interval
   */
  private disableHost(host: Host) {
    this.hostsAvailable.delete(host);
    this.hostsDisabled.add(host);
    this.index %= Math.max(1, this.hostsAvailable.size);

    setTimeout(() => this.enableHost(host), host.fail());
  }

  private handleRequestError (
    err: any, host: Host,
    options: PoolRequestOptions,
    callback: (err: Error, res: http.IncomingMessage) => void
  ) {
    if (!(err instanceof ServiceNotAvailableError) &&
        resubmitErrorCodes.indexOf(err.code) === -1) {
      return callback(err, null);
    }

    this.disableHost(host);
    const retries = options.retries || 0;
    if (retries < this.options.maxRetries && this.hostIsAvailable()) {
      options.retries = retries + 1;
      return this.stream(options, callback);
    }

    callback(err, null);
  }

}
