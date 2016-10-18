"use strict";
const schema_1 = require("../../src/schema");
const grammar_1 = require("../../src/grammar");
const helpers_1 = require("./helpers");
describe("schema", () => {
    let schema;
    beforeEach(() => {
        schema = new schema_1.Schema({
            database: "my_db",
            measurement: "my_measure",
            tags: ["my_tag"],
            fields: {
                int: grammar_1.FieldType.INTEGER,
                float: grammar_1.FieldType.FLOAT,
                string: grammar_1.FieldType.STRING,
                bool: grammar_1.FieldType.BOOLEAN,
            },
        });
    });
    describe("coerceBadly", () => {
        it("apparently works", () => {
            helpers_1.expect(schema_1.coerceBadly({
                b: 42,
                a: true,
                c: "hello\"world",
            })).to.deep.equal([
                ["a", "true"],
                ["b", "42"],
                ["c", "\"hello\\\"world\""],
            ]);
        });
    });
    describe("basic schema", () => {
        it("coerces data correctly", () => {
            helpers_1.expect(schema.coerceFields({
                int: 42,
                float: 43,
                string: "hello\"world",
                bool: true,
            })).to.deep.equal([
                ["bool", "T"],
                ["float", "43"],
                ["int", "42i"],
                ["string", "\"hello\\\"world\""],
            ]);
        });
        it("accepts partial data", () => {
            helpers_1.expect(schema.coerceFields({
                int: 42
            })).to.deep.equal([
                ["int", "42i"],
            ]);
        });
        it("coerces numeric string data", () => {
            helpers_1.expect(schema.coerceFields({
                int: "42"
            })).to.deep.equal([
                ["int", "42i"],
            ]);
        });
        it("strips null and undefined values", () => {
            helpers_1.expect(schema.coerceFields({
                int: 42,
                float: undefined,
                bool: null,
            })).to.deep.equal([
                ["int", "42i"],
            ]);
        });
        it("throws if wrong data type provided (bool)", () => {
            helpers_1.expect(() => schema.coerceFields({ bool: 42 })).to.throw(/expected bool/i);
            helpers_1.expect(() => schema.coerceFields({ bool: "asdf" })).to.throw(/expected bool/i);
        });
        it("throws if wrong data type provided (float)", () => {
            helpers_1.expect(() => schema.coerceFields({ float: true })).to.throw(/expected numeric/i);
            helpers_1.expect(() => schema.coerceFields({ float: "asdf" })).to.throw(/expected numeric/i);
        });
        it("throws if wrong data type provided (int)", () => {
            helpers_1.expect(() => schema.coerceFields({ int: true })).to.throw(/expected numeric/i);
            helpers_1.expect(() => schema.coerceFields({ int: "asdf" })).to.throw(/expected numeric/i);
        });
        it("allows valid tags", () => {
            helpers_1.expect(schema.checkTags({ "my_tag": "value" })).to.deep.equal(["my_tag"]);
            helpers_1.expect(schema.checkTags({})).to.deep.equal([]);
        });
        it("throws if invalid tags are provided", () => {
            helpers_1.expect(() => schema.checkTags({ "whatever": "value" })).to.throw(/extraneous tags/i);
        });
        it("throws if invalid fields are provided", () => {
            helpers_1.expect(() => helpers_1.expect(schema.coerceFields({ x: 42 }))).to.throw(/extraneous fields/i);
        });
    });
});
