import { escape, formatDate } from "./grammar";

export interface BaseExpression<T> {
  /**
   * Inserts a tag name in the expression.
   */
  tag(name: string): T;

  /**
   * Inserts a field name in the expression.
   */
  field(name: string): T;

  /**
   * Chains on a value to the expression. An error will be thrown if the
   * value is a type we can't represent in InfluxQL, primarily `null` or
   * `undefined.`
   */
  value(value: any): T;
}

export interface ExpressionHead extends BaseExpression<BinaryOp> {}

export interface ExpressionTail extends BaseExpression<ExpressionHead> {}

export interface BinaryOp {
  /**
   * Adds an "AND" operator
   */
  and: ExpressionTail;

  /**
   * Adds an "OR" operator
   */
  or: ExpressionTail;

  /**
   * Adds a "+" addition symbol
   */
  plus: ExpressionTail;

  /**
   * Adds a "*" multiplication symbol
   */
  times: ExpressionTail;

  /**
   * Adds a "-" subtraction symbol
   */
  minus: ExpressionTail;

  /**
   * Adds a "/" division symbol
   */
  div: ExpressionTail;

  /**
   * Adds a "=" symbol
   */
  equals: ExpressionTail;

  /**
   * Adds a "=~" comparator to select entries matching a regex.
   */
  matches: ExpressionTail;

  /**
   * Adds a "!~" comparator to select entries not matching a regex.
   */
  doesntMatch: ExpressionTail;

  /**
   * Adds a "!=" comparator to select entries not equaling a certain value.
   */
  notEqual: ExpressionTail;

  /**
   * Adds a ">" symbol
   */
  gt: ExpressionTail;

  /**
   * Adds a ">=" symbol
   */
  gte: ExpressionTail;

  /**
   * Adds a "<" symbol
   */
  lt: ExpressionTail;

  /**
   * Adds a "<=" symbol
   */
  lte: ExpressionTail;
}

/**
 * Expression is used to build filtering expressions, like those used in WHERE
 * clauses.
 */
export class Expression implements ExpressionHead, ExpressionTail, BinaryOp {

  private query = new Array<string>();

  public tag(name: string): this {
    this.field(name);
    return this;
  }

  public field(name: string): this {
    this.query.push(escape.quoted(name));
    return this;
  }

  public exp(fn: (e: Expression) => Expression): this {
    this.query.push(fn(new Expression()).toString());
    return this;
  }

  public value(value: any): this {
    switch (typeof value) {
      case "number":
        this.query.push(value);
        return this;
      case "string":
        this.query.push(escape.stringLit(value));
        return this;
      case "boolean":
        this.query.push(value ? "TRUE" : "FALSE");
        return this;
      default:
        if (value instanceof Date) {
          this.query.push(formatDate(value));
          return this;
        }

        if (value instanceof RegExp) {
          if (value.flags) {
            throw new Error("Attmempted to query using a regex with flags, " +
              "but Influx doesn't support flags in queries.");
          }
          this.query.push("/" + value.source + "/");
          return this;
        }

        if (value && typeof value.toString === "function") {
          this.query.push(value.toString());
          return this;
        }

        throw new Error(`node-influx doesn't know how to encode [${value}] into a ` +
          "query. If you think this is a bug, open an issue here: https://git.io/influx-err");
    }
  }

  get and(): this {
    this.query.push("AND");
    return this;
  }

  get or(): this {
    this.query.push("OR");
    return this;
  }

  get plus(): this {
    this.query.push("+");
    return this;
  }

  get times(): this {
    this.query.push("*");
    return this;
  }

  get minus(): this {
    this.query.push("-");
    return this;
  }

  get div(): this {
    this.query.push("/");
    return this;
  }

  get equals(): this {
    this.query.push("=");
    return this;
  }

  get matches(): this {
    this.query.push("=~");
    return this;
  }

  get doesntMatch(): this {
    this.query.push("!~");
    return this;
  }

  get notEqual(): this {
    this.query.push("!=");
    return this;
  }

  get gt(): this {
    this.query.push(">");
    return this;
  }

  get gte(): this {
    this.query.push(">=");
    return this;
  }

  get lt(): this {
    this.query.push("<");
    return this;
  }

  get lte(): this {
    this.query.push("<=");
    return this;
  }

  public toString(): string {
    return this.query.join(" ");
  }
}

/**
 * Measurement creates a reference to a particular measurement. You can
 * reference it solely by its name, but you can also specify the retention
 * policy and database it lives under.
 *
 * @example
 * m.name("my_measurement") // "my_measurement"
 * m.name("my_measurement").policy("one_day") // "one_day"."my_measurement"
 * m.name("my_measurement").policy("one_day").db("mydb") // "mydb".one_day"."my_measurement"
 */
export class Measurement {
  private parts = new Array<string>(3);

  public name(name: string): this {
    this.parts[2] = name;
    return this;
  }

  public policy(retentionPolicy: string): this {
    this.parts[1] = retentionPolicy;
    return this;
  }

  public db(db: string): this {
    this.parts[0] = db;
    return this;
  }

  public toString(): string {
    return this.parts.filter(p => !!p)
      .map(p => escape.quoted(p))
      .join(".");
  }
}

export type measurement = { measurement: string | ((m: Measurement) => Measurement) };
export type where = { where: string | ((e: ExpressionHead) => Expression) };

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
