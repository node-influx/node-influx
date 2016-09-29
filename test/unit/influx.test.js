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

    const expectQuery = (method, options, httpMethod = 'POST', yields = null) => {
      if (typeof options === 'string') {
        options = { q: options }
      }

      pool[method].yields(undefined, yields)
      expectations.push(() => {
        expect(pool[method]).to.have.been.calledWith({
          method: httpMethod,
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
      expectQuery('json', 'show databases', 'GET', dbFixture('showDatabases'))
      influx.getDatabaseNames((err, names) => {
        expect(err).to.be.undefined
        expect(names).to.deep.equal(['_internal', 'influx_test_gen'])
        done()
      })
    })

    it('.getMeasurements()', done => {
      expectQuery('json', 'show measurements', 'GET', dbFixture('showMeasurements'))
      influx.getMeasurements((err, names) => {
        expect(err).to.be.undefined
        expect(names).to.deep.equal(['series_0', 'series_1', 'series_2'])
        done()
      })
    })

    it('.getSeries() from all', done => {
      expectQuery('json', 'show series', 'GET', dbFixture('showSeries'))
      influx.getSeries((err, names) => {
        expect(err).to.be.undefined
        expect(names).to.deep.equal([
          'series_0,my_tag=0',
          'series_0,my_tag=1',
          'series_0,my_tag=5',
          'series_0,my_tag=6',
          'series_0,my_tag=7',
          'series_0,my_tag=8',
          'series_0,my_tag=9',
          'series_1,my_tag=0',
          'series_1,my_tag=2',
          'series_1,my_tag=4',
          'series_1,my_tag=5',
          'series_1,my_tag=6',
          'series_1,my_tag=7',
          'series_1,my_tag=8',
          'series_1,my_tag=9',
          'series_2,my_tag=1',
          'series_2,my_tag=2',
          'series_2,my_tag=3',
          'series_2,my_tag=4',
          'series_2,my_tag=5',
          'series_2,my_tag=6',
          'series_2,my_tag=7',
          'series_2,my_tag=8',
          'series_2,my_tag=9'
        ])
        done()
      })
    })

    it('.getSeries() from single', done => {
      expectQuery('json', 'show series from "series_1"', 'GET', dbFixture('showSeriesFromOne'))
      influx.getSeries('series_1', (err, names) => {
        expect(err).to.be.undefined
        expect(names).to.deep.equal([
          'series_1,my_tag=0',
          'series_1,my_tag=2',
          'series_1,my_tag=4',
          'series_1,my_tag=5',
          'series_1,my_tag=6',
          'series_1,my_tag=7',
          'series_1,my_tag=8',
          'series_1,my_tag=9'
        ])
        done()
      })
    })

    it('.dropMeasurement()', done => {
      expectQuery('discard', 'drop measurement "series_1"')
      influx.dropMeasurement('series_1', (err) => {
        expect(err).to.be.undefined
        done()
      })
    })

    describe('.dropSeries()', () => {
      it('drops with only from clause by string', () => {
        expectQuery('discard', 'drop series from "series_0"')
        influx.dropSeries({ measurement: 'series_0' })
      })

      it('drops with only from clause by builder', () => {
        expectQuery('discard', 'drop series from "series_0"')
        influx.dropSeries({ measurement: m => m.name('series_0') })
      })

      it('drops with only where clause by string', () => {
        expectQuery('discard', 'drop series where "my_tag" = 1')
        influx.dropSeries({ where: '"my_tag" = 1' })
      })

      it('drops with only where clause by builder', () => {
        expectQuery('discard', 'drop series where "my_tag" = 1')
        influx.dropSeries({ where: e => e.tag('my_tag').equals.value(1) })
      })

      it('drops with both', () => {
        expectQuery('discard', 'drop series from "series_0" where "my_tag" = 1')
        influx.dropSeries({
          measurement: m => m.name('series_0'),
          where: e => e.tag('my_tag').equals.value(1)
        })
      })
    })
  })
})
