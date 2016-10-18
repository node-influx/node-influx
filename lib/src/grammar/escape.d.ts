/**
 * tagEscaper escapes tag keys, tag values, and field keys.
 * @type {Object}
 * @property {function(s: string): string } quoted Escapes and wraps quoted
 *     values, such as database names.
 * @property {function(s: string): string } stringLit Escapes and
 *     wraps string literals.
 * @property {function(s: string): string } measurement Escapes measurement
 *     names on the line protocol.
 * @property {function(s: string): string } tag Escapes tag keys, take values,
 *     and field keys on the line protocol.
 *
 * @example
 * console.log(escape.quoted('my_"db')); // => "my_\"db"
 * console.log(escape.stringLit('hello\'world')); // => 'hello\'world'
 *
 * console.log(escape.measurement('my measurement')); // => my\ measurement
 * console.log(escape.tag('my tag=')); // => my\ tag\=
 */
export declare const escape: {
    measurement: (val: string) => string;
    quoted: (val: string) => string;
    stringLit: (val: string) => string;
    tag: (val: string) => string;
};
