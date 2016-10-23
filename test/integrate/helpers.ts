import { FieldType, IHostConfig, InfluxDB } from '../../src';

const sampleData = require('../fixture/integrateSampleData.json');
const details: IHostConfig = process.env.INFLUX_HOST
  ? JSON.parse(process.env.INFLUX_HOST)
  : { host: '127.0.01', port: 8086 };

export const db = process.env.INFLUX_TEST_DB || 'influx_test_db';

export function newClient(): Promise<InfluxDB> {
  const client = new InfluxDB({
    database: db,
    hosts: [details],
    schema: [
      {
        measurement: 'h2o_feet',
        tags: ['location'],
        fields: {
          'level description': FieldType.STRING,
          water_level: FieldType.FLOAT,
        },
      },
      {
        measurement: 'h2o_quality',
        tags: ['location', 'randtag'],
        fields: { index: FieldType.INTEGER },
      },
    ],
  });

  return client.dropDatabase(db)
    .then(() => client.createDatabase(db))
    .then(() => client);
}

export function writeSampleData(client: InfluxDB): Promise<void> {
  return client.writePoints(sampleData, { precision: 's' });
}
