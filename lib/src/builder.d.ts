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
export interface ExpressionHead extends BaseExpression<BinaryOp> {
}
export interface ExpressionTail extends BaseExpression<ExpressionHead> {
}
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
export declare class Expression implements ExpressionHead, ExpressionTail, BinaryOp {
    private query;
    /**
     * Inserts a tag reference into the expression; the name will be
     * automatically escaped.
     * @param  {String} name
     * @return {Expression}
     */
    tag(name: string): this;
    /**
     * Inserts a field reference into the expression; the name will be
     * automatically escaped.
     * @param  {String} name
     * @return {Expression}
     */
    field(name: string): this;
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
    exp(fn: (e: Expression) => Expression): this;
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
    value(value: any): this;
    /**
     * Chains on an AND clause to the expression.
     * @type {Expression}
     */
    readonly and: this;
    /**
     * Chains on an OR clause to the expression.
     * @type {Expression}
     */
    readonly or: this;
    /**
     * Chains on a `+` operator to the expression.
     * @type {Expression}
     */
    readonly plus: this;
    /**
     * Chains on a `*` operator to the expression.
     * @type {Expression}
     */
    readonly times: this;
    /**
     * Chains on a `-` operator to the expression.
     * @type {Expression}
     */
    readonly minus: this;
    /**
     * Chains on a `/` operator to the expression.
     * @type {Expression}
     */
    readonly div: this;
    /**
     * Chains on a `=` conditional to the expression.
     * @type {Expression}
     */
    readonly equals: this;
    /**
     * Chains on a `=~` conditional to the expression to match regexes.
     * @type {Expression}
     */
    readonly matches: this;
    /**
     * Chains on a `!`` conditional to the expression to match regexes.
     * @type {Expression}
     */
    readonly doesntMatch: this;
    /**
     * Chains on a `!=` conditional to the expression.
     * @type {Expression}
     */
    readonly notEqual: this;
    /**
     * Chains on a `>` conditional to the expression.
     * @type {Expression}
     */
    readonly gt: this;
    /**
     * Chains on a `>=` conditional to the expression.
     * @type {Expression}
     */
    readonly gte: this;
    /**
     * Chains on a `<` conditional to the expression.
     * @type {Expression}
     */
    readonly lt: this;
    /**
     * Chains on a `<=` conditional to the expression.
     * @type {Expression}
     */
    readonly lte: this;
    /**
     * Converts the expression into its InfluxQL representation.
     * @return {String}
     */
    toString(): string;
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
export declare class Measurement {
    private parts;
    /**
     * Sets the measurement name.
     * @param  {String} name
     * @return {Measurement}
     */
    name(name: string): this;
    /**
     * Sets the retention policy name.
     * @param  {String} retentionPolicy
     * @return {Measurement}
     */
    policy(retentionPolicy: string): this;
    /**
     * Sets the database name.
     * @param  {String} db
     * @return {Measurement}
     */
    db(db: string): this;
    /**
     * Converts the measurement into its InfluxQL representation.
     * @return {String}
     * @throws {Error} if a measurement name is not provided
     */
    toString(): string;
}
export declare type measurement = {
    measurement: string | ((m: Measurement) => Measurement);
};
export declare type where = {
    where: string | ((e: ExpressionHead) => Expression);
};
export declare function parseMeasurement(q: measurement): string;
export declare function parseWhere(q: where): string;
