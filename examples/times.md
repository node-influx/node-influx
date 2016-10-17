# A Moment for Times

InfluxDB is a time series database, so it would make sense that the concept of time is moderately important when dealing with it.

By default, Influx will store all dates you give to it as a nanosecond-precision timestamp, whereas in JavaScript, most of the time we're dealing with millisecond precision timestamps, which we get from `Date.now()` or `myDate.getTime()`. This presents a bit of a problem for us JavaScripters, since nanosecond-precision timestamps are stored as 64-bit unsigned integers that JavaScript simply cannot represent accurately.

```
➜  node-influx git:(master) node
> 1475985480231035677
1475985480231035600
```

This module tries to make dates as easy as possible for you to deal with, and out of the box everything should "just work".

There are three places that dates can get passed around:

- Dates coming from Influx queries, like `select * from my_series`
- Dates being interpolated _into_ Influx queries
- Dates being used when writing points on the line protocol, via `.writePoints()` or `.writeMeasurement()`

To deal with this, we introduce a new type called **NanoDate**. These dates behave just like the normal `Date` type, but have two additional methods: `.getNanoTime()` and `.getNanoISOString()`. They behave just like the normal `.getTime()` and `getISOString` methods, but they both return nanosecond-precision strings instead of millisecond-precision numbers and timestamps.

```js
expect(myNanoDate.getTime()).to.equal(1475985480231)
expect(myNanoDate.getNanoTime()).to.equal('1475985480231035677')
expect(myNanoDate.toISOString()).to.equal('2016-10-09T03:58:00.231Z')
expect(myNanoDate.toNanoISOString()).to.equal('2016-10-09T03:58:00.231035677Z')
```

By default, **all times returned from Influx queries are parsed to NanoDates**. For example, you can do something like the following:

```js
influx.query('select * from perf').then(results => {
  results.forEach(row => console.log(`Used ${row.cpu} at ${row.time.toNanoISOString()}`))
})
```

The exception is if you manually ask for a precision of `ms` or coarser in the `options` parameter of the [`Influx#query` method](https://node-influx.github.io/class/src/index.js~InfluxDB.html#instance-method-query). Then, we parse your times into normal Dates.

When writing data to Influx, **all write methods accept NanoDates in all situations**. This means if you select data from Influx and want to update a data point, you can pass that time right back into the `write` method. (Remember, points within series are unique by their time!) If you have a nanosecond timestamp from some external source, you can convert it to a NanoDate using [`toNanoDate`](https://node-influx.github.io/function/index.html#static-function-toNanoDate).

```js
import { toNanoDate } from 'influx'

const myNanoDate = toNanoDate('1475985480231035600')
expect(myNanoDate.getTime()).to.equal(1475985480231)
expect(myNanoDate.getNanoTime()).to.equal('1475985480231035600')
expect(myNanoDate.toNanoISOString()).to.equal('2016-10-09T03:58:00.231035600Z')
```

Finally, **if you want to embed a NanoDate into an Influx query, you should should use `toNanoISOString`** to so do:

```js
influx.query(`select * from perf where time > "${myNanoDate.toNanoISOString()}"`)
```

---

Anything unclear? Have some remaining questions or found a bug? Feel free to [open an issue](https://github.com/node-influx/node-influx/issues/new), we respond quickly!
