/// <reference types="node" />
import { BackoffStrategy } from "./backoff/backoff";
import { Host } from "./host";
import * as http from "http";
import * as urlModule from "url";
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
export declare class ServiceNotAvailableError extends Error {
}
/**
 * An RequestError is returned as an error from requests that
 * result in a 300 <= error code <= 500.
 */
export declare class RequestError extends Error {
    req: http.ClientRequest;
    res: http.IncomingMessage;
    static from(req: http.ClientRequest, res: http.IncomingMessage, callback: (e: RequestError) => void): void;
    constructor(req: http.ClientRequest, res: http.IncomingMessage, body: string);
}
export interface PingStats {
    url: urlModule.Url;
    res: http.ServerResponse;
    online: boolean;
    rtt: number;
    version: string;
}
/**
 *
 * The Pool maintains a list available Influx hosts and dispatches requests
 * to them. If there are errors connecting to hosts, it will disable that
 * host for a period of time.
 */
export declare class Pool {
    private options;
    private index;
    private timeout;
    private hostsAvailable;
    private hostsDisabled;
    /**
     * Creates a new Pool instance.
     * @param {PoolOptions} options
     */
    constructor(options: PoolOptions);
    /**
     * Returns a list of currently active hosts.
     * @return {Host[]}
     */
    getHostsAvailable(): Array<Host>;
    /**
     * Returns a list of hosts that are currently disabled due to network
     * errors.
     * @return {Host[]}
     */
    getHostsDisabled(): Array<Host>;
    /**
     * Inserts a new host to the pool.
     */
    addHost(url: string): Host;
    /**
     * Returns true if there"s any host available to by queried.
     * @return {Boolean}
     */
    hostIsAvailable(): boolean;
    /**
     * Makes a request and calls back with the response, parsed as JSON.
     * An error is returned on a non-2xx status code or on a parsing exception.
     */
    json(options: PoolRequestOptions): Promise<any>;
    /**
     * Makes a request and resolves with the plain text response,
     * if possible. An error is raised on a non-2xx status code.
     */
    text(options: PoolRequestOptions): Promise<string>;
    /**
     * Makes a request and discards any response body it receives.
     * An error is returned on a non-2xx status code.
     */
    discard(options: PoolRequestOptions): Promise<void>;
    /**
     * Ping sends out a request to all available Influx servers, reporting on
     * their response time and version number.
     */
    ping(timeout: number): Promise<PingStats[]>;
    /**
     * Makes a request and calls back with the IncomingMessage stream,
     * if possible. An error is returned on a non-2xx status code.
     */
    stream(options: PoolRequestOptions, callback: (err: Error, res: http.IncomingMessage) => void): void;
    /**
     * Returns the next available host for querying.
     * @return {Host}
     */
    private getHost();
    /**
     * Re-enables the provided host, returning it to the pool to query.
     * @param  {Host} host
     */
    private enableHost(host);
    /**
     * Disables the provided host, removing it from the query pool. It will be
     * re-enabled after a backoff interval
     */
    private disableHost(host);
    private handleRequestError(err, host, options, callback);
}
