/* eslint-env node, mocha */

import {expect} from 'chai';

import {InfluxDB} from '../../src';
import {newClient, writeSampleData} from './helpers';

describe('data operations', () => {
	let db: InfluxDB;

	beforeEach(() => {
		return newClient()
			.then(client => {
				db = client;
			})
			.then(() => writeSampleData(db));
	});

	it('shows databases', () => {
		return db.getDatabaseNames().then(res => expect(res).contain('influx_test_db'));
	});

	it('writes complex values (issue #242)', () => {
		const original = JSON.stringify({a: JSON.stringify({b: 'c c'})});
		return db.writeMeasurement('complex_value_series', [{fields: {msg: original}}]);
	});

	it('lists measurements', () => {
		return db.getMeasurements().then(res => {
			expect(res).to.deep.equal(['h2o_feet', 'h2o_quality']);
		});
	});

	it('lists series', () => {
		return db.getSeries().then(res => {
			expect(res).to.deep.equal([
				'h2o_feet,location=coyote_creek',
				'h2o_feet,location=santa_monica',
				'h2o_quality,location=coyote_creek,randtag=1',
				'h2o_quality,location=coyote_creek,randtag=2',
				'h2o_quality,location=coyote_creek,randtag=3'
			]);
		});
	});

	it('drops series', () => {
		return db
			.dropSeries({
				where: e => e.tag('randtag').equals.value('1'),
				measurement: 'h2o_quality'
			})
			.then(() => db.getSeries())
			.then(res => expect(res).to.not.contain('h2o_quality,location=coyote_creek,randtag=1'));
  });
  /* Can work when PR accepted
  it('drops shard', () => {
    const shards_in_db =  db.showShards('influx_test_db') ;
    const first_shard_number  = shards_in_db[0].id;
    return db
			.dropShard(first_shard_number)
			.then(() => db.showShards('influx_test_db'))
			.then(res => expect(res[0]).to.not.contain(`id=${first_shard_number}`));
  });
  */

	it('gets measurements', () => {
		return db.getMeasurements().then(res => expect(res).to.deep.equal(['h2o_feet', 'h2o_quality']));
	});

	it('drops measurement', () => {
		return db
			.dropMeasurement('h2o_feet')
			.then(() => db.getMeasurements())
			.then(res => expect(res).to.not.contain('h2o_feet'));
	});
});
