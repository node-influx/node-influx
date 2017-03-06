import { IncomingMessage } from 'http';
import { EventEmitter } from 'events';
import * as parse from 'csv-parse';

import { isoOrTimeToDate, TimePrecision } from '../grammar';
import { IParser, IResults, ResultError, Row, Tags } from './types';

const enum ReaderState {
  Opening,
  QuotedValue,
  UnquotedValue,
}

/**
 * The CSVParser parses CSV-formatted response from Influx, supported by
 * Influx 1.1.0 and later.
 * @private
 */
export class CSVParser implements IParser {
  public assertNoErrors(res: IncomingMessage): Promise<void> {
    return Promise.resolve();
  }

  public parse<T>(res: IncomingMessage, precision?: TimePrecision): Promise<IResults<T>[] | IResults<T>> {
    return new Promise((resolve, reject) => {
      const parser = parse({
        auto_parse: false,
        rowDelimiter: '\n',
      });

      parser.on('readable', () => {
        while (true) {
          const record = parser.read();
          if (!record) {
            return;
          }
          console.log(record);
        }
      });

      parser.on('finish', () => {
        console.log('done');
        resolve();
      })

      parser.on('error', err => reject(err));

      res.on('data', chunk => parser.write(chunk));
      res.on('end', () => parser.end());
    });
  }

  public parseSingle<T>(res: IncomingMessage, precision?: TimePrecision): Promise<IResults<T>> {
    return this.parse(res, precision).then(results => {
      assertContainsNoError(body);

      if (body.results.length !== 1) {
        throw new Error('node-influx expected the results length to equal 1, but ' +
          `it was ${body.results.length}. Please report this here: https://git.io/influx-err`);
      }

      return parseInner(body.results[0].series, precision);
    });
  }
}

export const parser = new CSVParser();
