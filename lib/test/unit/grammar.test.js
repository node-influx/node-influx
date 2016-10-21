"use strict";
const grammar = require("../../src/grammar");
const chai_1 = require("chai");
const escapeTables = require("../fixture/escapeTables.json");
describe("grammar", () => {
    Object.keys(escapeTables).forEach(escaper => {
        describe(escaper, () => {
            escapeTables[escaper].forEach(test => {
                it(`escapes \`${test[0]}\` as \`${test[1]}\``, () => {
                    chai_1.expect(grammar.escape[escaper](test[0])).to.equal(test[1]);
                });
            });
        });
    });
    it('does not escape raw values', () => {
        chai_1.expect(grammar.escape.quoted(new grammar.Raw('don"t escape'))).to.equal('don"t escape');
    });
    let nanoDate;
    let milliDate;
    beforeEach(() => {
        nanoDate = grammar.isoOrTimeToDate('2016-10-09T03:58:00.231035677Z', 'n');
        milliDate = new Date(1475985480231);
    });
    it('converts a nanoseconds timestamp to a nano date', () => {
        const date = grammar.toNanoDate('1475985480231035600');
        chai_1.expect(date.getTime()).to.equal(1475985480231);
        chai_1.expect(date.getNanoTime()).to.equal('1475985480231035600'); // precision is lost
        chai_1.expect(date.toNanoISOString()).to.equal('2016-10-09T03:58:00.231035600Z');
    });
    describe('formatting', () => {
        it("formats nanosecond dates", () => {
            chai_1.expect(grammar.formatDate(nanoDate)).to.equal("\"2016-10-09 03:58:00.231035677\"");
        });
        it("formats millisecond dates", () => {
            chai_1.expect(grammar.formatDate(milliDate)).to.equal("\"2016-10-09 03:58:00.231\"");
        });
    });
    describe('parsing', () => {
        it('parses ISO dates correctly', () => {
            const parsed = grammar.isoOrTimeToDate('2016-10-09T03:58:00.231035677Z', 'n');
            chai_1.expect(parsed.getTime()).to.equal(1475985480231);
            chai_1.expect(parsed.getNanoTime()).to.equal('1475985480231035677');
            chai_1.expect(parsed.toNanoISOString()).to.equal('2016-10-09T03:58:00.231035677Z');
        });
        it('parses numeric `ns` timestamps', () => {
            const parsed = grammar.isoOrTimeToDate(1475985480231035677, 'n');
            chai_1.expect(parsed.getTime()).to.equal(1475985480231);
            chai_1.expect(parsed.getNanoTime()).to.equal('1475985480231035600'); // precision is lost
            chai_1.expect(parsed.toNanoISOString()).to.equal('2016-10-09T03:58:00.231035600Z');
        });
        it('parses numeric `u` timestamps', () => {
            const parsed = grammar.isoOrTimeToDate(1475985480231035, 'u');
            chai_1.expect(parsed.getTime()).to.equal(1475985480231);
            chai_1.expect(parsed.getNanoTime()).to.equal('1475985480231035000');
            chai_1.expect(parsed.toNanoISOString()).to.equal('2016-10-09T03:58:00.231035000Z');
        });
        it('parses numeric `ms` timestamps', () => {
            const parsed = grammar.isoOrTimeToDate(1475985480231, 'ms');
            chai_1.expect(parsed.getTime()).to.equal(1475985480231);
            chai_1.expect(parsed.getNanoTime()).to.equal('1475985480231000000');
        });
        it('parses numeric `s` timestamps', () => {
            const parsed = grammar.isoOrTimeToDate(1475985480, 's');
            chai_1.expect(parsed.getTime()).to.equal(1475985480000);
            chai_1.expect(parsed.getNanoTime()).to.equal('1475985480000000000');
        });
        it('parses numeric `m` timestamps', () => {
            const parsed = grammar.isoOrTimeToDate(24599758, 'm');
            chai_1.expect(parsed.getTime()).to.equal(1475985480000);
            chai_1.expect(parsed.getNanoTime()).to.equal('1475985480000000000');
        });
        it('parses numeric `h` timestamps', () => {
            const parsed = grammar.isoOrTimeToDate(409995, 'h');
            chai_1.expect(parsed.getTime()).to.equal(1475982000000);
            chai_1.expect(parsed.getNanoTime()).to.equal('1475982000000000000');
        });
    });
    describe("timestamp casting", () => {
        it("casts dates into timestamps", () => {
            const d = new Date(1475121809084);
            chai_1.expect(grammar.castTimestamp(d, "n")).to.equal('1475121809084000000');
            chai_1.expect(grammar.castTimestamp(d, "u")).to.equal('1475121809084000');
            chai_1.expect(grammar.castTimestamp(d, "ms")).to.equal('1475121809084');
            chai_1.expect(grammar.castTimestamp(d, "s")).to.equal('1475121809');
            chai_1.expect(grammar.castTimestamp(d, "m")).to.equal('24585363');
            chai_1.expect(grammar.castTimestamp(d, "h")).to.equal('409756');
        });
        it("casts nanodates into timestamps", () => {
            const d = grammar.toNanoDate('1475985480231035600');
            chai_1.expect(grammar.castTimestamp(d, "n")).to.equal('1475985480231035600');
            chai_1.expect(grammar.castTimestamp(d, "u")).to.equal('1475985480231035');
            chai_1.expect(grammar.castTimestamp(d, "ms")).to.equal('1475985480231');
            chai_1.expect(grammar.castTimestamp(d, "s")).to.equal('1475985480');
            chai_1.expect(grammar.castTimestamp(d, "m")).to.equal('24599758');
            chai_1.expect(grammar.castTimestamp(d, "h")).to.equal('409995');
        });
        it("accepts strings, numbers liternally", () => {
            chai_1.expect(grammar.castTimestamp('1475985480231035600', 's')).to.equal('1475985480231035600');
            chai_1.expect(grammar.castTimestamp(1475985480231, 's')).to.equal('1475985480231');
        });
        it("throws on non-numeric strings", () => {
            chai_1.expect(() => grammar.castTimestamp('wut', 's')).to.throw(/numeric value/);
        });
    });
});
