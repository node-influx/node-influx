import { expect } from 'chai';

import { InfluxDB } from '../../src';
import { newClient } from './helpers';

describe('administrative actions', () => {
  let db: InfluxDB;
  beforeEach(() => {
    return newClient().then(client => db = client);
  });

  describe('users', () => {
    const expectUser = (name: string, admin: boolean): Promise<void> => {
      return db.getUsers()
        .then(users => expect(users).to.contain({ user: name, admin }))
        .then(() => undefined);
    };

    beforeEach(() => db.createUser('connor', 'foo', false));

    afterEach(() => db.dropUser('connor').catch(() => { /* noop */ }));

    it('creates users', () => expectUser('connor', false));

    it('grants admin privs', () => {
      return db.grantAdminPrivilege('connor')
        .then(() => expectUser('connor', true));
    });

    it('revokes admin privs', () => {
      return db.grantAdminPrivilege('connor')
        .then(() => db.revokeAdminPrivilege('connor'))
        .then(() => expectUser('connor', false));
    });

    it('grants specific privs', () => {
      return db.grantPrivilege('connor', 'READ'); // should not reject
    });

    it('drops users', () => {
      return db.dropUser('connor')
        .then(() => db.getUsers())
        .then(users => expect(users.map(u => u.user)).not.to.contain('connor'));
    });
  });

  describe('retention policies', () => {
    const expectPolicy = (policy: any): Promise<void> => {
      return db.showRetentionPolicies()
        .then(rps => expect(rps).to.contain(policy))
        .then(() => undefined);
    };

    beforeEach(() => {
      return db.createRetentionPolicy('7d', {
        duration: '7d',
        replication: 1,
      });
    });

    afterEach(() => db.dropRetentionPolicy('7d').catch(err => { /* noop */ }));

    it('creates policies', () => {
      return expectPolicy({
        default: false,
        duration: '168h0m0s',
        name: '7d',
        replicaN: 1,
        shardGroupDuration: '24h0m0s',
      });
    });

    it('alters policies', () => {
      return db.alterRetentionPolicy('7d', {
        duration: '7d',
        replication: 1,
        isDefault: true,
      }).then(() => {
        return expectPolicy({
          default: true,
          duration: '168h0m0s',
          name: '7d',
          replicaN: 1,
          shardGroupDuration: '24h0m0s',
        });
      });
    });

    it('drops policies', () => {
      return db.dropRetentionPolicy('7d')
        .then(() => db.showRetentionPolicies())
        .then(rps => expect(rps.map(rp => rp.name)).to.not.contain('7d'));
    });
  });

  describe('continuous queries', () => {
    const sampleQuery = 'SELECT MEAN(cpu) INTO "7d"."perf" FROM "1d"."perf" GROUP BY time(1m)';

    beforeEach(() => {
      return Promise.all([
        db.createRetentionPolicy('7d', {
          duration: '7d',
          replication: 1,
        }),
        db.createRetentionPolicy('1d', {
          duration: '1d',
          replication: 1,
        }),
      ]);
    });

    afterEach(() => {
      return Promise.all([
        db.dropRetentionPolicy('7d'),
        db.dropRetentionPolicy('1d'),
        db.dropContinuousQuery('7d_perf').catch(err => { /* noop */ }),
      ]);
    });

    it('creates continuous queries', () => {
      return db.createContinuousQuery('7d_perf', sampleQuery)
        .then(() => db.showContinousQueries())
        .then(queries => {
          expect(queries.slice()).to.deep.equal([
            { name: '7d_perf', query: 'CREATE CONTINUOUS QUERY "7d_perf" ON '
              + 'influx_test_db BEGIN SELECT mean(cpu) INTO influx_test_db."7d".perf '
              + 'FROM influx_test_db."1d".perf GROUP BY time(1m) END' },
          ]);
        });
    });

    it('drops continuous queries', () => {
      return db.createContinuousQuery('7d_perf', sampleQuery)
        .then(() => db.showContinousQueries())
        .then(() => db.dropContinuousQuery('7d_perf'))
        .then(() => db.showContinousQueries())
        .then(queries => expect(queries).to.have.length(0));
    });
  });
});
