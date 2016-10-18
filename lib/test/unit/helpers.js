"use strict";
const influxVersion = process.env.INFLUX_VERSION || 'v1.0.0';
const chai = require('chai');
chai.use(require('sinon-chai'));
exports.expect = chai.expect;
/**
 * dbFixture synchronously loads and returns a fixture for the current
 * influx version.
 * @param  {String} name
 * @return {Object}
 */
function dbFixture(name) {
    return require(`../fixture/${influxVersion}/${name}`);
}
exports.dbFixture = dbFixture;
;
