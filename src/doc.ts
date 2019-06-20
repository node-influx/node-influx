import { Tags } from './results';

/**
 * Pool options can be passed into the database to configure the behaviour
 * of the connection pool.
 * @typedef {Object} IPoolOptions
 * @property {Number} [maxRetries=2] Number of times we should retry running
 *     a query before calling back with an error.
 * @property {Number} [requestTimeout=30000] The length of time after which
 *     HTTP requests will error if they do not receive a response.
 * @property {IBackoffStrategy} [backoff] The backoff strategy to use for
 *     unhealthy connections. Defaults to an exponential backoff with an
 *     initial delay of 300ms and a maximum delay of 10 seconds.
 */

/**
 * A ISingleHostConfig can be provided into `new InfluxDB(config)` when you
 * have a single Influx address to connect to.
 *
 * @public
 * @typedef {Object} ISingleHostConfig
 * @property {String} [username='root'] Username for connecting to the database.
 * @property {String} [password='root'] Password for connecting to the database.
 * @property {String} [database] Default database to operate on. Providing this
 *     will let you omit database names in most operations, and is convenient
 *     if your app is primarily dealing with a single database.
 * @property {String} [host='127.0.0.1'] Influx host to connect to.
 * @property {Number} [port=8086] Influx port to connect to.
 * @property {String} [protocol='http'] Protocol to connect over, either
 *     'http' or 'https'.
 * @property {https.RequestOptions} [options={}] Option overrides to use in
 *     passing to http.request or https.request.
 * @property {IPoolOptions} [pool] Options for the connection pool.
 * @property {ISchemaOptions[]} [schema] An optional list of data schema to use.
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
 * A IClusterConfig can be provided into `new InfluxDB(config)` when you
 * have a multiple Influx nodes to connect to.
 *
 * @typedef {Object} IClusterConfig
 * @property {String} [username='root'] Username for connecting to the database.
 * @property {String} [password='root'] Password for connecting to the database.
 * @property {String} [database] Default database to operate on. Providing this
 *     will let you omit database names in most operations, and is convenient
 *     if your app is primarily dealing with a single database.
 * @property {Array} hosts A list of Influx hosts to connect to.
 * @property {String} [hosts.host='127.0.0.1'] Influx host to connect to.
 * @property {Number} [hosts.port=8086] Influx port to connect to.
 * @property {String} [hosts.protocol='http'] Protocol to connect over, either
 *     'http' or 'https'.
 * @property {https.RequestOptions} [hosts.options={}] Option overrides to
 *     use in passing to http.request or https.request.
 * @property {IPoolOptions} [pool] Options for the connection pool.
 * @property {ISchemaOptions[]} [schema] An optional list of data schema to use.
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
 * @typedef {Object} ISchemaOptions
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
 * IResults are returned from the {@link InfluxDB#query} method. It marshals the raw Influx
 * results into a more palatable, JavaScript-y structure. All query results
 * are marshalled into a single, flat array, and methods are provided to
 * examine grouped results as necessary. The `time` column, if included, is
 * converted into a {@link INanoDate}. If `.query()` was called on an array of strings,
 * it will return an array of IResults, one result per query string.
 *
 * @interface
 * @example
 * influx.query('select host, cpu, mem from perf').then(results => {
 *   expect(results).to.deep.equal([
 *     { host: 'ares.peet.io', cpu: 0.12, mem: 2435 },
 *     { host: 'ares.peet.io', cpu: 0.10, mem: 2451 },
 *     // ...
 *   ])
 * })
 */
export class IResults<T> extends Array {
  // For doc only, implementation in src/results.ts

  /**
   * Looks for and returns the first group in the results
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
  public group(_: Tags): T[] {
    return null;
  }

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
  public groups(): { name: string; tags: Tags; rows: T[] }[] {
    return null;
  }
}

/**
 * IPoint is passed to the client's write methods to store a point in InfluxDB.
 *
 * @typedef {Object} IPoint
 * @property {String} measurement Measurement is the Influx measurement name.
 * @property {Object.<String, String>} [tags] Tags is the list of tag
 *     values to insert.
 * @property {Object.<String, *>} [fields] Fields is the list of
 *     field values to insert.
 * @property {Date|string|number} [timestamp] Specifies a timestamp for this
 *     point. This can be a Date object, in which case we'll adjust it to the
 *     desired precision, or a numeric string or number, in which case
 *     it gets passed directly to Influx.
 */

/**
 * IWriteOptions configure how points are written in the database.
 *
 * @typedef {Object} IWriteOptions
 * @property {TimePrecision} [precision] Precision at which the points are
 *     written, defaults to milliseconds 'ms'. Influx recommends that you use
 *     the coarsest precision possible in order to maximize efficiency.
 * @property {String} [retentionPolicy] The retention policy to insert
 *     the points under, uses the DEFAULT policy if not provided.
 * @property {String} [database] The database to insert the points in, uses the
 *     adapter's default database if not provided.
 */

/**
 * The IQueryOptions allow you to configure how queries are run against Influx.
 *
 * @typedef {Object} IQueryOptions
 * @property {TimePrecision} [precision] Defines the precision at which
 *     to query points. Defaults to querying in nanosecond precision.
 * @property {String} [retentionPolicy] Retention policy to query from,
 *     defaults to the DEFAULT retention policy.
 * @property {String} [database]  Database under which to query the points.
 *     This is required if a database is not provided in Influx client.
 */

/**
 * IPingStats is returned from {@link InfluxDB#ping}.
 *
 * @typedef {Object} IPingStats
 * @property {Url} url URL is the host's URL
 * @property {Boolean} online Whether the request was completed successfully.
 * @property {http.ServerResponse} res The raw response from the server, may be
 *     null on a timeout or HTTP error.
 * @property {Number} rtt Total time the server took to respond, in milliseconds
 * @property {String} version Version number the server reports to run
 */

/**
 * The IBackoffStrategy dictates behaviour to use when hosts in the connection
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
export class IBackoffStrategy {
  // For doc only, implementation in src/pool/backoff.ts

  /**
   * getDelay returns the amount of delay of the current backoff.
   * @return {Number}
   */
  public getDelay(): number {
    return 0;
  }

  /**
   * Next is called when a failure occurs on a host to
   * return the next backoff amount.
   * @return {IBackoffStrategy}
   */
  public next(): IBackoffStrategy {
    return this;
  }

  /**
   * Returns a strategy with a reset backoff counter.
   * @return {IBackoffStrategy}
   */
  public reset(): IBackoffStrategy {
    return this;
  }
}

/**
 * An INanoDate is a type of Date that holds a nanosecond-precision unix
 * timestamp. It's the default date type parsed in {@link IResults} and
 * can be created manually using {@link toNanoDate}.
 * @interface
 */
export class INanoDate extends Date {
  // For doc only, implementations in src/grammar/times.ts
  /**
   * Returns the unix nanoseconds timestamp as a string.
   * @example
   * const date = toNanoDate('1475985480231035677')
   * expect(date.getNanoTime()).to.equal('1475985480231035677')
   */
  public getNanoTime(): string {
    return '';
  }

  /**
   * Formats the date as an ISO RFC3339 timestamp with nanosecond precision.
   * @example
   * const date = toNanoDate('1475985480231035677')
   * expect(date.toNanoISOString()).to.equal('2016-10-09T03:58:00.231035677Z')
   */
  public toNanoISOString(): string {
    return '';
  }
}
