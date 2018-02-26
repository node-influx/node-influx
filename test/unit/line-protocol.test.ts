import { expect } from 'chai';

import { FieldType } from '../../src';
import { serializePoint } from '../../src/line-protocol';
import { Schema } from '../../src/schema';

describe('line-protocol', () => {
  describe('serializePoint', () => {
    it('serialises with defaults', () => {
      const point = {
        measurement: 'h2o_feet',
        tags: { location: 'coyote_creek' },
        fields: {
          water_level: '8.120',
          'level description': 'between 6 and 9 feet',
        },
        timestamp: new Date(1439856000 * 1000),
      };
      const line = serializePoint(point);

      expect(line).to.equal(
        'h2o_feet,location=coyote_creek level\\ description="between 6 and 9 feet",water_level="8.120" 1439856000000000000',
      );
    });

    it('serialises with custom precision', () => {
      const point = {
        measurement: 'h2o_feet',
        tags: { location: 'coyote_creek' },
        fields: {
          water_level: '8.120',
          'level description': 'between 6 and 9 feet',
        },
        timestamp: new Date(1439856000 * 1000),
      };
      const line = serializePoint(point, { precision: 's' });

      expect(line).to.equal(
        'h2o_feet,location=coyote_creek level\\ description="between 6 and 9 feet",water_level="8.120" 1439856000',
      );
    });

    it('serialises with custom schema', () => {
      const point = {
        measurement: 'my_schemed_measure',
        tags: { my_tag: '1' },
        fields: {
          int: 42,
          float: 43,
          bool: true,
        },
      };

      const measurementSchema = new Schema({
        database: 'my_db',
        measurement: 'h2o_feet',
        tags: ['my_tag'],
        fields: {
          int: FieldType.INTEGER,
          float: FieldType.FLOAT,
          string: FieldType.STRING,
          bool: FieldType.BOOLEAN,
        },
      });
      const line = serializePoint(point, {
        schema: { h2o_feet: measurementSchema },
      });

      expect(line).to.equal('my_schemed_measure,my_tag=1 bool=true,float=43,int=42');
    });
  });
});
