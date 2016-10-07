import { Pool, PoolOptions } from "./pool";
import { parseSingle } from "./results";
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

export const FieldType = grammar.FieldType;

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
   * @type {[type]}
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
   * @type {[type]}
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

/**
 * Point is passed to the client's write methods to store a point in InfluxDB.
 */
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
  precision?: grammar.PrecisionIdent;

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
 * InfluxDB is the primary means of querying the database.
 * @public
 */
export class InfluxDB {

  private pool: Pool;
  private options: ClusterConfig;

  /**
   * Map of Schema instances defining measurements in Influx.
   */
  private schema: { [db: string]: { [measurement: string]: Schema } } = Object.create(null);

  /**
   * Connect to a single InfluxDB instance by specifying
   * a set of connection options.
   */
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
   * @example
   * return influx.createDatabase('mydb')
   */
  public createDatabase (databaseName: string): Promise<void> {
    return this.pool.discard(this.getQueryOpts({
      q: `create database ${grammar.quoteEscaper.escape(databaseName)}`,
    }, "POST"));
  }

  /**
   * Deletes a database with the provided name.
   * @example
   * return influx.createDatabase('mydb')
   */
  public dropDatabase (databaseName: string): Promise<void> {
    return this.pool.discard(this.getQueryOpts({
      q: `drop database ${grammar.quoteEscaper.escape(databaseName)}`,
    }, "POST"));
  }

  /**
   * Returns array of database names. Requires cluster admin privileges.
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
      query += ` from ${grammar.quoteEscaper.escape(measurement)}`;
    }

    return this.pool.json(this.getQueryOpts({ q: query }))
      .then(res => parseSingle<{ key: string }>(res).map(r => r.key));
  }

  /**
   * Removes a measurement from the database.
   * @example
   * dropMeasurement('my_measurement', err => done(err))
   * // => DROP MEASUREMENT "my_measurement"
   */
  public dropMeasurement(measurementName: string): Promise<void> {
    return this.pool.discard(this.getQueryOpts({
      q: `drop measurement ${grammar.quoteEscaper.escape(measurementName)}`,
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
   *
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

  public createUser(username: string, password: string,
                    isAdmin: boolean, callback?: any): Promise<void>;
  public createUser(username: string, password: string, callback?: any): Promise<void>;

  /**
   * Creates a new InfluxDB user.
   *
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
      q: `create user ${grammar.quoteEscaper.escape(username)} with password `
        + grammar.stringLitEscaper.escape(password)
        + (admin ? " with all privileges" : ""),
    }, "POST"));
  }

  /**
   * Sets a password for an Influx user.
   *
   * @example
   * influx.setPassword('connor', 'pa55w0rd')
   */
  public setPassword(username: string, password: string): Promise<void> {
    return this.pool.discard(this.getQueryOpts({
      q: `set password for ${grammar.quoteEscaper.escape(username)} = `
        + grammar.stringLitEscaper.escape(password),
    }, "POST"));
  }

  /**
   * Grants a privilege to a specified user.
   *
   * @example
   * influx.grantPrivilege('connor', 'READ', 'my_db') // grants read access on my_db to connor
   */
  public grantPrivilege(username: string, privilege: "READ" | "WRITE",
                        database: string = this.defaultDB()): Promise<void> {

    return this.pool.discard(this.getQueryOpts({
      q: `grant ${privilege} to ${grammar.quoteEscaper.escape(username)} on `
        + grammar.quoteEscaper.escape(database),
    }, "POST"));
  }

  /**
   * Removes a privilege from a specified user.
   *
   * @example
   * influx.setPassword('connor', 'READ', 'my_db') // removes read access on my_db from connor
   */
  public revokePrivilege(username: string, privilege: "READ" | "WRITE",
                         database: string = this.defaultDB()): Promise<void> {

    return this.pool.discard(this.getQueryOpts({
      q: `revoke ${privilege} from ${grammar.quoteEscaper.escape(username)} on `
        + grammar.quoteEscaper.escape(database),
    }, "POST"));
  }

  /**
   * Grants admin privileges to a specified user.
   *
   * @example
   * influx.grantAdminPrivilege('connor', 'READ', 'my_db')
   */
  public grantAdminPrivilege(username: string): Promise<void> {
    return this.pool.discard(this.getQueryOpts({
      q: `grant all to ${grammar.quoteEscaper.escape(username)}`,
    }, "POST"));
  }

  /**
   * Removes a admin privilege from a specified user.
   *
   * @example
   * influx.revokeAdminPrivilege('connor')
   */
  public revokeAdminPrivilege(username: string): Promise<void> {
    return this.pool.discard(this.getQueryOpts({
      q: `revoke all from ${grammar.quoteEscaper.escape(username)}`,
    }, "POST"));
  }

  /**
   * Removes a user from the database.
   *
   * @example
   * influx.dropUser('connor')
   */
  public dropUser(username: string): Promise<void> {
    return this.pool.discard(this.getQueryOpts({
      q: `drop user ${grammar.quoteEscaper.escape(username)}`,
    }, "POST"));
  }

  /**
   * Creates a continuous query in a database
   *
   * @example
   * influx.createContinuousQuery('downsample_cpu_1h', `
   *   SELECT MEAN(cpu) INTO "7d"."perf"
   *   FROM "1d"."perf" GROUP BY time(1m)
   * `)
   */
  public createContinuousQuery(name: string, query: string,
                               database: string = this.defaultDB()): Promise<void> {

    return this.pool.discard(this.getQueryOpts({
      q: `create continuous query ${grammar.quoteEscaper.escape(name)}`
        + ` on ${grammar.quoteEscaper.escape(database)} begin ${query} end`,
    }, "POST"));
  }

  /**
   * Creates a continuous query in a database
   *
   * @example
   * influx.dropContinuousQuery('downsample_cpu_1h')
   */
  public dropContinuousQuery(name: string, database: string = this.defaultDB()): Promise<void> {
    return this.pool.discard(this.getQueryOpts({
      q: `drop continuous query ${grammar.quoteEscaper.escape(name)}`
        + ` on ${grammar.quoteEscaper.escape(database)}`,
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
   * In the options, you can include the database name to write to (we use
   * the `database` specified in options you passed to `new Influx(option)`
   * if it's not provided) and the retention policy and time
   * precision to write the points with.
   *
   * A note when using manually-specified times and precisions: by default
   * we write using the `ms` precision since that's what JavaScript gives us.
   * You can adjust this. However, there is some special behaviour if you
   * manually specify a timestamp in your points:
   *  - if you specify the timestamp as a Date object, we'll convert it to
   *    milliseconds and multiply or divide as needed to get the right time
   *  - if you provide a string or number as the timestamp, we'll pass it
   *    straight into Influx.
   *
   * Please see the Point and WriteOptions type for a
   * full list of possible options.
   *
   * For best performance, it's recommended that you batch your data into
   * sets of a couple thousand records before writing it. In the future we'll
   * have some utilities within node-influx to make this easier.
   *
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
      precision = <grammar.PrecisionIdent> "ms",
      retentionPolicy = "DEFAULT",
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
          + grammar.tagEscaper.escape(tagsNames[i])
          + "="
          + grammar.tagEscaper.escape(tags[tagsNames[i]]);
      }

      for (let i = 0; i < fieldsPairs.length; i++) {
        payload += (i === 0 ? " " : ",")
          + grammar.tagEscaper.escape(fieldsPairs[i][0])
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
   * writeMeasurement functions similarly to .writePoints(), but it
   * automatically fills in the `measurement` value for all points for you.
   *
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
        epoch: "ms",
        p: this.options.password,
        u: this.options.username,
      }, params),
    };
  }
}
