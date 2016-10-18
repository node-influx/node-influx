"use strict";
const grammar_1 = require("./grammar");
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
class Expression {
    constructor() {
        this.query = new Array();
    }
    /**
     * Inserts a tag reference into the expression; the name will be
     * automatically escaped.
     * @param  {String} name
     * @return {Expression}
     */
    tag(name) {
        this.field(name);
        return this;
    }
    /**
     * Inserts a field reference into the expression; the name will be
     * automatically escaped.
     * @param  {String} name
     * @return {Expression}
     */
    field(name) {
        this.query.push(grammar_1.escape.quoted(name));
        return this;
    }
    /**
     * Inserts a subexpression; invokes the function with a new expression
     * that can be chained on.
     * @param  {function(e: Expression): Expression}  fn
     * @return {Expression}
     * @example
     * e.field('a').equals.value('b')
     *   .or.expr(e =>
     *     e.field('b').equals.value('b')
     *     .and.field('a').equals.value('c'))
     *   .toString()
     * // "a" = 'b' OR ("b" = 'b' AND 'a' = "c")
     */
    exp(fn) {
        this.query.push("(" + fn(new Expression()).toString() + ")");
        return this;
    }
    /**
     * Value chains on a value to the expression.
     *
     *  - Numbers will be inserted verbatim
     *  - Strings will be escaped and inserted
     *  - Booleans will be inserted correctly
     *  - Dates will be formatted and inserted correctly, including NanoDates.
     *  - Regular expressions will be inserted correctly, however an error will
     *    be thrown if they contain flags, as regex flags do not work in Influx
     *  - Otherwise we'll try to call `.toString()` on the value, throwing
     *    if we cannot do so.
     *
     * @param  {*}  value
     * @return {Expression}
     */
    value(value) {
        switch (typeof value) {
            case "number":
                this.query.push(value);
                return this;
            case "string":
                this.query.push(grammar_1.escape.stringLit(value));
                return this;
            case "boolean":
                this.query.push(value ? "TRUE" : "FALSE");
                return this;
            default:
                if (value instanceof Date) {
                    this.query.push(grammar_1.formatDate(value));
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
                throw new Error(`node-influx doesn't know how to encode the provided value into a ` +
                    "query. If you think this is a bug, open an issue here: https://git.io/influx-err");
        }
    }
    /**
     * Chains on an AND clause to the expression.
     * @type {Expression}
     */
    get and() {
        this.query.push("AND");
        return this;
    }
    /**
     * Chains on an OR clause to the expression.
     * @type {Expression}
     */
    get or() {
        this.query.push("OR");
        return this;
    }
    /**
     * Chains on a `+` operator to the expression.
     * @type {Expression}
     */
    get plus() {
        this.query.push("+");
        return this;
    }
    /**
     * Chains on a `*` operator to the expression.
     * @type {Expression}
     */
    get times() {
        this.query.push("*");
        return this;
    }
    /**
     * Chains on a `-` operator to the expression.
     * @type {Expression}
     */
    get minus() {
        this.query.push("-");
        return this;
    }
    /**
     * Chains on a `/` operator to the expression.
     * @type {Expression}
     */
    get div() {
        this.query.push("/");
        return this;
    }
    /**
     * Chains on a `=` conditional to the expression.
     * @type {Expression}
     */
    get equals() {
        this.query.push("=");
        return this;
    }
    /**
     * Chains on a `=~` conditional to the expression to match regexes.
     * @type {Expression}
     */
    get matches() {
        this.query.push("=~");
        return this;
    }
    /**
     * Chains on a `!`` conditional to the expression to match regexes.
     * @type {Expression}
     */
    get doesntMatch() {
        this.query.push("!~");
        return this;
    }
    /**
     * Chains on a `!=` conditional to the expression.
     * @type {Expression}
     */
    get notEqual() {
        this.query.push("!=");
        return this;
    }
    /**
     * Chains on a `>` conditional to the expression.
     * @type {Expression}
     */
    get gt() {
        this.query.push(">");
        return this;
    }
    /**
     * Chains on a `>=` conditional to the expression.
     * @type {Expression}
     */
    get gte() {
        this.query.push(">=");
        return this;
    }
    /**
     * Chains on a `<` conditional to the expression.
     * @type {Expression}
     */
    get lt() {
        this.query.push("<");
        return this;
    }
    /**
     * Chains on a `<=` conditional to the expression.
     * @type {Expression}
     */
    get lte() {
        this.query.push("<=");
        return this;
    }
    /**
     * Converts the expression into its InfluxQL representation.
     * @return {String}
     */
    toString() {
        return this.query.join(" ");
    }
}
exports.Expression = Expression;
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
class Measurement {
    constructor() {
        this.parts = new Array(3);
    }
    /**
     * Sets the measurement name.
     * @param  {String} name
     * @return {Measurement}
     */
    name(name) {
        this.parts[2] = name;
        return this;
    }
    /**
     * Sets the retention policy name.
     * @param  {String} retentionPolicy
     * @return {Measurement}
     */
    policy(retentionPolicy) {
        this.parts[1] = retentionPolicy;
        return this;
    }
    /**
     * Sets the database name.
     * @param  {String} db
     * @return {Measurement}
     */
    db(db) {
        this.parts[0] = db;
        return this;
    }
    /**
     * Converts the measurement into its InfluxQL representation.
     * @return {String}
     * @throws {Error} if a measurement name is not provided
     */
    toString() {
        if (!this.parts[2]) {
            throw new Error(`You must specify a measurement name to query! Got \`${this.parts[2]}\``);
        }
        return this.parts.filter(p => !!p)
            .map(p => grammar_1.escape.quoted(p))
            .join(".");
    }
}
exports.Measurement = Measurement;
function parseMeasurement(q) {
    if (typeof q.measurement === "function") {
        return q.measurement(new Measurement()).toString();
    }
    return q.measurement;
}
exports.parseMeasurement = parseMeasurement;
function parseWhere(q) {
    if (typeof q.where === "function") {
        return q.where(new Expression()).toString();
    }
    return q.where;
}
exports.parseWhere = parseWhere;
