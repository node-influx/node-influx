import { use } from 'chai';
import { IncomingMessage } from 'http';
import * as sinonChai from 'sinon-chai';

use(sinonChai);

const influxVersion = process.env.INFLUX_VERSION || 'v1.0.0';

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
export function dbFixture (name: string): any {
  return fixtures[influxVersion][name];
}

/**
 * Creates a fake incoming request containing the provided data. If the data
 * is a string, we assume it's in Influx's csv format.
 */
export function fakeIncoming(data: any): IncomingMessage {
  const csv = typeof data === 'string';
  return <any> {
    headers: {
      'content-type': csv ? 'text/csv' : 'application/json',
    },
    on: (ev: string, callback: Function) => {
      switch (ev) {
        case 'data':
          return callback(csv ? data : JSON.stringify(data));
        case 'end':
          return callback();
        default:
          throw new Error(`unknown event in mock: ${ev}`);
      }
    },
  };
}
