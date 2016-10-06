import * as grammar from "../../src/grammar";
import { expect } from "./helpers";

const escapeTables = require("../fixture/escapeTables.json");

describe("grammar", () => {
  Object.keys(escapeTables).forEach(escaper => {
    describe(escaper, () => {
      escapeTables[escaper].forEach(test => {
        it(`escapes \`${test[0]}\` as \`${test[1]}\``, () => {
          expect(grammar[escaper].escape(test[0])).to.equal(test[1]);
        });
      });
    });
  });

  it("formats dates correctly", () => {
    expect(grammar.formatDate(new Date(1475121809084)))
      .to.equal("\"2016-08-04 04:03:29.084\"");
  });

  it("date precision calculation", () => {
    const d = new Date(1475121809084);
    expect(grammar.dateToPrecision(d, "n")).to.equal(1475121809084000000);
    expect(grammar.dateToPrecision(d, "u")).to.equal(1475121809084000);
    expect(grammar.dateToPrecision(d, "ms")).to.equal(1475121809084);
    expect(grammar.dateToPrecision(d, "s")).to.equal(1475121809);
    expect(grammar.dateToPrecision(d, "m")).to.equal(24585363);
    expect(grammar.dateToPrecision(d, "h")).to.equal(409756);
  });

  it("casts timestamps correctly", () => {
    const d = new Date(1475121809084);
    expect(grammar.castTimestamp(d, "s")).to.equal("1475121809");
    expect(grammar.castTimestamp(d, "ms")).to.equal("1475121809084");

    expect(grammar.castTimestamp("1475121809", "s")).to.equal("1475121809");
    expect(grammar.castTimestamp("1475121809084", "ms")).to.equal("1475121809084");

    expect(grammar.castTimestamp(1475121809, "s")).to.equal("1475121809");
    expect(grammar.castTimestamp(1475121809084, "ms")).to.equal("1475121809084");
  });

  it("errors if an invalid timestamp value is provided", () => {
    expect(() => grammar.castTimestamp("sushi", "ms")).to.throw(/numeric value/);
  });
});
