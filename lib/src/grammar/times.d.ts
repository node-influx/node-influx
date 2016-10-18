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
export declare function toNanoDate(timestamp: string): NanoDate;
export declare type TimePrecision = "n" | "u" | "ms" | "s" | "m" | "h";
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
export declare const Precision: {
    Hours: string;
    Microseconds: string;
    Milliseconds: string;
    Minutes: string;
    Nanoseconds: string;
    Seconds: string;
};
/**
 * formatDate converts the Date instance to Influx's date query format.
 * @private
 */
export declare function formatDate(date: Date): string;
/**
 * Converts a Date instance to a timestamp with the specified time precision.
 * @private
 */
export declare function dateToTime(date: Date | NanoDate, precision: TimePrecision): string;
/**
 * Converts an ISO-formatted data or unix timestamp to a Date instance. If
 * the precision is finer than "ms" the returned value will be a NanoDate.
 * @private
 */
export declare function isoOrTimeToDate(stamp: string | number, precision?: TimePrecision): Date | NanoDate;
/**
 * Converts a timestamp to a string with the correct precision. Assumes
 * that raw number and string instances are already in the correct precision.
 * @private
 */
export declare function castTimestamp(timestamp: string | number | Date, precision: TimePrecision): string;
