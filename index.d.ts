export = influx;
declare var influx: influx.InfluxConstructor;

declare namespace influx {
    interface InfluxConstructor {
        /**
         * Connect to a single InfluxDB instance by specifying a set of connection options.
         */
        (options: SingleHostOptions): Influx;

        /**
         * Connect to an InfluxDB cluster by specifying a set of connection options.
         */
        (options: ClusterOptions): Influx;

        /**
         * Connect to an InfluxDB instance using a configuration URL.
         *
         * Example: http://user:password@host:8086/database
         */
        (url: string): Influx;
    }

    interface Influx {
        /**
         * Sets the default timeout for a request. When a request times out the host is removed from
         * the list of available hosts and the request is resubmitted to the next configured host.
         *
         * The default value is null (will wait forever for a respose).
         *
         * Be careful with this setting. If the value is too low,
         * slow queries might disable all configured hosts.
         */
        setRequestTimeout(value: number): void;

        /**
         * Sets the failover timeout for a host. After a host has been removed from balancing,
         * it will be re-enabled after 60 seconds (default).
         *
         * You can configure the timeout value using this function.
         */
        setFailoverTimeout(value: number): void;

        /**
         * Returns an array of available hosts.
         */
        getHostsAvailable(): Host[];

        /**
         * Returns an array of disabled hosts. This can be useful to check whether a host is unresponsive or not.
         */
        getHostsDisabled(): Host[];

        /**
         * Creates a new database - requires cluster admin privileges
         */
        createDatabase(databaseName: string, callback: (err: Error) => void): void;

        /**
         * Returns array of database names - requires cluster admin privileges
         */
        getDatabaseNames(callback: (err: Error, names: string[]) => void): void;

        /**
         * Drops a database inluding all measurements/series - requires cluster admin privileges
         */
        dropDatabase(databaseName: string, callback: (err: Error) => void): void;

        /**
         * Returns array of measurements - requires database admin privileges
         */
        getMeasurements(callback: (err: Error, measurements: Result) => void): void;

        /**
         * Drops a measurement from a database - requires database admin privileges
         */
        dropMeasurement(measurementName: string, callback: (err: Error) => void): void;

        /**
         * Returns array of series names from given database - requires database admin privileges
         */
        getSeries(callback: (err: Error, series: Series[]) => void): void;

        /**
         * Returns array of series names from given measurement - requires database admin privileges
         */
        getSeries(measurementName: string, callback: (err: Error, series: Series[]) => void): void;

        /**
         * Returns array of series names from given database - requires database admin privileges
         */
        getSeriesNames(callback: (err: Error, seriesNames: string[]) => void): void;

        /**
         * Returns array of series names from given measurement - requires database admin privileges
         */
        getSeriesNames(measurementName: string, callback: (err: Error, seriesNames: string[]) => void): void;

        /**
         * Drops a series from a database - requires database admin privileges
         */
        dropSeries(seriesId: string, callback: (err: Error) => void): void;

        /**
         * Returns an array of users - requires cluster admin privileges
         */
        getUsers(callback: (err: Error, users: string[]) => void): void;

        /**
         * Creates a new database user - requires cluster admin privileges
         */
        createUser(username: string, password: string, isAdmin: boolean, callback: (err: Error) => void): void;

        /**
         * Sets the users password - requires admin privileges
         */
        setPassword(username: string, password: string, callback: (err: Error) => void): void;

        /**
         * Grants privilege for the given user - requires admin privileges
         */
        grantPrivilege(privilege: string, databaseName: string, username: string, callback: (err: Error) => void): void;

        /**
         * Revokes privilege for the given user - requires admin privileges
         */
        revokePrivilege(privilege: string, databaseName: string, username: string, callback: (err: Error) => void): void;

        /**
         * Grants admin privileges for the given user - requires admin privileges
         */
        grantAdminPrivileges(username: string, callback: (err: Error) => void): void;

        /**
         * Revokes all admin privileges for the given user - requires admin privileges
         */
        revokeAdminPrivileges(username: string, callback: (err: Error) => void): void;

        /**
         * Drops the given user - requires admin privileges
         */
        dropUser(username: string, callback: (err: Error) => void): void;

        /**
         * Writes a point to a series - requires database user privileges
         */
        writePoint(seriesName: string, value: PointValue, callback?: (err: Error) => void): void;

        /**
         * Writes a point to a series - requires database user privileges
         */
        writePoint(seriesName: string, value: PointValue, tags: PointTags, callback?: (err: Error) => void): void;

        /**
         * Writes a point to a series - requires database user privileges
         */
        writePoint(seriesName: string, value: PointValue, tags: PointTags, options: WriteOptions, callback?: (err: Error) => void): void;

        /**
         * Writes a point to a series - requires database user privileges
         */
        writePoint(seriesName: string, values: PointValues, callback?: (err: Error) => void): void;
        
        /**
         * Writes a point to a series - requires database user privileges
         */
        writePoint(seriesName: string, values: PointValues, tags: PointTags, callback?: (err: Error) => void): void;

        /**
         * Writes a point to a series - requires database user privileges
         */
        writePoint(seriesName: string, values: PointValues, tags: PointTags, options: WriteOptions, callback?: (err: Error) => void): void;

        /**
         * Writes multiple points to a series - requires database user privileges
         */
        writePoints(seriesName: string, points: PointsArray[], callback?: (err: Error) => void): void;

        /**
         * Writes multiple points to a series - requires database user privileges
         */
        writePoints(seriesName: string, points: PointsArray[], options: WriteOptions, callback?: (err: Error) => void): void;

        /**
         * Writes multiple point to multiple series - requires database user privileges
         */
        writeSeries(series: { [name: string]: PointsArray[]; }, callback?: (err: Error) => void): void;

        /**
         * Writes multiple point to multiple series - requires database user privileges
         */
        writeSeries(series: { [name: string]: PointsArray[]; }, options: WriteOptions, callback?: (err: Error) => void): void;

        /**
         * Queries the database and returns an array of parsed responses. - requires database user privileges.
         */
        query(query: string, callback: (err: Error, results: { [tag: string]: PointValue|Date; }[]) => void): void;

        /**
         * Queries the database and returns an array of parsed responses. - requires database user privileges.
         */
        query(databaseName: string, query: string, callback: (err: Error, results: { [tag: string]: PointValue|Date; }[]) => void): void;

        /**
         * Queries the database and returns the raw response from InfluxDB. - requires database user privileges.
         */
        queryRaw(query: string, callback: (err: Error, results: Result) => void): void;

        /**
         * Queries the database and returns the raw response from InfluxDB. - requires database user privileges.
         */
        queryRaw(databaseName: string, query: string, callback: (err: Error, results: Result) => void): void;

        /**
         * Creates a continuous query - requires admin privileges
         */
        createContinuousQuery(queryName: string, query: string, callback: (err: Error) => void): void;

        /**
         * Creates a continuous query - requires admin privileges
         */
        createContinuousQuery(queryName: string, query: string, databaseName: string, callback: (err: Error) => void): void;

        /**
         * Fetches all continuous queries from a database - requires database admin privileges
         */
        getContinuousQueries(callback: (err: Error, queries: string[]) => void): void;

        /**
         * Drops a continuous query from a database - requires database admin privileges
         */
        dropContinuousQuery(queryName: string, callback: (err: Error) => void): void;

        /**
         * Drops a continuous query from a database - requires database admin privileges
         */
        dropContinuousQuery(queryName: string, databaseName: string, callback: (err: Error) => void): void;

        /**
         * Fetches all retention policies from a database.
         */
        getRetentionPolicies(databaseName: string, callback: (err: Error, policies: string[]) => void): void;

        /**
         * Creates a new retention policy - requires admin privileges.
         */
        createRetentionPolicy(policyName: string, databaseName: string, duration: string, replication: number, isDefault: boolean, callback: (err: Error) => void): void;

        /**
         * Alters an existing retention policy - requires admin privileges.
         */
        alterRetentionPolicy(policyName: string, databaseName: string, duration: string, replication: number, isDefault: boolean, callback: (err: Error) => void): void;
    }

    type TimePrecision = "ns"|"us"|"ms"|"s"|"m"|"h"|"d"|"w"|"m"|"y";

    interface Options {
        /**
         * database name
         */
        database: string;
        /**
         * username
         */
        username: string;
        /**
         * password
         */
        password: string;

        /**
         * logging function for depreciated warnings, defaults to console.log
         */
        depreciatedLogging?: (format: string, ...args: any[]) => void;
        /**
         * number of ms node-influx will take a host out of the balancing after a request failed, default: 60000
         */
        failoverTimeout?: number;
        /**
         * number of ms to wait before a request times out. defaults to 'null' (waits until connection is closed).
         * Use with caution!
         */
        requestTimeout?: number;
        /**
         * max number of retries until a request raises an error (e.g. 'no hosts available'), default : 2
         */
        maxRetries?: number;
        /**
         * Time precision, default : ms
         */
        timePrecision?: TimePrecision;
    }

    interface SingleHostOptions extends Options, Host {

    }

    interface ClusterOptions extends Options {
        /**
         * Array of hosts for cluster configuration, e.g. [ {host: 'localhost', port : 8086},...]
         * Port is optional
         */
        hosts: Host[];
    }

    interface Host {
        /**
         * hostname, e.g. 'localhost'
         */
        host: string;
        /**
         * influxdb port, default: 8086
         */
        port?: number;
        /**
         * protocol, default: http
         */
        protocol?: "http"|"https"|"udp";
    }

    type PointValue = string|number;

    interface PointValues {
        time?: Date;
        [name: string]: string|number|Date;
    }

    type PointsArray = {
        0: PointValue | PointValues;
        1: PointTags
    }

    interface PointTags {
        [tag: string]: any;
    }

    interface WriteOptions {
        precision: TimePrecision;
    }

    interface Result {
        series: Series[];
        messages?: Message[];
    }

    interface Series {
        name: string;
        columns: string[];
        values: any[][];
    }

    interface Message {
        level: string;
        text: string;
    }
}