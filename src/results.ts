import { TimePrecision, isoOrTimeToDate } from "./grammar";

/**
 * InfluxResults describes the result structure received from InfluxDB.
 *
 * NOTE: if you're poking around in Influx, use curl, not the `json` formatter
 * provided by the CLI. As of 1.0 this formatter changes the result structure
 * and it will confuse you, as it did me ;)
 */
export interface Response {
  results: Array<{series?: ResponseSeries[]}>;
}

export type Tags = { [name: string]: string };

export type Row = any;

export interface ResponseSeries {
  name: string;
  columns: string[];
  tags?: Tags;
  values: Row[];
}

function groupMethod(matcher: Tags): Row[] {

  // We do a tiny bit of "custom" deep equality checking here, taking
  // advantage of the fact that the tag keys are consistent across all
  // series results. This lets us match groupings much more efficiently,
  // ~6000x faster than the fastest vanilla equality checker (lodash)
  // when operating on large (~100,000 grouping) sets.

  const srcKeys = this.groupsTagsKeys;
  const dstKeys = Object.keys(matcher);
  if (srcKeys.length === 0 || srcKeys.length !== dstKeys.length) {
    return [];
  }

  L:
  for (let i = 0; i < this.groupRows.length; i++) {
    for (let k = 0; k < srcKeys.length; k++) {
      if (this.groupRows[i].tags[srcKeys[k]] !== matcher[srcKeys[k]]) {
        continue L;
      }
    }

    return this.groupRows[i].rows;
  }

  return [];
}

function groupsMethod(): { tags: Tags, rows: Row[] }[] {
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
function parseInner(series: ResponseSeries[] = [], precision?: TimePrecision): Results<any> {
  const results = <any> new Array<Row>();
  const tags
    = results.groupsTagsKeys
    = series.length && series[0].tags ? Object.keys(series[0].tags) : [];

  let nextGroup = new Array<Row>();
  results.groupRows = new Array(series.length);

  for (let i = 0, lastEnd = 0; i < series.length; i++, lastEnd = results.length) {
    const columns = series[i].columns;
    const values = series[i].values;

    for (let k = 0; k < series[i].values.length; k++) {
      const obj: Row = {};
      for (let j = 0; j < columns.length; j++) {
        if (columns[j] === "time") {
          obj.time = isoOrTimeToDate(<number | string> values[k][j], precision);
        } else {
          obj[columns[j]] = values[k][j];
        }
      }
      for (let j = 0; j < tags.length; j++) {
        obj[tags[j]] = series[i].tags[tags[j]];
      }

      results.push(obj);
      nextGroup.push(obj);
    }

    results.groupRows[i] = {
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
 * ResultsParser is a user-friendly results tables from raw Influx responses.
 */
export interface Results<T> extends Array<T> {
  /**
   * group returns a subset of rows which either:
   *  - have a tag value matching the string
   *  - have a tags object matching the predicate
   * It will throw an error if a single match string is provided
   * for a query that was grouped by multiple tags.
   */
  group(matcher: Tags): T[];

  /**
   * Returns the data grouped into nested arrays
   * like how it was returned from Influx.
   */
  groups(): { tags: Tags, rows: T[] }[];
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
export function parse<T>(res: Response, precision?: TimePrecision): Results<T>[] | Results<T> {
  if (res.results.length === 1) { // normalize case 3
    return parseInner(res.results[0].series, precision);
  } else {
    return res.results.map(result => parseInner(result.series, precision));
  }
}

/**
 * parseSingle asserts that the response contains a single result,
 * and returns that result.
 * @throws {Error} if the number of results is not exactly one
 * @private
 */
export function parseSingle<T>(res: Response, precision?: TimePrecision): Results<T> {
  if (res.results.length !== 1) {
    throw new Error("node-influx expected the results length to equal 1, but " +
      `it was ${0}. Please report this here: https://git.io/influx-err`);
  }

  return parseInner(res.results[0].series, precision);
}
