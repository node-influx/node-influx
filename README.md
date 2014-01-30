# node-influx

An [InfluxDB](http://influxdb.org/) Node.js Client

[![Build Status](https://travis-ci.org/bencevans/node-influx.png?branch=master)](https://travis-ci.org/bencevans/node-influx)
[![Coverage Status](https://coveralls.io/repos/bencevans/node-influx/badge.png?branch=master)](https://coveralls.io/r/bencevans/node-influx?branch=master)
[![Dependency Status](https://david-dm.org/bencevans/node-influx.png)](https://david-dm.org/bencevans/node-influx)

## Installation

`npm install influx`

## Usage

Create a client instance (`database` not required for all methods):

```js
var influx = require('influx');
var client = influx(host, port, username, password, database);
```


## Functions

###createDatabase
Creates a new database - requires cluster admin privileges

```js
createDatabase(databaseName, callback) { }
```

###deleteDatabase
Deletes a database - requires cluster admin privileges

```js
deleteDatabase(databaseName, callback) { }
```

###getDatabseNames
Returns array of database names - requires cluster admin privileges

```js
getDatabaseNames(function(err,arrayDatabaseNames){}) { }
```

###getSeriesNames
Returns array of series names from given database - requires database admin privileges

```js
getSeriesNames(databaseName, function(err,arraySeriesNames){} ) { }
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
Writes multiple point to a series - requires database user privileges

```js
var points = [ {attr : value, time : new Date()}, {attr : value2, time : new Date()}];
writePoint(seriesName, points, options, callback) { }
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


###readPoints
Reads points from a database - requires database user privileges

```js
readPoints(query, callback) { }
```





As Jeff Atwood puts it... [Read the source, Luke](http://www.codinghorror.com/blog/2012/04/learn-to-read-the-source-luke.html). If you're still stuck, read the `./examples/*` files and the `./test.js` file.


## Licence

MIT
