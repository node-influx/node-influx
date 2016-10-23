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
export enum FieldType {
  FLOAT,
  INTEGER,
  STRING,
  BOOLEAN,
}

export function isNumeric(value: string): boolean {
  return !Number.isNaN(Number(value));
}

/**
 * You can provide Raw values to Influx methods to prevent it from escaping
 * your provided string.
 * @class
 * @example
 * influx.createDatabase(new Influx.Raw('This won\'t be escaped!'));
 */
export class Raw {

  /**
   * Wraps a string so that it is not escaped in Influx queries.
   * @param {String} value
   * @example
   * influx.createDatabase(new Influx.Raw('This won\'t be escaped!'));
   */
  constructor(private value: string) {}

  /**
   * Returns the wrapped string.
   * @return {String}
   */
  public getValue(): string {
    return this.value;
  }
}
