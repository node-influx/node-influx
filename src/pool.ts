import { IBackoffStrategy } from "./backoff/backoff";
import { ExponentialBackoff } from "./backoff/exponential";
import { Host } from "./host";

import * as http from "http";
import * as https from "https";
import * as querystring from "querystring";
import * as urlModule from "url";

/**
 * Status codes that will cause a host to be marked as 'failed' if we get
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

export interface IPoolOptions {
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
  backoff?: IBackoffStrategy;
}

export interface IPoolRequestOptions {
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
export class ServiceNotAvailableError extends Error {
  constructor(message: string) {
    super();
    this.message = message;
    Object.setPrototypeOf(this, ServiceNotAvailableError.prototype);
  }
}

/**
 * An RequestError is returned as an error from requests that
 * result in a 300 <= error code <= 500.
 */
export class RequestError extends Error {
  constructor(
    public req: http.ClientRequest,
    public res: http.IncomingMessage,
    body: string
  ) {
    super();
    this.message = `A ${res.statusCode} ${res.statusMessage} error occurred: ${body}`;
    Object.setPrototypeOf(this, RequestError.prototype);
  }

  public static Create(
    req: http.ClientRequest,
    res: http.IncomingMessage,
    callback: (e: RequestError) => void
  ): void {
    let body = "";
    res.on("data", (str) => {
      body += str.toString();
    });
    res.on("end", () => callback(new RequestError(req, res, body)));
  }
}

/**
 * Creates a function generation that returns a wrapper which only allows
 * through the first call of any function that it generated.
 */
function doOnce<T extends Function>(): (arg: T) => <T>(arg: T) => any {
  let handled = false;

  return (fn) => {
    return (arg) => {
      if (handled) {
        return;
      }

      handled = true;
      fn(arg);
    };
  };
}

export interface IPingStats {
  url: urlModule.Url;
  res: http.IncomingMessage;
  online: boolean;
  rtt: number;
  version: string;
}

function setToArray<T>(itemSet: Set<T>): T[] {
  const output: T[] = [];
  itemSet.forEach((value) => {
    output.push(value);
  });

  return output;
}

const request = (
  options: http.RequestOptions,
  callback: (res: http.IncomingMessage) => void
): http.ClientRequest => {
  if (options.protocol === "https:") {
    return https.request(options, callback);
  }

  return http.request(options, callback);
};

/**
 *
 * The Pool maintains a list available Influx hosts and dispatches requests
 * to them. If there are errors connecting to hosts, it will disable that
 * host for a period of time.
 */
export class Pool {
  private readonly _options: IPoolOptions;

  private _index: number;

  private readonly _timeout: number;

  private readonly _hostsAvailable: Set<Host>;

  private readonly _hostsDisabled: Set<Host>;

  /**
   * Creates a new Pool instance.
   * @param {IPoolOptions} options
   */
  constructor(options: IPoolOptions) {
    this._options = {
      backoff: new ExponentialBackoff({
        initial: 300,
        max: 10 * 1000,
        random: 1,
      }),
      maxRetries: 2,
      requestTimeout: 30 * 1000,
      ...options,
    };

    this._index = 0;
    this._hostsAvailable = new Set<Host>();
    this._hostsDisabled = new Set<Host>();
    this._timeout = this._options.requestTimeout;
  }

  /**
   * Returns a list of currently active hosts.
   * @return {Host[]}
   */
  public getHostsAvailable(): Host[] {
    return setToArray(this._hostsAvailable);
  }

  /**
   * Returns a list of hosts that are currently disabled due to network
   * errors.
   * @return {Host[]}
   */
  public getHostsDisabled(): Host[] {
    return setToArray(this._hostsDisabled);
  }

  /**
   * Inserts a new host to the pool.
   */
  public addHost(url: string, options: https.RequestOptions = {}): Host {
    const host = new Host(url, this._options.backoff.reset(), options);
    this._hostsAvailable.add(host);
    return host;
  }

  /**
   * Returns true if there's any host available to by queried.
   * @return {Boolean}
   */
  public hostIsAvailable(): boolean {
    return this._hostsAvailable.size > 0;
  }

  /**
   * Makes a request and calls back with the response, parsed as JSON.
   * An error is returned on a non-2xx status code or on a parsing exception.
   */
  public json(options: IPoolRequestOptions): Promise<any> {
    return this.text(options).then((res) => JSON.parse(res));
  }

  /**
   * Makes a request and resolves with the plain text response,
   * if possible. An error is raised on a non-2xx status code.
   */
  public text(options: IPoolRequestOptions): Promise<string> {
    return new Promise((resolve, reject) => {
      this.stream(options, (err, res) => {
        if (err) {
          return reject(err);
        }

        let output = "";
        res.on("data", (str) => {
          output += str.toString();
        });
        res.on("end", () => resolve(output));
      });
    });
  }

  /**
   * Makes a request and discards any response body it receives.
   * An error is returned on a non-2xx status code.
   */
  public discard(options: IPoolRequestOptions): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.stream(options, (err, res) => {
        if (err) {
          return reject(err);
        }

        res.on("data", () => {
          /* ignore */
        });
        res.on("end", () => resolve());
      });
    });
  }

  /**
   * Ping sends out a request to all available Influx servers, reporting on
   * their response time and version number.
   */
  public ping(
    timeout: number,
    path: string = "/ping",
    auth: string | undefined = undefined
  ): Promise<IPingStats[]> {
    const todo: Array<Promise<IPingStats>> = [];

    setToArray(this._hostsAvailable)
      .concat(setToArray(this._hostsDisabled))
      .forEach((host) => {
        const start = Date.now();
        const url = host.url;
        const once = doOnce();

        return todo.push(
          new Promise((resolve) => {
            const headers: http.OutgoingHttpHeaders = {};
            if (typeof auth !== "undefined") {
              const encodedAuth = Buffer.from(auth).toString("base64");
              headers["Authorization"] = `Basic ${encodedAuth}`;
            }

            const req = request(
              {
                hostname: url.hostname,
                method: "GET",
                path,
                port: Number(url.port),
                protocol: url.protocol,
                timeout,
                headers: headers,
                ...host.options,
              },
              once((res: http.IncomingMessage) => {
                resolve({
                  url,
                  res: res.resume(),
                  online: res.statusCode < 300,
                  rtt: Date.now() - start,
                  version: res.headers["x-influxdb-version"],
                } as IPingStats);
              })
            );

            const fail = once(() => {
              req.abort();
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
              req.setTimeout(timeout, () => {
                fail.call(fail, arguments);
              }); // Tslint:disable-line
            }

            req.on("timeout", fail);
            req.on("error", fail);
            req.end();
          })
        );
      });

    return Promise.all(todo);
  }

  /**
   * Makes a request and calls back with the IncomingMessage stream,
   * if possible. An error is returned on a non-2xx status code.
   */
  public stream(
    options: IPoolRequestOptions,
    callback: (err: Error, res: http.IncomingMessage) => void
  ): void {
    if (!this.hostIsAvailable()) {
      return callback(new ServiceNotAvailableError("No host available"), null);
    }

    const once = doOnce();
    const host = this._getHost();

    let path = host.url.pathname === "/" ? "" : host.url.pathname;
    path += options.path;
    if (options.query) {
      path += "?" + querystring.stringify(options.query);
    }

    const req = request(
      {
        headers: {
          "content-length": options.body ? Buffer.from(options.body).length : 0,
        },
        hostname: host.url.hostname,
        method: options.method,
        path,
        port: Number(host.url.port),
        protocol: host.url.protocol,
        timeout: this._timeout,
        ...host.options,
      },
      once((res: http.IncomingMessage) => {
        res.setEncoding("utf8");
        if (res.statusCode >= 500) {
          res.on("data", () => {
            /* ignore */
          });

          res.on("end", () => {
            return this._handleRequestError(
              new ServiceNotAvailableError(res.statusMessage),
              host,
              options,
              callback
            );
          });

          return;
        }

        if (res.statusCode >= 300) {
          return RequestError.Create(req, res, (err) => callback(err, res));
        }

        host.success();
        return callback(undefined, res);
      })
    );

    // Handle network or HTTP parsing errors:
    req.on(
      "error",
      once((err: Error) => {
        this._handleRequestError(err, host, options, callback);
      })
    );

    // Handle timeouts:
    req.on(
      "timeout",
      once(() => {
        req.abort();
        this._handleRequestError(
          new ServiceNotAvailableError("Request timed out"),
          host,
          options,
          callback
        );
      })
    );

    // Support older Nodes and polyfills which don't allow .timeout() in the
    // request options, wrapped in a conditional for even worse polyfills. See:
    // https://github.com/node-influx/node-influx/issues/221
    if (typeof req.setTimeout === "function") {
      req.setTimeout(host.options.timeout || this._timeout); // Tslint:disable-line
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
  private _getHost(): Host {
    const available = setToArray(this._hostsAvailable);
    const host = available[this._index];
    this._index = (this._index + 1) % available.length;
    return host;
  }

  /**
   * Re-enables the provided host, returning it to the pool to query.
   * @param  {Host} host
   */
  private _enableHost(host: Host): void {
    this._hostsDisabled.delete(host);
    this._hostsAvailable.add(host);
  }

  /**
   * Disables the provided host, removing it from the query pool. It will be
   * re-enabled after a backoff interval
   */
  private _disableHost(host: Host): void {
    const delay = host.fail();

    if (delay > 0) {
      this._hostsAvailable.delete(host);
      this._hostsDisabled.add(host);
      this._index %= Math.max(1, this._hostsAvailable.size);

      setTimeout(() => this._enableHost(host), delay);
    }
  }

  private _handleRequestError(
    err: any,
    host: Host,
    options: IPoolRequestOptions,
    callback: (err: Error, res: http.IncomingMessage) => void
  ): void {
    if (
      !(err instanceof ServiceNotAvailableError) &&
      !resubmitErrorCodes.includes(err.code)
    ) {
      return callback(err, null);
    }

    this._disableHost(host);
    const retries = options.retries || 0;
    if (retries < this._options.maxRetries && this.hostIsAvailable()) {
      options.retries = retries + 1;
      return this.stream(options, callback);
    }

    callback(err, null);
  }
}
