import * as grammar from "../../src/grammar";
import { expect } from "./helpers";

const escapeTables = require("../fixture/escapeTables.json");

describe("grammar", () => {
  Object.keys(escapeTables).forEach(escaper => {
    describe(escaper, () => {
      escapeTables[escaper].forEach(test => {
        it(`escapes \`${test[0]}\` as \`${test[1]}\``, () => {
          expect(grammar.escape[escaper](test[0])).to.equal(test[1]);
        });
      });
    });
  });

  it('does not escape raw values', () => {
    expect(grammar.escape.quoted(<any> new grammar.Raw('don"t escape'))).to.equal('don"t escape');
  });

  let nanoDate: grammar.NanoDate;
  let milliDate: Date;

  beforeEach(() => {
    nanoDate = <grammar.NanoDate> grammar.isoOrTimeToDate('2016-10-09T03:58:00.231035677Z', 'n');
    milliDate = new Date(1475985480231);
  });

  it('converts a nanoseconds timestamp to a nano date', () => {
    const date = grammar.toNanoDate('1475985480231035600');
    expect(date.getTime()).to.equal(1475985480231);
    expect(date.getNanoTime()).to.equal('1475985480231035600'); // precision is lost
    expect(date.toNanoISOString()).to.equal('2016-10-09T03:58:00.231035600Z');
  });

  describe('formatting', () => {
    it("formats nanosecond dates", () => {
      expect(grammar.formatDate(nanoDate)).to.equal("\"2016-10-09 03:58:00.231035677\"");
    });
    it("formats millisecond dates", () => {
      expect(grammar.formatDate(milliDate)).to.equal("\"2016-10-09 03:58:00.231\"");
    });
  });

  describe('parsing', () => {
    it('parses ISO dates correctly', () => {
      const parsed = <grammar.NanoDate> grammar.isoOrTimeToDate('2016-10-09T03:58:00.231035677Z', 'n');
      expect(parsed.getTime()).to.equal(1475985480231);
      expect(parsed.getNanoTime()).to.equal('1475985480231035677');
      expect(parsed.toNanoISOString()).to.equal('2016-10-09T03:58:00.231035677Z');
    });

    it('parses numeric `ns` timestamps', () => {
      const parsed = <grammar.NanoDate> grammar.isoOrTimeToDate(1475985480231035677, 'n');
      expect(parsed.getTime()).to.equal(1475985480231);
      expect(parsed.getNanoTime()).to.equal('1475985480231035600'); // precision is lost
      expect(parsed.toNanoISOString()).to.equal('2016-10-09T03:58:00.231035600Z');
    });

    it('parses numeric `u` timestamps', () => {
      const parsed = <grammar.NanoDate> grammar.isoOrTimeToDate(1475985480231035, 'u');
      expect(parsed.getTime()).to.equal(1475985480231);
      expect(parsed.getNanoTime()).to.equal('1475985480231035000');
      expect(parsed.toNanoISOString()).to.equal('2016-10-09T03:58:00.231035000Z');
    });

    it('parses numeric `ms` timestamps', () => {
      const parsed = grammar.isoOrTimeToDate(1475985480231, 'ms');
      expect(parsed.getTime()).to.equal(1475985480231);
      expect(parsed).to.not.have.property('getNanoTime');
    });

    it('parses numeric `s` timestamps', () => {
      const parsed = grammar.isoOrTimeToDate(1475985480, 's');
      expect(parsed.getTime()).to.equal(1475985480000);
      expect(parsed).to.not.have.property('getNanoTime');
    });

    it('parses numeric `m` timestamps', () => {
      const parsed = grammar.isoOrTimeToDate(24599758, 'm');
      expect(parsed.getTime()).to.equal(1475985480000);
      expect(parsed).to.not.have.property('getNanoTime');
    });

    it('parses numeric `h` timestamps', () => {
      const parsed = grammar.isoOrTimeToDate(409995, 'h');
      expect(parsed.getTime()).to.equal(1475982000000);
      expect(parsed).to.not.have.property('getNanoTime');
    });
  });

  describe("timestamp casting", () => {
    it("casts dates into timestamps", () => {
      const d = new Date(1475121809084);
      expect(grammar.castTimestamp(d, "n")).to.equal('1475121809084000000');
      expect(grammar.castTimestamp(d, "u")).to.equal('1475121809084000');
      expect(grammar.castTimestamp(d, "ms")).to.equal('1475121809084');
      expect(grammar.castTimestamp(d, "s")).to.equal('1475121809');
      expect(grammar.castTimestamp(d, "m")).to.equal('24585363');
      expect(grammar.castTimestamp(d, "h")).to.equal('409756');
    });

    it("casts nanodates into timestamps", () => {
      const d = grammar.toNanoDate('1475985480231035600');
      expect(grammar.castTimestamp(d, "n")).to.equal('1475985480231035600');
      expect(grammar.castTimestamp(d, "u")).to.equal('1475985480231035');
      expect(grammar.castTimestamp(d, "ms")).to.equal('1475985480231');
      expect(grammar.castTimestamp(d, "s")).to.equal('1475985480');
      expect(grammar.castTimestamp(d, "m")).to.equal('24599758');
      expect(grammar.castTimestamp(d, "h")).to.equal('409995');
    });
  });
});
