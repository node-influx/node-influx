"use strict";
const results = require("../../src/results");
const chai_1 = require("chai");
describe('results', () => {
    it('parses a empty result', () => {
        chai_1.expect(results.parse({
            results: [{
                    series: [{
                            name: 'test_series',
                            columns: [
                                'time',
                                'mean'
                            ],
                            values: []
                        }]
                }]
        }).slice()).to.deep.equal([]);
    });
    it('parses a simple table of results', () => {
        const r = results.parseSingle({
            results: [{
                    series: [{
                            name: 'test_series',
                            columns: [
                                'time',
                                'mean'
                            ],
                            values: [
                                ['2016-09-25T16:12:51.787Z', 42],
                                ['2016-09-25T16:34:31.999Z', 44]
                            ]
                        }]
                }]
        });
        chai_1.expect(r.slice()).to.deep.equal([
            { time: new Date(1474819971787), mean: 42 },
            { time: new Date(1474821271999), mean: 44 }
        ]);
        chai_1.expect(r.groups()).to.deep.equal([
            { name: 'test_series', tags: {}, rows: r.slice() }
        ]);
        chai_1.expect(r.group({ tag: 'a' })).to.deep.equal([]);
    });
    it('parses alternate epochs', () => {
        const r1 = results.parseSingle({
            results: [{
                    series: [{
                            name: 'test_series',
                            columns: [
                                'time',
                                'mean'
                            ],
                            values: [
                                [1474819971787, 42],
                                [1474821271999, 44]
                            ]
                        }]
                }]
        }, 'ms');
        chai_1.expect(r1.slice()).to.deep.equal([
            { time: new Date(1474819971787), mean: 42 },
            { time: new Date(1474821271999), mean: 44 }
        ]);
        const r2 = results.parseSingle({
            results: [{
                    series: [{
                            name: 'test_series',
                            columns: [
                                'time',
                                'mean'
                            ],
                            values: [
                                [1474819971787000, 42],
                                [1474821271999000, 44]
                            ]
                        }]
                }]
        }, 'u');
        chai_1.expect(r2.slice()).to.deep.equal([
            { time: new Date(1474819971787), mean: 42 },
            { time: new Date(1474821271999), mean: 44 }
        ]);
    });
    it('parses grouped results', () => {
        const r = results.parseSingle({
            results: [{
                    series: [{
                            name: 'test_series',
                            tags: { tag: 'a' },
                            columns: [
                                'mean'
                            ],
                            values: [
                                [1],
                                [2]
                            ]
                        }, {
                            name: 'test_series',
                            tags: { tag: 'b' },
                            columns: [
                                'mean'
                            ],
                            values: [
                                [3],
                                [4]
                            ]
                        }]
                }]
        });
        chai_1.expect(r.slice()).to.deep.equal([
            { tag: 'a', mean: 1 },
            { tag: 'a', mean: 2 },
            { tag: 'b', mean: 3 },
            { tag: 'b', mean: 4 }
        ]);
        chai_1.expect(r.groups()).to.deep.equal([
            { name: 'test_series', tags: { tag: 'a' }, rows: [{ tag: 'a', mean: 1 }, { tag: 'a', mean: 2 }] },
            { name: 'test_series', tags: { tag: 'b' }, rows: [{ tag: 'b', mean: 3 }, { tag: 'b', mean: 4 }] }
        ]);
        chai_1.expect(r.group({ tag: 'a' })).to.deep.equal([
            { tag: 'a', mean: 1 },
            { tag: 'a', mean: 2 }
        ]);
        chai_1.expect(r.group({ tag: 'b' })).to.deep.equal([
            { tag: 'b', mean: 3 },
            { tag: 'b', mean: 4 }
        ]);
        chai_1.expect(r.group({ tag: 'c' })).to.deep.equal([]);
    });
    it('parses empty series', () => {
        const r1 = results.parseSingle({
            results: [{}]
        });
        chai_1.expect(r1.slice()).to.deep.equal([]);
    });
    it('parses empty values', () => {
        const r1 = results.parseSingle({
            results: [{
                    series: [
                        { columns: ['user', 'admin'] },
                    ],
                }],
        });
        chai_1.expect(r1.slice()).to.deep.equal([]);
    });
    it('throws error on an errorful series', () => {
        chai_1.expect(() => results.parseSingle({
            "results": [
                { error: "user already exists" }
            ]
        })).to.throw(/already exists/);
    });
});
