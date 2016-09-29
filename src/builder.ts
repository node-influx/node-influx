import { formatDate, quoteEscaper, stringLitEscaper } from "./grammar";

/**
 * Expression is used to build filtering expressions, like those used in WHERE
 * clauses.
 */
export class Expression {

  private query = new Array<string>();

  /**
   * Inserts a tag name in the expression.
   */
  public tag(name: string): this {
    this.field(name);
    return this;
  }

  /**
   * Inserts a field name in the expression.
   */
  public field(name: string): this {
    this.query.push(quoteEscaper.escape(name));
    return this;
  }

  public exp(fn: (e: Expression) => Expression): this {
    this.query.push(fn(new Expression()).toString());
    return this;
  }

  /**
   * Chains on a value to the "where" expression.
   */
  public value(value: any): this {
    switch (typeof value) {
      case "number":
        this.query.push(value);
        return this;
      case "string":
        this.query.push(stringLitEscaper.escape(value));
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

  /**
   * Adds an "AND" operator
   */
  get and(): this {
    this.query.push("AND");
    return this;
  }

  /**
   * Adds an "OR" operator
   */
  get or(): this {
    this.query.push("OR");
    return this;
  }

  /**
   * Adds a "+" addition symbol
   */
  get plus(): this {
    this.query.push("+");
    return this;
  }

  /**
   * Adds a "*" multiplication symbol
   */
  get times(): this {
    this.query.push("*");
    return this;
  }

  /**
   * Adds a "-" subtraction symbol
   */
  get minus(): this {
    this.query.push("-");
    return this;
  }

  /**
   * Adds a "/" division symbol
   */
  get div(): this {
    this.query.push("/");
    return this;
  }

  /**
   * Adds a "=" symbol
   */
  get equals(): this {
    this.query.push("=");
    return this;
  }

  /**
   * Adds a "=~" comparator to select entries matching a regex.
   */
  get matches(): this {
    this.query.push("=~");
    return this;
  }

  /**
   * Adds a "!~" comparator to select entries not matching a regex.
   */
  get doesntMatch(): this {
    this.query.push("!~");
    return this;
  }

  /**
   * Adds a "!=" comparator to select entries not equaling a certain value.
   */
  get notEqual(): this {
    this.query.push("!=");
    return this;
  }

  /**
   * Adds a ">" symbol
   */
  get gt(): this {
    this.query.push(">");
    return this;
  }

  /**
   * Adds a ">=" symbol
   */
  get gte(): this {
    this.query.push(">=");
    return this;
  }

  /**
   * Adds a "<" symbol
   */
  get lt(): this {
    this.query.push("<");
    return this;
  }

  /**
   * Adds a "<=" symbol
   */
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
      .map(p => quoteEscaper.escape(p))
      .join(".");
  }
}

export type measurement = { measurement: string | ((m: Measurement) => Measurement) };
export type where = { where: string | ((e: Expression) => Expression) };

export function parseMeasurement(q: measurement): string {
  if (typeof q.measurement === "function") {
    return q.measurement(new Measurement()).toString();
  }
  return quoteEscaper.escape(q.measurement);
}

export function parseWhere(q: where): string {
  if (typeof q.where === "function") {
    return q.where(new Expression()).toString();
  }
  return q.where;
}
