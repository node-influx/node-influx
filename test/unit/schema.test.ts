/* eslint-env node, mocha */

import { expect } from "chai";

import { FieldType } from "../../src/grammar";
import { coerceBadly, Schema } from "../../src/schema";

describe("schema", () => {
  let schema: Schema;

  beforeEach(() => {
    schema = new Schema({
      database: "my_db",
      measurement: "my_measure",
      tags: ["my_tag"],
      fields: {
        int: FieldType.INTEGER,
        float: FieldType.FLOAT,
        string: FieldType.STRING,
        bool: FieldType.BOOLEAN,
      },
    });
  });

  describe("coerceBadly", () => {
    it("apparently works", () => {
      expect(
        coerceBadly({
          b: 42,
          a: true,
          c: 'hello"world',
        })
      ).to.deep.equal([
        ["a", "true"],
        ["b", "42"],
        ["c", '"hello\\"world"'],
      ]);
    });
  });

  describe("basic schema", () => {
    it("coerces data correctly", () => {
      expect(
        schema.coerceFields({
          int: 42,
          float: 43,
          string: 'hello"world',
          bool: true,
        })
      ).to.deep.equal([
        ["bool", "T"],
        ["float", "43"],
        ["int", "42i"],
        ["string", '"hello\\"world"'],
      ]);
    });

    it("accepts partial data", () => {
      expect(
        schema.coerceFields({
          int: 42,
        })
      ).to.deep.equal([["int", "42i"]]);
    });

    it("coerces numeric string data", () => {
      expect(
        schema.coerceFields({
          int: "42",
        })
      ).to.deep.equal([["int", "42i"]]);
    });

    it("strips null and undefined values", () => {
      expect(
        schema.coerceFields({
          int: 42,
          float: undefined,
          bool: null,
        })
      ).to.deep.equal([["int", "42i"]]);
    });

    it("throws if wrong data type provided (bool)", () => {
      expect(() => schema.coerceFields({ bool: 42 })).to.throw(
        /expected bool/i
      );
      expect(() => schema.coerceFields({ bool: "asdf" })).to.throw(
        /expected bool/i
      );
    });

    it("throws if wrong data type provided (float)", () => {
      expect(() => schema.coerceFields({ float: true })).to.throw(
        /expected numeric/i
      );
      expect(() => schema.coerceFields({ float: "asdf" })).to.throw(
        /expected numeric/i
      );
    });

    it("throws if wrong data type provided (int)", () => {
      expect(() => schema.coerceFields({ int: true })).to.throw(
        /expected numeric/i
      );
      expect(() => schema.coerceFields({ int: "asdf" })).to.throw(
        /expected numeric/i
      );
    });

    it("allows valid tags", () => {
      expect(schema.checkTags({ my_tag: "value" })).to.deep.equal(["my_tag"]);
      expect(schema.checkTags({})).to.deep.equal([]);
    });

    it("throws if invalid tags are provided", () => {
      expect(() => schema.checkTags({ whatever: "value" })).to.throw(
        /extraneous tags/i
      );
    });

    it("throws if invalid fields are provided", () => {
      expect(() => expect(schema.coerceFields({ x: 42 }))).to.throw(
        /extraneous fields/i
      );
    });
  });
});
