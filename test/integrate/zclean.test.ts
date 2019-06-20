import { expect } from 'chai';

import { InfluxDB } from '../../src';
import { newClient } from './helpers';

describe('clean up test DB', () => {
  let db: InfluxDB;

  beforeEach(() => {
    return newClient().then(client => {
      db = client;
    });
  });

  it('drop databases', () => {
    return db
      .dropDatabase('influx_test_db')
      .then(() => db.getDatabaseNames())
      .then(res => expect(res).to.not.contain('influx_test_db'));
  });
});
