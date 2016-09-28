'use strict'

const InfluxDB = require('../../lib').InfluxDB
const sinon = require('sinon')

describe('influxdb', () => {
  describe('constructor', () => {
    it('uses default options', () => {
      expect(new InfluxDB().options).to.deep.equal({
        username: 'root',
        password: 'root',
        database: null,
        pool: undefined,
        hosts: [{
          host: '127.0.0.1',
          port: 8086,
          protocol: 'http'
        }]
      })
    })

    it('parses dsns', () => {
      expect(new InfluxDB('https://connor:password@192.168.0.1:1337/foo').options).to.deep.equal({
        username: 'connor',
        password: 'password',
        database: 'foo',
        pool: undefined,
        hosts: [{
          host: '192.168.0.1',
          port: 1337,
          protocol: 'https'
        }]
      })
    })

    it('parses single configs', () => {
      expect(new InfluxDB({ database: 'foo', host: '192.168.0.1' }).options).to.deep.equal({
        username: 'root',
        password: 'root',
        database: 'foo',
        pool: undefined,
        hosts: [{
          host: '192.168.0.1',
          port: 8086,
          protocol: 'http'
        }]
      })
    })

    it('parses cluster configs', () => {
      expect(new InfluxDB({ database: 'foo', hosts: [{ host: '192.168.0.1' }] }).options).to.deep.equal({
        username: 'root',
        password: 'root',
        database: 'foo',
        hosts: [{
          host: '192.168.0.1',
          port: 8086,
          protocol: 'http'
        }]
      })
    })
  })

  describe('methods', () => {
    let influx
    let pool
    let expectations = []
    beforeEach(() => {
      influx = new InfluxDB()
      pool = influx.pool

      sinon.stub(pool, 'discard')
      sinon.stub(pool, 'json')
      sinon.stub(pool, 'text')
    })

    afterEach(() => {
      while (expectations.length) {
        expectations.pop()()
      }
    })

    const expectQuery = (method, options, ...yields) => {
      if (typeof options === 'string') {
        options = { q: options }
      }

      pool[method].yields(...yields)
      expectations.push(() => {
        expect(pool[method]).to.have.been.calledWith({
          method: 'GET',
          path: '/query',
          query: Object.assign({
            epoch: 'u',
            u: 'root',
            p: 'root'
          }, options)
        })
      })
    }

    it('.createDatabase()', done => {
      expectQuery('discard', 'create database "foo"')
      influx.createDatabase('foo')
      expectQuery('discard', 'create database "f\\"oo"')
      influx.createDatabase('f"oo', done)
    })

    it('.dropDatabase()', done => {
      expectQuery('discard', 'drop database "foo"')
      influx.dropDatabase('foo')
      expectQuery('discard', 'drop database "f\\"oo"')
      influx.dropDatabase('f"oo', done)
    })

    it('.getDatabaseNames()', done => {
      expectQuery('json', 'show databases', undefined, dbFixture('showDatabases'))
      influx.getDatabaseNames((err, names) => {
        expect(err).to.be.undefined
        expect(names).to.deep.equal(['_internal', 'influx_test_gen'])
        done()
      })
    })
  })
})
