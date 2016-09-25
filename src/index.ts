import { Pool, PoolOptions } from "./pool";

import * as grammar from "./grammar";
import * as url from "url";

const defaultHost = Object.freeze({
  host: "127.0.0.1",
  port: 8086,
  protocol: "http",
});

const defaultOptions = Object.freeze(Object.assign({
  password: "root",
  timePrecision: "ms",
  username: "root",
}, defaultHost));

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
    protocol: <"http" | "https"> parsed.protocol,
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

  constructor (options: any) {
    // Figure out how to parse whatever we were passed in into a ClusterConfig.
    if (typeof options === "string") { // plain URI => SingleHostConfig
      options = parseOptionsUrl(options);
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
    this.pool = new Pool(resolved.pool);
    this.options = Object.assign({}, resolved, defaultOptions);

    resolved.hosts.forEach(host => {
      const h = Object.assign(host, defaultHost);
      this.pool.addHost(`${h.protocol}://${h.host}:${h.port}`);
    });
  }

  /**
   * Creates a new database with the provided name.
   */
  public createDatabase (databaseName: string, callback: (Error) => void) {
    this.pool.discard({
      method: "GET",
      path: "/query",
      query: {
        p: this.options.password,
        q: `create database ${grammar.quoteEscaper.escape(databaseName)}`,
        u: this.options.username,
      },
    }, callback);
  }
}
