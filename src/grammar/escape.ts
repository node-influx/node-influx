import {Raw} from './ds';

const reEscape = /[-|\\{()[\]^$+*?.]/g;

/**
 * The Escaper escapes the special characters in the provided list
 * with backslashes. Much of the code here is inspired by that in the
 * sqlstring packet found here: https://github.com/mysqljs/sqlstring
 *
 * Instances of the Escaper are derived from the documentation of escape
 * sequences found here: https://aka.ms/co1m4k
 *
 * sqlstring is made available under the following license:
 *
 *   Copyright (c) 2012 Felix Geisendörfer (felix@debuggable.com) and contributors
 *
 *   Permission is hereby granted, free of charge, to any person obtaining a copy
 *   of this software and associated documentation files (the "Software"), to deal
 *   in the Software without restriction, including without limitation the rights
 *   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *   copies of the Software, and to permit persons to whom the Software is
 *   furnished to do so, subject to the following conditions:
 *
 *   The above copyright notice and this permission notice shall be included in
 *   all copies or substantial portions of the Software.
 *
 *   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *   THE SOFTWARE.
 *
 */
class Escaper {
	private _re: RegExp;

	constructor(chars: string[], private wrap: string = '', private escaper: string = '\\') {
		const patterns = chars.join('').replace(reEscape, '\\$&');
		this._re = new RegExp('[' + patterns + '\\\\]', 'g');
	}

	/**
   * Escape replaces occurrences of special characters within the target
   * string with the necessary escape codes.
   */
	public escape(val: string): string {
		if (val as any instanceof Raw) {
			return (val as any).getValue();
		}

		let chunkIndex = (this._re.lastIndex = 0);
		let escapedVal = '';
		let match = this._re.exec(val);

		while (match) {
			escapedVal += val.slice(chunkIndex, match.index) + this.escaper + match[0];
			chunkIndex = this._re.lastIndex;
			match = this._re.exec(val);
		}

		if (chunkIndex === 0) {
			return this.wrap + val + this.wrap;
		}

		if (chunkIndex < val.length) {
			return this.wrap + escapedVal + val.slice(chunkIndex) + this.wrap;
		}

		return this.wrap + escapedVal + this.wrap;
	}
}

const bindEsc = (e: Escaper): ((val: string) => string) => e.escape.bind(e);

/**
 * TagEscaper escapes tag keys, tag values, and field keys.
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
export const escape = {
	/**
   * Measurement escapes measurement names.
   */
	measurement: bindEsc(new Escaper([',', ' '])),

	/**
   * Quoted escapes quoted values, such as database names.
   */
	quoted: bindEsc(new Escaper(['"'], '"')),

	/**
   * StringLitEscaper escapes single quotes in string literals.
   */
	stringLit: bindEsc(new Escaper(['\''], '\'')),
	/**
   * TagEscaper escapes tag keys, tag values, and field keys.
   */
	tag: bindEsc(new Escaper([',', '=', ' ']))
};
