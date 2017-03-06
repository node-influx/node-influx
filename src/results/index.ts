import { IncomingMessage } from 'http';

import { TimePrecision } from '../grammar';
import { parser as csvParser } from './csv';
import { parser as jsonParser } from './json';
import { IParser, IResults } from './types';

export { IResults, ResultError } from './types';

function getParserFor(res: IncomingMessage): IParser {
  switch (res.headers['content-type']) {
    case 'text/csv':
      return csvParser;
    case 'application/json':
    default:
      return jsonParser;
  }
}

export function assertNoErrors(res: IncomingMessage): Promise<void> {
  return getParserFor(res).assertNoErrors(res);
}

export function parse<T>(res: IncomingMessage, precision?: TimePrecision): Promise<IResults<T>[] | IResults<T>> {
  return getParserFor(res).parse(res, precision);
}

export function parseSingle<T>(res: IncomingMessage, precision?: TimePrecision): Promise<IResults<T>> {
  return getParserFor(res).parseSingle(res, precision);
}
