import { escape, formatDate } from "./grammar";

export interface IStringable {
  toString: () => string;
}

export interface IBaseExpression<T> {
  /**
   * Inserts a tag name in the expression.
   */
  tag: (name: string) => T;

  /**
   * Inserts a field name in the expression.
   */
  field: (name: string) => T;

  /**
   * Chains on a value to the expression. An error will be thrown if the
   * value is a type we can't represent in InfluxQL, primarily `null` or
   * `undefined.`
   */
  value: (value: any) => T;
}

export interface IExpressionHead extends IBaseExpression<IBinaryOp> {}

export interface IExpressionTail extends IBaseExpression<IExpressionHead> {}

export interface IBinaryOp {
  /**
   * Adds an 'AND' operator
   */
  and: IExpressionTail;

  /**
   * Adds an 'OR' operator
   */
  or: IExpressionTail;

  /**
   * Adds a '+' addition symbol
   */
  plus: IExpressionTail;

  /**
   * Adds a '*' multiplication symbol
   */
  times: IExpressionTail;

  /**
   * Adds a '-' subtraction symbol
   */
  minus: IExpressionTail;

  /**
   * Adds a '/' division symbol
   */
  div: IExpressionTail;

  /**
   * Adds a '=' symbol
   */
  equals: IExpressionTail;

  /**
   * Adds a '=~' comparator to select entries matching a regex.
   */
  matches: IExpressionTail;

  /**
   * Adds a '!~' comparator to select entries not matching a regex.
   */
  doesntMatch: IExpressionTail;

  /**
   * Adds a '!=' comparator to select entries not equaling a certain value.
   */
  notEqual: IExpressionTail;

  /**
   * Adds a '>' symbol
   */
  gt: IExpressionTail;

  /**
   * Adds a '>=' symbol
   */
  gte: IExpressionTail;

  /**
   * Adds a '<' symbol
   */
  lt: IExpressionTail;

  /**
   * Adds a '<=' symbol
   */
  lte: IExpressionTail;
}

function regexHasFlags(re: RegExp): boolean {
  if (typeof re.flags !== "undefined") {
    return re.flags.length > 0;
  }

  return !re.toString().endsWith("/");
}

/**
 * Expression is used to build filtering expressions, like those used in WHERE
 * clauses. It can be used for fluent and safe building of queries using
 * untrusted input.
 *
 * @example
 * e => e
 *   .field('host').equals.value('ares.peet.io')
 *   .or
 *   .field('host').matches(/example\.com$/)
 *   .or
 *   .expr(e => e
 *     .field('country').equals.value('US')
 *     .and
 *     .field('state').equals.value('WA'));
 *
 * // Generates:
 * // "host" = 'ares.peet.io' OR "host" ~= /example\.com$/ OR \
 * //   ("county" = 'US' AND "state" = 'WA')
 */
export class Expression implements IExpressionHead, IExpressionTail, IBinaryOp {
  private readonly _query: string[] = [];

  /**
   * Inserts a tag reference into the expression; the name will be
   * automatically escaped.
   * @param name
   * @return
   */
  public tag(name: string): this {
    this.field(name);
    return this;
  }

  /**
   * Inserts a field reference into the expression; the name will be
   * automatically escaped.
   * @param name
   * @return
   */
  public field(name: string): this {
    this._query.push(escape.quoted(name));
    return this;
  }

  /**
   * Inserts a subexpression; invokes the function with a new expression
   * that can be chained on.
   * @param fn
   * @return
   * @example
   * e.field('a').equals.value('b')
   *   .or.expr(e =>
   *     e.field('b').equals.value('b')
   *     .and.field('a').equals.value('c'))
   *   .toString()
   * // "a" = 'b' OR ("b" = 'b' AND "a" = 'c')
   */
  public exp(fn: (e: Expression) => Expression): this {
    this._query.push("(" + fn(new Expression()).toString() + ")");
    return this;
  }

  /**
   * Value chains on a value to the expression.
   *
   *  - Numbers will be inserted verbatim
   *  - Strings will be escaped and inserted
   *  - Booleans will be inserted correctly
   *  - Dates will be formatted and inserted correctly, including INanoDates.
   *  - Regular expressions will be inserted correctly, however an error will
   *    be thrown if they contain flags, as regex flags do not work in Influx
   *  - Otherwise we'll try to call `.toString()` on the value, throwing
   *    if we cannot do so.
   *
   * @param value
   * @return
   */
  public value(value: any): this {
    switch (typeof value) {
      case "number":
        this._query.push(value.toString());
        return this;
      case "string":
        this._query.push(escape.stringLit(value));
        return this;
      case "boolean":
        this._query.push(value ? "TRUE" : "FALSE");
        return this;
      default:
        if (value instanceof Date) {
          this._query.push(formatDate(value));
          return this;
        }

        if (value instanceof RegExp) {
          if (regexHasFlags(value)) {
            throw new Error(
              "Attempted to query using a regex with flags, " +
                "but Influx doesn't support flags in queries.",
            );
          }

          this._query.push("/" + value.source + "/");
          return this;
        }

        if (value && typeof value.toString === "function") {
          this._query.push(value.toString());
          return this;
        }

        throw new Error(
          "node-influx doesn't know how to encode the provided value into a " +
            "query. If you think this is a bug, open an issue here: https://git.io/influx-err",
        );
    }
  }

  /**
   * Chains on an AND clause to the expression.
   */
  get and(): this {
    this._query.push("AND");
    return this;
  }

  /**
   * Chains on an OR clause to the expression.
   */
  get or(): this {
    this._query.push("OR");
    return this;
  }

  /**
   * Chains on a `+` operator to the expression.
   */
  get plus(): this {
    this._query.push("+");
    return this;
  }

  /**
   * Chains on a `*` operator to the expression.
   */
  get times(): this {
    this._query.push("*");
    return this;
  }

  /**
   * Chains on a `-` operator to the expression.
   */
  get minus(): this {
    this._query.push("-");
    return this;
  }

  /**
   * Chains on a `/` operator to the expression.
   */
  get div(): this {
    this._query.push("/");
    return this;
  }

  /**
   * Chains on a `=` conditional to the expression.
   */
  get equals(): this {
    this._query.push("=");
    return this;
  }

  /**
   * Chains on a `=~` conditional to the expression to match regexes.
   */
  get matches(): this {
    this._query.push("=~");
    return this;
  }

  /**
   * Chains on a `!`` conditional to the expression to match regexes.
   */
  get doesntMatch(): this {
    this._query.push("!~");
    return this;
  }

  /**
   * Chains on a `!=` conditional to the expression.
   */
  get notEqual(): this {
    this._query.push("!=");
    return this;
  }

  /**
   * Chains on a `>` conditional to the expression.
   */
  get gt(): this {
    this._query.push(">");
    return this;
  }

  /**
   * Chains on a `>=` conditional to the expression.
   */
  get gte(): this {
    this._query.push(">=");
    return this;
  }

  /**
   * Chains on a `<` conditional to the expression.
   */
  get lt(): this {
    this._query.push("<");
    return this;
  }

  /**
   * Chains on a `<=` conditional to the expression.
   */
  get lte(): this {
    this._query.push("<=");
    return this;
  }

  /**
   * Converts the expression into its InfluxQL representation.
   * @return
   */
  public toString(): string {
    return this._query.join(" ");
  }
}

/**
 * Measurement creates a reference to a particular measurement. You can
 * reference it solely by its name, but you can also specify the retention
 * policy and database it lives under.
 *
 * @example
 * m.name('my_measurement') // "my_measurement"
 * m.name('my_measurement').policy('one_day') // "one_day"."my_measurement"
 * m.name('my_measurement').policy('one_day').db('mydb') // "mydb"."one_day"."my_measurement"
 */
export class Measurement {
  private _parts: string[] = [null, null, null];

  /**
   * Sets the measurement name.
   * @param name
   * @return
   */
  public name(name: string): this {
    this._parts[2] = name;
    return this;
  }

  /**
   * Sets the retention policy name.
   * @param retentionPolicy
   * @return
   */
  public policy(retentionPolicy: string): this {
    this._parts[1] = retentionPolicy;
    return this;
  }

  /**
   * Sets the database name.
   * @param db
   * @return
   */
  public db(db: string): this {
    this._parts[0] = db;
    return this;
  }

  /**
   * Converts the measurement into its InfluxQL representation.
   * @return
   * @throws {Error} if a measurement name is not provided
   */
  public toString(): string {
    if (!this._parts[2]) {
      throw new Error(
        `You must specify a measurement name to query! Got \`${this._parts[2]}\``,
      );
    }

    return this._parts
      .filter((p) => Boolean(p))
      .map((p) => escape.quoted(p))
      .join(".");
  }
}

export type measurement = {
  measurement: string | ((m: Measurement) => IStringable);
};
export type where = { where: string | ((e: IExpressionHead) => IStringable) };

export function parseMeasurement(q: measurement): string {
  if (typeof q.measurement === "function") {
    return q.measurement(new Measurement()).toString();
  }

  return q.measurement;
}

export function parseWhere(q: where): string {
  if (typeof q.where === "function") {
    return q.where(new Expression()).toString();
  }

  return q.where;
}
