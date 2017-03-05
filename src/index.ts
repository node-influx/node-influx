import { IPingStats, IPoolOptions, Pool } from './pool';
import { assertNoErrors, IResults, parse, parseSingle } from './results';
import { coerceBadly, ISchemaOptions, Schema } from './schema';
import { RequestOptions } from 'https';

import * as b from './builder';
import * as grammar from './grammar';
import * as url from 'url';

const defaultHost: IHostConfig = Object.freeze({
  host: '127.0.0.1',
  port: 8086,
  protocol: <'http'> 'http',
});

const defaultOptions: IClusterConfig = Object.freeze({
  database: null,
  hosts: [],
  password: 'root',
  schema: [],
  username: 'root',
});

export * from './builder';
export { INanoDate, FieldType, Precision, Raw, TimePrecision, escape, toNanoDate } from './grammar';
export { ISchemaOptions } from './schema';
export { IPingStats, IPoolOptions } from './pool';
export { IResults, IResponse, ResultError } from './results';

export interface IHostConfig {

  /**
   * Influx host to connect to, defaults to 127.0.0.1.
   */
  host: string;
  /**
   * Influx port to connect to, defaults to 8086.
   */
  port?: number;
  /**
   * Protocol to connect over, defaults to 'http'.
   */
  protocol?: 'http' | 'https';

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
    protocol: <'http' | 'https'> parsed.protocol.slice(0, -1),
  };

  if (parsed.auth) {
    [options.username, options.password] = parsed.auth.split(':');
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
  private options: IClusterConfig;

  /**
   * Map of Schema instances defining measurements in Influx.
   * @private
   */
  private schema: { [db: string]: { [measurement: string]: Schema } } = Object.create(null);

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
   * @param {IClusterConfig|ISingleHostConfig|string} [options='http://root:root@127.0.0.1:8086']
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
  constructor (options?: any) {
    // Figure out how to parse whatever we were passed in into a IClusterConfig.
    if (typeof options === 'string') { // plain URI => ISingleHostConfig
      options = parseOptionsUrl(options);
    } else if (!options) {
      options = defaultHost;
    }
    if (!options.hasOwnProperty('hosts')) { // ISingleHostConfig => IClusterConfig
      options = {
        database: options.database,
        hosts: [options],
        password: options.password,
        pool: options.pool,
        schema: options.schema,
        username: options.username,
      };
    }

    const resolved = <IClusterConfig> options;
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
      this.pool.addHost(`${host.protocol}://${host.host}:${host.port}`, host.options);
    });

    this.options.schema.forEach(schema => {
      const db = schema.database = schema.database || this.options.database;
      if (!db) {
        throw new Error(
          `Schema ${schema.measurement} doesn't have a database specified,` +
          'and no default database is provided!',
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
   * influx.createDatabase('mydb')
   */
  public createDatabase (databaseName: string): Promise<void> {
    return this.pool.json(this.getQueryOpts({
      q: `create database ${grammar.escape.quoted(databaseName)}`,
    }, 'POST')).then(assertNoErrors);
  }

  /**
   * Deletes a database with the provided name.
   * @param {string} databaseName
   * @return {Promise.<void>}
   * @example
   * influx.createDatabase('mydb')
   */
  public dropDatabase(databaseName: string): Promise<void> {
    return this.pool.json(this.getQueryOpts({
      q: `drop database ${grammar.escape.quoted(databaseName)}`,
    }, 'POST')).then(assertNoErrors);
  }

  /**
   * Returns array of database names. Requires cluster admin privileges.
   * @returns {Promise<String[]>} a list of database names
   * @example
   * influx.getMeasurements().then(names =>
   *   console.log('My database names are: ' + names.join(', ')));
   */
  public getDatabaseNames(): Promise<string[]> {
    return this.pool.json(this.getQueryOpts({ q: 'show databases' }))
      .then(res => parseSingle<{ name: string }>(res).map(r => r.name));
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
  public getMeasurements(database: string = this.defaultDB()): Promise<string[]> {
    return this.pool.json(this.getQueryOpts({
      db: database,
      q: 'show measurements',
    })).then(res => parseSingle<{ name: string }>(res).map(r => r.name));
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
   *   measurement: 'my_measurement',
   *   database: 'my_db'
   * }).then(names => {
   *   console.log('My series names in my_measurement are: ' + names.join(', '))
   * })
   */
  public getSeries (options: {
    measurement?: string,
    database?: string,
  } = {}): Promise<string[]> {
    const {
      database = this.defaultDB(),
      measurement,
    } = options;

    let query = 'show series';
    if (measurement) {
      query += ` from ${grammar.escape.quoted(measurement)}`;
    }

    return this.pool.json(this.getQueryOpts({
      db: database,
      q: query,
    })).then(res => parseSingle<{ key: string }>(res).map(r => r.key));
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
  public dropMeasurement(measurement: string, database: string = this.defaultDB()): Promise<void> {
    return this.pool.json(this.getQueryOpts({
      db: database,
      q: `drop measurement ${grammar.escape.quoted(measurement)}`,
    }, 'POST')).then(assertNoErrors);
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
  public dropSeries(options: b.measurement | b.where | { database: string }): Promise<void> {
    const db = 'database' in options ? (<any> options).database : this.defaultDB();

    let q = 'drop series';
    if ('measurement' in options) {
      q += ' from ' + b.parseMeasurement(<b.measurement> options);
    }
    if ('where' in options) {
      q += ' where ' + b.parseWhere(<b.where> options);
    }

    return this.pool.json(this.getQueryOpts({ db, q }, 'POST')).then(assertNoErrors);
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
    return this.pool.json(this.getQueryOpts({ q: 'show users' })).then(parseSingle);
  }

  /**
   * Creates a new InfluxDB user.
   * @param {String} username
   * @param {String} password
   * @param {Boolean} [admin=false] If true, the user will be given all
   *     privileges on all databases.
   * @return {Promise<void>}
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
    return this.pool.json(this.getQueryOpts({
      q: `create user ${grammar.escape.quoted(username)} with password `
        + grammar.escape.stringLit(password)
        + (admin ? ' with all privileges' : ''),
    }, 'POST')).then(assertNoErrors);
  }

  /**
   * Sets a password for an Influx user.
   * @param {String} username
   * @param {String} password
   * @return {Promise<void>}
   * @example
   * influx.setPassword('connor', 'pa55w0rd')
   */
  public setPassword(username: string, password: string): Promise<void> {
    return this.pool.json(this.getQueryOpts({
      q: `set password for ${grammar.escape.quoted(username)} = `
        + grammar.escape.stringLit(password),
    }, 'POST')).then(assertNoErrors);
  }

  /**
   * Grants a privilege to a specified user.
   * @param {String} username
   * @param {String} privilege Should be one of 'READ' or 'WRITE'
   * @param {String} [database] If not provided, uses the default database.
   * @return {Promise<void>}
   * @example
   * influx.grantPrivilege('connor', 'READ', 'my_db') // grants read access on my_db to connor
   */
  public grantPrivilege(username: string, privilege: 'READ' | 'WRITE',
                        database: string = this.defaultDB()): Promise<void> {

    return this.pool.json(this.getQueryOpts({
      q: `grant ${privilege} on ${grammar.escape.quoted(database)} `
        + `to ${grammar.escape.quoted(username)}`,
    }, 'POST')).then(assertNoErrors);
  }

  /**
   * Removes a privilege from a specified user.
   * @param {String} username
   * @param {String} privilege Should be one of 'READ' or 'WRITE'
   * @param {String} [database] If not provided, uses the default database.
   * @return {Promise<void>}
   * @example
   * influx.revokePrivilege('connor', 'READ', 'my_db') // removes read access on my_db from connor
   */
  public revokePrivilege(username: string, privilege: 'READ' | 'WRITE',
                         database: string = this.defaultDB()): Promise<void> {

    return this.pool.json(this.getQueryOpts({
      q: `revoke ${privilege} from ${grammar.escape.quoted(username)} on `
        + grammar.escape.quoted(database),
    }, 'POST')).then(assertNoErrors);
  }

  /**
   * Grants admin privileges to a specified user.
   * @param {String} username
   * @return {Promise<void>}
   * @example
   * influx.grantAdminPrivilege('connor')
   */
  public grantAdminPrivilege(username: string): Promise<void> {
    return this.pool.json(this.getQueryOpts({
      q: `grant all to ${grammar.escape.quoted(username)}`,
    }, 'POST')).then(assertNoErrors);
  }

  /**
   * Removes a admin privilege from a specified user.
   * @param {String} username
   * @return {Promise<void>}
   * @example
   * influx.revokeAdminPrivilege('connor')
   */
  public revokeAdminPrivilege(username: string): Promise<void> {
    return this.pool.json(this.getQueryOpts({
      q: `revoke all from ${grammar.escape.quoted(username)}`,
    }, 'POST')).then(assertNoErrors);
  }

  /**
   * Removes a user from the database.
   * @param {String} username
   * @return {Promise<void>}
   * @example
   * influx.dropUser('connor')
   */
  public dropUser(username: string): Promise<void> {
    return this.pool.json(this.getQueryOpts({
      q: `drop user ${grammar.escape.quoted(username)}`,
    }, 'POST')).then(assertNoErrors);
  }

  /**
   * Creates a continuous query in a database
   * @param {String} name The query name, for later reference
   * @param {String} query The body of the query to run
   * @param {String} [database] If not provided, uses the default database.
   * @return {Promise<void>}
   * @example
   * influx.createContinuousQuery('downsample_cpu_1h', `
   *   SELECT MEAN(cpu) INTO "7d"."perf"
   *   FROM "1d"."perf" GROUP BY time(1m)
   * `)
   */
  public createContinuousQuery(name: string, query: string,
                               database: string = this.defaultDB()): Promise<void> {

    return this.pool.json(this.getQueryOpts({
      q: `create continuous query ${grammar.escape.quoted(name)}`
        + ` on ${grammar.escape.quoted(database)} begin ${query} end`,
    }, 'POST')).then(assertNoErrors);
  }

  /**
   * Returns a list of continous queries in the database.
   * @param {String} [database] If not provided, uses the default database.
   * @return {Promise<void>}
   * @example
   * influx.showContinousQueries()
   */
  public showContinousQueries(database: string = this.defaultDB()): Promise<IResults<{
    name: string,
    query: string,
  }>> {
    return this.pool.json(this.getQueryOpts({
      db: database,
      q: 'show continuous queries',
    })).then(parseSingle);
  }

  /**
   * Creates a continuous query in a database
   * @param {String} name The query name
   * @param {String} [database] If not provided, uses the default database.
   * @return {Promise<void>}
   * @example
   * influx.dropContinuousQuery('downsample_cpu_1h')
   */
  public dropContinuousQuery(name: string, database: string = this.defaultDB()): Promise<void> {
    return this.pool.json(this.getQueryOpts({
      q: `drop continuous query ${grammar.escape.quoted(name)}`
        + ` on ${grammar.escape.quoted(database)}`,
    }, 'POST')).then(assertNoErrors);
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
   * @param {Boolean} [options.isDefault] Whether the retention policy should
   *     be the default policy on the database.
   * @return {Promise<void>}
   * @example
   * influx.createRetentionPolicy('7d', {
   *  duration: '7d',
   *  replication: 1
   * })
   */
  public createRetentionPolicy(name: string, options: IRetentionOptions): Promise<void> {
    const q = `create retention policy ${grammar.escape.quoted(name)} on `
      + grammar.escape.quoted(options.database || this.defaultDB())
      + ` duration ${options.duration} replication ${options.replication}`
      + (options.isDefault ? ' default' : '');

    return this.pool.json(this.getQueryOpts({ q }, 'POST')).then(assertNoErrors);
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
   * @return {Promise<void>}
   * @example
   * influx.alterRetentionPolicy('7d', {
   *  duration: '7d',
   *  replication: 1,
   *  default: true
   * })
   */
  public alterRetentionPolicy(name: string, options: IRetentionOptions): Promise<void> {
    const q = `alter retention policy ${grammar.escape.quoted(name)} on `
      + grammar.escape.quoted(options.database || this.defaultDB())
      + ` duration ${options.duration} replication ${options.replication}`
      + (options.isDefault ? ' default' : '');

    return this.pool.json(this.getQueryOpts({ q }, 'POST')).then(assertNoErrors);
  }

  /**
   * Deletes a retention policy and associated data. Note that the data will
   * not be immediately destroyed, and will hang around until Influx's
   * bi-hourly cron.
   *
   * @param {String} name The retention policy name
   * @param {String} [database] Database name that the policy lives in,
   *     uses the default database if not provided.
   * @return {Promise<void>}
   * @example
   * influx.dropRetentionPolicy('7d')
   */
  public dropRetentionPolicy(name: string, database: string = this.defaultDB()): Promise<void> {
    return this.pool.json(this.getQueryOpts({
      q: `drop retention policy ${grammar.escape.quoted(name)} `
        + `on ${grammar.escape.quoted(database)}`,
    }, 'POST')).then(assertNoErrors);
  }

  /**
   * Shows retention policies on the database
   *
   * @param {String} [database] The database to list policies on, uses the
   *     default database if not provided.
   * @return {Promise<Array<{
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
  public showRetentionPolicies(database: string = this.defaultDB()): Promise<{
    default: boolean, // tslint:disable-line
    duration: string,
    name: string,
    replicaN: number,
    shardGroupDuration: string,
  }[]> {
    return this.pool.json(this.getQueryOpts({
      q: `show retention policies on ${grammar.escape.quoted(database)}`,
    }, 'GET')).then(parseSingle);
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
   *  - if provide a INanoDate as returned from {@link toNanoTime} or the
   *    results from an Influx query, we'll be able to pull the precise
   *    nanosecond timestamp and manipulate it to get the right precision
   *  - if you provide a string or number as the timestamp, we'll pass it
   *    straight into Influx.
   *
   * Please see the IPoint and IWriteOptions types for a
   * full list of possible options.
   *
   * @param {IPoint[]} points
   * @param {IWriteOptions} [options]
   * @return {Promise<void>}
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
  public writePoints(points: IPoint[], options: IWriteOptions = {}): Promise<void> {
    const {
      database = this.defaultDB(),
      precision = <grammar.TimePrecision> 'n',
      retentionPolicy,
    } = options;

    let payload = '';
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

      payload += (payload.length > 0 ? '\n' : '') + measurement;
      for (let i = 0; i < tagsNames.length; i += 1) {
        payload += ','
          + grammar.escape.tag(tagsNames[i])
          + '='
          + grammar.escape.tag(tags[tagsNames[i]]);
      }

      for (let i = 0; i < fieldsPairs.length; i += 1) {
        payload += (i === 0 ? ' ' : ',')
          + grammar.escape.tag(fieldsPairs[i][0])
          + '='
          + fieldsPairs[i][1];
      }

      if (timestamp !== undefined) {
        payload += ' ' + grammar.castTimestamp(timestamp, precision);
      }
    });

    return this.pool.discard({
      body: payload,
      method: 'POST',
      path: '/write',
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
   * @param {IPoint[]} points
   * @param {IWriteOptions} [options]
   * @return {Promise<void>}
   * @example
   * influx.writeMeasurement('perf', [
   *   {
   *     tags: { host: 'box1.example.com' },
   *     fields: { cpu: getCpuUsage(), mem: getMemUsage() },
   *   }
   * ])
   */
  public writeMeasurement(measurement: string, points: IPoint[],
                          options: IWriteOptions = {}): Promise<void> {
    points = points.map(p => Object.assign({ measurement }, p));
    return this.writePoints(points, options);
  }

  public query<T>(query: string[], options?: IQueryOptions): Promise<IResults<T>[]>;
  public query<T>(query: string, options?: IQueryOptions): Promise<IResults<T>>;

  /**
   * .query() runs a query (or list of queries), and returns the results in a
   * friendly format, {@link IResults}. If you run multiple queries, an array of results
   * will be returned, otherwise a single result (array of objects) will be returned.
   *
   * @param {String|String[]} query
   * @param {IQueryOptions} [options]
   * @return {Promise<IResults|Results[]>} result(s)
   * @example
   * influx.query('select * from perf').then(results => {
   *   console.log(results)
   * })
   */
  public query<T>(
    query: string | string[],
    options: IQueryOptions = {},
  ): Promise<IResults<T> | IResults<T>> {
    if (Array.isArray(query)) {
      query = query.join(';');
    }
    // If the consumer asked explicitly for nanosecond precision parsing,
    // remove that to cause Influx to give us ISO dates that
    // we can parse correctly.
    if (options.precision === 'n') {
      options = Object.assign({}, options); // avoid mutating
      delete options.precision;
    }

    return this.queryRaw(query, options).then(res => parse(res, options.precision));
  }

  /**
   * queryRaw functions similarly to .query() but it does no fancy
   * transformations on the returned data; it calls `JSON.parse` and returns
   * those results verbatim.
   *
   * @param {String|String[]} query
   * @param {IQueryOptions} [options]
   * @return {Promise<*>}
   * @example
   * influx.queryRaw('select * from perf').then(rawData => {
   *   console.log(rawData)
   * })
   */
  public queryRaw<T>(query: string | string[], options: IQueryOptions = {}): Promise<any> {
    const {
      database = this.defaultDB(),
      retentionPolicy,
    } = options;

    if (query instanceof Array) {
      query = query.join(';');
    }

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
   * @return {Promise<IPingStats[]>}
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
    return this.pool.ping(timeout);
  }

  /**
   * Returns the default database that queries operates on. It throws if called
   * when a default database isn't set.
   * @private
   */
  private defaultDB(): string {
    if (!this.options.database) {
      throw new Error('Attempted to run an influx query without a default'
        + ' database specified or an explicit database provided.');
    }

    return this.options.database;
  }

  /**
   * Creates options to be passed into the pool to query databases.
   * @private
   */
  private getQueryOpts (params: any, method: string = 'GET'): any {
    return {
      method,
      path: '/query',
      query: Object.assign({
        p: this.options.password,
        u: this.options.username,
      }, params),
    };
  }
}
