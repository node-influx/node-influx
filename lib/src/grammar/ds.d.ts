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
export declare enum FieldType {
    FLOAT = 0,
    INTEGER = 1,
    STRING = 2,
    BOOLEAN = 3,
}
export declare function isNumeric(value: string): boolean;
/**
 * You can provide Raw values to Influx methods to prevent it from escaping
 * your provided string.
 * @class
 * @example
 * influx.createDatabase(new Influx.Raw('This won\'t be escaped!'));
 */
export declare class Raw {
    private value;
    /**
     * Wraps a string so that it is not escaped in Influx queries.
     * @param {String} value
     * @example
     * influx.createDatabase(new Influx.Raw('This won\'t be escaped!'));
     */
    constructor(value: string);
    /**
     * Returns the wrapped string.
     * @return {String}
     */
    getValue(): string;
}
