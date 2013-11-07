# node-influx

An [InfluxDB](http://influxdb.org/) Node.js Client

[![Build Status](https://travis-ci.org/bencevans/node-influx.png?branch=master)](https://travis-ci.org/bencevans/node-influx)

## Installation

`npm install influx`

## Usage

Create a client instance (`database` not required for all methods):

```js
var influx = require('influx');
var client = influx(host, port, username, password, database);
```

As Jeff Atwood puts it... [Read the source, Luke](http://www.codinghorror.com/blog/2012/04/learn-to-read-the-source-luke.html). If you're still stuck, read the `./example/*` files and the `./test.js` file.


## Licence

MIT
