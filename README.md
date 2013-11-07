# node-influx

An [InfluxDB](http://influxdb.org/) Node.js Client

[![Build Status](https://travis-ci.org/bencevans/node-influx.png?branch=master)](https://travis-ci.org/bencevans/node-influx)
[![Coverage Status](https://coveralls.io/repos/bencevans/node-influx/badge.png?branch=master)](https://coveralls.io/r/bencevans/node-influx?branch=master)

## Installation

`npm install influx`

## Usage

Create a client instance (`database` not required for all methods):

```js
var influx = require('influx');
var client = influx(host, port, username, password, database);
```

As Jeff Atwood puts it... [Read the source, Luke](http://www.codinghorror.com/blog/2012/04/learn-to-read-the-source-luke.html). If you're still stuck, read the `./examples/*` files and the `./test.js` file.


## Licence

MIT
