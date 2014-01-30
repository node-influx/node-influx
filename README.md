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

```js
createDatabase(databaseName, callback) { }
```
Creates a new database - requires cluster admin privileges

```js
deleteDatabase(databaseName, callback) { }
```
Deletes a database - requires cluster admin privileges

```js
getDatabaseNames(callback) { }
```
Returns array of database names - requires cluster admin privileges

```js
getSeriesNames(databaseName, callback) { }
```
Returns array of series names from given database - requires database admin privileges


```js
createUser(databaseName, username, password, callback) { }
```
Creates a new database user - requires cluster admin privileges

```js
writePoint(seriesName, values, options, callback) { }
```
Writes point to database - requires database user privileges

```js
readPoints(query, callback) { }
```
Reads points from a database - requires database user privileges





As Jeff Atwood puts it... [Read the source, Luke](http://www.codinghorror.com/blog/2012/04/learn-to-read-the-source-luke.html). If you're still stuck, read the `./examples/*` files and the `./test.js` file.


## Licence

MIT
