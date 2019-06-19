/* eslint-env node, mocha */
/* eslint-disable no-unused-expressions */

import {expect} from 'chai';
import * as sinon from 'sinon';

import {FieldType, InfluxDB, toNanoDate} from '../../src';
import {Pool} from '../../src/pool';
import {dbFixture} from './helpers';

describe('influxdb', () => {
	describe('constructor', () => {
		it('uses default options', () => {
			expect((new InfluxDB() as any)._options).to.deep.equal({
				username: 'root',
				password: 'root',
				database: null,
				pool: undefined,
				schema: [],
				hosts: [
					{
						host: '127.0.0.1',
						port: 8086,
						protocol: 'http',
						options: undefined
					}
				]
			});
		});

		it('parses dsns', () => {
			expect(
				(new InfluxDB('https://connor:password@192.168.0.1:1337/foo') as any)._options,
			).to.deep.equal({
				username: 'connor',
				password: 'password',
				database: 'foo',
				pool: undefined,
				schema: [],
				hosts: [
					{
						host: '192.168.0.1',
						port: 1337,
						protocol: 'https',
						options: undefined
					}
				]
			});
		});

		it('parses single configs', () => {
			expect((new InfluxDB({database: 'foo', host: '192.168.0.1'}) as any)._options).to.deep.equal({
				username: 'root',
				password: 'root',
				database: 'foo',
				pool: undefined,
				schema: [],
				hosts: [
					{
						host: '192.168.0.1',
						port: 8086,
						protocol: 'http',
						options: undefined
					}
				]
			});
		});

		it('parses cluster configs', () => {
			expect(
				(new InfluxDB({
					database: 'foo',
					hosts: [{host: '192.168.0.1', options: {ca: null}}]
				}) as any)._options,
			).to.deep.equal({
				username: 'root',
				password: 'root',
				database: 'foo',
				schema: [],
				hosts: [
					{
						host: '192.168.0.1',
						port: 8086,
						protocol: 'http',
						options: {ca: null}
					}
				]
			});
		});

		it('parses parses schema', () => {
			let client = new InfluxDB({
				schema: [
					{
						database: 'my_db',
						measurement: 'my_measurement',
						fields: {},
						tags: ['my_tag']
					}
				],
				hosts: [{host: '192.168.0.1', options: undefined}]
			}) as any;

			expect(client._schema.my_db.my_measurement).to.not.be.undefined;

			client = new InfluxDB({
				schema: [
					{
						measurement: 'my_measurement',
						fields: {},
						tags: ['my_tag']
					}
				],
				database: 'my_db',
				hosts: [{host: '192.168.0.1'}]
			}) as any;

			expect(client._schema.my_db.my_measurement).to.not.be.undefined;

			expect(() => {
				new InfluxDB({ // eslint-disable-line no-new
					schema: [
						{
							measurement: 'my_measurement',
							fields: {},
							tags: ['my_tag']
						}
					],
					hosts: [{host: '192.168.0.1'}]
				});
			}).to.throw(/no default database is provided/);
		});
	});

	describe('methods', () => {
		let influx: InfluxDB;
		let pool: Pool;
		const expectations: Array<() => void> = [];
		beforeEach(() => {
			influx = new InfluxDB({
				hosts: [],
				schema: [
					{
						database: 'my_db',
						measurement: 'my_schemed_measure',
						tags: ['my_tag'],
						fields: {
							int: FieldType.INTEGER,
							float: FieldType.FLOAT,
							string: FieldType.STRING,
							bool: FieldType.BOOLEAN
						}
					}
				]
			});
			pool = (influx as any)._pool;

			sinon.stub(pool, 'discard');
			sinon.stub(pool, 'json');
			sinon.stub(pool, 'text');
		});

		afterEach(() => {
			while (expectations.length) {
				expectations.pop()();
			}
		});

		const setDefaultDB = (db: string): void => {
			(influx as any)._options.database = db;
		};

		const expectQuery = (
			method: keyof Pool,
			options: string | any,
			httpMethod: string = 'POST',
			yields: any = {results: [{}]},
		): void => {
			if (typeof options === 'string') {
				options = {q: options};
			}

			(pool[method] as any).returns(Promise.resolve(yields));
			expectations.push(() => {
				expect(pool[method]).to.have.been.calledWith({
					method: httpMethod,
					path: '/query',
					query: {
						u: 'root',
						p: 'root',
						...options
					}
				});
			});
		};

		const expectWrite = (body: string, options: any): void => {
			if (typeof options === 'string') {
				options = {q: options};
			}

			(pool.discard as any).returns(Promise.resolve());
			expectations.push(() => {
				expect(pool.discard).to.have.been.calledWith({
					method: 'POST',
					path: '/write',
					body,
					query: {
						u: 'root',
						p: 'root',
						...options
					}
				});
			});
		};

		it('.createDatabase()', () => {
			expectQuery('json', 'create database "foo"');
			influx.createDatabase('foo');
			expectQuery('json', 'create database "f\\"oo"');
			influx.createDatabase('f"oo');
		});

		it('.dropDatabase()', () => {
			expectQuery('json', 'drop database "foo"');
			influx.dropDatabase('foo');
			expectQuery('json', 'drop database "f\\"oo"');
			influx.dropDatabase('f"oo');
    });

    it('.dropShard()', () => {
			expectQuery('json', 'drop shard 1');
			influx.dropShard(1);
    });


		it('.getDatabaseNames()', () => {
			expectQuery('json', 'show databases', 'GET', dbFixture('showDatabases'));
			return influx.getDatabaseNames().then(names => {
				expect(names).to.deep.equal(['_internal', 'influx_test_gen']);
			});
		});

		it('.getMeasurements()', () => {
			setDefaultDB('mydb');
			expectQuery(
				'json',
				{
					db: 'mydb',
					q: 'show measurements'
				},
				'GET',
				dbFixture('showMeasurements'),
			);

			return influx.getMeasurements().then(names => {
				expect(names).to.deep.equal(['series_0', 'series_1', 'series_2']);
			});
		});

		it('.getSeries() from all', () => {
			setDefaultDB('mydb');
			expectQuery(
				'json',
				{
					db: 'mydb',
					q: 'show series'
				},
				'GET',
				dbFixture('showSeries'),
			);

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
			expectQuery(
				'json',
				{
					db: 'mydb',
					q: 'show series from "measure_1"'
				},
				'GET',
				dbFixture('showSeriesFromOne'),
			);
			return influx
				.getSeries({
					database: 'mydb',
					measurement: 'measure_1'
				})
				.then(names => {
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
			expectQuery('json', {
				db: 'my_db',
				q: 'drop measurement "series_1"'
			});
			return influx.dropMeasurement('series_1', 'my_db');
		});

		describe('.dropSeries()', () => {
			beforeEach(() => setDefaultDB('my_db'));

			it('drops with only from clause by string', () => {
				expectQuery('json', {db: 'my_db', q: 'drop series from "series_0"'});
				influx.dropSeries({measurement: '"series_0"'});
			});

			it('drops with only from clause by builder', () => {
				expectQuery('json', {db: 'my_db', q: 'drop series from "series_0"'});
				influx.dropSeries({measurement: m => m.name('series_0')});
			});

			it('drops with only where clause by string', () => {
				expectQuery('json', {db: 'my_db', q: 'drop series where "my_tag" = 1'});
				influx.dropSeries({where: '"my_tag" = 1'});
			});

			it('drops with only where clause by builder', () => {
				expectQuery('json', {db: 'my_db', q: 'drop series where "my_tag" = 1'});
				influx.dropSeries({where: e => e.tag('my_tag').equals.value(1)});
			});

			it('drops with both', () => {
				expectQuery('json', {db: 'my_db', q: 'drop series from "series_0" where "my_tag" = 1'});
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
					{user: 'john', admin: true},
					{user: 'steve', admin: false}
				]);
			});
		});

		describe('.createUser()', () => {
			it('works with admin specified == true', () => {
				expectQuery(
					'json',
					'create user "con\\"nor" with password \'pa55\\\'word\' with all privileges',
				);
				return influx.createUser('con"nor', 'pa55\'word', true);
			});
			it('works with admin specified == false', () => {
				expectQuery('json', 'create user "con\\"nor" with password \'pa55\\\'word\'');
				return influx.createUser('con"nor', 'pa55\'word', false);
			});
			it('works with admin unspecified', () => {
				expectQuery('json', 'create user "con\\"nor" with password \'pa55\\\'word\'');
				return influx.createUser('con"nor', 'pa55\'word');
			});
		});

		describe('.grantPrivilege()', () => {
			it('queries correctly', () => {
				expectQuery('json', 'grant READ on "my_\\"_db" to "con\\"nor"');
				return influx.grantPrivilege('con"nor', 'READ', 'my_"_db');
			});
			it('throws if DB unspecified', () => {
				expect(() => influx.grantPrivilege('con"nor', 'READ')).to.throw(/default database/);
			});
			it('fills in default DB', () => {
				setDefaultDB('my_\\"_db');
				expectQuery('json', 'grant READ on "my_\\"_db" to "con\\"nor"');
				return influx.grantPrivilege('con"nor', 'READ', 'my_"_db');
			});
		});

		describe('.revokePrivilege()', () => {
			it('queries correctly', () => {
				expectQuery('json', 'revoke READ on "my_\\"_db" from "con\\"nor"');
				return influx.revokePrivilege('con"nor', 'READ', 'my_"_db');
			});
			it('throws if DB unspecified', () => {
				expect(() => influx.revokePrivilege('con"nor', 'READ')).to.throw(/default database/);
			});
			it('fills in default DB', () => {
				setDefaultDB('my_\\"_db');
				expectQuery('json', 'revoke READ on "my_\\"_db" from "con\\"nor"');
				return influx.revokePrivilege('con"nor', 'READ', 'my_"_db');
			});
		});

		it('.grantAdminPrivilege()', () => {
			expectQuery('json', 'grant all to "con\\"nor"');
			return influx.grantAdminPrivilege('con"nor');
		});

		it('.revokeAdminPrivilege()', () => {
			expectQuery('json', 'revoke all from "con\\"nor"');
			return influx.revokeAdminPrivilege('con"nor');
		});

		it('.dropUser()', () => {
			expectQuery('json', 'drop user "con\\"nor"');
			return influx.dropUser('con"nor');
		});

		describe('.createContinuousQuery()', () => {
			it('queries correctly no resample', () => {
				expectQuery('json', 'create continuous query "my_\\"q" on "my_\\"_db"  begin foo end');
				return influx.createContinuousQuery('my_"q', 'foo', 'my_"_db');
			});
			it('queries correctly with resample', () => {
				expectQuery(
					'json',
					'create continuous query "my_\\"q" on "my_\\"_db" resample for 4m begin foo end',
				);
				return influx.createContinuousQuery('my_"q', 'foo', 'my_"_db', 'resample for 4m');
			});
			it('throws if DB unspecified', () => {
				expect(() => influx.createContinuousQuery('my_"q', 'foo')).to.throw(/default database/);
			});
			it('fills in default DB', () => {
				setDefaultDB('my_"_db');
				expectQuery('json', 'create continuous query "my_\\"q" on "my_\\"_db"  begin foo end');
				return influx.createContinuousQuery('my_"q', 'foo');
			});
		});

		describe('.dropContinuousQuery()', () => {
			it('queries correctly', () => {
				expectQuery('json', 'drop continuous query "my_\\"q" on "my_\\"_db"');
				return influx.dropContinuousQuery('my_"q', 'my_"_db');
			});
			it('throws if DB unspecified', () => {
				expect(() => influx.dropContinuousQuery('my_"q')).to.throw(/default database/);
			});
			it('fills in default DB', () => {
				setDefaultDB('my_"_db');
				expectQuery('json', 'drop continuous query "my_\\"q" on "my_\\"_db"');
				return influx.dropContinuousQuery('my_"q');
			});
		});

		describe('.showContinousQueries()', () => {
			it('queries correctly', () => {
				expectQuery('json', {q: 'show continuous queries', db: 'my_db'}, 'GET');
				return influx.showContinousQueries('my_db');
			});
			it('throws if DB unspecified', () => {
				expect(() => influx.showContinousQueries()).to.throw(/default database/);
			});
			it('fills in default DB', () => {
				setDefaultDB('my_db');
				expectQuery('json', {q: 'show continuous queries', db: 'my_db'}, 'GET');
				return influx.showContinousQueries();
			});
		});

		describe('.writePoints()', () => {
			it('writes with all options specified without a schema', () => {
				expectWrite('mymeas,my_tag=1 myfield=90 1463683075', {
					precision: 's',
					rp: '1day',
					db: 'my_db'
				});

				return influx.writePoints(
					[
						{
							measurement: 'mymeas',
							tags: {my_tag: '1'},
							fields: {myfield: 90},
							timestamp: new Date(1463683075000)
						}
					],
					{
						database: 'my_db',
						precision: 's',
						retentionPolicy: '1day'
					},
				);
			});

			it('writes using default options without a schema', () => {
				setDefaultDB('my_db');
				expectWrite('mymeas,my_tag=1 myfield=90 1463683075000000000', {
					precision: 'n',
					rp: undefined,
					db: 'my_db'
				});

				return influx.writePoints([
					{
						measurement: 'mymeas',
						tags: {my_tag: '1'},
						fields: {myfield: 90},
						timestamp: new Date(1463683075000)
					}
				]);
			});

			it('uses a schema to coerce', () => {
				setDefaultDB('my_db');
				expectWrite('my_schemed_measure,my_tag=1 bool=T,float=43,int=42i', {
					precision: 'n',
					rp: undefined,
					db: 'my_db'
				});

				return influx.writePoints([
					{
						measurement: 'my_schemed_measure',
						tags: {my_tag: '1'},
						fields: {
							int: 42,
							float: 43,
							bool: true
						}
					}
				]);
			});

			it('can accept a schema at runtime', () => {
				setDefaultDB('my_db');
				expectWrite('my_runtime_schema_measure,my_tag=1 bool=T,float=43,int=42i', {
					precision: 'n',
					rp: undefined,
					db: 'my_db'
				});

				influx.addSchema({
					database: 'my_db',
					measurement: 'my_runtime_schema_measure',
					fields: {
						bool: FieldType.BOOLEAN,
						float: FieldType.FLOAT,
						int: FieldType.INTEGER
					},
					tags: ['my_tag']
				});
				return influx.writePoints([
					{
						measurement: 'my_runtime_schema_measure',
						tags: {my_tag: '1'},
						fields: {
							int: 42,
							float: 43,
							bool: true
						}
					}
				]);
			});

			it('throws on schema violations', () => {
				setDefaultDB('my_db');

				expect(() => {
					influx.writePoints([
						{
							measurement: 'my_schemed_measure',
							tags: {not_a_tag: '1'}
						}
					]);
				}).to.throw(/extraneous tags/i);

				expect(() => {
					influx.writePoints([
						{
							measurement: 'my_schemed_measure',
							fields: {not_a_field: '1'}
						}
					]);
				}).to.throw(/extraneous fields/i);

				expect(() => {
					influx.writePoints([
						{
							measurement: 'my_schemed_measure',
							fields: {bool: 'lol, not a bool'}
						}
					]);
				}).to.throw(/expected bool/i);
			});

			it('handles lack of tags', () => {
				expectWrite('mymeas myfield=90', {
					precision: 'n',
					rp: undefined,
					db: 'my_db'
				});

				return influx.writePoints(
					[
						{
							measurement: 'mymeas',
							fields: {myfield: 90}
						}
					],
					{database: 'my_db'},
				);
			});

			it('handles lack of fields', () => {
				expectWrite('mymeas,my_tag=90', {
					precision: 'n',
					rp: undefined,
					db: 'my_db'
				});

				return influx.writePoints(
					[
						{
							measurement: 'mymeas',
							tags: {my_tag: '90'}
						}
					],
					{database: 'my_db'},
				);
			});

			it('handles multiple tags', () => {
				expectWrite('mymeas,my_tag1=90,my_tag2=45', {
					precision: 'n',
					rp: undefined,
					db: 'my_db'
				});

				return influx.writePoints(
					[
						{
							measurement: 'mymeas',
							tags: {my_tag1: '90', my_tag2: '45'}
						}
					],
					{database: 'my_db'},
				);
			});

			it('writes with the .writeMeasurement method', () => {
				setDefaultDB('my_db');
				expectWrite('mymeas,my_tag=1 myfield=90 1463683075000000000', {
					precision: 'n',
					rp: undefined,
					db: 'my_db'
				});

				return influx.writeMeasurement('mymeas', [
					{
						tags: {my_tag: '1'},
						fields: {myfield: 90},
						timestamp: new Date(1463683075000)
					}
				]);
			});

			it('accepts nanoseconds (as ms)', () => {
				setDefaultDB('my_db');
				expectWrite('mymeas,my_tag=1 myfield=90 1463683075000000000', {
					precision: 'n',
					rp: undefined,
					db: 'my_db'
				});

				return influx.writeMeasurement('mymeas', [
					{
						tags: {my_tag: '1'},
						fields: {myfield: 90},
						timestamp: toNanoDate('1463683075000000000')
					}
				]);
			});

			it('accepts timestamp overriding', () => {
				setDefaultDB('my_db');
				expectWrite('mymeas,my_tag=1 myfield=90 1463683075000', {
					precision: 'ms',
					rp: undefined,
					db: 'my_db'
				});

				return influx.writeMeasurement(
					'mymeas',
					[
						{
							tags: {my_tag: '1'},
							fields: {myfield: 90},
							timestamp: toNanoDate('1463683075000000000')
						}
					],
					{precision: 'ms'},
				);
			});
		});

		describe('.query', () => {
			beforeEach(() => setDefaultDB('my_db'));

			it('runs raw queries', () => {
				expectQuery(
					'json',
					{
						q: 'select * from series_0',
						epoch: undefined,
						rp: undefined,
						db: 'my_db'
					},
					'GET',
					dbFixture('selectFromOne'),
				);

				return influx.queryRaw('select * from series_0').then(res => {
					expect(res).to.deep.equal(dbFixture('selectFromOne'));
				});
			});

			it('parses query output', () => {
				expectQuery(
					'json',
					{
						q: 'select * from series_0',
						epoch: undefined,
						rp: undefined,
						db: 'my_db'
					},
					'GET',
					dbFixture('selectFromOne'),
				);

				return influx.query('select * from series_0').then(res => {
					expect(res.slice()).to.deep.equal([
						{time: new Date('2016-09-29T02:19:09.38Z'), my_tag: '1', my_value: 67},
						{time: new Date('2016-09-29T02:19:09.379Z'), my_tag: '1', my_value: 32}
					]);
				});
			});

			it('selects from multiple', () => {
				expectQuery(
					'json',
					{
						q: 'select * from series_0;select * from series_1',
						epoch: undefined,
						rp: undefined,
						db: 'my_db'
					},
					'GET',
					dbFixture('selectFromOne'),
				);

				return influx.query(['select * from series_0', 'select * from series_1']);
			});

			it('passes in options', () => {
				expectQuery(
					'json',
					{
						q: 'select * from series_0',
						epoch: 'ms',
						rp: 'asdf',
						db: 'my_db'
					},
					'GET',
					dbFixture('selectFromOne'),
				);

				return influx.query(['select * from series_0'], {
					precision: 'ms',
					retentionPolicy: 'asdf'
				});
			});

			it('rewrites nanosecond precisions', () => {
				expectQuery(
					'json',
					{
						q: 'select * from series_0',
						epoch: undefined,
						rp: 'asdf',
						db: 'my_db'
					},
					'GET',
					dbFixture('selectFromOne'),
				);

				return influx.query(['select * from series_0'], {
					precision: 'n',
					retentionPolicy: 'asdf'
				});
			});
		});

		describe('.createRetentionPolicy', () => {
			beforeEach(() => setDefaultDB('my_db'));

			it('creates non-default policies', () => {
				expectQuery(
					'json',
					'create retention policy "7d\\"" on "test" duration 7d replication 1',
				);

				return influx.createRetentionPolicy('7d"', {
					database: 'test',
					duration: '7d',
					replication: 1
				});
			});

			it('creates default policies', () => {
				expectQuery(
					'json',
					'create retention policy "7d\\"" on "my_db" duration 7d replication 1 default',
				);

				return influx.createRetentionPolicy('7d"', {
					duration: '7d',
					replication: 1,
					isDefault: true
				});
			});
		});

		describe('.alterRetentionPolicy', () => {
			beforeEach(() => setDefaultDB('my_db'));

			it('creates non-default policies', () => {
				expectQuery(
					'json',
					'alter retention policy "7d\\"" on "test" duration 7d replication 1',
				);

				return influx.alterRetentionPolicy('7d"', {
					database: 'test',
					duration: '7d',
					replication: 1
				});
			});

			it('creates default policies', () => {
				expectQuery(
					'json',
					'alter retention policy "7d\\"" on "my_db" duration 7d replication 1 default',
				);

				return influx.alterRetentionPolicy('7d"', {
					duration: '7d',
					replication: 1,
					isDefault: true
				});
			});
		});

		it('drops retention policies', () => {
			setDefaultDB('my_db');
			expectQuery('json', 'drop retention policy "7d\\"" on "my_db"');
			return influx.dropRetentionPolicy('7d"');
		});

		it('shows retention policies', () => {
			const data = dbFixture('showRetentionPolicies');
			expectQuery('json', 'show retention policies on "my\\"db"', 'GET', data);
			influx.showRetentionPolicies('my"db');
			setDefaultDB('my_db');
			expectQuery('json', 'show retention policies on "my_db"', 'GET', data);

			return influx.showRetentionPolicies().then(res => {
				expect(res.slice()).to.deep.equal([
					{
						name: 'autogen',
						duration: '0s',
						shardGroupDuration: '168h0m0s',
						replicaN: 1,
						default: true
					},
					{
						name: '7d',
						duration: '168h0m0s',
						shardGroupDuration: '24h0m0s',
						replicaN: 1,
						default: false
					}
				]);
			});
		});

		it('shows shards', () => {
			setDefaultDB('_internal');
			expectQuery('json', 'show shards ', 'GET', dbFixture('showShards'));
			return influx.showShards().then(res => {
				expect(res.slice()).to.deep.equal([
					{
						id: 1,
						database: '_internal',
						retention_policy: 'monitor',
						shard_group: 1,
						start_time: '2019-06-13T00:00:00Z',
						end_time: '2019-06-14T00:00:00Z',
						expiry_time: '2019-06-21T00:00:00Z',
						owners: ''
					}
				]);
			});
		});
	});
});
