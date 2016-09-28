const chai = require('chai')
chai.use(require('sinon-chai'))

const influxVersion = process.env.INFLUX_VERSION || 'v1.0.0'

global.expect = chai.expect

/**
 * dbFixture synchronously loads and returns a fixture for the current
 * influx version.
 * @param  {String} name
 * @return {Object}
 */
global.dbFixture = (name) => {
  return require(`../fixture/${influxVersion}/${name}`)
}
