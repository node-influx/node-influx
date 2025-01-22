import type { INanoDate } from "./grammar";
import { isoOrTimeToDate, TimePrecision } from "./grammar";

/**
 * A ResultError is thrown when a query generates errorful results from Influx.
 */
export class ResultError extends Error {
  constructor(message: string) {
    super();
    this.message = `Error from InfluxDB: ${message}`;
  }
}

/**
 * InfluxResults describes the result structure received from InfluxDB.
 *
 * NOTE: if you're poking around in Influx, use curl, not the `json` formatter
 * provided by the CLI. As of 1.0 this formatter changes the result structure
 * and it will confuse you, as it did me ;)
 */
export interface IResponse {
  results: IResultEntry[];
}

export interface IResultEntry {
  series?: IResponseSeries[];
  error?: string;
}

export type Tags = { [name: string]: string };

export type Row = any;

export interface IResponseSeries {
  name?: string;
  columns: string[];
  tags?: Tags;
  values?: Row[];
}

function groupMethod(this: any, matcher: Tags): Row[] {
  // We do a tiny bit of 'custom' deep equality checking here, taking
  // advantage of the fact that the tag keys are consistent across all
  // series results. This lets us match groupings much more efficiently,
  // ~6000x faster than the fastest vanilla equality checker (lodash)
  // when operating on large (~100,000 grouping) sets.

  const srcKeys = this.groupsTagsKeys;
  const dstKeys = Object.keys(matcher);
  if (srcKeys.length === 0 || srcKeys.length !== dstKeys.length) {
    return [];
  }

  L: for (let row of this.groupRows) {
    // eslint-disable-line no-labels
    for (let src of srcKeys) {
      if (row.tags[src] !== matcher[src]) {
        continue L; // eslint-disable-line no-labels
      }
    }

    return row.rows;
  }

  return [];
}

function groupsMethod(
  this: any,
): Array<{ name: string; tags: Tags; rows: Row[] }> {
  return this.groupRows;
}

/**
 * Inner parsing function which unpacks the series into a table and attaches
 * methods to the array. This is quite optimized and a bit of a mess to read,
 * but it's all fairly easy procedural logic.
 *
 * We do this instead of subclassing Array since subclassing has some
 * undesirable side-effects. For example, calling .slice() on the array
 * makes it impossible to preserve groups as would be necessary if it's
 * subclassed.
 */

function parseInner(
  series: IResponseSeries[] = [],
  precision?: TimePrecision,
): IResults<any> {
  const results: any = [];
  results.groupsTagsKeys =
    series.length && series[0].tags ? Object.keys(series[0].tags) : [];
  const tags = results.groupsTagsKeys;

  let nextGroup: Row[] = [];
  results.groupRows = new Array(series.length); // Tslint:disable-line

  for (let i = 0; i < series.length; i += 1, results.length) {
    const { columns = [], values = [] } = series[i];

    for (let value of values) {
      const obj: Row = {};
      for (let j = 0; j < columns.length; j += 1) {
        if (columns[j] === "time") {
          obj.time = isoOrTimeToDate(value[j] as number | string, precision);
        } else {
          obj[columns[j]] = value[j];
        }
      }

      for (let tag of tags) {
        obj[tag] = series[i].tags[tag];
      }

      results.push(obj);
      nextGroup.push(obj);
    }

    results.groupRows[i] = {
      name: series[i].name,
      rows: nextGroup,
      tags: series[i].tags || {},
    };
    nextGroup = [];
  }

  results.group = groupMethod;
  results.groups = groupsMethod;
  return results;
}

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
   * @param matcher
   * @return
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
  group: (matcher: Tags) => T[];

  /**
   * Returns the data grouped into nested arrays, similarly to how it was
   * returned from Influx originally.
   *
   * @returns
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
  groups: () => Array<{ name: string; tags: Tags; rows: T[] }>;
}

/**
 * Checks if there are any errors in the IResponse and, if so, it throws them.
 * @private
 * @throws {ResultError}
 */
export function assertNoErrors(res: IResponse): IResponse {
  for (let result of res.results) {
    const { error } = result;
    if (error) {
      throw new ResultError(error);
    }
  }

  return res;
}

/**
 * From parses out a response to a result or list of responses.
 * There are three situations we cover here:
 *  1. A single query without groups, like `select * from myseries`
 *  2. A single query with groups, generated with a `group by` statement
 *     which groups by series *tags*, grouping by times is case (1)
 *  3. Multiple queries of types 1 and 2
 * @private
 */
export function parse<T>(
  res: IResponse,
  precision?: TimePrecision
): Array<IResults<T & {time: INanoDate}>> | IResults<T & {time: INanoDate}> {
  assertNoErrors(res);

  if (res.results.length === 1) {
    // Normalize case 3
    return parseInner(res.results[0].series, precision);
  }

  return res.results.map((result) => parseInner(result.series, precision));
}

/**
 * ParseSingle asserts that the response contains a single result,
 * and returns that result.
 * @throws {Error} if the number of results is not exactly one
 * @private
 */
export function parseSingle<T>(
  res: IResponse,
  precision?: TimePrecision,
): IResults<T> {
  assertNoErrors(res);

  if (res.results.length !== 1) {
    throw new Error(
      "node-influx expected the results length to equal 1, but " +
        `it was ${0}. Please report this here: https://git.io/influx-err`,
    );
  }

  return parseInner(res.results[0].series, precision);
}
