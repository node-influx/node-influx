/* eslint-disable @typescript-eslint/unified-signatures */
/* eslint-disable no-prototype-builtins */

import { RequestOptions } from "https";
import * as url from "url";

import * as b from "./builder";
import * as grammar from "./grammar";
import * as querystring from "querystring";
import { IPingStats, IPoolOptions, Pool } from "./pool";
import { assertNoErrors, IResults, parse, parseSingle } from "./results";
import { coerceBadly, ISchemaOptions, Schema } from "./schema";

const defaultHost: IHostConfig = Object.freeze({
  host: "127.0.0.1",
  port: 8086,
  path: "",
  protocol: "http" as const,
});

const defaultOptions: IClusterConfig = Object.freeze({
  database: null,
  hosts: [],
  password: "root",
  schema: [],
  username: "root",
});

export * from "./builder";
export {
  INanoDate,
  FieldType,
  Precision,
  Raw,
  TimePrecision,
  escape,
  toNanoDate,
} from "./grammar";
export { ISchemaOptions } from "./schema";
export { IPingStats, IPoolOptions } from "./pool";
export { IResults, IResponse, ResultError } from "./results";

export interface IHostConfig {
  /**
   * Influx host to connect to, defaults to 127.0.0.1.
   */
  host?: string;
  /**
   * Influx port to connect to, defaults to 8086.
   */
  port?: number;
  /**
   * Path for Influx within the host, defaults to ''.
   * May be used if Influx is behind a reverse proxy or load balancer.
   */
  path?: string;
  /**
   * Protocol to connect over, defaults to 'http'.
   */
  protocol?: "http" | "https";

  /**
   * Optional request option overrides.
   */
  options?: RequestOptions;
}

export interface ISingleHostConfig extends IHostConfig {
  /**
   * Username for connecting to the database. Defaults to 'root'.
   */
  username?: string;

  /**
   * Password for connecting to the database. Defaults to 'root'.
   */
  password?: string;

  /**
   * Default database to write information to.
   */
  database?: string;

  /**
   * Settings for the connection pool.
   */
  pool?: IPoolOptions;

  /**
   * A list of schema for measurements in the database.
   */
  schema?: ISchemaOptions[];
}

export interface IClusterConfig {
  /**
   * Username for connecting to the database. Defaults to 'root'.
   */
  username?: string;

  /**
   * Password for connecting to the database. Defaults to 'root'.
   */
  password?: string;

  /**
   * Default database to write information to.
   */
  database?: string;

  /**
   * A list of cluster hosts to connect to.
   */
  hosts: IHostConfig[];

  /**
   * Settings for the connection pool.
   */
  pool?: IPoolOptions;

  /**
   * A list of schema for measurements in the database.
   */
  schema?: ISchemaOptions[];
}

export interface IPoint {
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
  fields?: { [name: string]: any };

  /**
   * Timestamp tags this measurement with a date. This can be a Date object,
   * in which case we'll adjust it to the desired precision, or a numeric
   * string or number, in which case it gets passed directly to Influx.
   */
  timestamp?: Date | string | number;
}

export interface IParsedPoint extends IPoint {
  /**
   * Fields Pairs is the list of key/value pairs for each field on the point
   */
  fieldsPairs: Array<[string, string]>;
  /**
   * Tags Names is the list of tag names in the point
   */
  tagsNames: string[];
  /**
   * Casted Timestamp is the timestamp value after being casted to the
   * desired precision. Default 'n'
   */
  castedTimestamp?: string;
}

export interface IWriteOptions {
  /**
   * Precision at which the points are written, defaults to nanoseconds 'n'.
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

export interface IQueryOptions {
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

  /**
   * Any placeholders used by the query. Using these is strongly recommended
   * to avoid injection attacks.
   */
  placeholders?: Record<string, string | number>;

  /**
   * Execute a query as a HTTP GET or POST request
   */
  method?: "GET" | "POST";
}

export interface IParseOptions {
  /**
   * Precision at which the points are written, defaults to nanoseconds 'n'.
   */
  precision?: grammar.TimePrecision;
  /**
   * Database under which to write the points. This is required if a default
   * database is not provided in Influx.
   */
  database?: string;
}

/**
 * IRetentionOptions are passed into passed into the {@link
 * InfluxDB#createRetentionPolicy} and {@link InfluxDB#alterRetentionPolicy}.
 * See the [Downsampling and Retention page](https://docs.influxdata.com/
 * influxdb/v1.0/guides/downsampling_and_retention/) on the Influx docs for
 * more information.
 */
export interface IRetentionOptions {
  database?: string;
  duration: string;
  replication: number;
  isDefault?: boolean;
}

/**
 * Parses the URL out into into a IClusterConfig object
 */
function parseOptionsUrl(addr: string): ISingleHostConfig {
  const parsed = url.parse(addr);
  const options: ISingleHostConfig = {
    host: parsed.hostname,
    port: Number(parsed.port),
    protocol: parsed.protocol.slice(0, -1) as "http" | "https",
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
  srcs.forEach((src) => {
    Object.keys(src).forEach((key: Extract<keyof T, string>) => {
      if (target[key] === undefined) {
        target[key] = src[key];
      }
    });
  });

  return target;
}

/**
 * InfluxDB is the public interface to run queries against your database.
 * This is a 'driver-level' module, not a a full-fleged ORM or ODM; you run
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
 * @example
 * // Connect over HTTPS
 * const Influx = require('influx');
 * const influx = new Influx.InfluxDB({
 *  host: 'myinfluxdbhost',
 *  port: 443,
 *  protocol: 'https'
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
 *     where host = $<host>
 *     order by time desc
 *     limit 10
 *   `, {
 *      placeholders: {
 *        host: os.hostname()
 *      }
 *   })
 * }).then(rows => {
 *   rows.forEach(row => console.log(`A request to ${row.path} took ${row.duration}ms`))
 * })
 */
export class InfluxDB {
  /**
   * Connect pool for making requests.
   * @private
   */
  private readonly _pool: Pool;

  /**
   * Config options for Influx.
   * @private
   */
  private readonly _options: IClusterConfig;

  /**
   * Map of Schema instances defining measurements in Influx.
   * @private
   */
  private _schema: {
    [db: string]: { [measurement: string]: Schema };
  } = Object.create(null);

  constructor(options: ISingleHostConfig);

  /**
   * Connect to an InfluxDB cluster by specifying a
   * set of connection options.
   */
  constructor(options: IClusterConfig);

  /**
   * Connect to an InfluxDB instance using a configuration URL.
   * @example
   * new InfluxDB('http://user:password@host:8086/database')
   */
  constructor(url: string);

  /**
   * Connects to a local, default Influx instance.
   */
  constructor();

  /**
   * Connect to a single InfluxDB instance by specifying
   * a set of connection options.
   * @param [options='http://root:root@127.0.0.1:8086']
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
  constructor(options?: any) {
    // Figure out how to parse whatever we were passed in into a IClusterConfig.
    if (typeof options === "string") {
      // Plain URI => ISingleHostConfig
      options = parseOptionsUrl(options);
    } else if (!options) {
      options = defaultHost;
    }

    if (!options.hasOwnProperty("hosts")) {
      // ISingleHostConfig => IClusterConfig
      options = {
        database: options.database,
        hosts: [options],
        password: options.password,
        pool: options.pool,
        schema: options.schema,
        username: options.username,
      };
    }

    const resolved = options as IClusterConfig;
    resolved.hosts = resolved.hosts.map((host) => {
      return defaults(
        {
          host: host.host,
          port: host.port,
          path: host.path,
          protocol: host.protocol,
          options: host.options,
        },
        defaultHost
      );
    });

    this._pool = new Pool(resolved.pool);
    this._options = defaults(resolved, defaultOptions);

    resolved.hosts.forEach((host) => {
      this._pool.addHost(
        `${host.protocol}://${host.host}:${host.port}${host.path}`,
        host.options
      );
    });

    this._options.schema.forEach((schema) => this._createSchema(schema));
  }

  /**
   * Adds specified schema for better fields coercing.
   *
   * @param {ISchemaOptions} schema
   * @memberof InfluxDB
   */
  public addSchema(schema: ISchemaOptions): void {
    this._createSchema(schema);
  }

  /**
   * Creates a new database with the provided name.
   * @param databaseName
   * @return
   * @example
   * influx.createDatabase('mydb')
   */
  public createDatabase(databaseName: string): Promise<void> {
    return this._pool
      .json(
        this._getQueryOpts(
          {
            q: `create database ${grammar.escape.quoted(databaseName)}`,
          },
          "POST"
        )
      )
      .then(assertNoErrors)
      .then(() => undefined);
  }

  /**
   * Deletes a database with the provided name.
   * @param databaseName
   * @return
   * @example
   * influx.dropDatabase('mydb')
   */
  public dropDatabase(databaseName: string): Promise<void> {
    return this._pool
      .json(
        this._getQueryOpts(
          {
            q: `drop database ${grammar.escape.quoted(databaseName)}`,
          },
          "POST"
        )
      )
      .then(assertNoErrors)
      .then(() => undefined);
  }

  /**
   * Returns array of database names. Requires cluster admin privileges.
   * @returns a list of database names
   * @example
   * influx.getDatabaseNames().then(names =>
   *   console.log('My database names are: ' + names.join(', ')));
   */
  public getDatabaseNames(): Promise<string[]> {
    return this._pool
      .json(this._getQueryOpts({ q: "show databases" }))
      .then((res) => parseSingle<{ name: string }>(res).map((r) => r.name));
  }

  /**
   * Returns array of measurements.
   * @returns a list of measurement names
   * @param [database] the database the measurement lives in, optional
   *     if a default database is provided.
   * @example
   * influx.getMeasurements().then(names =>
   *   console.log('My measurement names are: ' + names.join(', ')));
   */
  public getMeasurements(
    database: string = this._defaultDB()
  ): Promise<string[]> {
    return this._pool
      .json(
        this._getQueryOpts({
          db: database,
          q: "show measurements",
        })
      )
      .then((res) => parseSingle<{ name: string }>(res).map((r) => r.name));
  }

  /**
   * Returns a list of all series within the target measurement, or from the
   * entire database if a measurement isn't provided.
   * @param [options]
   * @param [options.measurement] if provided, we'll only get series
   *     from within that measurement.
   * @param [options.database] the database the series lives in,
   *     optional if a default database is provided.
   * @returns a list of series names
   * @example
   * influx.getSeries().then(names => {
   *   console.log('My series names in my_measurement are: ' + names.join(', '))
   * })
   *
   * influx.getSeries({
   *   measurement: 'my_measurement',
   *   database: 'my_db'
   * }).then(names => {
   *   console.log('My series names in my_measurement are: ' + names.join(', '))
   * })
   */
  public getSeries(
    options: {
      measurement?: string;
      database?: string;
    } = {}
  ): Promise<string[]> {
    const { database = this._defaultDB(), measurement } = options;

    let query = "show series";
    if (measurement) {
      query += ` from ${grammar.escape.quoted(measurement)}`;
    }

    return this._pool
      .json(
        this._getQueryOpts({
          db: database,
          q: query,
        })
      )
      .then((res) => parseSingle<{ key: string }>(res).map((r) => r.key));
  }

  /**
   * Removes a measurement from the database.
   * @param measurement
   * @param [database] the database the measurement lives in, optional
   *     if a default database is provided.
   * @return
   * @example
   * influx.dropMeasurement('my_measurement')
   */
  public dropMeasurement(
    measurement: string,
    database: string = this._defaultDB()
  ): Promise<void> {
    return this._pool
      .json(
        this._getQueryOpts(
          {
            db: database,
            q: `drop measurement ${grammar.escape.quoted(measurement)}`,
          },
          "POST"
        )
      )
      .then(assertNoErrors)
      .then(() => undefined);
  }

  /**
   * Removes a one or more series from InfluxDB.
   *
   * @returns
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
  public dropSeries(
    options: b.measurement | b.where | { database: string }
  ): Promise<void> {
    const db =
      "database" in options ? (options as any).database : this._defaultDB();

    let q = "drop series";
    if ("measurement" in options) {
      q += " from " + b.parseMeasurement(options);
    }

    if ("where" in options) {
      q += " where " + b.parseWhere(options);
    }

    return this._pool
      .json(this._getQueryOpts({ db, q }, "POST"))
      .then(assertNoErrors)
      .then(() => undefined);
  }

  /**
   * Returns a list of users on the Influx database.
   * @return
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
  public getUsers(): Promise<IResults<{ user: string; admin: boolean }>> {
    return this._pool
      .json(this._getQueryOpts({ q: "show users" }))
      .then((result) => parseSingle<{ user: string; admin: boolean }>(result));
  }

  /**
   * Creates a new InfluxDB user.
   * @param username
   * @param password
   * @param [admin=false] If true, the user will be given all
   *     privileges on all databases.
   * @return
   * @example
   * influx.createUser('connor', 'pa55w0rd', true) // make 'connor' an admin
   *
   * // make non-admins:
   * influx.createUser('not_admin', 'pa55w0rd')
   */
  public createUser(
    username: string,
    password: string,
    admin = false
  ): Promise<void> {
    return this._pool
      .json(
        this._getQueryOpts(
          {
            q:
              `create user ${grammar.escape.quoted(username)} with password ` +
              grammar.escape.stringLit(password) +
              (admin ? " with all privileges" : ""),
          },
          "POST"
        )
      )
      .then(assertNoErrors)
      .then(() => undefined);
  }

  /**
   * Sets a password for an Influx user.
   * @param username
   * @param password
   * @return
   * @example
   * influx.setPassword('connor', 'pa55w0rd')
   */
  public setPassword(username: string, password: string): Promise<void> {
    return this._pool
      .json(
        this._getQueryOpts(
          {
            q:
              `set password for ${grammar.escape.quoted(username)} = ` +
              grammar.escape.stringLit(password),
          },
          "POST"
        )
      )
      .then(assertNoErrors)
      .then(() => undefined);
  }

  /**
   * Grants a privilege to a specified user.
   * @param username
   * @param privilege Should be one of 'READ' or 'WRITE'
   * @param [database] If not provided, uses the default database.
   * @return
   * @example
   * influx.grantPrivilege('connor', 'READ', 'my_db') // grants read access on my_db to connor
   */
  public grantPrivilege(
    username: string,
    privilege: "READ" | "WRITE",
    database: string = this._defaultDB()
  ): Promise<void> {
    return this._pool
      .json(
        this._getQueryOpts(
          {
            q:
              `grant ${privilege} on ${grammar.escape.quoted(database)} ` +
              `to ${grammar.escape.quoted(username)}`,
          },
          "POST"
        )
      )
      .then(assertNoErrors)
      .then(() => undefined);
  }

  /**
   * Removes a privilege from a specified user.
   * @param username
   * @param privilege Should be one of 'READ' or 'WRITE'
   * @param [database] If not provided, uses the default database.
   * @return
   * @example
   * influx.revokePrivilege('connor', 'READ', 'my_db') // removes read access on my_db from connor
   */
  public revokePrivilege(
    username: string,
    privilege: "READ" | "WRITE",
    database: string = this._defaultDB()
  ): Promise<void> {
    return this._pool
      .json(
        this._getQueryOpts(
          {
            q:
              `revoke ${privilege} on ${grammar.escape.quoted(
                database
              )} from ` + grammar.escape.quoted(username),
          },
          "POST"
        )
      )
      .then(assertNoErrors)
      .then(() => undefined);
  }

  /**
   * Grants admin privileges to a specified user.
   * @param username
   * @return
   * @example
   * influx.grantAdminPrivilege('connor')
   */
  public grantAdminPrivilege(username: string): Promise<void> {
    return this._pool
      .json(
        this._getQueryOpts(
          {
            q: `grant all to ${grammar.escape.quoted(username)}`,
          },
          "POST"
        )
      )
      .then(assertNoErrors)
      .then(() => undefined);
  }

  /**
   * Removes a admin privilege from a specified user.
   * @param username
   * @return
   * @example
   * influx.revokeAdminPrivilege('connor')
   */
  public revokeAdminPrivilege(username: string): Promise<void> {
    return this._pool
      .json(
        this._getQueryOpts(
          {
            q: `revoke all from ${grammar.escape.quoted(username)}`,
          },
          "POST"
        )
      )
      .then(assertNoErrors)
      .then(() => undefined);
  }

  /**
   * Removes a user from the database.
   * @param username
   * @return
   * @example
   * influx.dropUser('connor')
   */
  public dropUser(username: string): Promise<void> {
    return this._pool
      .json(
        this._getQueryOpts(
          {
            q: `drop user ${grammar.escape.quoted(username)}`,
          },
          "POST"
        )
      )
      .then(assertNoErrors)
      .then(() => undefined);
  }

  /**
   * Creates a continuous query in a database
   * @param name The query name, for later reference
   * @param query The body of the query to run
   * @param [database] If not provided, uses the default database.
   * @param [resample] If provided, adds resample policy
   * @return
   * @example
   * influx.createContinuousQuery('downsample_cpu_1h', `
   *   SELECT MEAN(cpu) INTO "7d"."perf"
   *   FROM "1d"."perf" GROUP BY time(1m)
   * `, undefined, 'RESAMPLE FOR 7m')
   */
  public createContinuousQuery(
    name: string,
    query: string,
    database: string = this._defaultDB(),
    resample = ""
  ): Promise<void> {
    return this._pool
      .json(
        this._getQueryOpts(
          {
            q:
              `create continuous query ${grammar.escape.quoted(name)}` +
              ` on ${grammar.escape.quoted(
                database
              )} ${resample} begin ${query} end`,
          },
          "POST"
        )
      )
      .then(assertNoErrors)
      .then(() => undefined);
  }

  /**
   * Returns a list of continous queries in the database.
   * @param [database] If not provided, uses the default database.
   * @return
   * @example
   * influx.showContinousQueries()
   */
  public showContinousQueries(database: string = this._defaultDB()): Promise<
    IResults<{
      name: string;
      query: string;
    }>
  > {
    return this._pool
      .json(
        this._getQueryOpts({
          db: database,
          q: "show continuous queries",
        })
      )
      .then((result) =>
        parseSingle<{
          name: string;
          query: string;
        }>(result)
      );
  }

  /**
   * Creates a continuous query in a database
   * @param name The query name
   * @param [database] If not provided, uses the default database.
   * @return
   * @example
   * influx.dropContinuousQuery('downsample_cpu_1h')
   */
  public dropContinuousQuery(
    name: string,
    database: string = this._defaultDB()
  ): Promise<void> {
    return this._pool
      .json(
        this._getQueryOpts(
          {
            q:
              `drop continuous query ${grammar.escape.quoted(name)}` +
              ` on ${grammar.escape.quoted(database)}`,
          },
          "POST"
        )
      )
      .then(assertNoErrors)
      .then(() => undefined);
  }

  /**
   * Creates a new retention policy on a database. You can read more about
   * [Downsampling and Retention](https://docs.influxdata.com/influxdb/v1.0/
   * guides/downsampling_and_retention/) on the InfluxDB website.
   *
   * @param name The retention policy name
   * @param options
   * @param [options.database] Database to create the policy on,
   *     uses the default database if not provided.
   * @param options.duration How long data in the retention policy
   *     should be stored for, should be in a format like `7d`. See details
   *     [here](https://docs.influxdata.com/influxdb/v1.0/query_language/spec/#durations)
   * @param options.replication How many servers data in the series
   *     should be replicated to.
   * @param [options.isDefault] Whether the retention policy should
   *     be the default policy on the database.
   * @return
   * @example
   * influx.createRetentionPolicy('7d', {
   *  duration: '7d',
   *  replication: 1
   * })
   */
  public createRetentionPolicy(
    name: string,
    options: IRetentionOptions
  ): Promise<void> {
    const q =
      `create retention policy ${grammar.escape.quoted(name)} on ` +
      grammar.escape.quoted(options.database || this._defaultDB()) +
      ` duration ${options.duration} replication ${options.replication}` +
      (options.isDefault ? " default" : "");

    return this._pool
      .json(this._getQueryOpts({ q }, "POST"))
      .then(assertNoErrors)
      .then(() => undefined);
  }

  /**
   * Alters an existing retention policy on a database.
   *
   * @param name The retention policy name
   * @param options
   * @param [options.database] Database to create the policy on,
   *     uses the default database if not provided.
   * @param options.duration How long data in the retention policy
   *     should be stored for, should be in a format like `7d`. See details
   *     [here](https://docs.influxdata.com/influxdb/v1.0/query_language/spec/#durations)
   * @param options.replication How many servers data in the series
   *     should be replicated to.
   * @param [options.default] Whether the retention policy should
   *     be the default policy on the database.
   * @return
   * @example
   * influx.alterRetentionPolicy('7d', {
   *  duration: '7d',
   *  replication: 1,
   *  default: true
   * })
   */
  public alterRetentionPolicy(
    name: string,
    options: IRetentionOptions
  ): Promise<void> {
    const q =
      `alter retention policy ${grammar.escape.quoted(name)} on ` +
      grammar.escape.quoted(options.database || this._defaultDB()) +
      ` duration ${options.duration} replication ${options.replication}` +
      (options.isDefault ? " default" : "");

    return this._pool
      .json(this._getQueryOpts({ q }, "POST"))
      .then(assertNoErrors)
      .then(() => undefined);
  }

  /**
   * Deletes a retention policy and associated data. Note that the data will
   * not be immediately destroyed, and will hang around until Influx's
   * bi-hourly cron.
   *
   * @param name The retention policy name
   * @param [database] Database name that the policy lives in,
   *     uses the default database if not provided.
   * @return
   * @example
   * influx.dropRetentionPolicy('7d')
   */
  public dropRetentionPolicy(
    name: string,
    database: string = this._defaultDB()
  ): Promise<void> {
    return this._pool
      .json(
        this._getQueryOpts(
          {
            q:
              `drop retention policy ${grammar.escape.quoted(name)} ` +
              `on ${grammar.escape.quoted(database)}`,
          },
          "POST"
        )
      )
      .then(assertNoErrors)
      .then(() => undefined);
  }

  /**
   * Shows retention policies on the database
   *
   * @param [database] The database to list policies on, uses the
   *     default database if not provided.
   * @return
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
  public showRetentionPolicies(database: string = this._defaultDB()): Promise<
    IResults<{
      default: boolean;
      duration: string;
      name: string;
      replicaN: number;
      shardGroupDuration: string;
    }>
  > {
    return this._pool
      .json(
        this._getQueryOpts(
          {
            q: `show retention policies on ${grammar.escape.quoted(database)}`,
          },
          "GET"
        )
      )
      .then((result) =>
        parseSingle<{
          default: boolean; // Tslint:disable-line
          duration: string;
          name: string;
          replicaN: number;
          shardGroupDuration: string;
        }>(result)
      );
  }

  /**
   * Shows shards on the database
   *
   * @param [database] The database to list policies on, uses the
   *     default database if not provided.
   * @return
   * @example
   * influx.showShards().then(shards => {
   *   expect(shards.slice()).to.deep.equal([
   *     {
   *		id: 1
   *		database: 'database',
   *		retention_policy: 'autogen',
   *		shard_group: 1,
   *		start_time: '2019-05-06T00:00:00Z',
   *		end_time: '2019-05-13T00:00:00Z',
   *		expiry_time: '2019-05-13T00:00:00Z',
   *		owners: null,
   *     },
   *   ])
   * })
   */
  public showShards(database: string = this._defaultDB()): Promise<
    Array<{
      id: number;
      database: string;
      retention_policy: string;
      shard_group: number;
      start_time: string;
      end_time: string;
      expiry_time: string;
      owners: string;
    }>
  > {
    return this._pool
      .json(
        this._getQueryOpts(
          {
            q: "show shards ",
          },
          "GET"
        )
      )
      .then((result) =>
        parseSingle<{
          id: number;
          database: string;
          retention_policy: string;
          shard_group: number;
          start_time: string;
          end_time: string;
          expiry_time: string;
          owners: string;
        }>(result).filter(function (i) {
          return i.database === database;
        })
      );
  }

  /**
   * Drops a shard with the provided number.
   * @param shard_id
   * @return
   * @example
   * influx.dropShard(3)
   */
  public dropShard(shard_id: number): Promise<void> {
    return this._pool
      .json(
        this._getQueryOpts(
          {
            q: `drop shard ${shard_id}`,
          },
          "POST"
        )
      )
      .then(assertNoErrors)
      .then(() => undefined);
  }

  /**
   * WritePoints sends a list of points together in a batch to InfluxDB. In
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
   *  - if provide a INanoDate as returned from {@link toNanoTime} or the
   *    results from an Influx query, we'll be able to pull the precise
   *    nanosecond timestamp and manipulate it to get the right precision
   *  - if you provide a string or number as the timestamp, we'll pass it
   *    straight into Influx.
   *
   * Please see the IPoint and IWriteOptions types for a
   * full list of possible options.
   *
   * @param points
   * @param [options]
   * @return
   * @example
   * // write a point into the default database with
   * // the default retention policy.
   * influx.writePoints([
   *   {
   *     measurement: 'perf',
   *     tags: { host: 'box1.example.com' },
   *     fields: { cpu: getCpuUsage(), mem: getMemUsage() },
   *   }
   * ])
   *
   * // you can manually specify the database,
   * // retention policy, and time precision:
   * influx.writePoints([
   *   {
   *     measurement: 'perf',
   *     tags: { host: 'box1.example.com' },
   *     fields: { cpu: getCpuUsage(), mem: getMemUsage() },
   *     timestamp: getLastRecordedTime(),
   *   }
   * ], {
   *   database: 'my_db',
   *   retentionPolicy: '1d',
   *   precision: 's'
   * })
   */
  public writePoints(
    points: IPoint[],
    options: IWriteOptions = {}
  ): Promise<void> {
    const {
      database = this._defaultDB(),
      precision = "n" as grammar.TimePrecision,
      retentionPolicy,
    } = options;

    let payload = "";
    points.forEach((point) => {
      const { measurement, tags, fieldsPairs, tagsNames, castedTimestamp } =
        this.parsePoint(point, { database, precision });

      payload += (payload.length > 0 ? "\n" : "") + measurement;

      for (let tagsName of tagsNames) {
        payload +=
          "," +
          grammar.escape.tag(tagsName) +
          "=" +
          grammar.escape.tag(tags[tagsName]);
      }

      for (let i = 0; i < fieldsPairs.length; i += 1) {
        payload +=
          (i === 0 ? " " : ",") +
          grammar.escape.tag(fieldsPairs[i][0]) +
          "=" +
          fieldsPairs[i][1];
      }

      if (castedTimestamp !== undefined) {
        payload += " " + castedTimestamp;
      }
    });

    return this._pool.discard({
      body: payload,
      method: "POST",
      path: "/write",
      query: {
        db: database,
        precision,
        rp: retentionPolicy,
      },
      auth:
        typeof this._options.username === "string"
          ? `${this._options.username}:${this._options.password || ""}`
          : undefined,
    });
  }

  /**
   * ParsePoint will perform the coercions/schema checks and return the data
   * required for writing a point. This will throw an error if a schema check
   * or coercion fails. This can be useful for flagging or "throwing out" bad
   * points in a batch write to prevent the entire batch from getting aborted
   *
   * ---
   *
   * A note when using this function, {@link InfluxDB#writePoints} will still perform
   * the same checks, so any pre-processed data will be checked for validity twice which
   * has potential performance implications on large data sets
   *
   * @param point
   * @param [options]
   * @return
   * @example
   * // parse a point as if it is getting written to the default
   * // databse with the default time precision
   * influx.parsePoint({
   *     measurement: 'perf',
   *     tags: { host: 'box1.example.com' },
   *     fields: { cpu: getCpuUsage(), mem: getMemUsage() },
   * })
   *
   * // you can manually specify the database and time precision
   * influx.parsePoint({
   *     measurement: 'perf',
   *     tags: { host: 'box1.example.com' },
   *     fields: { cpu: getCpuUsage(), mem: getMemUsage() },
   * }, {
   *   precision: 's',
   *   database: 'my_db'
   * })
   *
   * // if an error occurs, you can catch the error with try...catch
   * try {
   *   influx.parsePoint({
   *     measurement: 'perf',
   *     tags: { host: 'box1.example.com', myExtraneousTag: 'value' },
   *     fields: { cpu: getCpuUsage(), mem: getMemUsage(), myExtraneousField: 'value' },
   *   })
   * } catch(err) {
   *   handleError(err);
   * }
   */
  parsePoint(point: IPoint, options: IParseOptions = {}): IParsedPoint {
    const { database = this._defaultDB(), precision = "n" } = options;

    const { fields = {}, tags = {}, measurement, timestamp } = point;

    const schema =
      this._schema[database] && this._schema[database][measurement];
    const fieldsPairs = schema
      ? schema.coerceFields(fields)
      : coerceBadly(fields);
    const tagsNames = schema ? schema.checkTags(tags) : Object.keys(tags);
    const castedTimestamp =
      timestamp && grammar.castTimestamp(timestamp, precision);
    return {
      fields,
      tags,
      measurement,
      timestamp,
      fieldsPairs,
      tagsNames,
      castedTimestamp,
    };
  }

  /**
   * WriteMeasurement functions similarly to {@link InfluxDB#writePoints}, but
   * it automatically fills in the `measurement` value for all points for you.
   *
   * @param measurement
   * @param points
   * @param [options]
   * @return
   * @example
   * influx.writeMeasurement('perf', [
   *   {
   *     tags: { host: 'box1.example.com' },
   *     fields: { cpu: getCpuUsage(), mem: getMemUsage() },
   *   }
   * ])
   */
  public writeMeasurement(
    measurement: string,
    points: IPoint[],
    options: IWriteOptions = {}
  ): Promise<void> {
    points = points.map((p) => ({ measurement, ...p }));
    return this.writePoints(points, options);
  }

  public query<T>(
    query: string[],
    options?: IQueryOptions
  ): Promise<Array<IResults<T & { time: grammar.INanoDate }>>>;

  public query<T>(
    query: string,
    options?: IQueryOptions
  ): Promise<IResults<T & { time: grammar.INanoDate }>>;

  /**
   * .query() runs a query (or list of queries), and returns the results in a
   * friendly format, {@link IResults}. If you run multiple queries, an array of results
   * will be returned, otherwise a single result (array of objects) will be returned.
   *
   * @param query
   * @param [options]
   * @return result(s)
   * @example
   * influx.query('select * from perf').then(results => {
   *   console.log(results)
   * })
   */
  public query<T>(
    query: string | string[],
    options: IQueryOptions = {}
  ): Promise<
    | IResults<T & { time: grammar.INanoDate }>
    | Array<IResults<T & { time: grammar.INanoDate }>>
  > {
    if (Array.isArray(query)) {
      query = query.join(";");
    }

    // If the consumer asked explicitly for nanosecond precision parsing,
    // remove that to cause Influx to give us ISO dates that
    // we can parse correctly.
    if (options.precision === "n") {
      options = { ...options }; // Avoid mutating
      delete options.precision;
    }

    return this.queryRaw(query, options).then((res) =>
      parse<T>(res, options.precision)
    );
  }

  /**
   * QueryRaw functions similarly to .query() but it does no fancy
   * transformations on the returned data; it calls `JSON.parse` and returns
   * those results verbatim.
   *
   * @param query
   * @param [options]
   * @return
   * @example
   * influx.queryRaw('select * from perf').then(rawData => {
   *   console.log(rawData)
   * })
   */
  public queryRaw(
    query: string | string[],
    options: IQueryOptions = {}
  ): Promise<any> {
    const {
      database = this._defaultDB(),
      retentionPolicy,
      placeholders = {},
    } = options;

    if (query instanceof Array) {
      query = query.join(";");
    }

    return this._pool.json(
      this._getQueryOpts(
        {
          db: database,
          epoch: options.precision,
          q: query,
          rp: retentionPolicy,
          params: JSON.stringify(placeholders),
        },
        options.method,
        true,
      ),
    );
  }

  /**
   * Pings all available hosts, collecting online status and version info.
   * @param timeout Given in milliseconds
   * @return
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
  public ping(timeout: number): Promise<IPingStats[]> {
    let auth: string = undefined;

    if (typeof this._options.username === "string") {
      auth = `${this._options.username}:${this._options.password || ""}`;
    }

    return this._pool.ping(timeout, "/ping", auth);
  }

  /**
   * Returns the default database that queries operates on. It throws if called
   * when a default database isn't set.
   * @private
   */
  private _defaultDB(): string {
    if (!this._options.database) {
      throw new Error(
        "Attempted to run an influx query without a default" +
          " database specified or an explicit database provided."
      );
    }

    return this._options.database;
  }

  /**
   * Creates options to be passed into the pool to query databases.
   * @private
   */
  private _getQueryOpts(params: any, method = "GET", partOfBody = false): any {
    let auth: string = undefined;
    if (typeof this._options.username === "string") {
      auth = `${this._options.username}:${this._options.password || ""}`;
    }

    if (method === "POST" && partOfBody) {
      return {
        method,
        path: "/query",
        auth,
        body: querystring.stringify(params),
      };
    } else {
      return {
        method,
        path: "/query",
        auth,
        query: {
          ...params,
        },
      };
    }
  }

  /**
   * Creates specified measurement schema
   *
   * @private
   * @param {ISchemaOptions} schema
   * @memberof InfluxDB
   */
  private _createSchema(schema: ISchemaOptions): void {
    schema.database = schema.database || this._options.database;
    if (!schema.database) {
      throw new Error(
        `Schema ${schema.measurement} doesn't have a database specified,` +
          "and no default database is provided!"
      );
    }

    if (!this._schema[schema.database]) {
      this._schema[schema.database] = Object.create(null);
    }

    this._schema[schema.database][schema.measurement] = new Schema(schema);
  }
}
