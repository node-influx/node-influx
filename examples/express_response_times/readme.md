# Express Response Times Example

In this example we'll create a server which has an index page that prints out "hello world", and a page `http://localhost:3000/times` which prints out the last ten response times that InfluxDB gave us.

You can see annotated the source code [on Github here](https://github.com/node-influx/node-influx/tree/master/examples/express_response_times).

The end result should look something like this:

```js
➜  ~ curl -s localhost:3000
Hello world!
➜  ~ curl -s localhost:3000/times | jq
[
  {
    "time": "2016-10-09T19:13:26.815Z",
    "duration": 205,
    "host": "ares.peet.io",
    "path": "/"
  }
]
```

Get started by installing and importing everything we need! This tutorial assumes you're running Node 6.

```
npm install influx express
```

Now create a new file `app.js` and start writing:

```js
const Influx = require('../../')
const express = require('express')
const http = require('http')
const os = require('os')

const app = express()
```

Create a new Influx client. We tell it to use the `express_response_db` database by default, and give it some information about the schema we're writing. It can use this to be smarter about what data formats it writes and do some basic validation for us.

```js
const influx = new Influx.InfluxDB({
  host: 'localhost',
  database: 'express_response_db',
  schema: [
    {
      measurement: 'response_times',
      fields: {
        path: Influx.FieldType.STRING,
        duration: Influx.FieldType.INTEGER
      },
      tags: [
        'host'
      ]
    }
  ]
})
```

> Things we used:
>  - [new InfluxDB()](https://node-influx.github.io/class/src/index.js~InfluxDB.html#instance-constructor-constructor)
>  - [Influx.FieldType](https://node-influx.github.io/typedef/index.html#static-typedef-FieldType)

Now, we have a working Influx client! We'll make sure the database exists and boot the app.

```js
influx.getDatabaseNames()
  .then(names => {
    if (!names.includes('express_response_db')) {
      return influx.createDatabase('express_response_db');
    }
  })
  .then(() => {
    http.createServer(app).listen(3000, function () {
      console.log('Listening on port 3000')
    })
  })
  .catch(err => {
    console.error(`Error creating Influx database!`);
  })
```

> Things we used:
>  - [InfluxDB#getDatabaseNames](https://node-influx.github.io/class/src/index.js~InfluxDB.html#instance-method-getDatabaseNames)
>  - [InfluxDB#createDatabase](https://node-influx.github.io/class/src/index.js~InfluxDB.html#instance-method-createDatabase)

Finally, we'll define the middleware and routes we'll use. We have a generic middleware that records the time between when requests comes in, and the time we respond to them. We also have another route called `/times` which prints out the last ten timings we recorded.

```js
app.use((req, res, next) => {
  const start = Date.now()

  res.on('finish', () => {
    const duration = Date.now() - start
    console.log(`Request to ${req.path} took ${duration}ms`);

    influx.writePoints([
      {
        measurement: 'response_times',
        tags: { host: os.hostname() },
        fields: { duration, path: req.path },
      }
    ]).catch(err => {
      console.error(`Error saving data to InfluxDB! ${err.stack}`)
    })
  })
  return next()
})

app.get('/', function (req, res) {
  setTimeout(() => res.end('Hello world!'), Math.random() * 500)
})

app.get('/times', function (req, res) {
  influx.query(`
    select * from response_times
    where host = ${Influx.escape.stringLit(os.hostname())}
    order by time desc
    limit 10
  `).then(result => {
    res.json(result)
  }).catch(err => {
    res.status(500).send(err.stack)
  })
})
```

> Things we used:
>  - [InfluxDB#writePoints](https://node-influx.github.io/class/src/index.js~InfluxDB.html#instance-method-writePoints)
>  - [InfluxDB#query](https://node-influx.github.io/class/src/index.js~InfluxDB.html#instance-method-query)
>  - [InfluxDB.escape.stringLit](https://node-influx.github.io/variable/index.html#static-variable-escape)

That's it! Go ahead and boot your app using `node app.js` and try it out! You can see the complete annotated the source code [on Github here](https://github.com/node-influx/node-influx/tree/master/examples/express_response_times).
