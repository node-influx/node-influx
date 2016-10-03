/* eslint-env mocha */
var influx = require('./')
var assert = require('assert')
var request = require('request')

before(function (done) {
  // Before doing anything validate that InfluxDB is a recent version and running
  request('http://localhost:8086/ping', function (err, response, body) {
    if (err) return done(err)
    var version = response.headers['x-influxdb-version']
    var major = version.split('.')[0]
    var minor = version.split('.')[1]

    assert.equal(major, 0)
    assert(minor >= 13)
    done()
  })
})

describe('InfluxDB', function () {
  var client
  var dbClient
  var failClient

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
      numName: 'number_test',
      strName: 'string_test'
    }
  }

  beforeEach(function (done) {
    client = influx({host: info.server.host, port: info.server.port, username: info.server.username, password: info.server.password, database: info.db.name, retentionPolicy: info.db.retentionPolicy})
    assert(client instanceof influx.InfluxDB)

    failClient = influx({host: info.server.host, port: 6543, username: info.server.username, password: info.server.password, database: info.db.name})
    assert(failClient instanceof influx.InfluxDB)

    dbClient = influx({host: info.server.host, port: info.server.port, username: info.server.username, password: info.server.password, database: info.db.name})
    assert(dbClient instanceof influx.InfluxDB)

    done()
  })

  describe('#InfluxDB', function () {
    it('should exist as a function (class)', function () {
      assert(typeof influx.InfluxDB === 'function')
    })
  })

  describe('create client', function () {
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

  describe('#noNetwork', function () {
    // Tests for library internals, do not send or receive any data

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
      it('should build a properly formatted tags string', function () {
        var str = client._createKeyTagString({tag_1: 'value', tag2: 'value value', tag3: 'value,value'})
        assert.equal(str, 'tag2=value\\ value,tag3=value\\,value,tag_1=value')  // tags should be sorted
      })
    })

    describe('#_createKeyValueString', function () {
      it('should build a properly formatted fieldset', function () {
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

  describe('#failedHost', function () {
    it('should return failed host', function (done) {
      // Issue any request so that library disables a host
      failClient.getUsers(function () {
        var hosts = failClient.getHostsDisabled()
        assert.equal(hosts.length, 1)
        assert.equal(hosts[0].name, info.server.host)
        done()
      })
    })
  })

  describe('#users', function () {
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
      after(function (done) {
        client.dropUser(info.db.username, done)
      })
    })

    describe('#dropUser', function () {
      before(function (done) {
        client.createUser(info.db.username, info.db.password, true, done)
      })
      it('should delete a user without error', function (done) {
        client.dropUser(info.db.username, done)
      })
      it('should error when deleting a user that does not exist', function (done) {
        client.dropUser(info.db.username, function (err) {
          assert(err instanceof Error)
          done()
        })
      })
    })

    describe('#withExistingUser', function () {
      beforeEach(function (done) {
        client.createUser(info.db.username, info.db.password, true, done)
      })
      afterEach(function (done) {
        client.dropUser(info.db.username, done)
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
        it('should error with failClient', function (done) {
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

      describe('#grantAndRevokePrivileges', function () {
        it('should grant user privileges without error', function (done) {
          client.grantPrivilege('READ', info.db.name, info.db.username, done)
        })
        it('should error when granting user invalid privilege', function (done) {
          client.grantPrivilege('BEER', info.db.name, info.db.username, function (err) {
            assert(err instanceof Error)
            done()
          })
        })
        it('should revoke user privileges without error', function (done) {
          client.revokePrivilege('READ', info.db.name, info.db.username, done)
        })
        it('should error when revoking invalid privilege', function (done) {
          client.revokePrivilege('BEER', info.db.name, info.db.username, function (err) {
            assert(err instanceof Error)
            done()
          })
        })
      })

      describe('#grantAndRevokeAdminPrivileges', function () {
        it('should grant admin privileges without error', function (done) {
          client.grantAdminPrivileges(info.db.username, done)
        })
        it('should error when granting invalid privilege', function (done) {
          client.grantAdminPrivileges('invalidPriv', function (err) {
            assert(err instanceof Error)
            done()
          })
        })
        it('should revoke admin privileges without error', function (done) {
          client.revokeAdminPrivileges(info.db.username, done)
        })
        it('should error when revoking invalid privilege', function (done) {
          client.revokeAdminPrivileges('invalidPriv', function (err) {
            assert(err instanceof Error)
            done()
          })
        })
      })
    })
  })

  describe('#createDatabase', function () {
    it('should create a new database without error', function (done) {
      client.createDatabase(info.db.name, done)
    })
    afterEach(function (done) {
      client.dropDatabase(info.db.name, done)
    })
  })

  describe('#dropDatabase', function () {
    beforeEach(function (done) {
      client.createDatabase(info.db.name, done)
    })
    it('should delete the database without error', function (done) {
      client.dropDatabase(info.db.name, done)
    })
    it('should not error if database didn\'t exist', function (done) {
      client.dropDatabase(info.db.name, function (err) {
        if (err) return done(err)
        client.dropDatabase(info.db.name, function (err) {
          done(err)
        })
      })
    })
  })

  describe('#withDatabase', function () {
    beforeEach(function (done) {
      client.createDatabase(info.db.name, done)
    })

    afterEach(function (done) {
      client.dropDatabase(info.db.name, done)
    })

    describe('#duplicateDatabase', function () {
      it('should not report an error if db already exists', function (done) {
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

    describe('#retentionPolicies', function () {
      beforeEach(function (done) {
        dbClient.createRetentionPolicy(info.db.retentionPolicy, info.db.name, '1d', 1, true, done)
      })
      it('should get an array of retention policies', function (done) {
        client.getRetentionPolicies(info.db.name, function (err, rps) {
          assert.equal(err, null)
          assert(rps instanceof Array)
          assert.equal(rps.length, 1)
          done()
        })
      })
      it('should alter a rentention policy', function (done) {
        dbClient.alterRetentionPolicy(info.db.retentionPolicy, info.db.name, '1h', 1, true, done)
      })
    })

    describe('#writePoint', function () {
      this.timeout(5000)

      it('should write a generic point into the database', function (done) {
        dbClient.writePoint(info.series.numName, {value: 232, value2: 123}, {foo: 'bar', foobar: 'baz'}, done)
      })

      it('should write a generic point into the database', function (done) {
        dbClient.writePoint(info.series.numName, 1, {foo: 'bar', foobar: 'baz'}, done)
      })

      it('should write a generic point into the database', function (done) {
        dbClient.writePoint(info.series.numName, {time: 1234567890, value: 232}, {}, done)
      })

      it('should write a point with RFC3339 timestamp and read it back', function (done) {
        var timestamp = '2016-10-02T20:50:00Z'
        dbClient.writePoint(info.series.numName, {time: timestamp, tag1: 'timestampRoundTrip'}, {}, function (err) {
          assert.equal(err, null)
          dbClient.query('SELECT * FROM ' + info.series.numName + " WHERE tag1='timestampRoundTrip';", function (err, res) {
            assert.equal(err, null)
            assert(res instanceof Array)
            assert.equal(res.length, 1, 'one series')
            assert.equal(res[0].length, 1, 'one result')
            assert.equal(res[0][0].tag1, 'timestampRoundTrip', 'incorrect point')
            assert.equal(res[0][0].time, timestamp, 'timestamp mismatch')
            done()
          })
        })
      })

      it('should write a point with time into the database', function (done) {
        dbClient.writePoint(info.series.numName, {time: new Date(), value: 232}, {}, done)
      })

      it('should write a point with a string as value into the database', function (done) {
        dbClient.writePoint(info.series.strName, {value: 'my test string'}, {}, done)
      })

      it('should write a point with a string as value into the database (using different method)', function (done) {
        dbClient.writePoint(info.series.strName, 'my second test string', {}, done)
      })

      it('should write a point that has "length" in its keys (#126)', function (done) {
        dbClient.writePoint(info.series.strName, {length: 3}, {length: '5'}, done)
      })
    })

    describe('#writePoints', function () {
      this.timeout(10000)
      it('should write multiple points to the same time series, same column names', function (done) {
        var points = [
          [{value: 232}, {foobar: 'baz'}],
          [{value: 212}, {foobar: 'baz'}],
          [{value: 452}, {foobar: 'baz'}],
          [{value: 122}]
        ]
        dbClient.writePoints(info.series.numName, points, done)
      })
      it('should write multiple points to the same time series, differing column names', function (done) {
        var points = [
          [{value: 232}, {foobar: 'baz'}],
          [{othervalue: 212}, {foobar: 'baz'}],
          [{andanothervalue: 452}, {foobar: 'baz'}]
        ]
        dbClient.writePoints(info.series.numName, points, done)
      })
    })

    describe('#writeSeries', function () {
      it('should write multiple points to multiple time series, same column names', function (done) {
        var points = [
          [{value: 232}, {foobar: 'baz'}],
          [{value: 212}, {foobar: 'baz'}],
          [{value: 452}, {foobar: 'baz'}],
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
          [{value: 232}, {foobar: 'baz'}],
          [{othervalue: 212}, {foobar: 'baz'}],
          [{andanothervalue: 452}, {foobar: 'baz'}]
        ]
        var data = {
          series1: points,
          series2: points
        }
        dbClient.writeSeries(data, done)
      })
      it('should write multiple points to multiple time series, differing column names, specified timestamps', function (done) {
        var points = [
          [{value: 232, time: 1234567787}, {foobar: 'baz'}],
          [{othervalue: 212, time: 1234567777}, {foobar: 'baz'}],
          [{andanothervalue: 452, time: 1234567747}, {foobar: 'baz'}]
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

    describe('#withPointsInDB', function () {
      beforeEach(function (done) {
        dbClient.writePoint(info.series.numName, {value: 100, value2: 200}, {field1: 'f1', field2: 'f2'}, function () {
          dbClient.writePoint(info.series.numName, {value: 101, value2: 201}, {field1: 'f1'}, function () {
            dbClient.writePoint(info.series.strName, {value: 'my test string'}, {}, function () {
              done()
            })
          })
        })
      })

      describe('#query', function () {
        it('should read a point from the database', function (done) {
          dbClient.query('SELECT value FROM ' + info.series.numName + ';', function (err, res) {
            assert.equal(err, null)
            assert(res instanceof Array)
            assert.equal(res.length, 1)
            assert.equal(res[0].length, 2)
            assert.equal(res[0][0].value, 100)
            assert.equal(res[0][1].value, 101)
            done()
          })
        })
      })

      describe('#queryRaw', function () {
        it('should read a point from the database and return raw values', function (done) {
          dbClient.queryRaw('SELECT value FROM ' + info.series.numName + ';', function (err, res) {
            assert.equal(err, null)
            assert(res instanceof Array)
            assert.equal(res.length, 1)
            assert.equal(res[0].series.length, 1)
            done()
          })
        })
      })

      describe('#escapingRoundtrip', function () {
        it('should escape, write, read, and unescape a point', function (done) {
          dbClient.writePoint(
            info.series.numName,
            {'value,= 1': ',"= ', ',= "': ',= "'},
            {tag1: 'escapingRoundTrip', '"commas, and = signs"': '"space != ,"'},
            function (err) {
              assert.equal(err, null)
              dbClient.query('SELECT * FROM ' + info.series.numName + " WHERE tag1='escapingRoundTrip';", function (err, res) {
                assert.equal(err, null)
                assert(res instanceof Array)
                assert.equal(res.length, 1, 'one series')
                assert.equal(res[0].length, 1, 'one result')
                assert.equal(res[0][0].tag1, 'escapingRoundTrip', 'incorrect point')
                assert.equal(res[0][0]['value,= 1'], ',"= ', '[,= ]-escaping field keys and values')
                assert.equal(res[0][0][',= "'], ',= "', 'escaping commas, equals, spaces, quotes in field keys and values')
                assert.equal(res[0][0]['"commas, and = signs"'], '"space != ,"', 'escaping tag keys and values')
                done()
              })
            }
          )
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
        it('should validate the returned measurements')
      })

      describe('#getSeries', function () {
        it('getSeries without name should return array of series', function (done) {
          client.getSeries(function (err, series) {
            if (err) return done(err)
            var expected = [ {
              columns: [ 'key' ],
              values: [
                [ 'number_test,field1=f1' ],
                [ 'number_test,field1=f1,field2=f2' ],
                [ 'string_test' ]
              ] } ]
            assert.deepEqual(series, expected)
            done()
          })
        })

        it('should return array of series', function (done) {
          client.getSeries(info.series.numName, function (err, series) {
            if (err) return done(err)
            assert(series instanceof Array)
            assert.equal(series[0].values.length, 2)
            done()
          })
        })
        it('should bubble errors through')
      })

      describe('#getSeriesNames', function () {
        it('should return array of series.numNames', function (done) {
          client.getSeriesNames(function (err, series) {
            if (err) return done(err)
            assert(series instanceof Array)
            assert.notEqual(series.indexOf(info.series.numName), -1)
            done()
          })
        })
        it('should return array of series.numNames from the db defined on connection', function (done) {
          client.getSeriesNames(function (err, series) {
            if (err) return done(err)
            assert(series instanceof Array)
            assert.notEqual(series.indexOf(info.series.numName), -1)
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
          failClient.dropSeries(info.series.numName, function (err) {
            assert(err instanceof Error)
            done()
          })
        })
      })

      describe('#dropMeasurement', function () {
        this.timeout(25000)
        it('should drop measurement', function (done) {
          client.dropMeasurement(info.series.numName, function (err) {
            if (err) return done(err)
            assert.equal(err, null)
            done()
          })
        })
        it('should bubble errors through', function (done) {
          failClient.dropMeasurement(info.series.numName, function (err) {
            assert(err instanceof Error)
            done()
          })
        })
      })
    })

    describe('#specialCharacters', function () {
      var keyValues = [
        {key: 'fieldKey', value: 'this space,that'},
        {key: 'fieldKey', value: 'single\'double"quote'},
        {key: 'key space, comma', value: 'value'},
        {key: 'key sp "dquo \'squo, comma', value: 'value sp "dquo \'squo, comma'}
      ]

      keyValues.forEach(function (field) {
        it('should write and read back point with field {' + field.key + ': ' + field.value + '}', function (done) {
          var fieldObject = {}
          fieldObject[field.key] = field.value
          dbClient.writePoint(info.series.strName, fieldObject, {}, function (err) {
            if (err) return done(err)
            var queryKey = field.key.replace(/[\\"]/g, '\\$&')
            dbClient.query('SELECT "' + queryKey + '" FROM ' + info.series.strName + ';', function (err, res) {
              if (err) return done(err)
              assert.equal(res[0][0][field.key], field.value)
              done()
            })
          })
        })
      })
    })

    describe('#createContinuousQuery', function () {
      it('should create a continuous query', function (done) {
        dbClient.createContinuousQuery('testQuery', 'SELECT COUNT(value) INTO valuesCount_1h FROM ' + info.series.numName + ' GROUP BY time(1h) ', function (err, res) {
          assert.equal(err, null)
          assert(res instanceof Array)
          assert.equal(res.length, 1)
          done()
        })
      })
    })

    describe('#withContinuousQueryInDB', function () {
      beforeEach(function (done) {
        dbClient.createContinuousQuery('testQuery', 'SELECT COUNT(value) INTO valuesCount_1h FROM ' + info.series.numName + ' GROUP BY time(1h) ', done)
      })

      describe('#getContinuousQueries', function () {
        it('should fetch all continuous queries from the database', function (done) {
          dbClient.getContinuousQueries(function (err, res) {
            assert.equal(err, null)
            assert(res instanceof Array)
            assert.equal(res.length, 1)
            // XXX Double check API / documentation, extra level of arrays?
            // assert.equal(res[0].name, 'testQuery')
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
    })
  })

  describe('#failoverClient', function () {
    var normalClient
    var failoverClient
    var failoverdb = 'test_db_failover'

    before(function (done) {
      normalClient = influx({host: info.server.host, port: info.server.port, username: info.server.username, password: info.server.password, database: failoverdb})

      normalClient.createDatabase(failoverdb, function (err, response) {
        assert.equal(err, null)
        normalClient.writePoint(info.series.numName, {value: 232, value2: 123}, {foo: 'bar', foobar: 'baz'}, function (err, response) {
          assert.equal(err, null)
          done()
        })
      })
    })

    beforeEach(function (done) {
      failoverClient = influx({hosts: [
        {host: '192.168.255.1'},
        {host: '192.168.255.2'},
        {host: '192.168.255.3'},
        {host: '192.168.255.4'},
        {host: info.server.host, port: info.server.port}
      ], username: info.server.username, passwort: info.server.password, database: failoverdb})

      done()
    })

    after(function (done) {
      normalClient.dropDatabase(failoverdb, done)
    })

    describe('#setRequestTimeout', function () {
      it('should set the default request timeout value', function (done) {
        var timeout = failoverClient.setRequestTimeout(5000)
        assert.equal(timeout, 5000)
        done()
      })
    })

    describe('#setFailoverTimeout', function () {
      it('should set the default request timeout value', function (done) {
        var timeout = failoverClient.setFailoverTimeout(2000)
        assert.equal(timeout, 2000)
        done()
      })
    })

    describe('#exceedRetryLimit', function () {
      it('should exceed retry limit', function (done) {
        // Validate default retry value will still cause failure
        assert.equal(failoverClient.options.maxRetries, 2)
        failoverClient.setRequestTimeout(1000)
        // Should fail after ~3 seconds (third failed retry)
        this.timeout(4000)
        failoverClient.query('SELECT value FROM ' + info.series.numName + ';', function (err) {
          assert(err instanceof Error)
          done()
        })
      })
    })

    describe('#queryFailover', function () {
      it('should read a point from the database after the failed servers have been removed', function (done) {
        // FIXME: This is a bit of a hack, but there's currently no API to dynamically change this
        failoverClient.request.options.maxRetries = 5
        failoverClient.setRequestTimeout(1000)
        // Should succeed on 5th server it tries (4s of timeouts)
        this.timeout(10000)
        failoverClient.query('SELECT value FROM ' + info.series.numName + ';', function (err, res) {
          assert.equal(err, null)
          assert(res instanceof Array)
          assert.equal(res.length, 1)
          assert(res[0].length === 1)
          assert.equal(res[0][0].value, 232)
          done()
        })
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
