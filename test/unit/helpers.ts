import { use } from "chai";
import * as sinonChai from "sinon-chai";

use(sinonChai);

const influxVersion = process.env.INFLUX_VERSION || "v1.0.0";

/**
 * dbFixture synchronously loads and returns a fixture for the current
 * influx version.
 * @param  {String} name
 * @return {Object}
 */
export function dbFixture (name: string): any {
  return require(`../fixture/${influxVersion}/${name}`)
};
