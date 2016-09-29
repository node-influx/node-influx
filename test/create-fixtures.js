/**
 * When run, this file runs queries against the local influx server and saves
 * responses to queries as fixture files against which unit tests can be built,
 * so that they may run faster and more repeatably, and so that users can
 * quickly test the adapter against many database versions.
 *
 * Almost all Influx queries follow a set of standard responses. Thus we won't
 * be exhaustively creating fixtures for every type of query in existence, just
 * every query for which we do special parsing on its response.
 *
 * Each query is run in series, it's expected that this gets run against
 * a clean install/db with admin privileges.
 */

'use strict'

const querystring = require('querystring')
const fetch = require('node-fetch')
const path = require('path')
const db = 'influx_test_gen'
const fs = require('fs')

const queries = [
  update(`drop database "${db}"`), // clean up from any old/failed tests
  update(`create database "${db}"`),
  fixture('showDatabases', 'show databases'),
  write(fs.readFileSync(path.join(__dirname, 'fixtures_test_data.txt')), { db }),
  fixture('showMeasurements', 'show measurements', { db }),
  fixture('showSeries', 'show series', { db }),
  fixture('showSeriesFromOne', 'show series from series_1', { db }),
  fixture('selectFromOne', 'select * from series_0 where my_tag = \'1\' order by time desc', { db }),
  fixture('selectFromGroup', 'select top(my_value, 1) from series_0 group by my_tag order by time desc', { db }),
  fixture('error', 'this is not a valid query!')
]

const influxHost = process.env.INFLUX_HOST || 'http://localhost:8086'

let fixtureDir // filled in in boot()

/**
 * Writes a single line to the database, in line protocol format.
 * @param  {Object} params
 * @param  {String} body
 * @return {Function}
 */
function write (body, params) {
  return () => fetch(
    `${influxHost}/write?${querystring.stringify(params)}`,
    { method: 'POST', body }
  )
}

/**
 * Runs a single read query against the db.
 * @param  {Object} params
 * @param  {String} line
 * @return {Function}
 */
function query (query, params = {}) {
  params.q = query
  return () => fetch(
    `${influxHost}/query?${querystring.stringify(params)}`,
    { method: 'GET' }
  ).then(res => res.json())
}

/**
 * Runs a single update query against the db.
 * @param  {Object} params
 * @param  {String} line
 * @return {Function}
 */
function update (query, params = {}) {
  params.q = query
  return () => fetch(
    `${influxHost}/query?${querystring.stringify(params)}`,
    { method: 'POST' }
  ).then(res => res.buffer())
}

/**
 * Runs a query against the database and saves it as a fixture file.
 * @param  {String} fixtureName
 * @param  {Object} params
 * @param  {String} body
 * @return {Function}
 */
function fixture (fixtureName, body, params = {}) {
  return () => query(body, params)().then(res => {
    const name = path.join(fixtureDir, `${fixtureName}.json`)
    fs.writeFileSync(name, JSON.stringify(res, null, 2))
    console.log(`Created ${name}`)
  })
}

exports.boot = () => {
  return fetch(`${influxHost}/ping`)
  .then(res => {
    const version = res.headers.get('X-InfluxDB-Version')
    fixtureDir = path.join(__dirname, 'fixture', version)

    if (!fs.existsSync(fixtureDir)) {
      fs.mkdirSync(fixtureDir)
    }

    return (function run (i) {
      if (i === queries.length) {
        return
      }

      return queries[i]()
      .then(() => run(i + 1))
    })(0)
  })
}

if (require.main === module) {
  exports.boot()
  .then(() => process.exit(0))
}

