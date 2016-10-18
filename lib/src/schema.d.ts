import { FieldType } from "./grammar";
export interface SchemaOptions {
    /**
     * The measurement name this schema is describing.
     */
    measurement: string;
    /**
     * The database the measurement lives under. Uses the default database
     * if one is provided.
     */
    database?: string;
    /**
     * Columns is the map of column type definitions on the database.
     */
    fields: {
        [column: string]: FieldType;
    };
    /**
     * A list of schema tag names.
     */
    tags: string[];
}
export declare type FieldMap = {
    [name: string]: string | number | boolean;
};
/**
 * The Schema provides information and utilities for an InfluxDB measurement.
 * @private
 */
export declare class Schema {
    private options;
    private fieldNames;
    private tagHash;
    constructor(options: SchemaOptions);
    /**
     * coerceFields converts a map of field values to a strings which
     * can be injected into the line protocol without further escaping.
     * The output is given in [key, value] pairs.
     */
    coerceFields(fields: FieldMap): [string, string][];
    /**
     * Throws an error if the tags include values other than
     * what was specified in the schema. It returns a list of tag names.
     */
    checkTags(tags: {
        [tag: string]: string;
    }): string[];
    /**
     * Returns the "db"."measurement"[."field"] referencing the current schema.
     */
    private ref(field?);
}
/**
 * Coerces the field map to a set of writable values, a la coerceFields,
 * using native guesses based on the field datatypes.
 * @private
 */
export declare function coerceBadly(fields: FieldMap): [string, string][];
