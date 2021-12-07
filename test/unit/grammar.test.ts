import { expect } from "chai";

import * as grammar from "../../src/grammar";

const escapeTables = require("../fixture/escapeTables.json");

describe("grammar", () => {
  Object.keys(escapeTables).forEach((escaper: keyof typeof grammar.escape) => {
    describe(escaper, () => {
      escapeTables[escaper].forEach((test: [string, string]) => {
        it(`escapes \`${test[0]}\` as \`${test[1]}\``, () => {
          expect(grammar.escape[escaper](test[0])).to.equal(test[1]);
        });
      });
    });
  });

  it("does not escape raw values", () => {
    expect(
      grammar.escape.quoted(new grammar.Raw('don"t escape') as any)
    ).to.equal('don"t escape');
  });

  it("escapes backslashes (issues #486, #516)", () => {
    // eslint-disable-next-line quotes
    expect(grammar.escape.stringLit("GAZP()\\' or 1=1 --")).to.equal(
      "'GAZP()\\\\\\' or 1=1 --'"
    );
    expect(grammar.escape.tag(1 as any)).to.equal("1");
  });

  it("escapes complex values (issue #242)", () => {
    const original = JSON.stringify({ a: JSON.stringify({ b: "c c" }) });
    expect(grammar.escape.quoted(original)).to.equal(
      '"{\\"a\\":\\"{\\\\\\"b\\\\\\":\\\\\\"c c\\\\\\"}\\"}"'
    );
  });

  let nanoDate: grammar.INanoDate;
  let milliDate: Date;

  beforeEach(() => {
    nanoDate = grammar.isoOrTimeToDate("2016-10-09T03:58:00.231035677Z", "n");
    milliDate = new Date(1475985480231);
  });

  it("converts a nanoseconds timestamp to a nano date", () => {
    const date = grammar.toNanoDate("1475985480231035600");
    expect(date.getTime()).to.equal(1475985480231);
    expect(date.getNanoTime()).to.equal("1475985480231035600"); // Precision is lost
    expect(date.toNanoISOString()).to.equal("2016-10-09T03:58:00.231035600Z");
  });

  it("converts a nanoseconds timestamp with trailing zeroes to a nano date", () => {
    const date = grammar.toNanoDate("1254646541002000000");
    expect(date.getTime()).to.equal(1254646541002);
    expect(date.getNanoTime()).to.equal("1254646541002000000"); // Precision is lost
    expect(date.toNanoISOString()).to.equal("2009-10-04T08:55:41.002000000Z");
  });

  describe("formatting", () => {
    it("formats nanosecond dates", () => {
      expect(grammar.formatDate(nanoDate)).to.equal(
        '"2016-10-09 03:58:00.231035677"'
      );
    });
    it("formats millisecond dates", () => {
      expect(grammar.formatDate(milliDate)).to.equal(
        '"2016-10-09 03:58:00.231"'
      );
    });
  });

  describe("parsing", () => {
    it("parses ISO dates correctly", () => {
      const parsed = grammar.isoOrTimeToDate(
        "2016-10-09T03:58:00.231035677Z",
        "n"
      );
      expect(parsed.getTime()).to.equal(1475985480231);
      expect(parsed.getNanoTime()).to.equal("1475985480231035677");
      expect(parsed.toNanoISOString()).to.equal(
        "2016-10-09T03:58:00.231035677Z"
      );
    });

    it("parses numeric `ns` timestamps", () => {
      const parsed = grammar.isoOrTimeToDate(1475985480231035677, "n");
      expect(parsed.getTime()).to.equal(1475985480231);
      expect(parsed.getNanoTime()).to.equal("1475985480231035600"); // Precision is lost
      expect(parsed.toNanoISOString()).to.equal(
        "2016-10-09T03:58:00.231035600Z"
      );
    });

    it("accounts for floating point errors", () => {
      const parsed = grammar.isoOrTimeToDate(1638842483690000000, "n");
      expect(parsed.getTime()).to.equal(1638842483690);
      expect(parsed.toISOString()).to.equal("2021-12-07T02:01:23.690Z");
    });

    it("parses numeric `u` timestamps", () => {
      const parsed = grammar.isoOrTimeToDate(1475985480231035, "u");
      expect(parsed.getTime()).to.equal(1475985480231);
      expect(parsed.getNanoTime()).to.equal("1475985480231035000");
      expect(parsed.toNanoISOString()).to.equal(
        "2016-10-09T03:58:00.231035000Z"
      );
    });

    it("parses numeric `ms` timestamps", () => {
      const parsed = grammar.isoOrTimeToDate(1475985480231, "ms");
      expect(parsed.getTime()).to.equal(1475985480231);
      expect(parsed.getNanoTime()).to.equal("1475985480231000000");
    });

    it("parses numeric `s` timestamps", () => {
      const parsed = grammar.isoOrTimeToDate(1475985480, "s");
      expect(parsed.getTime()).to.equal(1475985480000);
      expect(parsed.getNanoTime()).to.equal("1475985480000000000");
    });

    it("parses numeric `m` timestamps", () => {
      const parsed = grammar.isoOrTimeToDate(24599758, "m");
      expect(parsed.getTime()).to.equal(1475985480000);
      expect(parsed.getNanoTime()).to.equal("1475985480000000000");
    });

    it("parses numeric `h` timestamps", () => {
      const parsed = grammar.isoOrTimeToDate(409995, "h");
      expect(parsed.getTime()).to.equal(1475982000000);
      expect(parsed.getNanoTime()).to.equal("1475982000000000000");
    });
  });

  describe("timestamp casting", () => {
    it("casts dates into timestamps", () => {
      const d = new Date(1475121809084);
      expect(grammar.castTimestamp(d, "n")).to.equal("1475121809084000000");
      expect(grammar.castTimestamp(d, "u")).to.equal("1475121809084000");
      expect(grammar.castTimestamp(d, "ms")).to.equal("1475121809084");
      expect(grammar.castTimestamp(d, "s")).to.equal("1475121809");
      expect(grammar.castTimestamp(d, "m")).to.equal("24585363");
      expect(grammar.castTimestamp(d, "h")).to.equal("409756");
    });

    it("casts nanodates into timestamps", () => {
      const d = grammar.toNanoDate("1475985480231035600");
      expect(grammar.castTimestamp(d, "n")).to.equal("1475985480231035600");
      expect(grammar.castTimestamp(d, "u")).to.equal("1475985480231035");
      expect(grammar.castTimestamp(d, "ms")).to.equal("1475985480231");
      expect(grammar.castTimestamp(d, "s")).to.equal("1475985480");
      expect(grammar.castTimestamp(d, "m")).to.equal("24599758");
      expect(grammar.castTimestamp(d, "h")).to.equal("409995");
    });

    it("accepts strings, numbers liternally", () => {
      expect(grammar.castTimestamp("1475985480231035600", "s")).to.equal(
        "1475985480231035600"
      );
      expect(grammar.castTimestamp(1475985480231, "s")).to.equal(
        "1475985480231"
      );
    });

    it("throws on non-numeric strings", () => {
      expect(() => grammar.castTimestamp("wut", "s")).to.throw(/numeric value/);
    });
  });
});
