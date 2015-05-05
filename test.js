var influx = require('./');
var assert = require('assert');


describe('InfluxDB', function () {

  var client;
  var dbClient;
  var failClient;
  var failoverClient;

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
      password: 'johnjohn'
    },
    series: {
      name: 'response_time'
    }
  };

  describe('#InfluxDB', function () {
    it('should exist as a function (class)', function () {
      assert(typeof influx.InfluxDB === 'function');
    });
  });

  describe('create client', function () {
    it('should create an instance without error', function () {
      client = influx({host : info.server.host, port: info.server.port, username: info.server.username, password : info.server.password, database : info.db.name});
      dbClient = influx({host : info.server.host, port: info.server.port, username: info.server.username, password : info.server.password, database : info.db.name});
      failClient = influx({host : info.server.host, port: 6543, username: info.server.username, password : info.server.password, database : info.db.name});
      failoverClient = influx({hosts : [
        {host : '192.168.1.1'},
        {host : '192.168.1.2'},
        {host : '192.168.1.3'},
        {host : '192.168.1.4'},
        {host : info.server.host, port: info.server.port}
      ], username: info.server.username, passwort : info.server.password, database : info.db.name});

      assert(client instanceof influx.InfluxDB);
    });
  });


  describe('#setRequestTimeout', function () {
    it('should set the default request timeout value', function () {
      var timeout= failoverClient.setRequestTimeout(5000);
      assert.equal(timeout,5000);
    });
  });

  describe('#setFailoverTimeout', function () {
    it('should set the default request timeout value', function () {
      var timeout= failoverClient.setFailoverTimeout(2000);
      assert.equal(timeout,2000);
    });
  });

  describe('#url', function () {
    it('should build a properly formatted url', function () {
      var url = client.url(info.db.name);
      assert.equal(url, /*'http://'+info.server.host+':8086/' + */ info.db.name + '?u=' + info.server.username + '&p=' + info.server.password + '&time_precision=' + info.server.timePrecision);
    });
  });

  describe('#availableHosts', function () {
    it('should return one host', function (done) {
      var hosts = client.getHostsAvailable();
      assert(hosts instanceof Array);
      assert.equal(hosts.length, 1);
      done();
    });
  });

  describe('#disabledHosts', function () {
    it('should return empty array', function (done) {
      var hosts = client.getHostsDisabled();
      assert(hosts instanceof Array);
      assert.equal(hosts.length, 0);
      done();
    });
  });

  describe('#createDatabase', function () {
    it('should create a new database without error', function (done) {
      client.createDatabase(info.db.name, done);
    });
    it('should throw an error if db already exists', function (done) {
      client.createDatabase(info.db.name, function (err) {
        assert(err instanceof Error);
        done();
      });
    });
  });

  describe('#getDatabaseNames', function () {
    it('should return array of database names', function (done) {
      client.getDatabaseNames(function (err, dbs) {
        if (err) return done(err);
        assert(dbs instanceof Array);
        assert.notEqual(dbs.indexOf(info.db.name), -1);
        done();
      });
    });
    it('should bubble errors through', function (done) {
      failClient.getDatabaseNames(function (err) {
        assert(err instanceof Error);
        done();
      });
    });
  });

  describe('#disabledHosts', function () {
    it('should return failed host', function (done) {
      var hosts = failClient.getHostsDisabled();
      assert.equal(hosts.length, 1);
      assert.equal(hosts[0].name, info.server.host);
      done();
    });
  });

  describe('#getUsers', function() {
    it('should get an array of database users', function (done) {
      client.getUsers(info.db.name, function(err, users) {
        assert.equal(err, null);
        assert(users instanceof Array);
        assert.equal(users.length, 0);
        done();
      });
    });
  });

  describe('#createUser', function () {
    it('should create a user without error', function (done) {
      client.createUser(info.db.name, info.db.username, info.db.password, done);
    });
    it('should error when creating an existing user', function (done) {
      client.createUser(info.db.name, info.db.username, info.db.password, function (err) {
        assert(err instanceof Error);
        done();
      });
    });
  });

  describe('#getUser', function() {
    it('should get a database user without error', function (done) {
      client.getUser(info.db.name, info.db.username, done);
    });
    it('should error when getting non existing user', function (done) {
      client.getUser(info.db.name, 'johndoe', function (err) {
        assert(err instanceof Error);
        done();
      });
    });
  });

  describe('#updateUser', function () {
    it('should update user without error', function (done) {
      client.updateUser(info.db.name, info.db.username, {admin: true}, done);
    });
    it('should error when updating non existing user', function (done) {
      client.updateUser(info.db.name, 'johndoe', {admin: false}, function (err) {
        assert(err instanceof Error);
        done();
      });
    });
  });


  describe('#writePoint', function () {
    it('should write a generic point into the database', function (done) {
      dbClient.writePoint(info.series.name, {username: 'reallytrial', value: 232}, done);
    });
    it('should write a point with time into the database', function (done) {
      dbClient.writePoint(info.series.name, {time: new Date(), value: 232}, done);
    });
  });

  describe('#writePoints', function () {
    this.timeout(10000);
    it('should write multiple points to the same time series, same column names', function (done) {
      var points = [
        {username: 'reallytrial', value: 232},
        {username: 'welovefashion', value: 232},
        {username: 'welovefashion', value: 4711}
      ];
      dbClient.writePoints(info.series.name, points, done);
    });
    it('should write multiple points to the same time series, differing column names', function (done) {
      var points = [
        {username: 'reallytrial', value: 232},
        {username: 'welovefashion', othervalue: 232},
        {otherusername: 'welovefashion', value: 4711}
      ];
      dbClient.writePoints(info.series.name, points, done);
    });
  });

  describe('#writeSeries', function () {
    it('should write multiple points to multiple time series, same column names', function (done) {
      var points = [
        {username: 'reallytrial', value: 232},
        {username: 'welovefashion', value: 232},
        {username: 'welovefashion', value: 4711}
      ];
      var data = {
        series1: points,
        series2: points
      };
      dbClient.writeSeries(data, done);
    });
    it('should write multiple points to multiple time series, differing column names', function (done) {
      var points = [
        {username: 'reallytrial', value: 232},
        {username: 'welovefashion', othervalue: 232},
        {otherusername: 'welovefashion', value: 4711}
      ];
      var data = {
        series1: points,
        series2: points
      };
      dbClient.writeSeries(data, done);
    });
  });

  describe('#query', function () {
    it('should read a point from the database', function (done) {
      dbClient.query('SELECT value FROM ' + info.series.name + ';', function (err, res) {
        assert.equal(err, null);
        assert(res instanceof Array);
        assert.equal(res.length, 1);
        assert.equal(res[0].name, info.series.name);
        assert(res[0].points.length >= 2);
        done();
      });
    });
  });

  describe('#query', function () {
    it('should create a continuous query', function (done) {
      dbClient.query('SELECT MEDIAN(value) FROM ' + info.series.name + ' INTO ' + info.series.name + '.downsampled;', function (err, res) {
        assert.equal(err, null);
        assert(res instanceof Array);
        assert.equal(res.length, 0);
        done();
      });
    });
  });

  describe('#getContinuousQueries', function () {
    it('should fetch all continuous queries from the database', function (done) {
      dbClient.getContinuousQueries( function (err, res) {
        assert.equal(err, null);
        assert(res instanceof Array);
        assert.equal(res.length, 1);
        done();
      });
    });
  });

  describe('#dropContinuousQuery', function () {
    it('should drop the continuous query from the database', function (done) {
      dbClient.getContinuousQueries(info.db.name, function (err, res) {
        dbClient.dropContinuousQuery(res[0].points[0][1], function (err) {
          assert.equal(err, null);
          done();
        });
      });
    });
  });

  describe('#getShardSpaces', function () {
    it('should fetch all shard spaces from the database', function (done) {
      dbClient.getShardSpaces(function (err, res) {
        assert.equal(err, null);
        assert(res instanceof Array);
        assert.equal(res.length, 1);
        done();
      });
    });
  });

  describe('#createShardSpace', function () {
    it('should create a shard space', function (done) {
      dbClient.createShardSpace({
        name: 'test_shard',
        retentionPolicy: '30d',
        shardDuration: '7d',
        regex: '/test123/',
        replicationFactor: 1,
        split: 1
      }, function (err) {
        assert.equal(err, null);
        done();
      });
    });
  });

  describe('#updateShardSpace', function () {
    it('should update the database shard space', function (done) {
      dbClient.getShardSpaces(function (err, res) {
        dbClient.updateShardSpace(res[0].name, {
          retentionPolicy: '60d',
          shardDuration: '14d',
          regex: '/test123/',
          replicationFactor: 1,
          split: 1
        }, function (err) {
          assert.equal(err, null);
          done();
        });
      });
    });
  });

  describe('#deleteShardSpace', function () {
    it('should delete the database shard space', function (done) {
      dbClient.getShardSpaces(function (err, res) {
        dbClient.deleteShardSpace(res[0].name, function (err) {
          assert.equal(err, null);
          done();
        });
      });
    });
  });


  describe('#query failover', function () {
    this.timeout(30000);
    it('should exceed retry limit', function (done) {
      failoverClient.query('SELECT value FROM ' + info.series.name + ';', function (err) {
        assert(err instanceof Error);
        done();
      });
    });
  });

  describe('#query  failover', function () {
    this.timeout(25000);
    it('should read a point from the database after the failed servers have been removed', function (done) {
      failoverClient.query('SELECT value FROM ' + info.series.name + ';', function (err, res) {
        assert.equal(err, null);
        assert(res instanceof Array);
        assert.equal(res.length, 1);
        assert.equal(res[0].name, info.series.name);
        assert(res[0].points.length >= 2);
        done();
      });
    });
  });

  describe('#getSeriesNames', function () {
    it('should return array of series names', function (done) {
      client.getSeriesNames(info.db.name, function (err, series) {
        if (err) return done(err);
        assert(series instanceof Array);
        assert.notEqual(series.indexOf(info.series.name), -1);
        done();
      });
    });
    it('should return array of series names from the db defined on connection', function (done) {
      client.getSeriesNames(function (err, series) {
        if (err) return done(err);
        assert(series instanceof Array);
        assert.notEqual(series.indexOf(info.series.name), -1);
        done();
      });
    });
    it('should bubble errors through', function (done) {
      failClient.getSeriesNames(info.db.name, function (err) {
        assert(err instanceof Error);
        done();
      });
    });
  });

  describe('#dropSeries', function () {
    this.timeout(25000);
    it('should drop series', function (done) {
      client.dropSeries(info.series.name, function (err) {
        if (err) return done(err);
        assert.equal(err, null);
        done();
      });
    });
    it('should bubble errors through', function (done) {
      failClient.dropSeries(info.series.name, function (err) {
        assert(err instanceof Error);
        done();
      });
    });
  });

  describe('#deleteDatabase', function () {
    this.timeout(25000);
    it('should delete the database without error', function (done) {
      client.deleteDatabase(info.db.name, done);
    });
    it('should error if database didn\'t exist', function (done) {
      client.deleteDatabase(info.db.name, function (err) {
        assert(err instanceof Error);
        done();
      });
    });
  });

});

describe('Helpers', function () {

  describe('parseResult()', function () {
    assert.deepEqual(influx.parseResult({
      'name': 'response_time',
      'columns': ['time', 'sequence_number', 'value'],
      'points': [
        [1383934015207, 23169, 232],
        [1383934015205, 23168, 232]
      ]
    }), [
      {time: 1383934015207, sequence_number: 23169, value: 232},
      {time: 1383934015205, sequence_number: 23168, value: 232}
    ]);
  });
});

describe('HTTPS connection', function() {
  var client;

  var dbName = 'https_db';

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
      });
    });

    it('should create a new database without error', function (done) {
      client.createDatabase(dbName, done);
    });

    it('should throw an error if db already exists', function (done) {
      client.createDatabase(dbName, function (err) {
        assert(err instanceof Error);
        done();
      });
    });

  });
});
