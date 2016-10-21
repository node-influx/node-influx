"use strict";
const exponential_1 = require("./backoff/exponential");
const host_1 = require("./host");
const http = require("http");
const querystring = require("querystring");
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
/**
 * An ServiceNotAvailableError is returned as an error from requests that
 * result in a > 500 error code.
 */
class ServiceNotAvailableError extends Error {
}
exports.ServiceNotAvailableError = ServiceNotAvailableError;
/**
 * An RequestError is returned as an error from requests that
 * result in a 300 <= error code <= 500.
 */
class RequestError extends Error {
    constructor(req, res, body) {
        super(`A ${res.statusCode} ${res.statusMessage} error occurred: ${body}`);
        this.req = req;
        this.res = res;
    }
    static from(req, res, callback) {
        let body = "";
        res.on("data", str => body = body + str.toString());
        res.on("end", () => callback(new RequestError(req, res, body)));
    }
}
exports.RequestError = RequestError;
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
    constructor(options) {
        this.options = Object.assign({
            backoff: new exponential_1.ExponentialBackoff({
                initial: 300,
                max: 10 * 1000,
                random: 1,
            }),
            maxRetries: 2,
            requestTimeout: 30 * 1000,
        }, options);
        this.index = 0;
        this.hostsAvailable = new Set();
        this.hostsDisabled = new Set();
        this.timeout = this.options.requestTimeout;
    }
    /**
     * Returns a list of currently active hosts.
     * @return {Host[]}
     */
    getHostsAvailable() {
        return Array.from(this.hostsAvailable);
    }
    /**
     * Returns a list of hosts that are currently disabled due to network
     * errors.
     * @return {Host[]}
     */
    getHostsDisabled() {
        return Array.from(this.hostsDisabled);
    }
    /**
     * Inserts a new host to the pool.
     */
    addHost(url) {
        const host = new host_1.Host(url, this.options.backoff.reset());
        this.hostsAvailable.add(host);
        return host;
    }
    /**
     * Returns true if there"s any host available to by queried.
     * @return {Boolean}
     */
    hostIsAvailable() {
        return this.hostsAvailable.size > 0;
    }
    /**
     * Makes a request and calls back with the response, parsed as JSON.
     * An error is returned on a non-2xx status code or on a parsing exception.
     */
    json(options) {
        return this.text(options).then(res => JSON.parse(res));
    }
    /**
     * Makes a request and resolves with the plain text response,
     * if possible. An error is raised on a non-2xx status code.
     */
    text(options) {
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
    discard(options) {
        return new Promise((resolve, reject) => {
            this.stream(options, (err, res) => {
                if (err) {
                    return reject(err);
                }
                res.on("data", () => { });
                res.on("end", () => resolve());
            });
        });
    }
    /**
     * Ping sends out a request to all available Influx servers, reporting on
     * their response time and version number.
     */
    ping(timeout) {
        let todo = [];
        [...this.hostsAvailable, ...this.hostsDisabled].forEach(host => {
            const start = Date.now();
            const url = host.url;
            return todo.push(new Promise(resolve => {
                const req = http.request({
                    hostname: url.hostname,
                    method: "GET",
                    path: "/ping",
                    port: Number(url.port),
                    protocol: url.protocol,
                }, res => {
                    resolve({
                        url,
                        res,
                        online: res.statusCode < 300,
                        rtt: Date.now() - start,
                        version: res.headers["x-influxdb-version"],
                    });
                });
                const fail = () => {
                    resolve({
                        online: false,
                        res: null,
                        rtt: Infinity,
                        url,
                        version: null,
                    });
                };
                req.setTimeout(timeout, fail);
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
    stream(options, callback) {
        if (!this.hostIsAvailable()) {
            return callback(new ServiceNotAvailableError("No host available"), null);
        }
        // In Node, responses can come in after `timeout` events are fired,
        // but we don't want to fire callbacks twice. Create guarding functions
        // to prevent this.
        let isHandled = false;
        const shouldHandle = () => {
            const should = !isHandled;
            isHandled = true;
            return should;
        };
        let path = options.path;
        if (options.query) {
            path += "?" + querystring.stringify(options.query);
        }
        const host = this.getHost();
        const req = http.request({
            headers: { "content-length": options.body ? options.body.length : 0 },
            hostname: host.url.hostname,
            method: options.method,
            path,
            port: Number(host.url.port),
            protocol: host.url.protocol,
        }, res => {
            if (!shouldHandle()) {
                return;
            }
            if (res.statusCode >= 500) {
                return this.handleRequestError(new ServiceNotAvailableError(res.statusMessage), host, options, callback);
            }
            if (res.statusCode >= 300) {
                return RequestError.from(req, res, err => callback(err, res));
            }
            host.success();
            return callback(undefined, res);
        });
        // Handle network or HTTP parsing errors:
        req.on("error", err => {
            if (shouldHandle()) {
                this.handleRequestError(err, host, options, callback);
            }
        });
        // Handle timeouts:
        // We wrap this in a conditional pending better browser support. See:
        // https://github.com/node-influx/node-influx/issues/221
        if (typeof req.setTimeout === "function") {
            req.setTimeout(this.timeout, () => {
                if (shouldHandle()) {
                    this.handleRequestError(new ServiceNotAvailableError("Request timed out"), host, options, callback);
                }
            });
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
    getHost() {
        const available = Array.from(this.hostsAvailable);
        const host = available[this.index];
        this.index = (this.index + 1) % available.length;
        return host;
    }
    /**
     * Re-enables the provided host, returning it to the pool to query.
     * @param  {Host} host
     */
    enableHost(host) {
        this.hostsDisabled.delete(host);
        this.hostsAvailable.add(host);
    }
    /**
     * Disables the provided host, removing it from the query pool. It will be
     * re-enabled after a backoff interval
     */
    disableHost(host) {
        this.hostsAvailable.delete(host);
        this.hostsDisabled.add(host);
        this.index %= Math.max(1, this.hostsAvailable.size);
        setTimeout(() => this.enableHost(host), host.fail());
    }
    handleRequestError(err, host, options, callback) {
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
exports.Pool = Pool;
