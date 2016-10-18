/// <reference types="node" />
import { TimePrecision } from "./grammar";
/**
 * A ResultError is thrown when a query generates errorful results from Influx.
 */
export declare class ResultError extends Error {
    constructor(message: string);
}
/**
 * InfluxResults describes the result structure received from InfluxDB.
 *
 * NOTE: if you're poking around in Influx, use curl, not the `json` formatter
 * provided by the CLI. As of 1.0 this formatter changes the result structure
 * and it will confuse you, as it did me ;)
 */
export interface Response {
    results: ResultEntry[];
}
export interface ResultEntry {
    series?: ResponseSeries[];
    error?: string;
}
export declare type Tags = {
    [name: string]: string;
};
export declare type Row = any;
export interface ResponseSeries {
    name?: string;
    columns: string[];
    tags?: Tags;
    values?: Row[];
}
/**
 * ResultsParser is a user-friendly results tables from raw Influx responses.
 */
export interface Results<T> extends Array<T> {
    /**
     * Group looks for and returns the first group in the results
     * that matches the provided tags.
     *
     * If you've used lodash or underscore, we do something quite similar to
     * their object matching: for every row in the results, if it contains tag
     * values matching the requested object, we return it.
     *
     * @param  {Object.<String, String>} matcher
     * @return {T[]}
     * @example
     * // Matching tags sets in queries:
     * influx.query('select * from perf group by host').then(results => {
     *   expect(results.group({ host: 'ares.peet.io'})).to.deep.equal([
     *     { host: 'ares.peet.io', cpu: 0.12, mem: 2435 },
     *     { host: 'ares.peet.io', cpu: 0.10, mem: 2451 },
     *     // ...
     *   ])
     *
     *   expect(results.group({ host: 'box1.example.com'})).to.deep.equal([
     *     { host: 'box1.example.com', cpu: 0.54, mem: 8420 },
     *     // ...
     *   ])
     * })
     */
    group(matcher: Tags): T[];
    /**
     * Returns the data grouped into nested arrays, similarly to how it was
     * returned from Influx originally.
     *
     * @returns {Array<{ name: String, tags: Object.<String, String>, rows: T[] }>
     * @example
     * influx.query('select * from perf group by host').then(results => {
     *   expect(results.groups()).to.deep.equal([
     *     {
     *       name: 'perf',
     *       tags: { host: 'ares.peet.io' },
     *       rows: [
     *         { host: 'ares.peet.io', cpu: 0.12, mem: 2435 },
     *         { host: 'ares.peet.io', cpu: 0.10, mem: 2451 },
     *         // ...
     *       ]
     *     }
     *     {
     *       name: 'perf',
     *       tags: { host: 'box1.example.com' },
     *       rows: [
     *         { host: 'box1.example.com', cpu: 0.54, mem: 8420 },
     *         // ...
     *       ]
     *     }
     *   ])
     * })
     */
    groups(): {
        name: string;
        tags: Tags;
        rows: T[];
    }[];
}
/**
 * Checks if there are any errors in the Response and, if so, it throws them.
 * @private
 * @throws {ResultError}
 */
export declare function assertNoErrors(res: Response): Response;
/**
 * From parses out a response to a result or list of responses.
 * There are three situations we cover here:
 *  1. A single query without groups, like `select * from myseries`
 *  2. A single query with groups, generated with a `group by` statement
 *     which groups by series *tags*, grouping by times is case (1)
 *  3. Multiple queries of types 1 and 2
 * @private
 */
export declare function parse<T>(res: Response, precision?: TimePrecision): Results<T>[] | Results<T>;
/**
 * parseSingle asserts that the response contains a single result,
 * and returns that result.
 * @throws {Error} if the number of results is not exactly one
 * @private
 */
export declare function parseSingle<T>(res: Response, precision?: TimePrecision): Results<T>;
