"use strict";
/**
 * FieldType is an enumeration of InfluxDB field data types.
 * @typedef {Number} FieldType
 * @example
 * import { FieldType } from 'influx'; // or const FieldType = require('influx').FieldType
 *
 * const schema = {
 *   measurement: 'my_measurement',
 *   fields: {
 *     my_int: FieldType.INTEGER,
 *     my_float: FieldType.FLOAT,
 *     my_string: FieldType.STRING,
 *     my_boolean: FieldType.BOOLEAN,
 *   }
 * }
 */
(function (FieldType) {
    FieldType[FieldType["FLOAT"] = 0] = "FLOAT";
    FieldType[FieldType["INTEGER"] = 1] = "INTEGER";
    FieldType[FieldType["STRING"] = 2] = "STRING";
    FieldType[FieldType["BOOLEAN"] = 3] = "BOOLEAN";
})(exports.FieldType || (exports.FieldType = {}));
var FieldType = exports.FieldType;
;
const numericRe = /^[0-9]+$/;
function isNumeric(value) {
    return numericRe.test(value);
}
exports.isNumeric = isNumeric;
/**
 * You can provide Raw values to Influx methods to prevent it from escaping
 * your provided string.
 * @class
 * @example
 * influx.createDatabase(new Influx.Raw('This won\'t be escaped!'));
 */
class Raw {
    /**
     * Wraps a string so that it is not escaped in Influx queries.
     * @param {String} value
     * @example
     * influx.createDatabase(new Influx.Raw('This won\'t be escaped!'));
     */
    constructor(value) {
        this.value = value;
    }
    /**
     * Returns the wrapped string.
     * @return {String}
     */
    getValue() {
        return this.value;
    }
}
exports.Raw = Raw;
