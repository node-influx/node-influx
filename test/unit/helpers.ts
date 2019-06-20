/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-require-imports */

import { use } from 'chai';
import * as sinonChai from 'sinon-chai';

use(sinonChai);

const influxVersion = process.env.INFLUX_VERSION || 'v1.0.0';

// This tree is created statically rather than dynamically required for Webpack.
const fixtures: { [version: string]: { [fixture: string]: object } } = {
  'v1.0.0': {
    error: require('../fixture/v1.0.0/error.json'),
    selectFromEmpty: require('../fixture/v1.0.0/selectFromEmpty.json'),
    selectFromGroup: require('../fixture/v1.0.0/selectFromGroup.json'),
    selectFromOne: require('../fixture/v1.0.0/selectFromOne.json'),
    showDatabases: require('../fixture/v1.0.0/showDatabases.json'),
    showMeasurements: require('../fixture/v1.0.0/showMeasurements.json'),
    showRetentionPolicies: require('../fixture/v1.0.0/showRetentionPolicies.json'),
    showShards: require('../fixture/v1.0.0/showShards.json'),
    showSeries: require('../fixture/v1.0.0/showSeries.json'),
    showSeriesFromOne: require('../fixture/v1.0.0/showSeriesFromOne.json'),
    showUsers: require('../fixture/v1.0.0/showUsers.json'),
  },
};

/**
 * DbFixture synchronously loads and returns a fixture for the current
 * influx version.
 * @param name
 * @return
 */
export function dbFixture(name: string): any {
  return fixtures[influxVersion][name];
}
