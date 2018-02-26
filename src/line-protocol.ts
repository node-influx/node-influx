import * as grammar from './grammar';
import { IPoint } from './index';
import { coerceBadly, Schema } from './schema';

export interface ISerializePointOptions {
  /**
   * Precision at which the points are written, defaults to nanoseconds 'n'.
   */
  precision?: grammar.TimePrecision;

  /**
   * Map of Schema instances for measurements.
   */
  schema?: { [measurement: string]: Schema };
}

/**
 * Serialise an IPoint into a string conforming to the Influx line protocol.
 *
 * Please see the IPoint and ISerializePointOptions types for a
 * full list of possible options.
 *
 * @param {IPoint} point
 * @param {IWriteOptions} [options]
 * @return {string}
 * @example
 * // serialise a point object into influx line protocol
 * // without using a schema
 * const line = influx.serializePoint(
 *   {
 *     measurement: 'perf',
 *     tags: { host: 'box1.example.com' },
 *     fields: { cpu: getCpuUsage(), mem: getMemUsage() },
 *   }
 * )
 *
 * // you can manually specify the precision,
 * // and schema.
 * const line = influx.serializePoint(
 *   {
 *     measurement: 'perf',
 *     tags: { host: 'box1.example.com' },
 *     fields: { cpu: getCpuUsage(), mem: getMemUsage() },
 *     timestamp: getLastRecordedTime(),
 *   }, {
 *     precision: 's',
 *     schema: { perf: /* schema instance /* },
 *   }
 * )
 */
export function serializePoint(point: IPoint, options: ISerializePointOptions = {}): string {
  const { precision = <grammar.TimePrecision>'n' } = options;
  const { fields = {}, tags = {}, measurement, timestamp } = point;

  const schema = options.schema && options.schema[measurement];
  const fieldsPairs = schema ? schema.coerceFields(fields) : coerceBadly(fields);
  const tagsNames = schema ? schema.checkTags(tags) : Object.keys(tags);

  let line: string = measurement;

  for (let i = 0; i < tagsNames.length; i += 1) {
    line += ',' + grammar.escape.tag(tagsNames[i]) + '=' + grammar.escape.tag(tags[tagsNames[i]]);
  }

  for (let i = 0; i < fieldsPairs.length; i += 1) {
    line += (i === 0 ? ' ' : ',') + grammar.escape.tag(fieldsPairs[i][0]) + '=' + fieldsPairs[i][1];
  }

  if (timestamp !== undefined) {
    line += ' ' + grammar.castTimestamp(timestamp, precision);
  }

  return line;
}
