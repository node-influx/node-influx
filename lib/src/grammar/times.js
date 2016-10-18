"use strict";
const ds_1 = require("./ds");
/**
 * Just a quick overview of what's going on in this file. It's a bit of a mess.
 * Influx uses three time formats:
 *  - ISO times with nanoseconds when querying where an epoch is not provided
 *  - Unix timestamps when querying with an epoch (specifying the precision
 *    in the given time unit)
 *  - Its own time format for time literals.
 *
 * To complicate matters, Influx operates on nanosecond precisions
 * by default, but we can't represent nanosecond timestamps in
 * JavaScript numbers as they're 64 bit uints.
 *
 * As a result we have several utilities to convert between these different
 * formats. When precision is required, we represent nanosecond timestamps
 * as strings and wrap default dates in the NanoDate interface which
 * lets the consumer read and write these more precise timestamps.
 *
 * Representing the timestamps as strings is definitely not a pure way to go
 * about it, but importing an arbitrary-precision integer library adds
 * bloat and is a massive hit to throughput. The operations we do do
 * are pretty trivial, so we stick with manipulating strings
 * and make sure to wash our hands when we're done.
 *
 * Vocabulary:
 *  Unix timestamp   = "timestamp", abbreviated as "time"
 *  ISO timestamp    = "ISO time", abbreviated as "ISO"
 *  Influx timestamp = "Influx time", abbreviated as "Influx"
 */
function leftPad(str, length, pad = "0") {
    if (typeof str === "number") {
        str = String(str);
    }
    while (str.length < length) {
        str = pad + str;
    }
    return str;
}
function rightPad(str, length, pad = "0") {
    if (typeof str === "number") {
        str = String(str);
    }
    while (str.length < length) {
        str += pad;
    }
    return str;
}
/**
 * Covers a nanoseconds unix timestamp to a NanoDate for node-influx. The
 * timestamp is provided as a string to prevent precision loss.
 *
 * Please see [A Moment for Times](https://node-influx.github.io/manual/
 * usage.html#a-moment-for-times) for a more complete and eloquent explanation
 * of time handling in this module.
 *
 * @param {String} timestamp
 * @returns {NanoDate}
 * @example
 * const date = toNanoDate('1475985480231035600')
 *
 * // You can use the returned Date as a normal date:
 * expect(date.getTime()).to.equal(1475985480231);
 *
 * // We decorate it with two additional methods to read
 * // nanosecond-precision results:
 * expect(date.getNanoTime()).to.equal('1475985480231035600');
 * expect(date.toNanoISOString()).to.equal('2016-10-09T03:58:00.231035600Z');
 */
function toNanoDate(timestamp) {
    const date = new Date(Math.floor(Number(timestamp) / nsPer.ms));
    date._nanoTime = timestamp;
    date.getNanoTime = nanoDateMethods.getNanoTimeFromStamp;
    date.toNanoISOString = nanoDateMethods.toNanoISOStringFromStamp;
    return date;
}
exports.toNanoDate = toNanoDate;
function asNanoDate(date) {
    const d = date;
    if (d.getNanoTime) {
        return d;
    }
    return undefined;
}
/**
 * Precision is a map of available Influx time precisions.
 * @type {Object.<String, String>}
 * @example
 * console.log(Precision.Hours); // => "h"
 * console.log(Precision.Minutes); // => "m"
 * console.log(Precision.Seconds); // => "s"
 * console.log(Precision.Milliseconds); // => "ms"
 * console.log(Precision.Microseconds); // => "u"
 * console.log(Precision.Nanoseconds); // => "ns"
 */
exports.Precision = Object.freeze({
    Hours: "h",
    Microseconds: "u",
    Milliseconds: "ms",
    Minutes: "m",
    Nanoseconds: "n",
    Seconds: "s",
});
class MillisecondDateManipulator {
    format(date) {
        return "\"" + leftPad(date.getUTCFullYear(), 2)
            + "-" + leftPad(date.getUTCMonth() + 1, 2)
            + "-" + leftPad(date.getUTCDate(), 2)
            + " " + leftPad(date.getUTCHours(), 2)
            + ":" + leftPad(date.getUTCMinutes(), 2)
            + ":" + leftPad(date.getUTCSeconds(), 2)
            + "." + leftPad(date.getUTCMilliseconds(), 3) + "\"";
    }
    toTime(date, precision) {
        let ms = date.getTime();
        switch (precision) {
            case "n":
                ms *= 1000;
            case "u":
                ms *= 1000;
            case "ms":
                return String(ms);
            case "h":
                ms /= 60;
            case "m":
                ms /= 60;
            case "s":
                ms /= 1000;
                return String(Math.floor(ms));
            default:
                throw new Error(`Unknown precision "${precision}"!`);
        }
    }
    isoToDate(timestamp) {
        return new Date(timestamp);
    }
    timetoDate(timestamp, precision) {
        switch (precision) {
            case "n":
                timestamp /= 1000;
            case "u":
                timestamp /= 1000;
            case "ms":
                return new Date(timestamp);
            case "h":
                timestamp *= 60;
            case "m":
                timestamp *= 60;
            case "s":
                timestamp *= 1000;
                return new Date(timestamp);
            default:
                throw new Error(`Unknown precision "${precision}"!`);
        }
    }
}
const nsPer = {
    ms: Math.pow(10, 6),
    s: Math.pow(10, 9),
};
function nanoIsoToTime(iso) {
    const [secondsStr, decimalStr] = iso.split(".");
    const seconds = Math.floor(new Date(secondsStr + "Z").getTime() / 1000);
    const decimal = rightPad(decimalStr.slice(0, -1), 9);
    return `${seconds}${decimal}`;
}
const nanoDateMethods = {
    getNanoTimeFromISO() {
        if (!this._cachedNanoISO) {
            this._cachedNanoTime = nanoIsoToTime(this._nanoISO);
        }
        return this._cachedNanoTime;
    },
    toNanoISOStringFromISO() {
        if (!this._cachedNanoISO) {
            this._cachedNanoTime = nanoIsoToTime(this._nanoISO);
        }
        const base = this.toISOString().slice(0, -4); // slice of `123Z` milliseconds
        return `${base}${this._cachedNanoTime.slice(-9)}Z`;
    },
    getNanoTimeFromStamp() {
        return this._nanoTime;
    },
    toNanoISOStringFromStamp() {
        const base = this.toISOString().slice(0, -4); // slice of `123Z` milliseconds
        return `${base}${this._nanoTime.slice(-9)}Z`;
    },
};
class NanosecondsDateManipulator {
    format(date) {
        return "\"" + leftPad(date.getUTCFullYear(), 2)
            + "-" + leftPad(date.getUTCMonth() + 1, 2)
            + "-" + leftPad(date.getUTCDate(), 2)
            + " " + leftPad(date.getUTCHours(), 2)
            + ":" + leftPad(date.getUTCMinutes(), 2)
            + ":" + leftPad(date.getUTCSeconds(), 2)
            + "." + date.getNanoTime().slice(-9) + "\"";
    }
    toTime(date, precision) {
        let ms = date.getTime();
        switch (precision) {
            case "u":
                return date.getNanoTime().slice(0, -3);
            case "n":
                return date.getNanoTime();
            case "h":
                ms /= 60;
            case "m":
                ms /= 60;
            case "s":
                ms /= 1000;
            case "ms":
                return String(Math.floor(ms));
            default:
                throw new Error(`Unknown precision "${precision}"!`);
        }
    }
    isoToDate(timestamp) {
        let date = new Date(timestamp);
        date._nanoISO = timestamp;
        date.getNanoTime = nanoDateMethods.getNanoTimeFromISO;
        date.toNanoISOString = nanoDateMethods.toNanoISOStringFromISO;
        return date;
    }
    timetoDate(timestamp, precision) {
        switch (precision) {
            case "h":
                timestamp *= 60;
            case "m":
                timestamp *= 60;
            case "s":
                timestamp *= 1000;
            case "ms":
                timestamp *= 1000;
            case "u":
                timestamp *= 1000;
            case "n":
                return toNanoDate(String(timestamp));
            default:
                throw new Error(`Unknown precision "${precision}"!`);
        }
    }
}
const milliManipulator = new MillisecondDateManipulator();
const nanoManipulator = new NanosecondsDateManipulator();
/**
 * formatDate converts the Date instance to Influx's date query format.
 * @private
 */
function formatDate(date) {
    const nano = asNanoDate(date);
    if (nano) {
        return nanoManipulator.format(nano);
    }
    else {
        return milliManipulator.format(date);
    }
}
exports.formatDate = formatDate;
/**
 * Converts a Date instance to a timestamp with the specified time precision.
 * @private
 */
function dateToTime(date, precision) {
    const nano = asNanoDate(date);
    if (nano) {
        return nanoManipulator.toTime(nano, precision);
    }
    else {
        return milliManipulator.toTime(date, precision);
    }
}
exports.dateToTime = dateToTime;
;
/**
 * Converts an ISO-formatted data or unix timestamp to a Date instance. If
 * the precision is finer than "ms" the returned value will be a NanoDate.
 * @private
 */
function isoOrTimeToDate(stamp, precision = "n") {
    const manipulator = !precision || precision === "u" || precision === "n"
        ? nanoManipulator
        : milliManipulator;
    if (typeof stamp === "string") {
        return manipulator.isoToDate(stamp);
    }
    else {
        return manipulator.timetoDate(stamp, precision);
    }
}
exports.isoOrTimeToDate = isoOrTimeToDate;
;
/**
 * Converts a timestamp to a string with the correct precision. Assumes
 * that raw number and string instances are already in the correct precision.
 * @private
 */
function castTimestamp(timestamp, precision) {
    if (typeof timestamp === "string") {
        if (!ds_1.isNumeric(timestamp)) {
            throw new Error(`Expected numeric value for, timestamp, but got "${timestamp}"!`);
        }
        return timestamp;
    }
    if (typeof timestamp === "number") {
        return String(timestamp);
    }
    return dateToTime(timestamp, precision);
}
exports.castTimestamp = castTimestamp;
;
