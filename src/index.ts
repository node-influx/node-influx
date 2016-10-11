import { Pool, PoolOptions } from "./pool";
import { Results, parse, parseSingle } from "./results";
import { Schema, SchemaOptions, coerceBadly } from "./schema";

import * as b from "./builder";
import * as grammar from "./grammar";
import * as url from "url";

const defaultHost: HostConfig = Object.freeze({
  host: "127.0.0.1",
  port: 8086,
  protocol: <"http"> "http",
});

const defaultOptions: ClusterConfig = Object.freeze({
  database: null,
  hosts: [],
  password: "root",
  schema: [],
  username: "root",
});

export * from "./builder";
export { FieldType, Precision, TimePrecision, toNanoDate } from "./grammar";
export { SchemaOptions } from "./schema";
export { PoolOptions } from "./pool";

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
  tags?: { [name: string]: string };

  /**
   * Fields is the list of field values to insert.
   */
  fields?: { [name: string]: grammar.FieldType };

  /**
   * Timestamp tags this measurement with a date. This can be a Date object,
   * in which case we'll adjust it to the desired precision, or a numeric
   * string or number, in which case it gets passed directly to Influx.
   */
  timestamp: Date | string | number;
}

export interface WriteOptions {

  /**
   * Precision at which the points are written, defaults to milliseconds "ms".
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
   * Epoch defining the precision at which to query points.
   *
   * WARNING: if this, is set to nanoseconds `ns`, timestamps will be unable
   * to correctly be represented in JavaScript due to precision limitations.
   * If this is left unset, Influx returns an ISO formatted date from which
   * we are able to parse nanosecond precision dates (see the Results type).
   */
  epoch?: grammar.TimePrecision;

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
 * Parses the URL out into into a ClusterConfig object
 */
function parseOptionsUrl(addr: string): SingleHostConfig {
  const parsed = url.parse(addr);
  const options: SingleHostConfig = {
    host: parsed.hostname,
    port: Number(parsed.port),
    protocol: <"http" | "https"> parsed.protocol.slice(0, -1),
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
function defaults<T>(target: T, ...srcs: T[]): T {
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
 */
export class InfluxDB {

  /**
   * Connect pool for making requests.
   * @private
   */
  private pool: Pool;

  /**
   * Config options for Influx.
   * @private
   */
  private options: ClusterConfig;

  /**
   * Map of Schema instances defining measurements in Influx.
   * @private
   */
  private schema: { [db: string]: { [measurement: string]: Schema } } = Object.create(null);

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
   * Connect to a single InfluxDB instance by specifying
   * a set of connection options.
   * @param {ClusterConfig|SingleHostConfig|string} options
   *
   * @example
   * import { InfluxDB } from 'influx'; // or const InfluxDB = require('influx').InfluxDB
   *
   * // Connect to a single host with a DSN:
   * const client = new InfluxDB('http://user:password@host:8086/database')
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
   *
   * @example
   * import { InfluxDB } from 'influx'; // or const InfluxDB = require('influx').InfluxDB
   *
   * // Use a pool of several host connections and balance queries across them:
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
   *
   */
  constructor (options?: any) {
    // Figure out how to parse whatever we were passed in into a ClusterConfig.
    if (typeof options === "string") { // plain URI => SingleHostConfig
      options = parseOptionsUrl(options);
    } else if (!options) {
      options = defaultHost;
    }
    if (!options.hasOwnProperty("hosts")) { // SingleHostConfig => ClusterConfig
      options = {
        database: options.database,
        hosts: [options],
        password: options.password,
        pool: options.pool,
        schema: options.schema,
        username: options.username,
      };
    }

    const resolved = <ClusterConfig> options;
    resolved.hosts = resolved.hosts.map(host => {
      return defaults({
        host: host.host,
        port: host.port,
        protocol: host.protocol,
      }, defaultHost);
    });

    this.pool = new Pool(resolved.pool);
    this.options = defaults(resolved, defaultOptions);

    resolved.hosts.forEach(host => {
      this.pool.addHost(`${host.protocol}://${host.host}:${host.port}`);
    });

    this.options.schema.forEach(schema => {
      const db = schema.database || this.options.database;
      if (!db) {
        throw new Error(
          `Schema ${schema.measurement} doesn't have a database specified,` +
          "and no default database is provided!"
        );
      }
      if (!this.schema[db]) {
        this.schema[db] = Object.create(null);
      }

      this.schema[db][schema.measurement] = new Schema(schema);
    });
  }

  /**
   * Creates a new database with the provided name.
   * @param {string} databaseName
   * @return {Promise.<void>}
   * @example
   * return influx.createDatabase('mydb')
   */
  public createDatabase (databaseName: string): Promise<void> {
    return this.pool.discard(this.getQueryOpts({
      q: `create database ${grammar.escape.quoted(databaseName)}`,
    }, "POST"));
  }

  /**
   * Deletes a database with the provided name.
   * @param {string} databaseName
   * @return {Promise.<void>}
   * @example
   * return influx.createDatabase('mydb')
   */
  public dropDatabase (databaseName: string): Promise<void> {
    return this.pool.discard(this.getQueryOpts({
      q: `drop database ${grammar.escape.quoted(databaseName)}`,
    }, "POST"));
  }

  /**
   * Returns array of database names. Requires cluster admin privileges.
   * @returns {Promise<String[]>} a list of database names
   * @example
   * return influx.getMeasurements().then(names =>
   *   console.log('My database names are: ' + names.join(', ')));
   */
  public getDatabaseNames (): Promise<string[]> {
    return this.pool.json(this.getQueryOpts({ q: "show databases" }))
      .then(res => parseSingle<{ name: string }>(res).map(r => r.name));
  }

  /**
   * Returns array of measurements.
   * @returns {Promise<String[]>} a list of measurement names
   * @example
   * return influx.getMeasurements().then(names =>
   *   console.log('My measurement names are: ' + names.join(', ')));
   */
  public getMeasurements (): Promise<string[]> {
    return this.pool.json(this.getQueryOpts({ q: "show measurements" }))
      .then(res => parseSingle<{ name: string }>(res).map(r => r.name));
  }

  /**
   * Returns a list of all series within the target measurement, or from the
   * entire database if a measurement isn't provided.
   * @param {String} [measurement] if provided, we'll only get series from
   *     within that measurement.
   * @returns {Promise<String[]>} a list of series names
   * @example
   * influx.getSeries().then(names =>
   *   console.log('My series names are: ' + names.join(', ')));
   *
   * influx.getSeries("my_measurement").then(names =>
   *   console.log('My series names in my_measurement are: ' + names.join(', ')));
   */
  public getSeries (measurement?: string): Promise<string[]> {
    let query = "show series";
    if (measurement) {
      query += ` from ${grammar.escape.quoted(measurement)}`;
    }

    return this.pool.json(this.getQueryOpts({ q: query }))
      .then(res => parseSingle<{ key: string }>(res).map(r => r.key));
  }

  /**
   * Removes a measurement from the database.
   * @param {string} measurementName
   * @return {Promise.<void>}
   * @example
   * dropMeasurement('my_measurement', err => done(err))
   * // => DROP MEASUREMENT "my_measurement"
   */
  public dropMeasurement(measurementName: string): Promise<void> {
    return this.pool.discard(this.getQueryOpts({
      q: `drop measurement ${grammar.escape.quoted(measurementName)}`,
    }, "POST"));
  }

  /**
   * Removes a one or more series from InfluxDB.
   *
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
   *   where: e => e.tag('cpu').equals.value('cpu8')
   * })
   * // DROP SERIES FROM "autogen"."cpu" WHERE "cpu" = 'cpu8'
   */
  public dropSeries(options: b.measurement | b.where | (b.measurement & b.where)): Promise<void> {
    let q = "drop series";
    if ("measurement" in options) {
      q += " from " + b.parseMeasurement(<b.measurement> options);
    }
    if ("where" in options) {
      q += " where " + b.parseWhere(<b.where> options);
    }

    return this.pool.discard(this.getQueryOpts({ q }, "POST"));
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
  public getUsers(): Promise<{ user: string, admin: boolean}[]> {
    return this.pool.json(this.getQueryOpts({ q: "show users" })).then(parseSingle);
  }

  /**
   * Creates a new InfluxDB user.
   * @param {String} username
   * @param {String} password
   * @param {String} [admin=false] If true, the user will be given all
   *     privileges on all databases.
   * @returns {Promise<void>}
   * @example
   * influx.createUser('connor', 'pa55w0rd', true) // make 'connor' an admin
   *
   * // make non-admins:
   * influx.createUser('not_admin', 'pa55w0rd')
   */
  public createUser(
    username: string, password: string,
    admin: boolean = false,
  ): Promise<void> {
    return this.pool.discard(this.getQueryOpts({
      q: `create user ${grammar.escape.quoted(username)} with password `
        + grammar.escape.stringLit(password)
        + (admin ? " with all privileges" : ""),
    }, "POST"));
  }

  /**
   * Sets a password for an Influx user.
   * @param {String} username
   * @param {String} password
   * @returns {Promise<void>}
   * @example
   * influx.setPassword('connor', 'pa55w0rd')
   */
  public setPassword(username: string, password: string): Promise<void> {
    return this.pool.discard(this.getQueryOpts({
      q: `set password for ${grammar.escape.quoted(username)} = `
        + grammar.escape.stringLit(password),
    }, "POST"));
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
  public grantPrivilege(username: string, privilege: "READ" | "WRITE",
                        database: string = this.defaultDB()): Promise<void> {

    return this.pool.discard(this.getQueryOpts({
      q: `grant ${privilege} to ${grammar.escape.quoted(username)} on `
        + grammar.escape.quoted(database),
    }, "POST"));
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
  public revokePrivilege(username: string, privilege: "READ" | "WRITE",
                         database: string = this.defaultDB()): Promise<void> {

    return this.pool.discard(this.getQueryOpts({
      q: `revoke ${privilege} from ${grammar.escape.quoted(username)} on `
        + grammar.escape.quoted(database),
    }, "POST"));
  }

  /**
   * Grants admin privileges to a specified user.
   * @param {String} username
   * @returns {Promise<void>}
   * @example
   * influx.grantAdminPrivilege('connor', 'READ', 'my_db')
   */
  public grantAdminPrivilege(username: string): Promise<void> {
    return this.pool.discard(this.getQueryOpts({
      q: `grant all to ${grammar.escape.quoted(username)}`,
    }, "POST"));
  }

  /**
   * Removes a admin privilege from a specified user.
   * @param {String} username
   * @returns {Promise<void>}
   * @example
   * influx.revokeAdminPrivilege('connor')
   */
  public revokeAdminPrivilege(username: string): Promise<void> {
    return this.pool.discard(this.getQueryOpts({
      q: `revoke all from ${grammar.escape.quoted(username)}`,
    }, "POST"));
  }

  /**
   * Removes a user from the database.
   * @param {String} username
   * @returns {Promise<void>}
   * @example
   * influx.dropUser('connor')
   */
  public dropUser(username: string): Promise<void> {
    return this.pool.discard(this.getQueryOpts({
      q: `drop user ${grammar.escape.quoted(username)}`,
    }, "POST"));
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
  public createContinuousQuery(name: string, query: string,
                               database: string = this.defaultDB()): Promise<void> {

    return this.pool.discard(this.getQueryOpts({
      q: `create continuous query ${grammar.escape.quoted(name)}`
        + ` on ${grammar.escape.quoted(database)} begin ${query} end`,
    }, "POST"));
  }

  /**
   * Creates a continuous query in a database
   * @param {String} name The query name
   * @param {String} [database] If not provided, uses the default database.
   * @returns {Promise<void>}
   * @example
   * influx.dropContinuousQuery('downsample_cpu_1h')
   */
  public dropContinuousQuery(name: string, database: string = this.defaultDB()): Promise<void> {
    return this.pool.discard(this.getQueryOpts({
      q: `drop continuous query ${grammar.escape.quoted(name)}`
        + ` on ${grammar.escape.quoted(database)}`,
    }, "POST"));
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
  public writePoints(points: Point[], options: WriteOptions = {}): Promise<void> {
    const {
      database = this.defaultDB(),
      precision = <grammar.TimePrecision> "ms",
      retentionPolicy,
    } = options;

    let payload = "";
    points.forEach(point => {
      const {
        fields = {},
        tags = {},
        measurement,
        timestamp,
      } = point;

      const schema = this.schema[database] && this.schema[database][measurement];
      const fieldsPairs = schema ? schema.coerceFields(fields) : coerceBadly(fields);
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
  public writeMeasurement(measurement: string, points: Point[],
                          options: WriteOptions = {}): Promise<void> {
    points = points.map(p => Object.assign({ measurement }, p));
    return this.writePoints(points, options);
  }

  public query<T>(query: string[], options?: QueryOptions): Promise<Results<T>>;
  public query<T>(query: string, options?: QueryOptions): Promise<Results<T>[]>;

  /**
   * .query() run a query (or list of queries), runs them, and returns the
   * results in a friendly format.
   *
   * @example
   * influx.query('select * from perf').then(results => {
   *   console.log(results)
   * })
   */
  public query<T>(
    query: string | string[],
    options: QueryOptions = {}
  ): Promise<Results<T> | Results<T>> {
    if (Array.isArray(query)) {
      query = query.join(";");
    }

    return this.queryRaw(query, options).then(res => parse(res, options.epoch));
  }

  /**
   * queryRaw functions similarly to .query() but it does no fancy parsing on
   * the JSON object that InfluxDB returns.
   *
   * @example
   * influx.queryRaw('select * from perf').then(rawData => {
   *   console.log(rawData)
   * })
   */
  public queryRaw<T>(query: string, options: QueryOptions = {}): Promise<any> {
    const {
      database = this.defaultDB(),
      epoch,
      retentionPolicy,
    } = options;

    return this.pool.json(this.getQueryOpts({
      db: database,
      epoch,
      q: query,
      rp: retentionPolicy,
    }));
  }

  /**
   * Returns the default database that queries operates on. It throws if called
   * when a default database isn't set.
   */
  private defaultDB(): string {
    if (!this.options.database) {
      throw new Error("Attempted to run an influx query without a default"
        + " database specified or an explicit interface provided.");
    }

    return this.options.database;
  }

  /**
   * Creates options to be passed into the pool to query databases.
   */
  private getQueryOpts (params: any, method: string = "GET"): any {
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
