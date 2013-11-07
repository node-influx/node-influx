
var influx = require('./');
var assert = require('assert');


describe("InfluxDB", function() {

  var client;
  var dbClient;

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
      client = influx(info.server.host, info.server.port, info.server.username, info.server.password);
      dbClient = influx(info.server.host, info.server.port, info.db.username, info.db.password, info.db.name);
      assert(client instanceof influx.InfluxDB);
    });
  });

  describe("#url", function() {
    it("should build a properly formatted url", function() {
      var url = client.url(info.db.name);
      assert.equal(url, 'http://localhost:8086/' + info.db.name + '?u=' + info.server.username + '&p=' + info.server.password);
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

  describe("#writePoint", function() {
    it("should write a generic point into the database", function (done) {
      dbClient.writePoint(info.series.stars, {username: 'reallytrial', value: 232}, done);
    });
    it("should write a point with time into the database", function (done) {
      dbClient.writePoint(info.series.stars, {time: new Date(), value: 232}, done);
    });
  });

  describe("#readPoint", function() {
    it("should read a point from the database");
  });

  describe("#deleteDatabase", function() {
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