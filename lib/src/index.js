"use strict";
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
const pool_1 = require("./pool");
const results_1 = require("./results");
const schema_1 = require("./schema");
const b = require("./builder");
const grammar = require("./grammar");
const url = require("url");
const defaultHost = Object.freeze({
    host: "127.0.0.1",
    port: 8086,
    protocol: "http",
});
const defaultOptions = Object.freeze({
    database: null,
    hosts: [],
    password: "root",
    schema: [],
    username: "root",
});
__export(require("./builder"));
var grammar_1 = require("./grammar");
exports.FieldType = grammar_1.FieldType;
exports.Precision = grammar_1.Precision;
exports.Raw = grammar_1.Raw;
exports.escape = grammar_1.escape;
exports.toNanoDate = grammar_1.toNanoDate;
var results_2 = require("./results");
exports.ResultError = results_2.ResultError;
/**
 * Parses the URL out into into a ClusterConfig object
 */
function parseOptionsUrl(addr) {
    const parsed = url.parse(addr);
    const options = {
        host: parsed.hostname,
        port: Number(parsed.port),
        protocol: parsed.protocol.slice(0, -1),
    };
    if (parsed.auth) {
        [options.username, options.password] = parsed.auth.split(":");
    }
    if (parsed.pathname.length > 1) {
        options.database = parsed.pathname.slice(1);
    }
    return options;
}
/**
 * Works similarly to Object.assign, but only overwrites
 * properties that resolve to undefined.
 */
function defaults(target, ...srcs) {
    srcs.forEach(src => {
        Object.keys(src).forEach(key => {
            if (target[key] === undefined) {
                target[key] = src[key];
            }
        });
    });
    return target;
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
class InfluxDB {
    /**
     * Connect to a single InfluxDB instance by specifying
     * a set of connection options.
     * @param {ClusterConfig|SingleHostConfig|string} [options='http://root:root@127.0.0.1:8086']
     *
     * @example
     * const Influx = require('influx')
     *
     * // Connect to a single host with a DSN:
     * const influx = new Influx.InfluxDB('http://user:password@host:8086/database')
     *
     * @example
     * const Influx = require('influx')
     *
     * // Connect to a single host with a full set of config details and
     * // a custom schema
     * const client = new Influx.InfluxDB({
     *   database: 'my_db',
     *   host: 'localhost',
     *   port: 8086,
     *   username: 'connor',
     *   password: 'pa$$w0rd',
     *   schema: [
     *     {
     *       measurement: 'perf',
     *       fields: {
     *         memory_usage: Influx.FieldType.INTEGER,
     *         cpu_usage: Influx.FieldType.FLOAT,
     *         is_online: Influx.FieldType.BOOLEAN
     *       }
     *       tags: [
     *         'hostname'
     *       ]
     *     }
     *   ]
     * })
     *
     * @example
     * const Influx = require('influx')
     *
     * // Use a pool of several host connections and balance queries across them:
     * const client = new Influx.InfluxDB({
     *   database: 'my_db',
     *   username: 'connor',
     *   password: 'pa$$w0rd',
     *   hosts: [
     *     { host: 'db1.example.com' },
     *     { host: 'db2.example.com' },
     *   ],
     *   schema: [
     *     {
     *       measurement: 'perf',
     *       fields: {
     *         memory_usage: Influx.FieldType.INTEGER,
     *         cpu_usage: Influx.FieldType.FLOAT,
     *         is_online: Influx.FieldType.BOOLEAN
     *       }
     *       tags: [
     *         'hostname'
     *       ]
     *     }
     *   ]
     * })
     *
     */
    constructor(options) {
        /**
         * Map of Schema instances defining measurements in Influx.
         * @private
         */
        this.schema = Object.create(null);
        // Figure out how to parse whatever we were passed in into a ClusterConfig.
        if (typeof options === "string") {
            options = parseOptionsUrl(options);
        }
        else if (!options) {
            options = defaultHost;
        }
        if (!options.hasOwnProperty("hosts")) {
            options = {
                database: options.database,
                hosts: [options],
                password: options.password,
                pool: options.pool,
                schema: options.schema,
                username: options.username,
            };
        }
        const resolved = options;
        resolved.hosts = resolved.hosts.map(host => {
            return defaults({
                host: host.host,
                port: host.port,
                protocol: host.protocol,
            }, defaultHost);
        });
        this.pool = new pool_1.Pool(resolved.pool);
        this.options = defaults(resolved, defaultOptions);
        resolved.hosts.forEach(host => {
            this.pool.addHost(`${host.protocol}://${host.host}:${host.port}`);
        });
        this.options.schema.forEach(schema => {
            const db = schema.database = schema.database || this.options.database;
            if (!db) {
                throw new Error(`Schema ${schema.measurement} doesn't have a database specified,` +
                    "and no default database is provided!");
            }
            if (!this.schema[db]) {
                this.schema[db] = Object.create(null);
            }
            this.schema[db][schema.measurement] = new schema_1.Schema(schema);
        });
    }
    /**
     * Creates a new database with the provided name.
     * @param {string} databaseName
     * @return {Promise.<void>}
     * @example
     * influx.createDatabase('mydb')
     */
    createDatabase(databaseName) {
        return this.pool.json(this.getQueryOpts({
            q: `create database ${grammar.escape.quoted(databaseName)}`,
        }, "POST")).then(results_1.assertNoErrors);
    }
    /**
     * Deletes a database with the provided name.
     * @param {string} databaseName
     * @return {Promise.<void>}
     * @example
     * influx.createDatabase('mydb')
     */
    dropDatabase(databaseName) {
        return this.pool.json(this.getQueryOpts({
            q: `drop database ${grammar.escape.quoted(databaseName)}`,
        }, "POST")).then(results_1.assertNoErrors);
    }
    /**
     * Returns array of database names. Requires cluster admin privileges.
     * @returns {Promise<String[]>} a list of database names
     * @example
     * influx.getMeasurements().then(names =>
     *   console.log('My database names are: ' + names.join(', ')));
     */
    getDatabaseNames() {
        return this.pool.json(this.getQueryOpts({ q: "show databases" }))
            .then(res => results_1.parseSingle(res).map(r => r.name));
    }
    /**
     * Returns array of measurements.
     * @returns {Promise<String[]>} a list of measurement names
     * @param {String} [database] the database the measurement lives in, optional
     *     if a default database is provided.
     * @example
     * influx.getMeasurements().then(names =>
     *   console.log('My measurement names are: ' + names.join(', ')));
     */
    getMeasurements(database = this.defaultDB()) {
        return this.pool.json(this.getQueryOpts({
            db: database,
            q: "show measurements",
        })).then(res => results_1.parseSingle(res).map(r => r.name));
    }
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
    getSeries(options = {}) {
        const { database = this.defaultDB(), measurement, } = options;
        let query = "show series";
        if (measurement) {
            query += ` from ${grammar.escape.quoted(measurement)}`;
        }
        return this.pool.json(this.getQueryOpts({
            db: database,
            q: query,
        })).then(res => results_1.parseSingle(res).map(r => r.key));
    }
    /**
     * Removes a measurement from the database.
     * @param {String} measurement
     * @param {String} [database] the database the measurement lives in, optional
     *     if a default database is provided.
     * @return {Promise.<void>}
     * @example
     * influx.dropMeasurement('my_measurement')
     */
    dropMeasurement(measurement, database = this.defaultDB()) {
        return this.pool.json(this.getQueryOpts({
            db: database,
            q: `drop measurement ${grammar.escape.quoted(measurement)}`,
        }, "POST")).then(results_1.assertNoErrors);
    }
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
    dropSeries(options) {
        const db = "database" in options ? options.database : this.defaultDB();
        let q = "drop series";
        if ("measurement" in options) {
            q += " from " + b.parseMeasurement(options);
        }
        if ("where" in options) {
            q += " where " + b.parseWhere(options);
        }
        return this.pool.json(this.getQueryOpts({ db, q }, "POST")).then(results_1.assertNoErrors);
    }
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
    getUsers() {
        return this.pool.json(this.getQueryOpts({ q: "show users" })).then(results_1.parseSingle);
    }
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
    createUser(username, password, admin = false) {
        return this.pool.json(this.getQueryOpts({
            q: `create user ${grammar.escape.quoted(username)} with password `
                + grammar.escape.stringLit(password)
                + (admin ? " with all privileges" : ""),
        }, "POST")).then(results_1.assertNoErrors);
    }
    /**
     * Sets a password for an Influx user.
     * @param {String} username
     * @param {String} password
     * @returns {Promise<void>}
     * @example
     * influx.setPassword('connor', 'pa55w0rd')
     */
    setPassword(username, password) {
        return this.pool.json(this.getQueryOpts({
            q: `set password for ${grammar.escape.quoted(username)} = `
                + grammar.escape.stringLit(password),
        }, "POST")).then(results_1.assertNoErrors);
    }
    /**
     * Grants a privilege to a specified user.
     * @param {String} username
     * @param {String} privilege Should be one of "READ" or "WRITE"
     * @param {String} [database] If not provided, uses the default database.
     * @returns {Promise<void>}
     * @example
     * influx.grantPrivilege('connor', 'READ', 'my_db') // grants read access on my_db to connor
     */
    grantPrivilege(username, privilege, database = this.defaultDB()) {
        return this.pool.json(this.getQueryOpts({
            q: `grant ${privilege} to ${grammar.escape.quoted(username)} on `
                + grammar.escape.quoted(database),
        }, "POST")).then(results_1.assertNoErrors);
    }
    /**
     * Removes a privilege from a specified user.
     * @param {String} username
     * @param {String} privilege Should be one of "READ" or "WRITE"
     * @param {String} [database] If not provided, uses the default database.
     * @returns {Promise<void>}
     * @example
     * influx.revokePrivilege('connor', 'READ', 'my_db') // removes read access on my_db from connor
     */
    revokePrivilege(username, privilege, database = this.defaultDB()) {
        return this.pool.json(this.getQueryOpts({
            q: `revoke ${privilege} from ${grammar.escape.quoted(username)} on `
                + grammar.escape.quoted(database),
        }, "POST")).then(results_1.assertNoErrors);
    }
    /**
     * Grants admin privileges to a specified user.
     * @param {String} username
     * @returns {Promise<void>}
     * @example
     * influx.grantAdminPrivilege('connor')
     */
    grantAdminPrivilege(username) {
        return this.pool.json(this.getQueryOpts({
            q: `grant all to ${grammar.escape.quoted(username)}`,
        }, "POST")).then(results_1.assertNoErrors);
    }
    /**
     * Removes a admin privilege from a specified user.
     * @param {String} username
     * @returns {Promise<void>}
     * @example
     * influx.revokeAdminPrivilege('connor')
     */
    revokeAdminPrivilege(username) {
        return this.pool.json(this.getQueryOpts({
            q: `revoke all from ${grammar.escape.quoted(username)}`,
        }, "POST")).then(results_1.assertNoErrors);
    }
    /**
     * Removes a user from the database.
     * @param {String} username
     * @returns {Promise<void>}
     * @example
     * influx.dropUser('connor')
     */
    dropUser(username) {
        return this.pool.json(this.getQueryOpts({
            q: `drop user ${grammar.escape.quoted(username)}`,
        }, "POST")).then(results_1.assertNoErrors);
    }
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
    createContinuousQuery(name, query, database = this.defaultDB()) {
        return this.pool.json(this.getQueryOpts({
            q: `create continuous query ${grammar.escape.quoted(name)}`
                + ` on ${grammar.escape.quoted(database)} begin ${query} end`,
        }, "POST")).then(results_1.assertNoErrors);
    }
    /**
     * Returns a list of continous queries in the database.
     * @param {String} [database] If not provided, uses the default database.
     * @returns {Promise<void>}
     * @example
     * influx.showContinousQueries()
     */
    showContinousQueries(database = this.defaultDB()) {
        return this.pool.json(this.getQueryOpts({
            db: database,
            q: "show continuous queries",
        })).then(results_1.parseSingle);
    }
    /**
     * Creates a continuous query in a database
     * @param {String} name The query name
     * @param {String} [database] If not provided, uses the default database.
     * @returns {Promise<void>}
     * @example
     * influx.dropContinuousQuery('downsample_cpu_1h')
     */
    dropContinuousQuery(name, database = this.defaultDB()) {
        return this.pool.json(this.getQueryOpts({
            q: `drop continuous query ${grammar.escape.quoted(name)}`
                + ` on ${grammar.escape.quoted(database)}`,
        }, "POST")).then(results_1.assertNoErrors);
    }
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
    createRetentionPolicy(name, options) {
        const q = `create retention policy ${grammar.escape.quoted(name)} on `
            + grammar.escape.quoted(options.database || this.defaultDB())
            + ` duration ${options.duration} replication ${options.replication}`
            + (options.default ? " default" : "");
        return this.pool.json(this.getQueryOpts({ q }, "POST")).then(results_1.assertNoErrors);
    }
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
    alterRetentionPolicy(name, options) {
        const q = `alter retention policy ${grammar.escape.quoted(name)} on `
            + grammar.escape.quoted(options.database || this.defaultDB())
            + ` duration ${options.duration} replication ${options.replication}`
            + (options.default ? " default" : "");
        return this.pool.json(this.getQueryOpts({ q }, "POST")).then(results_1.assertNoErrors);
    }
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
    dropRetentionPolicy(name, database = this.defaultDB()) {
        return this.pool.json(this.getQueryOpts({
            q: `drop retention policy ${grammar.escape.quoted(name)} `
                + `on ${grammar.escape.quoted(database)}`,
        }, "POST")).then(results_1.assertNoErrors);
    }
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
    showRetentionPolicies(database = this.defaultDB()) {
        return this.pool.json(this.getQueryOpts({
            q: `show retention policies on ${grammar.escape.quoted(database)}`,
        }, "GET")).then(results_1.parseSingle);
    }
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
    writePoints(points, options = {}) {
        const { database = this.defaultDB(), precision = "n", retentionPolicy, } = options;
        let payload = "";
        points.forEach(point => {
            const { fields = {}, tags = {}, measurement, timestamp, } = point;
            const schema = this.schema[database] && this.schema[database][measurement];
            const fieldsPairs = schema ? schema.coerceFields(fields) : schema_1.coerceBadly(fields);
            const tagsNames = schema ? schema.checkTags(tags) : Object.keys(tags);
            payload += (payload.length > 0 ? "\n" : "") + measurement;
            for (let i = 0; i < tagsNames.length; i++) {
                payload += ","
                    + grammar.escape.tag(tagsNames[i])
                    + "="
                    + grammar.escape.tag(tags[tagsNames[i]]);
            }
            for (let i = 0; i < fieldsPairs.length; i++) {
                payload += (i === 0 ? " " : ",")
                    + grammar.escape.tag(fieldsPairs[i][0])
                    + "="
                    + fieldsPairs[i][1];
            }
            if (timestamp !== undefined) {
                payload += " " + grammar.castTimestamp(timestamp, precision);
            }
        });
        return this.pool.discard({
            body: payload,
            method: "POST",
            path: "/write",
            query: Object.assign({
                db: database,
                p: this.options.password,
                precision,
                rp: retentionPolicy,
                u: this.options.username,
            }),
        });
    }
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
    writeMeasurement(measurement, points, options = {}) {
        points = points.map(p => Object.assign({ measurement }, p));
        return this.writePoints(points, options);
    }
    /**
     * .query() run a query (or list of queries), runs them, and returns the
     * results in a friendly format. If you run multiple queries, multiple
     * sets of results will be returned, otherwise a single result will
     * be returned.
     *
     * @param {String|String[]} query
     * @param {QueryOptions} [options]
     * @return {Promise<Results|Results[]>} query
     * @example
     * influx.query('select * from perf').then(results => {
     *   console.log(results)
     * })
     */
    query(query, options = {}) {
        if (Array.isArray(query)) {
            query = query.join(";");
        }
        // If the consumer asked explicitly for nanosecond precision parsing,
        // remove that to cause Influx to give us ISO dates that
        // we can parse correctly.
        if (options.precision === "n") {
            options = Object.assign({}, options); // avoid mutating
            delete options.precision;
        }
        return this.queryRaw(query, options).then(res => results_1.parse(res, options.precision));
    }
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
    queryRaw(query, options = {}) {
        const { database = this.defaultDB(), retentionPolicy, } = options;
        return this.pool.json(this.getQueryOpts({
            db: database,
            epoch: options.precision,
            q: query,
            rp: retentionPolicy,
        }));
    }
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
    ping(timeout) {
        return this.pool.ping(timeout);
    }
    /**
     * Returns the default database that queries operates on. It throws if called
     * when a default database isn't set.
     * @private
     */
    defaultDB() {
        if (!this.options.database) {
            throw new Error("Attempted to run an influx query without a default"
                + " database specified or an explicit database provided.");
        }
        return this.options.database;
    }
    /**
     * Creates options to be passed into the pool to query databases.
     * @private
     */
    getQueryOpts(params, method = "GET") {
        return {
            method,
            path: "/query",
            query: Object.assign({
                p: this.options.password,
                u: this.options.username,
            }, params),
        };
    }
}
exports.InfluxDB = InfluxDB;
