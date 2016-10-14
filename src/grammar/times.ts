import { isNumeric } from "./ds";

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

function leftPad(str: number | string, length: number, pad: string = "0"): string {
  if (typeof str === "number") {
    str = String(str);
  }
  while (str.length < length) {
    str = pad + str;
  }
  return str;
}

function rightPad(str: number | string, length: number, pad: string = "0"): string {
  if (typeof str === "number") {
    str = String(str);
  }
  while (str.length < length) {
    str += pad;
  }
  return str;
}

export interface NanoDate extends Date {
  /**
   * Returns the unix nanoseconds timestamp as a string.
   */
  getNanoTime(): string;

  /**
   * Formats the date as an ISO RFC3339 timestamp with nanosecond precision.
   */
  toNanoISOString(): string;
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
export function toNanoDate(timestamp: string): NanoDate {
  const date = <any> new Date(Math.floor(Number(timestamp) / nsPer.ms));
  date._nanoTime = timestamp;
  date.getNanoTime = nanoDateMethods.getNanoTimeFromStamp;
  date.toNanoISOString = nanoDateMethods.toNanoISOStringFromStamp;
  return date;
}

function asNanoDate(date: Date): NanoDate {
  const d = <any> date;
  if (d.getNanoTime) {
    return d;
  }

  return undefined;
}

export type TimePrecision = "n" | "u" | "ms" | "s" | "m" | "h";

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
export const Precision = Object.freeze({
  Hours: "h",
  Microseconds: "u",
  Milliseconds: "ms",
  Minutes: "m",
  Nanoseconds: "n",
  Seconds: "s",
});

/**
 * DateManipulator describes a type which allows various kinds of parsing
 * to/from dates. Publicly, we expose simple functions and call into
 * specialized manipulators internally when dealing with precise
 * (nanosecond-precision) or imprecise (millisecond-precision) dates.
 */
interface IDateManipulator<T> {
  /**
   * formatDate converts the Date instance to Influx's date query format.
   */
  format(date: T): string;

  /**
   * Converts a Date instance to a numeric unix
   * timestamp with the specified time precision.
   */
  toTime(date: T, precision: TimePrecision): string;

  /**
   * Converts an ISO timestamp to a Date instance.
   */
  isoToDate(timestamp: string): T;

  /**
   * Converts a numeric timestamp with the specified precision to a date.
   */
  timetoDate(timestamp: number, precision: TimePrecision): T;
}

class MillisecondDateManipulator implements IDateManipulator<Date> {

  public format(date: Date): string {
    return "\"" + leftPad(date.getUTCFullYear(), 2)
       + "-" + leftPad(date.getUTCMonth() + 1, 2)
       + "-" + leftPad(date.getUTCDate(), 2)
       + " " + leftPad(date.getUTCHours(), 2)
       + ":" + leftPad(date.getUTCMinutes(), 2)
       + ":" + leftPad(date.getUTCSeconds(), 2)
       + "." + leftPad(date.getUTCMilliseconds(), 3) + "\"";
  }

  public toTime(date: Date, precision: TimePrecision): string {
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

  public isoToDate(timestamp: string): Date {
    return new Date(timestamp);
  }

  public timetoDate(timestamp: number, precision: TimePrecision): Date {
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

function nanoIsoToTime(iso: string): string {
  const [secondsStr, decimalStr] = iso.split(".");
  const seconds = Math.floor(new Date(secondsStr + "Z").getTime() / 1000);
  const decimal = rightPad(decimalStr.slice(0, -1), 9);
  return `${seconds}${decimal}`;
}

const nanoDateMethods = {
  getNanoTimeFromISO(): string {
    if (!this._cachedNanoISO) {
      this._cachedNanoTime = nanoIsoToTime(this._nanoISO);
    }

    return this._cachedNanoTime;
  },
  toNanoISOStringFromISO(): string {
    if (!this._cachedNanoISO) {
      this._cachedNanoTime = nanoIsoToTime(this._nanoISO);
    }

    const base = this.toISOString().slice(0, -4); // slice of `123Z` milliseconds
    return `${base}${this._cachedNanoTime.slice(-9)}Z`;
  },

  getNanoTimeFromStamp(): string {
    return this._nanoTime;
  },
  toNanoISOStringFromStamp(): string {
    const base = this.toISOString().slice(0, -4); // slice of `123Z` milliseconds
    return `${base}${this._nanoTime.slice(-9)}Z`;
  },
};

class NanosecondsDateManipulator implements IDateManipulator<NanoDate> {

  public format(date: NanoDate): string {
    return "\"" + leftPad(date.getUTCFullYear(), 2)
       + "-" + leftPad(date.getUTCMonth() + 1, 2)
       + "-" + leftPad(date.getUTCDate(), 2)
       + " " + leftPad(date.getUTCHours(), 2)
       + ":" + leftPad(date.getUTCMinutes(), 2)
       + ":" + leftPad(date.getUTCSeconds(), 2)
       + "." + date.getNanoTime().slice(-9) + "\"";
  }

  public toTime(date: NanoDate, precision: TimePrecision): string {
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

  public isoToDate(timestamp: string): NanoDate {
    let date = <any> new Date(timestamp);
    date._nanoISO = timestamp;
    date.getNanoTime = nanoDateMethods.getNanoTimeFromISO;
    date.toNanoISOString = nanoDateMethods.toNanoISOStringFromISO;
    return date;
  }

  public timetoDate(timestamp: number, precision: TimePrecision): NanoDate {
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
export function formatDate(date: Date): string {
  const nano = asNanoDate(date);
  if (nano) {
    return nanoManipulator.format(nano);
  } else {
    return milliManipulator.format(date);
  }
}

/**
 * Converts a Date instance to a timestamp with the specified time precision.
 * @private
 */
export function dateToTime(date: Date | NanoDate, precision: TimePrecision): string {
  const nano = asNanoDate(date);
  if (nano) {
    return nanoManipulator.toTime(nano, precision);
  } else {
    return milliManipulator.toTime(date, precision);
  }
};

/**
 * Converts an ISO-formatted data or unix timestamp to a Date instance. If
 * the precision is finer than "ms" the returned value will be a NanoDate.
 * @private
 */
export function isoOrTimeToDate(
  stamp: string | number,
  precision: TimePrecision = "n"
): Date | NanoDate {

  const manipulator = !precision || precision === "u" || precision === "n"
    ? nanoManipulator
    : milliManipulator;

  if (typeof stamp === "string") {
    return manipulator.isoToDate(stamp);
  } else {
    return manipulator.timetoDate(stamp, precision);
  }
};

/**
 * Converts a timestamp to a string with the correct precision. Assumes
 * that raw number and string instances are already in the correct precision.
 * @private
 */
export function castTimestamp(timestamp: string | number | Date,
                              precision: TimePrecision): string {
  if (typeof timestamp === "string") {
    if (!isNumeric(timestamp)) {
      throw new Error(
        `Expected numeric value for, timestamp, but got "${timestamp}"!`
      );
    }
    return timestamp;
  }

  if (typeof timestamp === "number") {
    return String(timestamp);
  }

  return dateToTime(timestamp, precision);
};
