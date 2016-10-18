"use strict";
const grammar = require("../../src/grammar");
const helpers_1 = require("./helpers");
const escapeTables = require("../fixture/escapeTables.json");
describe("grammar", () => {
    Object.keys(escapeTables).forEach(escaper => {
        describe(escaper, () => {
            escapeTables[escaper].forEach(test => {
                it(`escapes \`${test[0]}\` as \`${test[1]}\``, () => {
                    helpers_1.expect(grammar.escape[escaper](test[0])).to.equal(test[1]);
                });
            });
        });
    });
    it('does not escape raw values', () => {
        helpers_1.expect(grammar.escape.quoted(new grammar.Raw('don"t escape'))).to.equal('don"t escape');
    });
    let nanoDate;
    let milliDate;
    beforeEach(() => {
        nanoDate = grammar.isoOrTimeToDate('2016-10-09T03:58:00.231035677Z', 'n');
        milliDate = new Date(1475985480231);
    });
    it('converts a nanoseconds timestamp to a nano date', () => {
        const date = grammar.toNanoDate('1475985480231035600');
        helpers_1.expect(date.getTime()).to.equal(1475985480231);
        helpers_1.expect(date.getNanoTime()).to.equal('1475985480231035600'); // precision is lost
        helpers_1.expect(date.toNanoISOString()).to.equal('2016-10-09T03:58:00.231035600Z');
    });
    describe('formatting', () => {
        it("formats nanosecond dates", () => {
            helpers_1.expect(grammar.formatDate(nanoDate)).to.equal("\"2016-10-09 03:58:00.231035677\"");
        });
        it("formats millisecond dates", () => {
            helpers_1.expect(grammar.formatDate(milliDate)).to.equal("\"2016-10-09 03:58:00.231\"");
        });
    });
    describe('parsing', () => {
        it('parses ISO dates correctly', () => {
            const parsed = grammar.isoOrTimeToDate('2016-10-09T03:58:00.231035677Z', 'n');
            helpers_1.expect(parsed.getTime()).to.equal(1475985480231);
            helpers_1.expect(parsed.getNanoTime()).to.equal('1475985480231035677');
            helpers_1.expect(parsed.toNanoISOString()).to.equal('2016-10-09T03:58:00.231035677Z');
        });
        it('parses numeric `ns` timestamps', () => {
            const parsed = grammar.isoOrTimeToDate(1475985480231035677, 'n');
            helpers_1.expect(parsed.getTime()).to.equal(1475985480231);
            helpers_1.expect(parsed.getNanoTime()).to.equal('1475985480231035600'); // precision is lost
            helpers_1.expect(parsed.toNanoISOString()).to.equal('2016-10-09T03:58:00.231035600Z');
        });
        it('parses numeric `u` timestamps', () => {
            const parsed = grammar.isoOrTimeToDate(1475985480231035, 'u');
            helpers_1.expect(parsed.getTime()).to.equal(1475985480231);
            helpers_1.expect(parsed.getNanoTime()).to.equal('1475985480231035000');
            helpers_1.expect(parsed.toNanoISOString()).to.equal('2016-10-09T03:58:00.231035000Z');
        });
        it('parses numeric `ms` timestamps', () => {
            const parsed = grammar.isoOrTimeToDate(1475985480231, 'ms');
            helpers_1.expect(parsed.getTime()).to.equal(1475985480231);
            helpers_1.expect(parsed).to.not.have.property('getNanoTime');
        });
        it('parses numeric `s` timestamps', () => {
            const parsed = grammar.isoOrTimeToDate(1475985480, 's');
            helpers_1.expect(parsed.getTime()).to.equal(1475985480000);
            helpers_1.expect(parsed).to.not.have.property('getNanoTime');
        });
        it('parses numeric `m` timestamps', () => {
            const parsed = grammar.isoOrTimeToDate(24599758, 'm');
            helpers_1.expect(parsed.getTime()).to.equal(1475985480000);
            helpers_1.expect(parsed).to.not.have.property('getNanoTime');
        });
        it('parses numeric `h` timestamps', () => {
            const parsed = grammar.isoOrTimeToDate(409995, 'h');
            helpers_1.expect(parsed.getTime()).to.equal(1475982000000);
            helpers_1.expect(parsed).to.not.have.property('getNanoTime');
        });
    });
    describe("timestamp casting", () => {
        it("casts dates into timestamps", () => {
            const d = new Date(1475121809084);
            helpers_1.expect(grammar.castTimestamp(d, "n")).to.equal('1475121809084000000');
            helpers_1.expect(grammar.castTimestamp(d, "u")).to.equal('1475121809084000');
            helpers_1.expect(grammar.castTimestamp(d, "ms")).to.equal('1475121809084');
            helpers_1.expect(grammar.castTimestamp(d, "s")).to.equal('1475121809');
            helpers_1.expect(grammar.castTimestamp(d, "m")).to.equal('24585363');
            helpers_1.expect(grammar.castTimestamp(d, "h")).to.equal('409756');
        });
        it("casts nanodates into timestamps", () => {
            const d = grammar.toNanoDate('1475985480231035600');
            helpers_1.expect(grammar.castTimestamp(d, "n")).to.equal('1475985480231035600');
            helpers_1.expect(grammar.castTimestamp(d, "u")).to.equal('1475985480231035');
            helpers_1.expect(grammar.castTimestamp(d, "ms")).to.equal('1475985480231');
            helpers_1.expect(grammar.castTimestamp(d, "s")).to.equal('1475985480');
            helpers_1.expect(grammar.castTimestamp(d, "m")).to.equal('24599758');
            helpers_1.expect(grammar.castTimestamp(d, "h")).to.equal('409995');
        });
        it("accepts strings, numbers liternally", () => {
            helpers_1.expect(grammar.castTimestamp('1475985480231035600', 's')).to.equal('1475985480231035600');
            helpers_1.expect(grammar.castTimestamp(1475985480231, 's')).to.equal('1475985480231');
        });
        it("throws on non-numeric strings", () => {
            helpers_1.expect(() => grammar.castTimestamp('wut', 's')).to.throw(/numeric value/);
        });
    });
});
