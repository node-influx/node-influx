/* eslint-env node, mocha */

import {expect} from 'chai';

import {Expression, Measurement, toNanoDate} from '../../src/index';

describe('query builder', () => {
	describe('measurement builder', () => {
		it('builds with only name', () => {
			expect(new Measurement().name('my_"meas').toString()).to.equal('"my_\\"meas"');
		});

		it('builds with name and rp', () => {
			expect(
				new Measurement()
					.name('my_"meas')
					.policy('po"licy')
					.toString(),
			).to.equal('"po\\"licy"."my_\\"meas"');
		});

		it('builds with name, rp, and db', () => {
			expect(
				new Measurement()
					.name('my_"meas')
					.policy('po"licy')
					.db('my_"db')
					.toString(),
			).to.equal('"my_\\"db"."po\\"licy"."my_\\"meas"');
		});

		it('builds with name and db', () => {
			expect(
				new Measurement()
					.name('my_"meas')
					.db('my_"db')
					.toString(),
			).to.equal('"my_\\"db"."my_\\"meas"');
		});

		it('throws when a name is omitted', () => {
			expect(() => new Measurement().db('my_"db').toString()).to.throw(
				/must specify a measurement/,
			);
		});
	});

	describe('expression builder', () => {
		it('creates basic queries', () => {
			expect(
				new Expression()
					.tag('my_"tag')
					.equals.value('42')
					.toString(),
			).to.equal('"my_\\"tag" = \'42\'');
		});

		it('inserts data types correctly', () => {
			expect(
				new Expression()
					.field('f')
					.equals.value('str\'')
					.or.field('f')
					.matches.value(/[0-9]+/)
					.or.field('f')
					.equals.value(42)
					.or.field('f')
					.equals.tag('my_"tag')
					.or.field('f')
					.equals.value(new Date(1475985480231))
					.or.field('f')
					.equals.value(toNanoDate('1475985480231035600'))
					.or.field('f')
					.equals.value(true)
					.or.exp(e =>
						e
							.field('a')
							.equals.value(1)
							.or.field('b')
							.equals.value(2),
					)
					.or.field('f')
					.doesntMatch.value({toString: () => '/my-custom-re/'})
					.toString(),
			).to.equal(
				'"f" = \'str\\\'\' OR "f" =~ /[0-9]+/ OR "f" = 42 ' +
          'OR "f" = "my_\\"tag" OR "f" = "2016-10-09 03:58:00.231" ' +
          'OR "f" = "2016-10-09 03:58:00.231035600" OR "f" = TRUE ' +
          'OR ("a" = 1 OR "b" = 2) OR "f" !~ /my-custom-re/',
			);
		});

		it('throws when using a flagged regex', () => {
			expect(() => new Expression().field('f').matches.value(/a/i)).to.throw(
				/doesn't support flags/,
			);
		});

		it('throws when using un-stringifyable object', () => {
			expect(() => new Expression().field('f').equals.value(Object.create(null))).to.throw(
				/doesn't know how to encode/,
			);
		});

		const operationsTable = [
			{method: 'equals', yields: '='},
			{method: 'notEqual', yields: '!='},
			{method: 'gt', yields: '>'},
			{method: 'gte', yields: '>='},
			{method: 'lt', yields: '<'},
			{method: 'lte', yields: '<='},
			{method: 'plus', yields: '+'},
			{method: 'minus', yields: '-'},
			{method: 'times', yields: '*'},
			{method: 'div', yields: '/'},
			{method: 'and', yields: 'AND'},
			{method: 'or', yields: 'OR'},
			{method: 'matches', yields: '=~'},
			{method: 'doesntMatch', yields: '!~'}
		];

		operationsTable.forEach(({method, yields}) => {
			it(`yields ${yields} from .${method}`, () => {
				const expr: any = new Expression().field('f');
				expect(expr[method].value(true).toString()).to.equal(`"f" ${yields} TRUE`);
			});
		});
	});
});
