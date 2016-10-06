'use strict'

import { InfluxDB } from "../../src";
import { expect, dbFixture } from "./helpers";
const sinon = require('sinon')

describe('influxdb', () => {
  describe('constructor', () => {
    it('uses default options', () => {
      expect((<any> new InfluxDB()).options).to.deep.equal({
        username: 'root',
        password: 'root',
        database: null,
        pool: undefined,
        schema: [],
        hosts: [{
          host: '127.0.0.1',
          port: 8086,
          protocol: 'http'
        }]
      });
    });

    it('parses dsns', () => {
      expect((<any> new InfluxDB('https://connor:password@192.168.0.1:1337/foo')).options).to.deep.equal({
        username: 'connor',
        password: 'password',
        database: 'foo',
        pool: undefined,
        schema: [],
        hosts: [{
          host: '192.168.0.1',
          port: 1337,
          protocol: 'https'
        }]
      });
    });

    it('parses single configs', () => {
      expect((<any> new InfluxDB({ database: 'foo', host: '192.168.0.1' })).options).to.deep.equal({
        username: 'root',
        password: 'root',
        database: 'foo',
        pool: undefined,
        schema: [],
        hosts: [{
          host: '192.168.0.1',
          port: 8086,
          protocol: 'http'
        }]
      });
    });

    it('parses cluster configs', () => {
      expect((<any> new InfluxDB({ database: 'foo', hosts: [{ host: '192.168.0.1' }] })).options).to.deep.equal({
        username: 'root',
        password: 'root',
        database: 'foo',
        schema: [],
        hosts: [{
          host: '192.168.0.1',
          port: 8086,
          protocol: 'http'
        }]
      });
    });
  });

  describe('methods', () => {
    let influx
    let pool
    let expectations = []
    beforeEach(() => {
      influx = new InfluxDB();
      pool = influx.pool;

      sinon.stub(pool, 'discard');
      sinon.stub(pool, 'json');
      sinon.stub(pool, 'text');
    });

    afterEach(() => {
      while (expectations.length) {
        expectations.pop()();
      }
    });

    const setDefaultDB = (db: string) => {
      (<any> influx).options.database = db;
    };

    const expectQuery = (
        method: string,
        options: string | any,
        httpMethod: string = 'POST',
        yields: any = null
    ) => {
      if (typeof options === 'string') {
        options = { q: options }
      }

      pool[method].returns(Promise.resolve(yields));
      expectations.push(() => {
        expect(pool[method]).to.have.been.calledWith({
          method: httpMethod,
          path: '/query',
          query: Object.assign({
            epoch: 'u',
            u: 'root',
            p: 'root'
          }, options)
        });
      });
    };

    it('.createDatabase()', () => {
      expectQuery('discard', 'create database "foo"');
      influx.createDatabase('foo');
      expectQuery('discard', 'create database "f\\"oo"');
      influx.createDatabase('f"oo');
    });

    it('.dropDatabase()', () => {
      expectQuery('discard', 'drop database "foo"');
      influx.dropDatabase('foo');
      expectQuery('discard', 'drop database "f\\"oo"');
      influx.dropDatabase('f"oo');
    });

    it('.getDatabaseNames()', () => {
      expectQuery('json', 'show databases', 'GET', dbFixture('showDatabases'));
      return influx.getDatabaseNames().then(names => {
        expect(names).to.deep.equal(['_internal', 'influx_test_gen']);
      });
    });

    it('.getMeasurements()', () => {
      expectQuery('json', 'show measurements', 'GET', dbFixture('showMeasurements'));
      return influx.getMeasurements().then(names => {
        expect(names).to.deep.equal(['series_0', 'series_1', 'series_2']);
      });
    });

    it('.getSeries() from all', () => {
      expectQuery('json', 'show series', 'GET', dbFixture('showSeries'));
      return influx.getSeries().then(names => {
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
        ]);
      });
    });

    it('.getSeries() from single', () => {
      expectQuery('json', 'show series from "series_1"', 'GET', dbFixture('showSeriesFromOne'));
      return influx.getSeries('series_1').then(names => {
        expect(names).to.deep.equal([
          'series_1,my_tag=0',
          'series_1,my_tag=2',
          'series_1,my_tag=4',
          'series_1,my_tag=5',
          'series_1,my_tag=6',
          'series_1,my_tag=7',
          'series_1,my_tag=8',
          'series_1,my_tag=9'
        ]);
      });
    });

    it('.dropMeasurement()', () => {
      expectQuery('discard', 'drop measurement "series_1"');
      return influx.dropMeasurement('series_1');
    });

    describe('.dropSeries()', () => {
      it('drops with only from clause by string', () => {
        expectQuery('discard', 'drop series from "series_0"');
        influx.dropSeries({ measurement: '"series_0"' });
      });

      it('drops with only from clause by builder', () => {
        expectQuery('discard', 'drop series from "series_0"');
        influx.dropSeries({ measurement: m => m.name('series_0') });
      });

      it('drops with only where clause by string', () => {
        expectQuery('discard', 'drop series where "my_tag" = 1');
        influx.dropSeries({ where: '"my_tag" = 1' });
      });

      it('drops with only where clause by builder', () => {
        expectQuery('discard', 'drop series where "my_tag" = 1');
        influx.dropSeries({ where: e => e.tag('my_tag').equals.value(1) });
      });

      it('drops with both', () => {
        expectQuery('discard', 'drop series from "series_0" where "my_tag" = 1');
        influx.dropSeries({
          measurement: m => m.name('series_0'),
          where: e => e.tag('my_tag').equals.value(1)
        });
      });
    });

    it('.getUsers()', () => {
      expectQuery('json', 'show users', 'GET', dbFixture('showUsers'));
      return influx.getUsers().then(names => {
        expect(names.slice()).to.deep.equal([
          { user: 'john', admin: true },
          { user: 'steve', admin: false },
        ]);
      });
    });

    describe('.createUser()', () => {
      it('works with admin specified == true', () => {
        expectQuery('discard', 'create user "con\\"nor" with password \'pa55\\\'word\' with all privileges');
        return influx.createUser('con"nor', 'pa55\'word', true);
      });
      it('works with admin specified == false', () => {
        expectQuery('discard', 'create user "con\\"nor" with password \'pa55\\\'word\'');
        return influx.createUser('con"nor', 'pa55\'word', false);
      });
      it('works with admin unspecified', () => {
        expectQuery('discard', 'create user "con\\"nor" with password \'pa55\\\'word\'');
        return influx.createUser('con"nor', 'pa55\'word');
      });
    });

    describe('.grantPrivilege()', () => {
      it('queries correctly', () => {
        expectQuery('discard', 'grant READ to "con\\"nor" on "my_\\"_db"');
        return influx.grantPrivilege('con"nor', 'READ', 'my_"_db');
      });
      it('throws if DB unspecified', () => {
        expect(() => influx.grantPrivilege('con"nor', 'READ')).to.throw(/default database/);
      });
      it('fills in default DB', () => {
        setDefaultDB('my_\\"_db');
        expectQuery('discard', 'grant READ to "con\\"nor" on "my_\\"_db"');
        return influx.grantPrivilege('con"nor', 'READ', 'my_"_db');
      });
    });

    describe('.revokePrivilege()', () => {
      it('queries correctly', () => {
        expectQuery('discard', 'revoke READ from "con\\"nor" on "my_\\"_db"');
        return influx.revokePrivilege('con"nor', 'READ', 'my_"_db');
      });
      it('throws if DB unspecified', () => {
        expect(() => influx.revokePrivilege('con"nor', 'READ')).to.throw(/default database/);
      });
      it('fills in default DB', () => {
        setDefaultDB('my_\\"_db');
        expectQuery('discard', 'revoke READ from "con\\"nor" on "my_\\"_db"');
        return influx.revokePrivilege('con"nor', 'READ', 'my_"_db');
      });
    });

    it('.grantAdminPrivilege()', () => {
        expectQuery('discard', 'grant all to "con\\"nor"');
        return influx.grantAdminPrivilege('con"nor');
    });

    it('.revokeAdminPrivilege()', () => {
        expectQuery('discard', 'revoke all from "con\\"nor"');
        return influx.revokeAdminPrivilege('con"nor');
    });

    it('.dropUser()', () => {
        expectQuery('discard', 'drop user "con\\"nor"');
        return influx.dropUser('con"nor');
    });

    describe('.createContinuousQuery()', () => {
      it('queries correctly', () => {
        expectQuery('discard', 'create continuous query "my_\\"q" on "my_\\"_db" begin foo end');
        return influx.createContinuousQuery('my_"q', 'foo', 'my_"_db');
      });
      it('throws if DB unspecified', () => {
        expect(() => influx.createContinuousQuery('my_"q', 'foo')).to.throw(/default database/);
      });
      it('fills in default DB', () => {
        setDefaultDB('my_"_db');
        expectQuery('discard', 'create continuous query "my_\\"q" on "my_\\"_db" begin foo end');
        return influx.createContinuousQuery('my_"q', 'foo');
      });
    });

    describe('.dropContinuousQuery()', () => {
      it('queries correctly', () => {
        expectQuery('discard', 'drop continuous query "my_\\"q" on "my_\\"_db"');
        return influx.dropContinuousQuery('my_"q', 'my_"_db');
      });
      it('throws if DB unspecified', () => {
        expect(() => influx.dropContinuousQuery('my_"q')).to.throw(/default database/);
      });
      it('fills in default DB', () => {
        setDefaultDB('my_"_db');
        expectQuery('discard', 'drop continuous query "my_\\"q" on "my_\\"_db"');
        return influx.dropContinuousQuery('my_"q');
      });
    });
  });
});
