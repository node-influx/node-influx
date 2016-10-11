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
 * a custom schema
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
 * a custom schema
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
 * @param {String} [database] The database where the measurement lives. This is
 *     required if you don't provide a default database in Influx.
 * @param {String} measurement The measurement name in Influx this refers to
 * @param {Object.<String, FieldType>} fields A mapping of fields names to
 *     their data types. It's assumed that this is a comprehensive mapping of
 *     every field you might write.
 * @param {String[]} tags A list of tag names in this measurement. It's assumed
 *     that this is a comprehensive list of every tag you might write.
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
