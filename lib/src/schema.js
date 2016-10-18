"use strict";
const grammar_1 = require("./grammar");
/**
 * The Schema provides information and utilities for an InfluxDB measurement.
 * @private
 */
class Schema {
    constructor(options) {
        this.options = options;
        this.tagHash = {};
        // fieldNames are sorted for performance: when coerceFields is run the
        // fields will be added to the output in order.
        this.fieldNames = Object.keys(options.fields).sort();
        options.tags.forEach(tag => { this.tagHash[tag] = true; });
    }
    /**
     * coerceFields converts a map of field values to a strings which
     * can be injected into the line protocol without further escaping.
     * The output is given in [key, value] pairs.
     */
    coerceFields(fields) {
        let consumed = 0;
        const output = [];
        this.fieldNames.forEach(field => {
            if (!fields.hasOwnProperty(field)) {
                return;
            }
            const value = fields[field];
            const typ = typeof value;
            consumed++;
            if (value == null) {
                return;
            }
            let coerced;
            switch (this.options.fields[field]) {
                case grammar_1.FieldType.STRING:
                    coerced = grammar_1.escape.quoted(String(value));
                    break;
                case grammar_1.FieldType.INTEGER:
                    if (typ !== "number" && !grammar_1.isNumeric(String(value))) {
                        throw new Error(`Expected numeric value for ${this.ref(field)}, but got "${value}"!`);
                    }
                    coerced = String(Math.floor(value)) + "i";
                    break;
                case grammar_1.FieldType.FLOAT:
                    if (typ !== "number" && !grammar_1.isNumeric(String(value))) {
                        throw new Error(`Expected numeric value for ${this.ref(field)}, but got "${value}"!`);
                    }
                    coerced = String(value);
                    break;
                case grammar_1.FieldType.BOOLEAN:
                    if (typ !== "boolean") {
                        throw new Error(`Expected boolean value for ${this.ref(field)}, but got a ${typ}!`);
                    }
                    coerced = value ? "T" : "F";
                    break;
                default:
                    throw new Error(`Unknown field type ${this.options.fields[field]} for ${field} in ` +
                        `${this.ref()}. Please ensure that your configuration is correct.`);
            }
            output.push([field, coerced]);
        });
        const keys = Object.keys(fields);
        if (consumed !== keys.length) {
            const extraneous = keys.filter(f => this.fieldNames.indexOf(f) === -1);
            throw new Error(`Extraneous fields detected for writing InfluxDB point in` +
                `${this.ref()}: \`${extraneous.join("`, `")}\`.`);
        }
        return output;
    }
    /**
     * Throws an error if the tags include values other than
     * what was specified in the schema. It returns a list of tag names.
     */
    checkTags(tags) {
        const names = Object.keys(tags);
        const extraneous = names.filter(tag => !this.tagHash[tag]);
        if (extraneous.length > 0) {
            throw new Error(`Extraneous tags detected for writing InfluxDB point in` +
                `${this.ref()}: \`${extraneous.join("`, `")}\`.`);
        }
        return names;
    }
    /**
     * Returns the "db"."measurement"[."field"] referencing the current schema.
     */
    ref(field) {
        let out = this.options.database + "." + this.options.measurement;
        if (field) {
            out += "." + field;
        }
        return out;
    }
}
exports.Schema = Schema;
/**
 * Coerces the field map to a set of writable values, a la coerceFields,
 * using native guesses based on the field datatypes.
 * @private
 */
function coerceBadly(fields) {
    return Object.keys(fields).sort().map(field => {
        const value = fields[field];
        if (typeof value === "string") {
            return [field, grammar_1.escape.quoted(value)];
        }
        else {
            return [field, String(value)];
        }
    });
}
exports.coerceBadly = coerceBadly;
;
