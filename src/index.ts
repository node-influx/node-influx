import { Pool, PoolOptions } from "./pool";
import { Response, parseSingle } from "./results";

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
  username: "root",
});

/**
 * @typedef {Object} HostConfig
 * @property {String} [host=127.0.0.1] Influx host to connect to
 * @property {String} [port=8086] port to connect to on the host
 * @property {String} [protocol=http] protocol to connect with
 */

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
 * Takes an Influx callback and returns a new callback which attempts to extract
 * a column, by name, from the output and pass it into the original callback.
 */
function extractColumnInto(column: string, callback: (err: Error, results: string[]) => void)
: (err: Error, res: Response) => void {

  return (err, res) => {
    if (err) {
      return callback(err, undefined);
    }

    callback(undefined, parseSingle(res).map(r => r[column]));
  };
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

function noop () { /* ignore */ }

/**
 * InfluxDB is the primary means of querying the database.
 * @public
 */
export class InfluxDB {

  private pool: Pool;
  private options: ClusterConfig;

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
  }

  /**
   * Creates a new database with the provided name.
   * @example
   * influx.createDatabase('mydb', (err) => done(err))
   */
  public createDatabase (databaseName: string, callback: (err: Error) => void = noop) {
    this.pool.discard(this.getQueryOpts({
      q: `create database ${grammar.quoteEscaper.escape(databaseName)}`,
    }, "POST"), callback);
  }

  /**
   * Deletes a database with the provided name.
   * @example
   * influx.createDatabase('mydb', (err) => done(err))
   */
  public dropDatabase (databaseName: string, callback: (err: Error) => void = noop) {
    this.pool.discard(this.getQueryOpts({
      q: `drop database ${grammar.quoteEscaper.escape(databaseName)}`,
    }, "POST"), callback);
  }

  /**
   * Returns array of database names. Requires cluster admin privileges.
   * @example
   * influx.getMeasurements((err, names) => {
   *   console.log('My database names are: ' + names.join(', '))
   * })
   */
  public getDatabaseNames (callback: (err: Error, names: string[]) => void) {
    this.pool.json(
      this.getQueryOpts({ q: "show databases" }),
      extractColumnInto("name", callback)
    );
  }

  /**
   * Returns array of measurements.
   * @example
   * influx.getMeasurements((err, names) => {
   *   console.log('My measurement names are: ' + names.join(', '))
   * })
   */
  public getMeasurements (callback: (err: Error, measurements: string[]) => void) {
    this.pool.json(
      this.getQueryOpts({ q: "show measurements" }),
      extractColumnInto("name", callback)
    );
  }

  /**
   * Returns a list of all series in the database.
   */
  public getSeries (callback: (err: Error, measurements: string[]) => void);

  /**
   * Returns a list of all series within the target measurement.
   * @example
   * influx.getSeries((err, names) => {
   *   console.log('My series names are: ' + names.join(', '))
   * })
   *
   * influx.getSeries("my_measurement", (err, names) => {
   *   console.log('My series names in my_measurement are: ' + names.join(', '))
   * })
   */
  public getSeries (measurement: string, callback: (err: Error, measurements: string[]) => void);

  public getSeries (m: any, callback?: (err: Error, measurements: string[]) => void) {
    let query = "show series";
    if (typeof m === "string") {
      query += ` from ${grammar.quoteEscaper.escape(m)}`;
    } else {
      callback = m;
    }

    this.pool.json(
      this.getQueryOpts({ q: query }),
      extractColumnInto("key", callback)
    );
  }

  /**
   * Removes a measurement from the database.
   * @example
   * dropMeasurement('my_measurement', err => done(err))
   * // => DROP MEASUREMENT "my_measurement"
   */
  public dropMeasurement(measurementName: string, callback: (err: Error) => void = noop) {
    this.pool.discard(this.getQueryOpts({
      q: `drop measurement ${grammar.quoteEscaper.escape(measurementName)}`,
    }, "POST"), callback);
  }

  /**
   * Removes a one or more series from InfluxDB.
   *
   * @example
   * // The following pairs of queries are equivalent: you can chose either to
   * // use our builder or pass in string directly. The builder takes care
   * // of escaping and most syntax handling for you.
   *
   * influx.dropSeries({ where: e => e.tag('cpu').equals.value('cpu8') }, err => done(err))
   * influx.dropSeries({ where: '"cpu" = \'cpu8\'' }, err => done(err))
   * // DROP SERIES WHERE "cpu" = 'cpu8'
   *
   * influx.dropSeries({ measurement: m => m.name('cpu').policy('autogen') }, err => done(err))
   * influx.dropSeries({ measurement: '"cpu"."autogen"' }, err => done(err))
   * // DROP SERIES FROM "autogen"."cpu"
   *
   * influx.dropSeries({
   *   measurement: m => m.name('cpu').policy('autogen')
   *   where: e => e.tag('cpu').equals.value('cpu8')
   * }, err => done(err))
   * // DROP SERIES FROM "autogen"."cpu" WHERE "cpu" = 'cpu8'
   */
  public dropSeries(
    options: b.measurement | b.where | (b.measurement & b.where),
    callback: (err: Error) => void = noop
  ) {
    let q = "drop series";
    if ("measurement" in options) {
      q += " from " + b.parseMeasurement(<b.measurement> options);
    }
    if ("where" in options) {
      q += " where " + b.parseWhere(<b.where> options);
    }

    this.pool.discard(this.getQueryOpts({ q }, "POST"), callback);
  }

  /**
   * Creates options to be passed into the pool to query databases.
   */
  private getQueryOpts (params: any, method: string = "GET"): any {
    return {
      method,
      path: "/query",
      query: Object.assign({
        epoch: "u",
        p: this.options.password,
        u: this.options.username,
      }, params),
    };
  }
}
