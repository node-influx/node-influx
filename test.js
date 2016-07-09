/* eslint-env mocha */
var influx = require('./')
var assert = require('assert')

describe('InfluxDB', function () {
  var client
  var dbClient
  var failClient
  var failoverClient

  var info = {
    server: {
      host: 'localhost',
      port: 8086,
      username: 'root',
      password: 'root',
      timePrecision: 'ms'
    },
    db: {
      name: 'test_db',
      username: 'johnsmith',
      password: 'johnjohn',
      retentionPolicy: 'testrp'
    },
    series: {
      name: 'response_time',
      strName: 'string_test'
    }
  }

  describe('#InfluxDB', function () {
    it('should exist as a function (class)', function () {
      assert(typeof influx.InfluxDB === 'function')
    })
  })

  describe('create client', function () {
    it('should create an instance without error', function () {
      client = influx({host: info.server.host, port: info.server.port, username: info.server.username, password: info.server.password, database: info.db.name, retentionPolicy: info.db.retentionPolicy})
      dbClient = influx({host: info.server.host, port: info.server.port, username: info.server.username, password: info.server.password, database: info.db.name})
      failClient = influx({host: info.server.host, port: 6543, username: info.server.username, password: info.server.password, database: info.db.name})
      failoverClient = influx({hosts: [
          {host: '192.168.255.1'},
          {host: '192.168.255.2'},
          {host: '192.168.255.3'},
          {host: '192.168.255.4'},
          {host: info.server.host, port: info.server.port}
      ], username: info.server.username, passwort: info.server.password, database: info.db.name})

      assert(client instanceof influx.InfluxDB)
    })

    describe('configured using URLs', function () {
      it('should parse it when passed as `options`', function () {
        var urlClient = influx(
          'http://admin:fancierpassword@influx.foobar.com:1337/mydatabase'
        )

        assert.equal(urlClient.options.host, 'influx.foobar.com')
        assert.equal(urlClient.options.port, 1337)
        assert.equal(urlClient.options.username, 'admin')
        assert.equal(urlClient.options.password, 'fancierpassword')
        assert.equal(urlClient.options.database, 'mydatabase')
      })

      it('should parse them when passed in `hosts`', function () {
        var urlClient = influx({
          hosts: [
            'http://127.0.0.1:1337',
            'https://127.0.0.2:1338'
          ]
        })

        var hostsParsed = urlClient.getHostsAvailable()
        assert.equal(hostsParsed[0].name, '127.0.0.1')
        assert.equal(hostsParsed[0].port, 1337)
        assert.equal(hostsParsed[0].protocol, 'http:')
        assert.equal(hostsParsed[1].name, '127.0.0.2')
        assert.equal(hostsParsed[1].port, 1338)
        assert.equal(hostsParsed[1].protocol, 'https:')
      })
    })
  })

  describe('#setRequestTimeout', function () {
    it('should set the default request timeout value', function () {
      var timeout = failoverClient.setRequestTimeout(5000)
      assert.equal(timeout, 5000)
    })
  })

  describe('#setFailoverTimeout', function () {
    it('should set the default request timeout value', function () {
      var timeout = failoverClient.setFailoverTimeout(2000)
      assert.equal(timeout, 2000)
    })
  })

  describe('#url', function () {
    it('should build a properly formatted url', function () {
      var url = client.url('query', { db: info.db.name, rp: info.db.retentionPolicy, precision: info.server.timePrecision })
      assert.equal(url, /* 'http://'+info.server.host+':8086/' + */ 'query?u=' + info.server.username + '&p=' + info.server.password + '&db=' + info.db.name + '&rp=' + info.db.retentionPolicy + '&precision=' + info.server.timePrecision)
    })

    it('should build a properly formatted url', function () {
      var url = client.url('query')
      assert.equal(url, /* 'http://'+info.server.host+':8086/' + */ 'query?u=' + info.server.username + '&p=' + info.server.password + '&precision=' + info.server.timePrecision + '&db=' + info.db.name + '&rp=' + info.db.retentionPolicy)
    })

  })

  describe('#_createKeyTagString', function () {
    it('should build a properly formatted string', function () {
      var str = client._createKeyTagString({tag_1: 'value', tag2: 'value value', tag3: 'value,value'})
      assert.equal(str, 'tag_1=value,tag2=value\\ value,tag3=value\\,value')
    })
  })

  describe('#_createKeyValueString', function () {
    it('should build a properly formatted string', function () {
      var str = client._createKeyValueString({a: 1, b: 2})
      assert.equal(str, 'a=1,b=2')
    })
  })

  describe('parseResult()', function () {
    it('should build a properly formatted response', function (done) {
      client._parseResults([{'series': [{'name': 'myseries2', 'tags': {'mytag': 'foobarfoo'}, 'columns': ['time', 'value'], 'values': [['2015-06-27T06:25:54.411900884Z', 55]]}, {'name': 'myseries2', 'tags': {'mytag': 'foobarfoo2'}, 'columns': ['time', 'value'], 'values': [['2015-06-27T06:25:54.411900884Z', 29]]}]}],
        function (err, results) {
          if (err) return done(err)
          assert.deepEqual(results,
            [ [ { time: '2015-06-27T06:25:54.411900884Z',
              value: 55,
            mytag: 'foobarfoo' },
              { time: '2015-06-27T06:25:54.411900884Z',
                value: 29,
              mytag: 'foobarfoo2' } ] ]
          )
          done()
        })
    })
  })

  describe('#availableHosts', function () {
    it('should return one host', function (done) {
      var hosts = client.getHostsAvailable()
      assert(hosts instanceof Array)
      assert.equal(hosts.length, 1)
      done()
    })
  })

  describe('#disabledHosts', function () {
    it('should return empty array', function (done) {
      var hosts = client.getHostsDisabled()
      assert(hosts instanceof Array)
      assert.equal(hosts.length, 0)
      done()
    })
  })

  describe('#createDatabase', function () {
    it('should create a new database without error', function (done) {
      client.createDatabase(info.db.name, done)
    })
    it('should not throw an error if db already exists', function (done) {
      client.createDatabase(info.db.name, function (err) {
        done(err)
      })
    })
  })

  describe('#getDatabaseNames', function () {
    it('should return array of database names', function (done) {
      client.getDatabaseNames(function (err, dbs) {
        if (err) return done(err)
        assert(dbs instanceof Array)
        assert.notEqual(dbs.indexOf(info.db.name), -1)
        done()
      })
    })
    it('should bubble errors through', function (done) {
      failClient.getDatabaseNames(function (err) {
        assert(err instanceof Error)
        done()
      })
    })
  })

  describe('#disabledHosts', function () {
    it('should return failed host', function (done) {
      var hosts = failClient.getHostsDisabled()
      assert.equal(hosts.length, 1)
      assert.equal(hosts[0].name, info.server.host)
      done()
    })
  })

  describe('#createUser', function () {
    it('should create a user without error', function (done) {
      client.createUser(info.db.username, info.db.password, true, done)
    })
    it('should error when creating an existing user', function (done) {
      client.createUser(info.db.username, info.db.password, function (err) {
        assert(err instanceof Error)
        done()
      })
    })
  })

  describe('#getUsers', function () {
    it('should get an array of database users', function (done) {
      client.getUsers(function (err, users) {
        assert.equal(err, null)
        assert(users instanceof Array)
        assert.equal(users.length, 1)
        done()
      })
    })

    it('should error when deleting an existing user', function (done) {
      failClient.getUsers(function (err) {
        assert(err instanceof Error)
        done()
      })
    })

  })

  describe('#setPassword', function () {
    it('should update user password without error', function (done) {
      client.setPassword(info.db.username, info.db.password, done)
    })
  })

  describe('#grantPrivilege', function () {
    it('should grant user privileges without error', function (done) {
      client.grantPrivilege('READ', info.db.name, info.db.username, done)
    })
    it('should error when granting user privilege', function (done) {
      client.grantPrivilege('BEER', info.db.name, info.db.username, function (err) {
        assert(err instanceof Error)
        done()
      })
    })
  })

  describe('#revokePrivilege', function () {
    it('should revoke user privileges without error', function (done) {
      client.revokePrivilege('READ', info.db.name, info.db.username, done)
    })
    it('should error when updating user privilege', function (done) {
      client.revokePrivilege('BEER', info.db.name, info.db.username, function (err) {
        assert(err instanceof Error)
        done()
      })
    })
  })

  describe('#grantAdminPrivileges', function () {
    it('should grant admin privileges without error', function (done) {
      client.grantAdminPrivileges(info.db.username, done)
    })
    it('should error when granting admin privileges', function (done) {
      client.grantAdminPrivileges('yourmum', function (err) {
        assert(err instanceof Error)
        done()
      })
    })
  })

  describe('#revokeAdminPrivileges', function () {
    it('should revoke admin privileges without error', function (done) {
      client.revokeAdminPrivileges(info.db.username, done)
    })
    it('should error when revoking admin privileges', function (done) {
      client.revokeAdminPrivileges('yourmum', function (err) {
        assert(err instanceof Error)
        done()
      })
    })
  })

  describe('#dropUser', function () {
    it('should delete a user without error', function (done) {
      client.dropUser(info.db.username, done)
    })
    it('should error when deleting an existing user', function (done) {
      client.dropUser(info.db.username, function (err) {
        assert(err instanceof Error)
        done()
      })
    })
  })

  describe('#createRetentionPolicy', function () {
    it('should create a rentention policy', function (done) {
      dbClient.createRetentionPolicy(info.db.retentionPolicy, info.db.name, '1d', 1, true, done)
    })
  })

  describe('#getRetentionPolicies', function () {
    it('should get an array of retention policies', function (done) {
      client.getRetentionPolicies(info.db.name, function (err, rps) {
        assert.equal(err, null)
        assert(rps instanceof Array)
        assert.equal(rps.length, 1)
        done()
      })
    })
  })

  describe('#alterRetentionPolicy', function () {
    it('should alter a rentention policy', function (done) {
      dbClient.alterRetentionPolicy(info.db.retentionPolicy, info.db.name, '1h', 1, true, done)
    })
  })

  describe('#writePoint', function () {
    this.timeout(5000)

    it('should write a generic point into the database', function (done) {
      dbClient.writePoint(info.series.name, {value: 232, value2: 123}, { foo: 'bar', foobar: 'baz'}, done)
    })

    it('should write a generic point into the database', function (done) {
      dbClient.writePoint(info.series.name, 1, { foo: 'bar', foobar: 'baz'}, done)
    })

    it('should write a generic point into the database', function (done) {
      dbClient.writePoint(info.series.name, {time: 1234567890, value: 232}, {}, done)

    })

    it('should write a point with time into the database', function (done) {
      dbClient.writePoint(info.series.name, {time: new Date(), value: 232}, {}, done)
    })

    it('should write a point with a string as value into the database', function (done) {
      dbClient.writePoint(info.series.strName, {value: 'my test string'}, {}, done)
    })

    it('should write a point with a string as value into the database (using different method)', function (done) {
      dbClient.writePoint(info.series.strName, 'my second test string', {}, done)
    })

    it('should write a point that has "length" in its keys', function (done) {
      dbClient.writePoint(info.series.strName, {length: 3}, {length: '5'}, done)
    })
  })

  describe('#writePoints', function () {
    this.timeout(10000)
    it('should write multiple points to the same time series, same column names', function (done) {
      var points = [
        [{value: 232}, { foobar: 'baz'}],
        [{value: 212}, { foobar: 'baz'}],
        [{value: 452}, { foobar: 'baz'}],
        [{value: 122}]
      ]
      dbClient.writePoints(info.series.name, points, done)
    })
    it('should write multiple points to the same time series, differing column names', function (done) {
      var points = [
        [{value: 232}, { foobar: 'baz'}],
        [{othervalue: 212}, { foobar: 'baz'}],
        [{andanothervalue: 452}, { foobar: 'baz'}]
      ]
      dbClient.writePoints(info.series.name, points, done)
    })
  })

  describe('#writeSeries', function () {
    it('should write multiple points to multiple time series, same column names', function (done) {
      var points = [
        [{value: 232}, { foobar: 'baz'}],
        [{value: 212}, { foobar: 'baz'}],
        [{value: 452}, { foobar: 'baz'}],
        [{value: 122}]
      ]
      var data = {
        series1: points,
        series2: points
      }
      dbClient.writeSeries(data, done)
    })
    it('should write multiple points to multiple time series, differing column names', function (done) {
      var points = [
        [{value: 232}, { foobar: 'baz'}],
        [{othervalue: 212}, { foobar: 'baz'}],
        [{andanothervalue: 452}, { foobar: 'baz'}]
      ]
      var data = {
        series1: points,
        series2: points
      }
      dbClient.writeSeries(data, done)
    })
    it('should write multiple points to multiple time series, differing column names, specified timestamps', function (done) {
      var points = [
        [{value: 232, time: 1234567787}, { foobar: 'baz'}],
        [{othervalue: 212, time: 1234567777}, { foobar: 'baz'}],
        [{andanothervalue: 452, time: 1234567747}, { foobar: 'baz'}]
      ]
      var data = {
        series1: points,
        series2: points
      }
      var response = dbClient._prepareValues(data)
      var expected = 'series1,foobar=baz value=232 1234567787\nseries1,foobar=baz othervalue=212 1234567777\nseries1,foobar=baz andanothervalue=452 1234567747\nseries2,foobar=baz value=232 1234567787\nseries2,foobar=baz othervalue=212 1234567777\nseries2,foobar=baz andanothervalue=452 1234567747'
      assert.equal(response, expected)
      done()
    })
  })

  describe('#query', function () {
    it('should read a point from the database', function (done) {
      dbClient.query('SELECT value FROM ' + info.series.name + ';', function (err, res) {
        assert.equal(err, null)
        assert(res instanceof Array)
        assert.equal(res.length, 1)
        assert(res[0].length >= 2)
        assert.equal(res[0][0].value, 232)
        done()
      })
    })
  })

  describe('#queryRaw', function () {
    it('should read a point from the database and return raw values', function (done) {
      dbClient.queryRaw('SELECT value FROM ' + info.series.name + ';', function (err, res) {
        assert.equal(err, null)
        assert(res instanceof Array)
        assert.equal(res.length, 1)
        assert.equal(res[0].series.length, 1)
        done()
      })
    })
  })

  describe('#createContinuousQuery', function () {
    it('should create a continuous query', function (done) {
      dbClient.createContinuousQuery('testQuery', 'SELECT COUNT(value) INTO valuesCount_1h FROM ' + info.series.name + ' GROUP BY time(1h) ', function (err, res) {
        assert.equal(err, null)
        assert(res instanceof Array)
        assert.equal(res.length, 1)
        done()
      })
    })
  })

  describe('#getContinuousQueries', function () {
    it('should fetch all continuous queries from the database', function (done) {
      dbClient.getContinuousQueries(function (err, res) {
        assert.equal(err, null)
        assert(res instanceof Array)
        assert.equal(res.length, 1)
        done()
      })
    })
  })

  describe('#dropContinuousQuery', function () {
    it('should drop the continuous query from the database', function (done) {
      dbClient.getContinuousQueries(function (err, res) {
        if (err) return done(err)
        dbClient.dropContinuousQuery(res[0][0].name, function (err) {
          assert.equal(err, null)
          done()
        })
      })
    })
  })

  describe('#query failover', function () {
    it('should exceed retry limit', function (done) {
      this.timeout(30000)
      failoverClient.query('SELECT value FROM ' + info.series.name + ';', function (err) {
        assert(err instanceof Error)
        done()
      })
    })
  })

  describe('#query failover', function () {
    it('should read a point from the database after the failed servers have been removed', function (done) {
      this.timeout(25000)
      failoverClient.query('SELECT value FROM ' + info.series.name + ';', function (err, res) {
        assert.equal(err, null)
        assert(res instanceof Array)
        assert.equal(res.length, 1)
        assert(res[0].length >= 2)
        assert.equal(res[0][0].value, 232)
        done()
      })
    })
  })

  describe('#getMeasurements', function () {
    it('should return array of measurements', function (done) {
      client.getMeasurements(function (err, measurements) {
        if (err) return done(err)
        assert(measurements instanceof Array)
        assert.equal(measurements.length, 1)
        done()
      })
    })
  })

  describe('#getSeries', function () {
    it('should return array of series', function (done) {
      client.getSeries(function (err, series) {
        if (err) return done(err)
        assert(series[0].values instanceof Array)
        assert(series[0].values.length >= 3)
        done()
      })
    })

    it('should return array of series', function (done) {
      client.getSeries(info.series.name, function (err, series) {
        if (err) return done(err)
        assert(series instanceof Array)
        assert.equal(series[0].values.length, 3)
        done()
      })
    })
    it('should bubble errors through')
  })

  describe('#getSeriesNames', function () {
    it('should return array of series names', function (done) {
      client.getSeriesNames(function (err, series) {
        if (err) return done(err)
        assert(series instanceof Array)
        assert.notEqual(series.indexOf(info.series.name), -1)
        done()
      })
    })
    it('should return array of series names from the db defined on connection', function (done) {
      client.getSeriesNames(function (err, series) {
        if (err) return done(err)
        assert(series instanceof Array)
        assert.notEqual(series.indexOf(info.series.name), -1)
        done()
      })
    })
    it('should bubble errors through')
  })

  describe('#dropSeries', function () {
    this.timeout(25000)
    it('should drop series', function (done) {
      client.dropSeries('WHERE foobar="baz"', function (err) {
        if (err) return done(err)
        assert.equal(err, null)
        done()
      })
    })
    it('should bubble errors through', function (done) {
      failClient.dropSeries(info.series.name, function (err) {
        assert(err instanceof Error)
        done()
      })
    })
  })

  describe('#dropMeasurement', function () {
    this.timeout(25000)
    it('should drop measurement', function (done) {
      client.dropMeasurement(info.series.name, function (err) {
        if (err) return done(err)
        assert.equal(err, null)
        done()
      })
    })
    it('should bubble errors through', function (done) {
      failClient.dropMeasurement(info.series.name, function (err) {
        assert(err instanceof Error)
        done()
      })
    })
  })

  describe('#dropDatabase', function () {
    this.timeout(25000)
    it('should delete the database without error', function (done) {
      client.dropDatabase(info.db.name, done)
    })
    it('should not error if database didn\'t exist', function (done) {
      client.dropDatabase(info.db.name, function (err) {
        done(err)
      })
    })
  })

})

// todo:
// HTTPS support didn't work, InfluxDB didn't start no matter what. needs to be solved asap
/* describe('HTTPS connection', function() {
  var client

  var dbName = 'https_db'

  describe('connect and create test DB', function () {

    before(function() {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // allow self-signed cert

      client = influx({
        host: 'localhost',
        port: 8084,
        protocol: 'https',
        username: 'root',
        password: 'root',
        timePrecision: 'ms'
      })
    })

    it('should create a new database without error', function (done) {
      client.createDatabase(dbName, done)
    })

    it('should throw an error if db already exists', function (done) {
      client.createDatabase(dbName, function (err) {
        assert(err instanceof Error)
        done()
      })
    })

  })
})
*/
