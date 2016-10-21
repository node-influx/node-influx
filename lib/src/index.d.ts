import { PingStats, PoolOptions } from "./pool";
import { Results } from "./results";
import { SchemaOptions } from "./schema";
import * as b from "./builder";
import * as grammar from "./grammar";
export * from "./builder";
export { FieldType, Precision, Raw, TimePrecision, escape, toNanoDate } from "./grammar";
export { SchemaOptions } from "./schema";
export { PingStats, PoolOptions } from "./pool";
export { ResultError } from "./results";
export interface HostConfig {
    /**
     * Influx host to connect to, defaults to 127.0.0.1.
     */
    host: string;
    /**
     * Influx port to connect to, defaults to 8060.
     */
    port?: number;
    /**
     * Protocol to connect over, defaults to "http".
     */
    protocol?: "http" | "https";
}
export interface SingleHostConfig extends HostConfig {
    /**
     * Username for connecting to the database. Defaults to "root".
     */
    username?: string;
    /**
     * Password for connecting to the database. Defaults to "root".
     */
    password?: string;
    /**
     * Default database to write information to.
     */
    database?: string;
    /**
     * Settings for the connection pool.
     */
    pool?: PoolOptions;
    /**
     * A list of schema for measurements in the database.
     */
    schema?: SchemaOptions[];
}
export interface ClusterConfig {
    /**
     * Username for connecting to the database. Defaults to "root".
     */
    username?: string;
    /**
     * Password for connecting to the database. Defaults to "root".
     */
    password?: string;
    /**
     * Default database to write information to.
     */
    database?: string;
    /**
     * A list of cluster hosts to connect to.
     */
    hosts: Array<HostConfig>;
    /**
     * Settings for the connection pool.
     */
    pool?: PoolOptions;
    /**
     * A list of schema for measurements in the database.
     */
    schema?: SchemaOptions[];
}
export interface Point {
    /**
     * Measurement is the Influx measurement name.
     */
    measurement?: string;
    /**
     * Tags is the list of tag values to insert.
     */
    tags?: {
        [name: string]: string;
    };
    /**
     * Fields is the list of field values to insert.
     */
    fields?: {
        [name: string]: grammar.FieldType;
    };
    /**
     * Timestamp tags this measurement with a date. This can be a Date object,
     * in which case we'll adjust it to the desired precision, or a numeric
     * string or number, in which case it gets passed directly to Influx.
     */
    timestamp: Date | string | number;
}
export interface WriteOptions {
    /**
     * Precision at which the points are written, defaults to nanoseconds "n".
     */
    precision?: grammar.TimePrecision;
    /**
     * Retention policy to write the points under, defaults to the DEFAULT
     * database policy.
     */
    retentionPolicy?: string;
    /**
     * Database under which to write the points. This is required if a default
     * database is not provided in Influx.
     */
    database?: string;
}
export interface QueryOptions {
    /**
     * Defines the precision at which to query points. When left blank, it will
     * query in nanosecond precision.
     */
    precision?: grammar.TimePrecision;
    /**
     * Retention policy to query from, defaults to the DEFAULT
     * database policy.
     */
    retentionPolicy?: string;
    /**
     * Database under which to query the points. This is required if a default
     * database is not provided in Influx.
     */
    database?: string;
}
/**
 * RetentionOptions are passed into passed into the {@link
 * InfluxDB#createRetentionPolicy} and {@link InfluxDB#alterRetentionPolicy}.
 * See the [Downsampling and Retention page](https://docs.influxdata.com/
 * influxdb/v1.0/guides/downsampling_and_retention/) on the Influx docs for
 * more information.
 */
export interface RetentionOptions {
    database?: string;
    duration: string;
    replication: number;
    default?: boolean;
}
/**
 * InfluxDB is the public interface to run queries against the your database.
 * This is a "driver-level" module, not a a full-fleged ORM or ODM; you run
 * queries directly by calling methods on this class.
 *
 * Please check out some of [the tutorials](https://node-influx.github.io/manual/tutorial.html)
 * if you want help getting started!
 *
 * @example
 * const Influx = require('influx');
 * const influx = new Influx.InfluxDB({
 *  host: 'localhost',
 *  database: 'express_response_db',
 *  schema: [
 *    {
 *      measurement: 'response_times',
 *      fields: {
 *        path: Influx.FieldType.STRING,
 *        duration: Influx.FieldType.INTEGER
 *      },
 *      tags: [
 *        'host'
 *      ]
 *    }
 *  ]
 * })
 *
 * influx.writePoints([
 *   {
 *     measurement: 'response_times',
 *     tags: { host: os.hostname() },
 *     fields: { duration, path: req.path },
 *   }
 * ]).then(() => {
 *   return influx.query(`
 *     select * from response_times
 *     where host = ${Influx.escape.stringLit(os.hostname())}
 *     order by time desc
 *     limit 10
 *   `)
 * }).then(rows => {
 *   rows.forEach(row => console.log(`A request to ${row.path} took ${row.duration}ms`))
 * })
 */
export declare class InfluxDB {
    /**
     * Connect pool for making requests.
     * @private
     */
    private pool;
    /**
     * Config options for Influx.
     * @private
     */
    private options;
    /**
     * Map of Schema instances defining measurements in Influx.
     * @private
     */
    private schema;
    constructor(options: SingleHostConfig);
    /**
     * Connect to an InfluxDB cluster by specifying a
     * set of connection options.
     */
    constructor(options: ClusterConfig);
    /**
     * Connect to an InfluxDB instance using a configuration URL.
     * @example
     * new InfluxDB("http://user:password@host:8086/database")
     */
    constructor(url: string);
    /**
     * Connects to a local, default Influx instance.
     */
    constructor();
    /**
     * Creates a new database with the provided name.
     * @param {string} databaseName
     * @return {Promise.<void>}
     * @example
     * influx.createDatabase('mydb')
     */
    createDatabase(databaseName: string): Promise<void>;
    /**
     * Deletes a database with the provided name.
     * @param {string} databaseName
     * @return {Promise.<void>}
     * @example
     * influx.createDatabase('mydb')
     */
    dropDatabase(databaseName: string): Promise<void>;
    /**
     * Returns array of database names. Requires cluster admin privileges.
     * @returns {Promise<String[]>} a list of database names
     * @example
     * influx.getMeasurements().then(names =>
     *   console.log('My database names are: ' + names.join(', ')));
     */
    getDatabaseNames(): Promise<string[]>;
    /**
     * Returns array of measurements.
     * @returns {Promise<String[]>} a list of measurement names
     * @param {String} [database] the database the measurement lives in, optional
     *     if a default database is provided.
     * @example
     * influx.getMeasurements().then(names =>
     *   console.log('My measurement names are: ' + names.join(', ')));
     */
    getMeasurements(database?: string): Promise<string[]>;
    /**
     * Returns a list of all series within the target measurement, or from the
     * entire database if a measurement isn't provided.
     * @param {Object} [options]
     * @param {String} [options.measurement] if provided, we'll only get series
     *     from within that measurement.
     * @param {String} [options.database] the database the series lives in,
     *     optional if a default database is provided.
     * @returns {Promise<String[]>} a list of series names
     * @example
     * influx.getSeries().then(names => {
     *   console.log('My series names in my_measurement are: ' + names.join(', '))
     * })
     *
     * influx.getSeries({
     *   measurement: "my_measurement",
     *   database: "my_db"
     * }).then(names => {
     *   console.log('My series names in my_measurement are: ' + names.join(', '))
     * })
     */
    getSeries(options?: {
        measurement?: string;
        database?: string;
    }): Promise<string[]>;
    /**
     * Removes a measurement from the database.
     * @param {String} measurement
     * @param {String} [database] the database the measurement lives in, optional
     *     if a default database is provided.
     * @return {Promise.<void>}
     * @example
     * influx.dropMeasurement('my_measurement')
     */
    dropMeasurement(measurement: string, database?: string): Promise<void>;
    /**
     * Removes a one or more series from InfluxDB.
     *
     * @returns {Promise<void>}
     * @example
     * // The following pairs of queries are equivalent: you can chose either to
     * // use our builder or pass in string directly. The builder takes care
     * // of escaping and most syntax handling for you.
     *
     * influx.dropSeries({ where: e => e.tag('cpu').equals.value('cpu8') })
     * influx.dropSeries({ where: '"cpu" = \'cpu8\'' })
     * // DROP SERIES WHERE "cpu" = 'cpu8'
     *
     * influx.dropSeries({ measurement: m => m.name('cpu').policy('autogen') })
     * influx.dropSeries({ measurement: '"cpu"."autogen"' })
     * // DROP SERIES FROM "autogen"."cpu"
     *
     * influx.dropSeries({
     *   measurement: m => m.name('cpu').policy('autogen'),
     *   where: e => e.tag('cpu').equals.value('cpu8'),
     *   database: 'my_db'
     * })
     * // DROP SERIES FROM "autogen"."cpu" WHERE "cpu" = 'cpu8'
     */
    dropSeries(options: b.measurement | b.where | {
        database: string;
    }): Promise<void>;
    /**
     * Returns a list of users on the Influx database.
     * @return {Promise<Array<{ user: String, admin: Boolean }>>}
     * @example
     * influx.getUsers().then(users => {
     *   users.forEach(user => {
     *     if (user.admin) {
     *       console.log(user.user, 'is an admin!')
     *     } else {
     *       console.log(user.user, 'is not an admin!')
     *     }
     *   })
     * })
     */
    getUsers(): Promise<{
        user: string;
        admin: boolean;
    }[]>;
    /**
     * Creates a new InfluxDB user.
     * @param {String} username
     * @param {String} password
     * @param {Boolean} [admin=false] If true, the user will be given all
     *     privileges on all databases.
     * @returns {Promise<void>}
     * @example
     * influx.createUser('connor', 'pa55w0rd', true) // make 'connor' an admin
     *
     * // make non-admins:
     * influx.createUser('not_admin', 'pa55w0rd')
     */
    createUser(username: string, password: string, admin?: boolean): Promise<void>;
    /**
     * Sets a password for an Influx user.
     * @param {String} username
     * @param {String} password
     * @returns {Promise<void>}
     * @example
     * influx.setPassword('connor', 'pa55w0rd')
     */
    setPassword(username: string, password: string): Promise<void>;
    /**
     * Grants a privilege to a specified user.
     * @param {String} username
     * @param {String} privilege Should be one of "READ" or "WRITE"
     * @param {String} [database] If not provided, uses the default database.
     * @returns {Promise<void>}
     * @example
     * influx.grantPrivilege('connor', 'READ', 'my_db') // grants read access on my_db to connor
     */
    grantPrivilege(username: string, privilege: "READ" | "WRITE", database?: string): Promise<void>;
    /**
     * Removes a privilege from a specified user.
     * @param {String} username
     * @param {String} privilege Should be one of "READ" or "WRITE"
     * @param {String} [database] If not provided, uses the default database.
     * @returns {Promise<void>}
     * @example
     * influx.revokePrivilege('connor', 'READ', 'my_db') // removes read access on my_db from connor
     */
    revokePrivilege(username: string, privilege: "READ" | "WRITE", database?: string): Promise<void>;
    /**
     * Grants admin privileges to a specified user.
     * @param {String} username
     * @returns {Promise<void>}
     * @example
     * influx.grantAdminPrivilege('connor')
     */
    grantAdminPrivilege(username: string): Promise<void>;
    /**
     * Removes a admin privilege from a specified user.
     * @param {String} username
     * @returns {Promise<void>}
     * @example
     * influx.revokeAdminPrivilege('connor')
     */
    revokeAdminPrivilege(username: string): Promise<void>;
    /**
     * Removes a user from the database.
     * @param {String} username
     * @returns {Promise<void>}
     * @example
     * influx.dropUser('connor')
     */
    dropUser(username: string): Promise<void>;
    /**
     * Creates a continuous query in a database
     * @param {String} name The query name, for later reference
     * @param {String} query The body of the query to run
     * @param {String} [database] If not provided, uses the default database.
     * @returns {Promise<void>}
     * @example
     * influx.createContinuousQuery('downsample_cpu_1h', `
     *   SELECT MEAN(cpu) INTO "7d"."perf"
     *   FROM "1d"."perf" GROUP BY time(1m)
     * `)
     */
    createContinuousQuery(name: string, query: string, database?: string): Promise<void>;
    /**
     * Returns a list of continous queries in the database.
     * @param {String} [database] If not provided, uses the default database.
     * @returns {Promise<void>}
     * @example
     * influx.showContinousQueries()
     */
    showContinousQueries(database?: string): Promise<Results<{
        name: string;
        query: string;
    }>>;
    /**
     * Creates a continuous query in a database
     * @param {String} name The query name
     * @param {String} [database] If not provided, uses the default database.
     * @returns {Promise<void>}
     * @example
     * influx.dropContinuousQuery('downsample_cpu_1h')
     */
    dropContinuousQuery(name: string, database?: string): Promise<void>;
    /**
     * Creates a new retention policy on a database. You can read more about
     * [Downsampling and Retention](https://docs.influxdata.com/influxdb/v1.0/
     * guides/downsampling_and_retention/) on the InfluxDB website.
     *
     * @param {String} name The retention policy name
     * @param {Object} options
     * @param {String} [options.database] Database to create the policy on,
     *     uses the default database if not provided.
     * @param {String} options.duration How long data in the retention policy
     *     should be stored for, should be in a format like `7d`. See details
     *     [here](https://docs.influxdata.com/influxdb/v1.0/query_language/spec/#durations)
     * @param {Number} options.replication How many servers data in the series
     *     should be replicated to.
     * @param {Boolean} [options.default] Whether the retention policy should
     *     be the default policy on the database.
     * @returns {Promise<void>}
     * @example
     * influx.createRetentionPolicy('7d', {
     *  duration: '7d',
     *  replication: 1
     * })
     */
    createRetentionPolicy(name: string, options: RetentionOptions): Promise<void>;
    /**
     * Alters an existing retention policy on a database.
     *
     * @param {String} name The retention policy name
     * @param {Object} options
     * @param {String} [options.database] Database to create the policy on,
     *     uses the default database if not provided.
     * @param {String} options.duration How long data in the retention policy
     *     should be stored for, should be in a format like `7d`. See details
     *     [here](https://docs.influxdata.com/influxdb/v1.0/query_language/spec/#durations)
     * @param {Number} options.replication How many servers data in the series
     *     should be replicated to.
     * @param {Boolean} [options.default] Whether the retention policy should
     *     be the default policy on the database.
     * @returns {Promise<void>}
     * @example
     * influx.alterRetentionPolicy('7d', {
     *  duration: '7d',
     *  replication: 1,
     *  default: true
     * })
     */
    alterRetentionPolicy(name: string, options: RetentionOptions): Promise<void>;
    /**
     * Deletes a retention policy and associated data. Note that the data will
     * not be immediately destroyed, and will hang around until Influx's
     * bi-hourly cron.
     *
     * @param {String} name The retention policy name
     * @param {String} [database] Database name that the policy lives in,
     *     uses the default database if not provided.
     * @returns {Promise<void>}
     * @example
     * influx.dropRetentionPolicy('7d')
     */
    dropRetentionPolicy(name: string, database?: string): Promise<void>;
    /**
     * Shows retention policies on the database
     *
     * @param {String} [database] The database to list policies on, uses the
     *     default database if not provided.
     * @returns {Promise<Array<{
     *     name: String,
     *     duration: String,
     *     shardGroupDuration: String,
     *     replicaN: Number,
     *     default: Boolean
     * }>>}
     * @example
     * influx.showRetentionPolicies().then(policies => {
     *   expect(policies.slice()).to.deep.equal([
     *     {
     *       name: 'autogen',
     *       duration: '0s',
     *       shardGroupDuration: '168h0m0s',
     *       replicaN: 1,
     *       default: true,
     *     },
     *     {
     *       name: '7d',
     *       duration: '168h0m0s',
     *       shardGroupDuration: '24h0m0s',
     *       replicaN: 1,
     *       default: false,
     *     },
     *   ])
     * })
     */
    showRetentionPolicies(database?: string): Promise<{
        default: boolean;
        duration: string;
        name: string;
        replicaN: number;
        shardGroupDuration: string;
    }[]>;
    /**
     * writePoints sends a list of points together in a batch to InfluxDB. In
     * each point you must specify the measurement name to write into as well
     * as a list of tag and field values. Optionally, you can specify the
     * time to tag that point at, defaulting to the current time.
     *
     * If you defined a schema for the measurement in the options you passed
     * to `new Influx(options)`, we'll use that to make sure that types get
     * cast correctly and that there are no extraneous fields or columns.
     *
     * For best performance, it's recommended that you batch your data into
     * sets of a couple thousand records before writing it. In the future we'll
     * have some utilities within node-influx to make this easier.
     *
     * ---
     *
     * A note when using manually-specified times and precisions: by default
     * we write using the `ms` precision since that's what JavaScript gives us.
     * You can adjust this. However, there is some special behaviour if you
     * manually specify a timestamp in your points:
     *  - if you specify the timestamp as a Date object, we'll convert it to
     *    milliseconds and manipulate it as needed to get the right precision
     *  - if provide a NanoDate as returned from {@link toNanoTime} or the
     *    results from an Influx query, we'll be able to pull the precise
     *    nanosecond timestamp and manipulate it to get the right precision
     *  - if you provide a string or number as the timestamp, we'll pass it
     *    straight into Influx.
     *
     * Please see the Point and WriteOptions type for a
     * full list of possible options.
     *
     * @param {Point[]} points
     * @param {WriteOptions} [options]
     * @return {Promise<void>}
     * @example
     * // write a point into the default database with
     * // the default retention policy.
     * influx.writePoints([
     *   {
     *     measurement: 'perf',
     *     fields: { host: 'box1.example.com' },
     *     tags: { cpu: getCpuUsage(), mem: getMemUsage() },
     *   }
     * ])
     *
     * // you can manually specify the database,
     * // retention policy, and time precision:
     * influx.writePoints([
     *   {
     *     measurement: 'perf',
     *     fields: { host: 'box1.example.com' },
     *     tags: { cpu: getCpuUsage(), mem: getMemUsage() },
     *     timestamp: getLastRecordedTime(),
     *   }
     * ], {
     *   database: 'my_db',
     *   retentionPolicy: '1d',
     *   precision: 's'
     * })
     */
    writePoints(points: Point[], options?: WriteOptions): Promise<void>;
    /**
     * writeMeasurement functions similarly to {@link InfluxDB#writePoints}, but
     * it automatically fills in the `measurement` value for all points for you.
     *
     * @param {String} measurement
     * @param {Point[]} points
     * @param {WriteOptions} [options]
     * @return {Promise<void>}
     * @example
     * influx.writeMeasurement('perf', [
     *   {
     *     fields: { host: 'box1.example.com' },
     *     tags: { cpu: getCpuUsage(), mem: getMemUsage() },
     *   }
     * ])
     */
    writeMeasurement(measurement: string, points: Point[], options?: WriteOptions): Promise<void>;
    query<T>(query: string[], options?: QueryOptions): Promise<Results<T>[]>;
    query<T>(query: string, options?: QueryOptions): Promise<Results<T>>;
    /**
     * queryRaw functions similarly to .query() but it does no fancy
     * transformations on the returned data; it calls `JSON.parse` and returns
     * those results verbatim.
     *
     * @param {String|String[]} query
     * @param {QueryOptions} [options]
     * @return {Promise<*>}
     * @example
     * influx.queryRaw('select * from perf').then(rawData => {
     *   console.log(rawData)
     * })
     */
    queryRaw<T>(query: string, options?: QueryOptions): Promise<any>;
    /**
     * Pings all available hosts, collecting online status and version info.
     * @param  {Number}               timeout Given in milliseconds
     * @return {Promise<PingStats[]>}
     * @example
     * influx.ping(5000).then(hosts => {
     *   hosts.forEach(host => {
     *     if (host.online) {
     *       console.log(`${host.url.host} responded in ${host.rtt}ms running ${host.version})`)
     *     } else {
     *       console.log(`${host.url.host} is offline :(`)
     *     }
     *   })
     * })
     */
    ping(timeout: number): Promise<PingStats[]>;
    /**
     * Returns the default database that queries operates on. It throws if called
     * when a default database isn't set.
     * @private
     */
    private defaultDB();
    /**
     * Creates options to be passed into the pool to query databases.
     * @private
     */
    private getQueryOpts(params, method?);
}
