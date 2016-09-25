
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
export class Escaper {

  private re: RegExp;

  constructor(chars: string[], private wrap = "", private escaper = "\\") {
    const patterns = chars.join("").replace(reEscape, "\\$&");
    this.re = new RegExp("[" + patterns + "]", "g");
  }

  /**
   * Escape replaces occurrences of special characters within the target
   * string with the necessary escape codes.
   */
  public escape(val: string): string {
    let chunkIndex = this.re.lastIndex = 0;
    let escapedVal = "";
    let match = this.re.exec(val);

    while (match) {
      escapedVal += val.slice(chunkIndex, match.index) + this.escaper + match[0];
      chunkIndex = this.re.lastIndex;
      match = this.re.exec(val);
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

/**
 * tagEscaper escapes tag keys, tag values, and field keys.
 */
export const tagEscaper = new Escaper([",", "=", " "]);

/**
 * measurementEscaper escapes measurement names.
 */
export const measurementEscaper = new Escaper([",", " "]);

/**
 * quoteEscaper escapes quoted values, such as database names.
 */
export const quoteEscaper = new Escaper(["\""], "\"");
