import { FieldType, quoteEscaper } from "./grammar";

export interface SchemaOptions {
  /**
   * The measurement name this schema is describing.
   */
  measurement: string;

  /**
   * The database the measurement lives under.
   */
  database: string;

  /**
   * Columns is the map of column type definitions on the database.
   */
  fields: { [column: string]: FieldType };

  /**
   * A list of schema tag names.
   */
  tags: string[];
}

export type FieldMap = { [name: string]: number | string | boolean };

/**
 * The Schema provides information and utilities for an InfluxDB measurement.
 */
export class Schema {

  private fieldNames: string[];
  private tagHash: { [tag: string]: true } = {};

  constructor(private options: SchemaOptions) {
    this.fieldNames = Object.keys(options.fields);
    options.tags.forEach(tag => { this.tagHash[tag] = true; });
  }

  /**
   * coerceFields converts a map of field values to a map of strings which
   * can be injected into the line protocol without further escaping.
   */
  public coerceFields(fields: FieldMap): { [name: string]: string } {
    let consumed = 0;
    const output = {};

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

      switch (this.options.fields[field]) {
      case FieldType.STRING:
        output[field] = quoteEscaper.escape(String(value));
        break;

      case FieldType.INTEGER:
        if (typ !== "number" && !(/^[0-9]+$/).test(String(value))) {
          throw new Error(`Expected numeric value for ${this.ref(field)}, but got "${value}"!`);
        }
        output[field] = String(Math.floor(<number> value)) + "i";
        break;

      case FieldType.FLOAT:
        if (typ !== "number" && !(/^[0-9]+$/).test(String(value))) {
          throw new Error(`Expected numeric value for ${this.ref(field)}, but got "${value}"!`);
        }
        output[field] = String(value);
        break;

      case FieldType.BOOLEAN:
        if (typ !== "boolean") {
          throw new Error(`Expected boolean value for ${this.ref(field)}, but got a ${typ}!`);
        }
        output[field] = value ? "T" : "F";
        break;

      default:
        throw new Error(
          `Unknown field type ${this.options.fields[field]} for ${field} in ` +
          `${this.ref()}. Please ensure that your configuration is correct.`
        );
      }
    });

    const keys = Object.keys(fields);
    if (consumed !== keys.length) {
      const extraneous = keys.filter(f => this.fieldNames.indexOf(f) === -1);

      throw new Error(
        `Extraneous fields detected for writing InfluxDB point in` +
        `${this.ref()}: \`${extraneous.join("`, `")}\`.`
      );
    }

    return output;
  }

  /**
   * Throws an error if the tags include values other than
   * what was specified in the schema.
   */
  public assertTags(tags: { [tag: string]: string }) {
    const extraneous = Object.keys(tags).filter(tag => !this.tagHash[tag]);
    if (extraneous.length > 0) {
      throw new Error(
        `Extraneous tags detected for writing InfluxDB point in` +
        `${this.ref()}: \`${extraneous.join("`, `")}\`.`
      );
    }
  }

  /**
   * Returns the "db"."measurement"[."field"] referencing the current schema.
   */
  private ref(field?: string): string {
    let out = this.options.database + "." + this.options.measurement;
    if (field) {
      out += "." + field;
    }
    return out;
  }
}

/**
 * Coerces the field map to a set of writable values, a la coerceFields,
 * using native guesses based on the field datatypes.
 */
export function coerceBadly (fields: FieldMap): { [name: string]: string } {
  const output = {};
  Object.keys(fields).forEach(field => {
    const value = fields[field];
    if (typeof value === "string") {
      output[field] = quoteEscaper.escape(value);
    } else {
      output[field] = String(value);
    }
  });

  return output;
};
