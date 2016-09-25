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

export type Row = {
  time: Date,
  [prop: string]: number | string | boolean | Date
};

export interface ResponseSeries {
  name: string,
  columns: string[],
  tags?: Tags,
  values: Row[],
}

function getMicrotime() {
  return this._microtime;
}

/**
 * Returns a date object decorated with an accessor for its microtime
 * epoch. "Correctly" we would subclass Date here, but parsing is a
 * very hot loop and super() calls are expensive.
 */
function dateFromMicrotime(microtime: number): Date {
  const d = <any> new Date(microtime / 1000);
  d._microtime = microtime;
  d.getMicrotime = getMicrotime;
  return d;
}

/**
 * ResultsParser creates user-friendly results tables from raw Influx responses.
 */
export class Results extends Array<Row> {

  private groupsComputed = false;
  private groupsTagsKeys: string[];
  private groupRows: { tags: Tags, rows: Row[] }[] = [];

  constructor(series: ResponseSeries[] = []) {
    super();

    for (let i = 0, lastEnd = 0; i < series.length; i++, lastEnd = this.length) {
      const columns = series[i].columns;
      const values = series[i].values;
      const timeCol = columns.indexOf("time");

      for (let k = 0; k < series[i].values.length; k++) {
        const obj: Row = { time: dateFromMicrotime(<number> values[k][timeCol])};
        for (let j = 0; j < columns.length; j++) {
          if (j === timeCol) {
            continue
          }
          obj[columns[j]] = values[k][j];
        }
        this.push(obj);
      }

      this.groupRows.push({
        tags: series[i].tags || {},
        rows: this.slice(lastEnd),
      });

      if (i === 0 && series[i].tags) {
        this.groupsTagsKeys = Object.keys(series[i].tags);
      }
    }
  }

  /**
   * findGroup returns a subset of rows which either:
   *  - have a tag value matching the string
   *  - have a tags object matching the predicate
   * It will throw an error if a single match string is provided
   * for a query that was grouped by multiple tags.
   */
  public group(matcher: Tags): Row[] {

    // We do a tiny bit of "custom" deep equality checking here, taking
    // advantage of the fact that the tag keys are consistent across all
    // series results. This lets us match groupings much more efficiently,
    // ~6000x faster than the fastest vanilla equality checker (lodash)
    // when operating on large (~100,000 grouping) sets.

    const srcKeys = this.groupsTagsKeys;
    const dstKeys = Object.keys(matcher);
    if (srcKeys.length === 0 || srcKeys.length !== dstKeys.length) {
      return []
    }

    L:
    for (let i = 0; i < this.groupRows.length; i++) {
      for (let k = 0; k < srcKeys.length; k++) {
        if (this.groupRows[i].tags[k] !== matcher[k]) {
          continue L;
        }
      }

      return this.groupRows[i].rows;
    }

    return [];
  }

  /**
   * Returns the data grouped into nested arrays
   * like how it was returned from Influx.
   */
  public groups(): { tags: Tags, rows: Row[] }[] {
    return this.groupRows;
  }

  /**
   * From parses out a response to a result or list of responses.
   * There are three situations we cover here:
   *  1. A single query without groups, like `select * from myseries`
   *  2. A single query with groups, generated with a `group by` statement
   *     which groups by series *tags*, grouping by times is case (1)
   *  3. Multiple queries of types 1 and 2
   */
  public static parse(res: Response): Results[] | Results {
    if (res.results.length === 1) { // normalize case 3
      return new Results(res.results[0].series);
    } else {
      return res.results.map(result => new Results(result.series))
    }
  }
}
