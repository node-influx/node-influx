import { Tags } from "./results";
/**
 * Pool options can be passed into the database to configure the behaviour
 * of the connection pool.
 * @typedef {Object} PoolOptions
 * @property {Number} [maxRetries=2] Number of times we should retry running
 *     a query before calling back with an error.
 * @property {Number} [requestTimeout=30000] The length of time after which
 *     HTTP requests will error if they do not receive a response.
 * @property {BackoffStrategy} [backoff] The backoff strategy to use for
 *     unhealthy connections. Defaults to an exponential backoff with an
 *     initial delay of 300ms and a maximum delay of 10 seconds.
 */
/**
 * A SingleHostConfig can be provided into `new InfluxDB(config)` when you
 * have a single Influx address to connect to.
 *
 * @public
 * @typedef {Object} SingleHostConfig
 * @property {String} [username='root'] Username for connecting to the database.
 * @property {String} [password='root'] Password for connecting to the database.
 * @property {String} [database] Default database to operate on. Providing this
 *     will let you omit database names in most operations, and is convenient
 *     if your app is primarily dealing with a single database.
 * @property {String} [host='127.0.0.1'] Influx host to connect to.
 * @property {Number} [port=8060] Influx port to connect to.
 * @property {String} [protocol="http"] Protocol to connect over, either
 *     "http" or "https".
 * @property {PoolOptions} [pool] Options for the connection pool.
 * @property {SchemaOptions[]} [schema] An optional list of data schema to use.
 *
 * @example
 * import { InfluxDB } from 'influx'; // or const InfluxDB = require('influx').InfluxDB
 *
 * // Connect to a single host with a full set of config details and
 * // a custom schema
 * const client = new InfluxDB({
 *   database: 'my_db',
 *   host: 'localhost',
 *   port: 8086,
 *   username: 'connor',
 *   password: 'pa$$w0rd',
 *   schema: [{
 *     measurement: 'perf',
 *     tags: ['hostname'],
 *     fields: {
 *       memory_usage: FieldType.INTEGER,
 *       cpu_usage: FieldType.FLOAT,
 *       is_online: FieldType.BOOLEAN,
 *     }
 *   }]
 * })
 */
/**
 * A ClusterConfig can be provided into `new InfluxDB(config)` when you
 * have a multiple Influx nodes to connect to.
 *
 * @typedef {Object} ClusterConfig
 * @property {String} [username='root'] Username for connecting to the database.
 * @property {String} [password='root'] Password for connecting to the database.
 * @property {String} [database] Default database to operate on. Providing this
 *     will let you omit database names in most operations, and is convenient
 *     if your app is primarily dealing with a single database.
 * @property {Array} hosts A list of Influx hosts to connect to.
 * @property {String} [hosts.host='127.0.0.1'] Influx host to connect to.
 * @property {Number} [hosts.port=8060] Influx port to connect to.
 * @property {String} [hosts.protocol="http"] Protocol to connect over, either
 *     "http" or "https".
 * @property {PoolOptions} [pool] Options for the connection pool.
 * @property {SchemaOptions[]} [schema] An optional list of data schema to use.
 *
 * @example
 * import { InfluxDB } from 'influx'; // or const InfluxDB = require('influx').InfluxDB
 *
 * // Connect to a single host with a full set of config details and
 * // a custom schema
 * const client = new InfluxDB({
 *   database: 'my_db',
 *   username: 'connor',
 *   password: 'pa$$w0rd',
 *   hosts: [
 *     { host: 'db1.example.com' },
 *     { host: 'db2.example.com' },
 *   ]
 *   schema: [{
 *     measurement: 'perf',
 *     tags: ['hostname'],
 *     fields: {
 *       memory_usage: FieldType.INTEGER,
 *       cpu_usage: FieldType.FLOAT,
 *       is_online: FieldType.BOOLEAN,
 *     }
 *   }]
 * })
 */
/**
 * Schema options can be passed into the `new InfluxDB()` constructor to
 * help define the shape of your data. Each schema config corresponds to
 * a measurement in Influx
 *
 * It's recommended, but not required, that you make use of schema; internally
 * we use them to be smarter about coercing your data, and providing immediate
 * error feedback if you try to write data which doesn't fit in your schema:
 * either if you include tags of fields which are not present in your schema,
 * or you enter the wrong datatype for one of your schema fields.
 *
 * @typedef {Object} SchemaOptions
 * @property {String} [database] The database where the measurement lives. This
 *     is required if you don't provide a default database in Influx.
 * @property {String} measurement The measurement name in Influx this refers to
 * @property {Object.<String, FieldType>} fields A mapping of fields names to
 *     their data types. It's assumed that this is a comprehensive mapping of
 *     every field you might write.
 * @property {String[]} tags A list of tag names in this measurement. It's
 *     assumed that this is a comprehensive list of every tag you might write.
 *
 * @example
 * {
 *   measurement: 'perf',
 *   tags: ['hostname'],
 *   fields: {
 *     memory_usage: FieldType.INTEGER,
 *     cpu_usage: FieldType.FLOAT,
 *     is_online: FieldType.BOOLEAN,
 *   }
 * }
 */
/**
 * Results are returned from the .query method. It marshals the raw Influx
 * results into a more palatable, JavaScript-y structure. All query results
 * are marshalled into a single, flat arrays, and methods are provided to
 * example grouped results as necessary.
 *
 * @class Result<T>
 * @example
 * influx.query('select host, cpu, mem from perf').then(results => {
 *   expect(results).to.deep.equal([
 *     { host: 'ares.peet.io', cpu: 0.12, mem: 2435 },
 *     { host: 'ares.peet.io', cpu: 0.10, mem: 2451 },
 *     // ...
 *   ])
 * })
 */
export declare class Results<T> extends Array {
    /**
     * Group looks for and returns the first group in the results
     * that matches the provided tags.
     *
     * If you've used lodash or underscore, we do something quite similar to
     * their object matching: for every row in the results, if it contains tag
     * values matching the requested object, we return it.
     *
     * @param  {Object.<String, String>} matcher
     * @return {T[]}
     * @example
     * // Matching tags sets in queries:
     * influx.query('select * from perf group by host').then(results => {
     *   expect(results.group({ host: 'ares.peet.io'})).to.deep.equal([
     *     { host: 'ares.peet.io', cpu: 0.12, mem: 2435 },
     *     { host: 'ares.peet.io', cpu: 0.10, mem: 2451 },
     *     // ...
     *   ])
     *
     *   expect(results.group({ host: 'box1.example.com'})).to.deep.equal([
     *     { host: 'box1.example.com', cpu: 0.54, mem: 8420 },
     *     // ...
     *   ])
     * })
     */
    group(matcher: Tags): T[];
    /**
     * Returns the data grouped into nested arrays, similarly to how it was
     * returned from Influx originally.
     *
     * @returns {Array<{ name: String, tags: Object.<String, String>, rows: T[] }>}
     * @example
     * influx.query('select * from perf group by host').then(results => {
     *   expect(results.groups()).to.deep.equal([
     *     {
     *       name: 'perf',
     *       tags: { host: 'ares.peet.io' },
     *       rows: [
     *         { host: 'ares.peet.io', cpu: 0.12, mem: 2435 },
     *         { host: 'ares.peet.io', cpu: 0.10, mem: 2451 },
     *         // ...
     *       ]
     *     }
     *     {
     *       name: 'perf',
     *       tags: { host: 'box1.example.com' },
     *       rows: [
     *         { host: 'box1.example.com', cpu: 0.54, mem: 8420 },
     *         // ...
     *       ]
     *     }
     *   ])
     * })
     */
    groups(): {
        name: string;
        tags: Tags;
        rows: T[];
    }[];
}
/**
 * Point is passed to the client's write methods to store a point in InfluxDB.
 *
 * @typedef {Object} Point
 * @property {String} measurement Measurement is the Influx measurement name.
 * @property {Object.<String, String>} [tags] Tags is the list of tag
 *     values to insert.
 * @property {Object.<String, *>} [fields] Fields is the list of
 *     field values to insert.
 * @property {Date|string|number} [fields] Timestamp tags this measurement with
 *     a date. This can be a Date object, in which case we'll adjust it to the
 *     desired precision, or a numeric string or number, in which case
 *     it gets passed directly to Influx.
 */
/**
 * WriteOptions configure how points are written in the database.
 *
 * @typedef {Object} WriteOptions
 * @property {TimePrecision} [precision] Precision at which the points are
 *     written, defaults to milliseconds "ms". Influx recommends that you use
 *     the coarsest precision possible in order to maximize efficiency.
 * @property {String} [retentionPolicy] The retention policy to insert
 *     the points under, uses the DEFAULT policy if not provided.
 * @property {String} [database] The database to insert the points in, uses the
 *     adapter's default database if not provided.
 */
/**
 * The QueryOptions allow you to configure how queries are run against Influx.
 *
 * --
 *
 * Warning: if the epoch is set to nanoseconds `ns`, timestamps will be unable
 * to correctly be represented in JavaScript due to precision limitations. If
 * you wish to read nanosecond-precision timstamps, simply leave it unset; this
 * will cause Influx to return ISO formatted dates which we can parse. See the
 * {@link Results} type for more information about how to access them.
 *
 * Please see [A Moment for Times](https://node-influx.github.io/manual/
 * usage.html#a-moment-for-times) for a more complete and eloquent explanation
 * of time handling in this module.
 *
 * @typedef {Object} QueryOptions
 * @property {TimePrecision} [epoch] Epoch defining the precision at which
 *     to query points.
 * @property {String} [retentionPolicy] Retention policy to query from,
 *     defaults to the DEFAULT retention policy.
 * @property {String} [database]  Database under which to query the points.
 *     This is required if a database is not provided in Influx client.
 */
/**
 * PingStats is returned from {@link InfluxDB#ping}.
 *
 * @typedef {Object} PingStats
 * @property {Url} url URL is the host's URL
 * @property {Boolean} online Whether the request was completed successfully.
 * @property {http.ServerResponse} res The raw response from the server, may be
 *     null on a timeout or HTTP error.
 * @property {Number} rtt Total time the server took to respond, in milliseconds
 * @property {String} version Version number the server reports to run
 */
/**
 * The BackoffStrategy dictates behaviour to use when hosts in the connection
 * pool start failing. We remove them from the pool for a duration of time
 * specified by the backoff strategy.
 *
 * The strategy itself is immutable, and each method call should return a new
 * strategy without modifying the original one.
 *
 * @interface
 * @example
 * let backoff = new MyBackoffStrategy();
 * console.log(backoff.getDelay()); // => 10
 * backoff = backoff.next();
 * console.log(backoff.getDelay()); // => 20
 * backoff = backoff.reset();
 * console.log(backoff.getDelay()); // => 10
 */
export declare class BackoffStrategy {
    /**
     * getDelay returns the amount of delay of the current backoff.
     * @return {Number}
     */
    getDelay(): number;
    /**
     * Next is called when a failure occurs on a host to
     * return the next backoff amount.
     * @return {BackoffStrategy}
     */
    next(): BackoffStrategy;
    /**
     * Returns a strategy with a reset backoff counter.
     * @return {BackoffStrategy}
     */
    reset(): BackoffStrategy;
}
