import { IncomingMessage } from 'http';
import { TimePrecision } from '../grammar';

/**
 * A ResultError is thrown when a query generates errorful results from Influx.
 */
export class ResultError extends Error {
  constructor(message: string) {
    super();
    this.message = `Error from InfluxDB: ${message}`;
  }
}

export type Tags = { [name: string]: string };

export type Row = any;

/**
 * IResultsParser is a user-friendly results tables from raw Influx responses.
 */
export interface IResults<T> extends Array<T> {
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
  groups(): { name: string, tags: Tags, rows: T[] }[];
}

/**
 * IParser describes a type that can deserialize response from InfluxDB.
 */
export interface IParser {
  /**
   * Checks if there are any errors in the response and, if so,
   * it rejects with them.
   * @throws {ResultError}
   */
  assertNoErrors(res: IncomingMessage): Promise<void>;

  /**
   * From parses out a response to a result or list of responses.
   * There are three situations we cover here:
   *  1. A single query without groups, like `select * from myseries`
   *  2. A single query with groups, generated with a `group by` statement
   *     which groups by series *tags*, grouping by times is case (1)
   *  3. Multiple queries of types 1 and 2
   */
  parse<T>(res: IncomingMessage, precision?: TimePrecision): Promise<IResults<T>[] | IResults<T>>;

  /**
   * parseSingle asserts that the response contains a single result,
   * and returns that result.
   * @throws {Error} if the number of results is not exactly one
   */
  parseSingle<T>(res: IncomingMessage, precision?: TimePrecision): Promise<IResults<T>>;
}
