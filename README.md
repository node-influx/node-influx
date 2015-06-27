# node-influx

An [InfluxDB](http://influxdb.org/) Node.js Client

[![npm](http://img.shields.io/npm/v/influx.svg)](https://www.npmjs.org/package/influx)
[![build](http://img.shields.io/travis/bencevans/node-influx/master.svg)](https://travis-ci.org/bencevans/node-influx)
[![coverage](http://img.shields.io/coveralls/bencevans/node-influx/master.svg)](https://coveralls.io/r/bencevans/node-influx?branch=master)
[![code climate](http://img.shields.io/codeclimate/github/bencevans/node-influx.svg)](https://codeclimate.com/github/bencevans/node-influx)
[![Dependency Status](https://david-dm.org/bencevans/node-influx.png)](https://david-dm.org/bencevans/node-influx)
[![Github Releases](https://img.shields.io/github/downloads/atom/atom/latest/total.svg)](https://github.com/bencevans/node-influx)

[![Bountysource](https://www.bountysource.com/badge/issue?issue_id=3370228)](https://www.bountysource.com/issues/3370228-handle-chunked-query-responses?utm_source=3370228&utm_medium=shield&utm_campaign=ISSUE_BADGE) - Reward the contributors for their efforts on upcoming tasks.

[![js-standard-style](https://cdn.rawgit.com/feross/standard/master/badge.svg)](https://github.com/feross/standard)

## Installation

    $ npm install influx

## Usage

Create a client instance (`database` not required for all methods):

```js
var influx = require('influx')

var client = influx({

  //cluster configuration
  hosts : [
    {
      host : 'localhost',
      port : 8060, //optional. default 8086
      protocol : 'http' //optional. default 'http'
    }
  ],
  // or single-host configuration
  host : 'localhost',
  port : 8086, // optional, default 8086
  protocol : 'http', // optional, default 'http'
  username : 'dbuser',
  password : 'f4ncyp4ass',
  database : 'my_database'
})

```

A list of all configuration values can be found below.


You can either pass a single hostname or an array of hostnames. Node-influx uses round-robin balancing to distribute
the requests across all configured hosts. When a host is unreachable, node-influx tries to resubmit the request to another
host and disables the failed host for 60 seconds (timeout value is configurable). If all servers fail to respond, node-influx raises an error.


### Configuration options

| Option        | Description   |
|:------------- |:-------------|
| username      | username |
| password      | password      |
| database | database name |
| host | hostname, e.g. 'localhost' |
| port [optional] |  influxdb port, default: 8086 |
| protocol [optional] |  protocol, default: http |
| hosts [optional] | Array of hosts for cluster configuration, e.g. [ {host: 'localhost', port : 8086},...] Port is optional |
| depreciatedLogging [optional] | logging function for depreciated warnings, defaults to console.log |
| failoverTimeout [optional] |  number of ms node-influx will take a host out of the balancing after a request failed, default: 60000 |
| requestTimeout [optional] | number of ms to wait before a request times out. defaults to 'null' (waits until connection is closed). Use with caution! |
| maxRetries [options] | max number of retries until a request raises an error (e.g. 'no hosts available'), default : 2 |
| timePrecision [optional] |Time precision, default : ms |


## Functions


###setRequestTimeout
Sets the default timeout for a request. When a request times out the host is removed from the list of available hosts
and the request is resubmitted to the next configured host. The default value is ```null``` (will wait forever for a respose).

Be careful with this setting. If the value is too low, slow queries might disable all configured hosts.

```js
setRequestTimeout( value ) { }
```

###setFailoverTimeout
Sets the failover timeout for a host. After a host has been removed from balancing, it will be re-enabled after 60
seconds (default). You can configure the timeout value using this function.

```js
setFailoverTimeout( value ) { }
```

###getHostsAvailable
Returns an array of available hosts.

```js
getHostsAvailable( ) { }
```

###getHostsDisabled
Returns an array of disabled hosts. This can be useful to check whether a host is unresponsive or not.
```js
getHostsDisabled( ) { }
```


###createDatabase
Creates a new database - requires cluster admin privileges

```js
createDatabase(databaseName, [options,] callback) { }
```
[Options can be an array of shard spaces and/or continuous queries](http://influxdb.com/docs/v0.8/advanced_topics/sharding_and_storage.html#configuration).

###deleteDatabase
Deletes a database - requires cluster admin privileges

```js
deleteDatabase(databaseName, callback) { }
```

###getDatabaseNames
Returns array of database names - requires cluster admin privileges

```js
getDatabaseNames(function(err,arrayDatabaseNames){}) { }
```

###getSeriesNames
Returns array of series names from given database - requires database admin privileges

```js
getSeriesNames(databaseName, function(err,arraySeriesNames){} ) { }
```

###getUsers
Returns an array of database users - requires cluster admin privileges

```js
getUsers(databaseName, callback) { }
```

###getUser
Returns a database user - requires cluster admin privileges

```js
getUser(databaseName, username, callback) { }
```

###createUser
Creates a new database user - requires cluster admin privileges

```js
createUser(databaseName, username, password, callback) { }
```

###writePoint
Writes a point to a series - requires database user privileges

```js
var point = { attr : value, time : new Date()};
writePoint(seriesName, point, options, callback) { }
```

###writePoints
Writes multiple points to a series - requires database user privileges

```js
var points = [ {attr : value, time : new Date()}, {attr : value2, time : new Date()}];
writePoints(seriesName, points, options, callback) { }
```

###writeSeries
Writes multiple point to multiple series - requires database user privileges

```js
var points = [ {attr : value, time : new Date()}, {attr : value2, time : new Date()}];
var points2 = [ {attr : value, time : new Date()}, {attr : value2, time : new Date()}];

var series = {
    series_name_one : points,
    series_name_two : points2
};

writeSeries(series, options, callback) { }
```

*Please note that there's a POST limit at about 2MB per request. Do not submit too many points at once.*

###query
Queries the database - requires database user privileges

```js
var query = 'SELECT MEDIAN(column) FROM myseries WHERE time > now() - 24h';
query([database,] query, callback) { }


query([database,]query, callback) { }

```

If `database` is omitted, node-influx uses the database defined in the default options.

###getContinuousQueries
Fetches all continuous queries from a database - requires database admin privileges

```js
getContinuousQueries( [databaseName,] callback) { }
```

###dropContinuousQuery
Drops a continuous query from a database - requires database admin privileges

```js
dropContinuousQuery( [databaseName,] queryID, callback) { }
```


###dropSeries
Drops a series from a database - requires database admin privileges

```js
dropSeries ( [databaseName ,] seriesName, callback) { }
```



As Jeff Atwood puts it... [Read the source, Luke](http://www.codinghorror.com/blog/2012/04/learn-to-read-the-source-luke.html). If you're still stuck, read the `./examples/*` files and the `./test.js` file.

## Testing

Either install InfluxDB or use a docker container to run the service:

    docker run -d -p 8083:8083 -p 8086:8086 --expose 8090 --expose 8099 tutum/influxdb

Then to run the test harness use `npm test`.

## Contributing

If you want to add features, fix bugs or improve node-influx please open a pull-request. 
Please note, we are following [Javascript Standard Style](https://github.com/feross/standard). Before opening a PR
your code should pass Standard.

 `npm install standard`
 `standard`



## Licence

MIT
