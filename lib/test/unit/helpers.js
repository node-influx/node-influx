"use strict";
const chai_1 = require("chai");
const sinonChai = require("sinon-chai");
chai_1.use(sinonChai);
const influxVersion = process.env.INFLUX_VERSION || "v1.0.0";
// This tree is created statically rather than dynamically required for Webpack.
const fixtures = {
    'v1.0.0': {
        error: require('../fixture/v1.0.0/error.json'),
        selectFromEmpty: require('../fixture/v1.0.0/selectFromEmpty.json'),
        selectFromGroup: require('../fixture/v1.0.0/selectFromGroup.json'),
        selectFromOne: require('../fixture/v1.0.0/selectFromOne.json'),
        showDatabases: require('../fixture/v1.0.0/showDatabases.json'),
        showMeasurements: require('../fixture/v1.0.0/showMeasurements.json'),
        showRetentionPolicies: require('../fixture/v1.0.0/showRetentionPolicies.json'),
        showSeries: require('../fixture/v1.0.0/showSeries.json'),
        showSeriesFromOne: require('../fixture/v1.0.0/showSeriesFromOne.json'),
        showUsers: require('../fixture/v1.0.0/showUsers.json'),
    },
};
/**
 * dbFixture synchronously loads and returns a fixture for the current
 * influx version.
 * @param  {String} name
 * @return {Object}
 */
function dbFixture(name) {
    return fixtures[influxVersion][name];
}
exports.dbFixture = dbFixture;
;
