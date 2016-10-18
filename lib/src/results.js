"use strict";
const grammar_1 = require("./grammar");
/**
 * A ResultError is thrown when a query generates errorful results from Influx.
 */
class ResultError extends Error {
    constructor(message) {
        super(`Error from InfluxDB: ${message}`);
    }
}
exports.ResultError = ResultError;
function groupMethod(matcher) {
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
    L: for (let i = 0; i < this.groupRows.length; i++) {
        for (let k = 0; k < srcKeys.length; k++) {
            if (this.groupRows[i].tags[srcKeys[k]] !== matcher[srcKeys[k]]) {
                continue L;
            }
        }
        return this.groupRows[i].rows;
    }
    return [];
}
function groupsMethod() {
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
function parseInner(series = [], precision) {
    const results = new Array();
    const tags = results.groupsTagsKeys
        = series.length && series[0].tags ? Object.keys(series[0].tags) : [];
    let nextGroup = new Array();
    results.groupRows = new Array(series.length);
    for (let i = 0, lastEnd = 0; i < series.length; i++, lastEnd = results.length) {
        const { columns = [], values = [], } = series[i];
        for (let k = 0; k < values.length; k++) {
            const obj = {};
            for (let j = 0; j < columns.length; j++) {
                if (columns[j] === "time") {
                    obj.time = grammar_1.isoOrTimeToDate(values[k][j], precision);
                }
                else {
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
 * Checks if there are any errors in the Response and, if so, it throws them.
 * @private
 * @throws {ResultError}
 */
function assertNoErrors(res) {
    for (let i = 0; i < res.results.length; i++) {
        const { error } = res.results[i];
        if (error) {
            throw new ResultError(error);
        }
    }
    return res;
}
exports.assertNoErrors = assertNoErrors;
/**
 * From parses out a response to a result or list of responses.
 * There are three situations we cover here:
 *  1. A single query without groups, like `select * from myseries`
 *  2. A single query with groups, generated with a `group by` statement
 *     which groups by series *tags*, grouping by times is case (1)
 *  3. Multiple queries of types 1 and 2
 * @private
 */
function parse(res, precision) {
    assertNoErrors(res);
    if (res.results.length === 1) {
        return parseInner(res.results[0].series, precision);
    }
    else {
        return res.results.map(result => parseInner(result.series, precision));
    }
}
exports.parse = parse;
/**
 * parseSingle asserts that the response contains a single result,
 * and returns that result.
 * @throws {Error} if the number of results is not exactly one
 * @private
 */
function parseSingle(res, precision) {
    assertNoErrors(res);
    if (res.results.length !== 1) {
        throw new Error("node-influx expected the results length to equal 1, but " +
            `it was ${0}. Please report this here: https://git.io/influx-err`);
    }
    return parseInner(res.results[0].series, precision);
}
exports.parseSingle = parseSingle;
