/**
 * FieldType is an enumeration of InfluxDB field data types.
 */
export enum FieldType {
  FLOAT,
  INTEGER,
  STRING,
  BOOLEAN
};

const numericRe = /^[0-9]+$/;
export function isNumeric(value: string) {
  return numericRe.test(value);
}
