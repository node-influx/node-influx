import { Pool, PoolOptions } from "./pool";

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
   */
  public createDatabase (databaseName: string, callback: (err: Error) => void = noop) {
    this.pool.discard(this.getQueryOpts({
      q: `create database ${grammar.quoteEscaper.escape(databaseName)}`,
    }), callback);
  }

  /**
   * Deletes a database with the provided name.
   */
  public dropDatabase (databaseName: string, callback: (err: Error) => void = noop) {
    this.pool.discard(this.getQueryOpts({
      q: `drop database ${grammar.quoteEscaper.escape(databaseName)}`,
    }), callback);
  }

  /**
   * Returns array of database names. Requires cluster admin privileges.
   */
  public getDatabaseNames (callback: (err: Error, names: string[]) => void) {
    this.pool.json(this.getQueryOpts({
      q: "show databases",
    }), callback);
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
