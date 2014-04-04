
var influx = require('./');
var assert = require('assert');


describe("InfluxDB", function() {

  var client;
  var dbClient;
  var failClient;

  var info = {
    server: {
      host:     'localhost',
      port:     8086,
      username: 'root',
      password: 'root'
    },
    db: {
      name:     'test_db',
      username: 'johnsmith',
      password: 'johnjohn'
    },
    series: {
      name: 'response_time'
    }
  };

  describe('#InfluxDB', function() {
    it('should exist as a function (class)', function() {
      assert(typeof influx.InfluxDB === 'function');
    });
  });

  describe('create client', function() {
    it('should create an instance without error', function() {
      client = influx(info.server.host, info.server.port, info.server.username, info.server.password, info.db.name);
      dbClient = influx(info.server.host, info.server.port, info.db.username, info.db.password, info.db.name);
      failClient = influx(info.server.host, 6465, info.db.username, info.db.password, info.db.name);
      assert(client instanceof influx.InfluxDB);
    });
  });

  describe("#url", function() {
    it("should build a properly formatted url", function() {
      var url = client.url(info.db.name);
      assert.equal(url, 'http://'+info.server.host+':8086/' + info.db.name + '?u=' + info.server.username + '&p=' + info.server.password);
    });
  });

  describe("#createDatabase", function() {
    it("should create a new database without error", function (done) {
      client.createDatabase(info.db.name, done);
    });
    it("should throw an error if db already exists", function (done) {
      client.createDatabase(info.db.name, function(err) {
        assert(err instanceof Error);
        done();
      });
    });
  });

  describe("#getDatabaseNames", function() {
    it('should return array of database names', function(done) {
      client.getDatabaseNames(function(err, dbs) {
        if(err) return done(err);
        assert(dbs instanceof Array);
        assert.notEqual(dbs.indexOf(info.db.name), -1);
        done();
      });
    });
    it('should bubble errors through', function(done) {
      failClient.getDatabaseNames(function(err) {
        assert(err instanceof Error);
        done();
      });
    });
  });

  describe('#createUser', function(done) {
    it('should create a user without error', function(done) {
      client.createUser(info.db.name, info.db.username, info.db.password, done);
    });
    it('should error when creating an existing user', function(done) {
      client.createUser(info.db.name, info.db.username, info.db.password, function(err) {
        assert(err instanceof Error);
        done();
      });
    });
  });


    describe('#updateUser', function(done) {
        it('should update user without error', function(done) {
            client.updateUser(info.db.name, info.db.username, {admin : true}, done);
        });
        it('should error when updating non existing user', function(done) {
            client.updateUser(info.db.name, 'johndoe', {admin : false}, function(err) {
                assert(err instanceof Error);
                done();
            });
        });
    });


    describe("#writePoint", function() {
    it("should write a generic point into the database", function (done) {
      dbClient.writePoint(info.series.name, {username: 'reallytrial', value: 232}, done);
    });
    it("should write a point with time into the database", function (done) {
      dbClient.writePoint(info.series.name, {time: new Date(), value: 232}, done);
    });
  });

  describe("#writePoints", function() {
    it("should write multiple points to the same time series, same column names", function (done) {
      var points = [
        {username: 'reallytrial', value: 232},
        {username: 'welovefashion', value: 232},
        {username: 'welovefashion', value: 4711}
      ];
      dbClient.writePoints(info.series.name, points, done);
    });
    it("should write multiple points to the same time series, differing column names", function (done) {
      var points = [
        {username: 'reallytrial', value: 232},
        {username: 'welovefashion', othervalue: 232},
        {otherusername: 'welovefashion', value: 4711}
      ];
      dbClient.writePoints(info.series.name, points, done);
    });
  });

  describe("#writeSeries", function() {
    it("should write multiple points to multiple time series, same column names", function (done) {
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
    it("should write multiple points to multiple time series, differing column names", function (done) {
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

  describe("#query", function() {
    it("should read a point from the database", function(done) {
      dbClient.query('SELECT value FROM ' + info.series.name + ';', function(err, res) {
        assert.equal(err, null);
        assert(res instanceof Array);
        assert.equal(res.length, 1);
        assert.equal(res[0].name, info.series.name);
        assert(res[0].points.length >= 2);
        done();
      });
    });
  });

    describe("#query", function() {
        it("should create a continuous query", function(done) {
            dbClient.query('SELECT MEDIAN(value) as value FROM ' + info.series.name + ' INTO ' + info.series.name + '.downsampled;', function(err, res) {
                assert.equal(err, null);
                assert(res instanceof Array);
                assert.equal(res.length, 0);
                done();
            });
        });
    });
    describe("#getContinuousQueries", function() {
        it("should fetch all continuous queries from the database", function(done) {
            dbClient.getContinuousQueries(info.db.name, function(err, res) {
                assert.equal(err, null);
                assert(res instanceof Array);
                assert.equal(res.length, 1);
                done();
            });
        });
    });

    describe("#dropContinuousQuery", function() {
        it("should fetch all continuous queries from the database", function(done) {
            dbClient.getContinuousQueries(info.db.name, function(err, res) {
                dbClient.dropContinuousQuery(res[0].id,function(err,res)
                {
                    assert.equal(err, null);
                    done();
                });
            });
        });
    });


    describe("#readPoints", function() {
        it("should read a point from the database", function(done) {
            dbClient.readPoints('SELECT value FROM ' + info.series.name + ';', function(err, res) {
                assert.equal(err, null);
                assert(res instanceof Array);
                assert.equal(res.length, 1);
                assert.equal(res[0].name, info.series.name);
                assert(res[0].points.length >= 2);
                done();
            });
        });
    });

    describe("#getSeriesNames", function() {
        it('should return array of series names', function(done) {
            client.getSeriesNames(info.db.name, function(err, series) {
                if(err) return done(err);
                assert(series instanceof Array);
                assert.notEqual(series.indexOf(info.series.name), -1);
                done();
            });
        });
        it('should return array of series names from the db defined on connection', function(done) {
          client.getSeriesNames(function(err, series) {
            if(err) return done(err);
            assert(series instanceof Array);
            assert.notEqual(series.indexOf(info.series.name), -1);
            done();
          })
        });
        it('should bubble errors through', function(done) {
            failClient.getSeriesNames(info.db.name, function(err) {
                assert(err instanceof Error);
                done();
            });
        });
    });

    describe('#dropSeries',function() {
        this.timeout(20000);
       it('should drop series',function(done) {
          client.dropSeries(info.series.name,function(err)
          {
              if (err) return done(err);
              assert.equal(err, null);
              done();
          });
           it('should bubble errors through', function(done) {
               failClient.dropSeries(info.series.name, function(err) {
                   assert(err instanceof Error);
                   done();
               });
           });

       });
    });

  describe("#deleteDatabase", function() {
    this.timeout(20000);
    it('should delete the database without error', function (done) {
      client.deleteDatabase(info.db.name, done);
    });
    it('should error if database didn\'t exist', function (done) {
      client.deleteDatabase(info.db.name, function(err) {
        assert(err instanceof Error);
        done();
      });
    });
  });

});

describe('Helpers', function() {

  describe('parseResult()', function() {
    assert.deepEqual(influx.parseResult({
      "name":"response_time",
      "columns":["time","sequence_number","value"],
      "points":[[1383934015207,23169,232],[1383934015205,23168,232]]
    }), [{time: 1383934015207, sequence_number: 23169, value: 232}, {time: 1383934015205, sequence_number: 23168, value: 232}]);
  });
});