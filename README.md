# node-influx

An [InfluxDB](http://influxdb.org/) Node.js Client

[![npm](http://img.shields.io/npm/v/influx.svg)](https://www.npmjs.org/package/influx)
[![build](http://img.shields.io/travis/node-influx/node-influx/master.svg)](https://travis-ci.org/node-influx/node-influx)
[![coverage](http://img.shields.io/coveralls/bencevans/node-influx/master.svg)](https://coveralls.io/r/node-influx/node-influx?branch=master)
[![code climate](http://img.shields.io/codeclimate/github/bencevans/node-influx.svg)](https://codeclimate.com/github/node-influx/node-influx)
[![Dependency Status](https://david-dm.org/node-influx/node-influx.png)](https://david-dm.org/node-influx/node-influx)
[![Github Releases](https://img.shields.io/github/downloads/atom/atom/latest/total.svg)](https://github.com/node-influx/node-influx)

[![Bountysource](https://www.bountysource.com/badge/issue?issue_id=3370228)](https://www.bountysource.com/issues/3370228-handle-chunked-query-responses?utm_source=3370228&utm_medium=shield&utm_campaign=ISSUE_BADGE) - Reward the contributors for their efforts on upcoming tasks.

[![js-standard-style](https://cdn.rawgit.com/feross/standard/master/badge.svg)](https://github.com/feross/standard)

## Installation

    $ npm install influx

## Compatibility

Version 0.3.x is compatible with InfluxDB 0.8.x
Version 0.4.x is compatible with InfluxDB 0.9.x (currently under development)


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


##### setRequestTimeout
Sets the default timeout for a request. When a request times out the host is removed from the list of available hosts
and the request is resubmitted to the next configured host. The default value is ```null``` (will wait forever for a respose).

Be careful with this setting. If the value is too low, slow queries might disable all configured hosts.

```js
client.setRequestTimeout( value )
```

##### setFailoverTimeout
Sets the failover timeout for a host. After a host has been removed from balancing, it will be re-enabled after 60
seconds (default). You can configure the timeout value using this function.

```js
client.setFailoverTimeout( value )
```

##### getHostsAvailable
Returns an array of available hosts.

```js
getHostsAvailable( ) 
```

##### getHostsDisabled
Returns an array of disabled hosts. This can be useful to check whether a host is unresponsive or not.
```js
client.getHostsDisabled( )
```


##### createDatabase
Creates a new database - requires cluster admin privileges

```js
client.createDatabase(databaseName, function(err, result) {} )
```


##### getDatabaseNames
Returns array of database names - requires cluster admin privileges

```js
client.getDatabaseNames( function(err,arrayDatabaseNames){ } ) 
```

##### dropDatabase
Drops a database inluding all measurements/series - requires cluster admin privileges

```js
dropDatabase ( databaseName, function(err,response) { })
```


##### getMeasurements
Returns array of measurements - requires database admin privileges

```js
client.getMeasurements(function(err,arrayMeasurements){ } )
```


##### dropMeasurement
Drops a measurement from a database - requires database admin privileges

```js
dropSeries ( measurementName, function(err,response) { })
```


##### getSeries
Returns array of series names from given measurement, or database if `measurementName` is omitted - requires database admin privileges

```js
client.getSeries([measurementName,] function(err,arraySeriesNames){} )
```

##### getSeriesNames
Returns array of series names from given measurement - requires database admin privileges

```js
client.getSeriesNames([measurementName,] function(err,arraySeriesNames){} ) { }
```


##### dropSeries
Drops a series from a database - requires database admin privileges

```js
dropSeries ( seriesId, function(err,response) { })
```



##### getUsers
Returns an array of users - requires cluster admin privileges

```js
client.getUsers(function (err, users) { } )
```

##### createUser
Creates a new database user - requires cluster admin privileges

```js
client.createUser(username, password, isAdmin, function(err,response) { })
```

##### setPassword
Sets the users password - requires admin privileges

```js
client.setPassword(username, password, function (err, reponse) {} )
```


##### grantPrivilege
Grants privilege for the given user - requires admin privileges

```js
client.grantPrivilege(privilege, databaseName, userName, function (err, reponse) {} )
```

##### revokePrivilege
Revokes privilege for the given user - requires admin privileges

```js
client.revokePrivilege(privilege, databaseName, userName, function (err, reponse) {} )
```

##### grantAdminPrivileges
Grants admin privileges for the given user - requires admin privileges

```js
client.grantAdminPrivileges(userName, function (err, reponse) {} )
```

##### revokeAdminPrivileges
Revokes all admin privileges for the given user - requires admin privileges

```js
client.revokeAdminPrivileges(userName, function (err, reponse) {} )
```

##### dropUser
Drops the given user - requires admin privileges
```js
client.dropUser(userName, function(err,response) {] )
```


##### writePoint
Writes a point to a series - requires database user privileges

```js
var point = { attr : value, time : new Date()};
client.writePoint(seriesName, values, tags, [options,] function(err, response) { })
```

`values` can be either an objekt or a single value. For the latter the columname is set to `value`.
You can set the time by passing an object propety called `time`. The time an be either an integer value or a Date object. When providing a single value, don't forget to adjust the time precision accordingly. The default value is `ms`.
The parameter `options` is optional and can be used to set the time precision.

###### example
```js
//write a single point with two values and two tags. time is omitted
client.writePoint(info.series.name, {value: 232, value2: 123}, { foo: 'bar', foobar: 'baz'}, done)

//write a single point with the value "1". The value "1" corresponds to { value : 1 }
client.writePoint(info.series.name, 1, { foo: 'bar', foobar: 'baz'}, done)

//write a single point, providing an integer timestamp and time precision 's' for seconds
client.writePoint(info.series.name, {time: 1234567890, value: 232}, {precision : 's'}, done)

//write a single point, providing a Date object. Precision is set to default 'ms' for milliseconds.
client.writePoint(info.series.name, {time: new Date(), value: 232}, done)


```

###### writePoints
Writes multiple points to a series - requires database user privileges

`Points` is an array of points. Each point containing two objects - the actual values and tags.
```js
var points = [
  //first value with tag
  [{value: 232}, { tag: 'foobar'}],
  //second value with different tag
  [{value: 212}, { someothertag: 'baz'}],
  //third value, passed as integer. Different tag
  [123, { foobar: 'baz'}],
  //value providing timestamp, without tags
  [{value: 122, time : new Date()}]
]
client.writePoints(seriesName, points, [options,] callback) { }
```

##### writeSeries
Writes multiple point to multiple series - requires database user privileges

```js
var points = [
  //first value with tag
  [{value: 232}, { tag: 'foobar'}],
  //second value with different tag
  [{value: 212}, { someothertag: 'baz'}],
  //third value, passed as integer. Different tag
  [123, { foobar: 'baz'}],
  //value providing timestamp, without tags
  [{value: 122, time : new Date()}]
]

var points2 = [
  //first value with tag
  [{value: 1232}, { tag: 'foobar'}],
  //second value with different tag
  [{value: 223212}, { someothertag: 'baz'}],
  //third value, passed as integer. Different tag
  [12345, { foobar: 'baz'}],
  //value providing timestamp, without tags
  [{value: 23122, time : new Date()}]
]
var series = {
    series_name_one : points,
    series_name_two : points2
};

client.writeSeries(series, [options,] function(err,response) { })
```

*Please note that there's a POST limit at about 2MB per request. Do not submit too many points at once.*

##### query
Queries the database and returns an array of parsed responses. - requires database user privileges.

```js
var query = 'SELECT MEDIAN(column) FROM myseries WHERE time > now() - 24h';
client.query([database,] query, function(err, results) { })

```

If `database` is omitted, node-influx uses the database defined in the default options.
Since InfluxDB 0.9, all values with different tags are stored in different timeseries. The response from InfluxDB contains an array of values for each series that matches the request.
To make things easier the query function now returns a parsed response, meaning that all points from all series are merged into a single array of points and their tags. You can still retrieve the raw response from InfluxDB using `client.queryRaw()`.

You can also pass multiple queries at once. The callback returns an array of series, one series per query.

```js
client.query('SELECT * FROM myseries; SELECT AVG(VALUE) as avgvalue from myseries', function (err, results) {});

// -> results =[ 
//   [ { value : 1, tagname : 'tagvalue'}, {value : 3, othertag : 'value}],
//   [ {avgvalue : 2.345}]
// ]

```


##### queryRaw
Same as function `query` but returns the raw response from InfluxDB.

```js
var query = 'SELECT MEDIAN(column) FROM myseries WHERE time > now() - 24h';
client.queryRaw([database,] query, function(err, results) { })

```

##### createContinuousQuery

Creates a continuous query - requires admin privileges

```js
client.createContinuousQuery('testQuery', 'SELECT COUNT(value) INTO valuesCount_1h FROM ' + info.series.name + ' GROUP BY time(1h) ', function (err, res) {} )
```

##### getContinuousQueries
Fetches all continuous queries from a database - requires database admin privileges

```js
getContinuousQueries( function(err,arrayContinuousQueries) { })
```

##### dropContinuousQuery
Drops a continuous query from a database - requires database admin privileges

```js
dropContinuousQuery( queryName, [databaseName,] callback) { }
```


##### getRetentionPolicies

Fetches all retention policies from a database.

```js
client.getRetentionPolicies(databaseName, function(err,response) {} )
```

##### createRetentionPolicy

Creates a new retention policy - requires admin privileges.

```js
client.createRetentionPolicy(rpName, databaseName, duration, replication, isDefault, function(err,response) {} )
```

##### example
```js
client.createRetentionPolicy('my_ret_pol_name', 'my_database, '1d', 1, true, function (err,resonse) {})
```

##### alterRetentionPolicy

Alters an existing retention policy - requires admin privileges.

```js
client.alterRetentionPolicy(rpName, databaseName, duration, replication, isDefault, function(err,response) {} )
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
