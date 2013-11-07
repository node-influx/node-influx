/**
 * Test Suite from the InfluxDB Projects Javascript Client
 * https://github.com/influxdb/influxdb-js/blob/master/spec/javascripts/apiSpec.js
 */

var InfluxDB = require('./');
var assert = require('assert');


describe("InfluxDB", function() {
  var api;

  beforeEach(function() {
    db = new InfluxDB("localhost", 8086, "root", "root");
  });

  describe("#url", function() {
    it("should build a properly formatted url", function() {
      var url = db.url("foo");
      assert(url === "http://localhost:8086/foo?username=root&password=root");
    });
  });

  describe("#createDatabase", function() {
    it("should create a new database", function (done) {
      request = db.createDatabase("test", done);
    });
  });

  describe("#readPoint", function() {
    it("should read a point from the database", function () {
      db.readPoint();
    });
  });

  describe("#writePoint", function() {
    it("should write a point into the database", function () {
      db.writePoint("foo", {a: 1, b: 2});
    });
  });

});