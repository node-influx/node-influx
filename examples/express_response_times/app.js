var express = require('express')
var http = require('http')
var influx = require('../../')

var app = express()
var serverInflux = influx()
var dbInflux = influx({host: 'localhost', username: 'example_response_dbuser', password: 'P85sw0rD', database: 'example_response'})

app.use(express.logger('dev'))

/**
 * LOOKING FOR JUST THE MIDDLEWARE?
 *
 *    THEN COPY THIS PART
 *
 *  WARNING: CHANGE THE ERROR THROW
 */

// TODO: Wait and then send multiple points within suitable timeframe.

app.use(function (req, res, next) {
  var startTime = new Date()
  function logRequest () {
    res.removeListener('finish', logRequest)
    res.removeListener('close', logRequest)
    dbInflux.writePoint('response_times', { time: startTime, value: (new Date()) - startTime }, function (err) {
      if (err) throw err
    })
  }
  res.on('finish', logRequest)
  res.on('close', logRequest)
  return next()
})

/**
 *      AND STOP HERE
 */

app.get('/', function (req, res) {
  setTimeout(function () {
    res.send('Good Day.')
  }, Math.random() * 500)
})

function startApp () {
  http.createServer(app).listen(3000, function () {
    console.log('Listening on port 3000')
  })
}

console.log('Checking DB Exists')
serverInflux.getDatabaseNames(function (err, dbs) {
  if (err) throw err
  if (dbs.indexOf('example_response') === -1) {
    console.log('Creating Database')
    serverInflux.createDatabase('example_response', function (err) {
      if (err) throw err
      console.log('Creating User')
      serverInflux.createUser('example_response', 'example_response_dbuser', 'P85sw0rD', function (err) {
        if (err) throw err
        startApp()
      })
    })
  } else {
    startApp()
  }
})
