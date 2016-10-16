import { InfluxDB } from '../../src';
import { newClient } from './helpers';
import { expect } from 'chai';

describe('administrative actions', () => {
  let db: InfluxDB;
  beforeEach(() => {
    return newClient().then(client => db = client);
  });

  describe('users', () => {
    const expectUser = (name: string, admin: boolean): Promise<void> => {
      return db.getUsers().then(users => expect(users).to.contain({ user: name, admin }));
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

    it('drops users', () => {
      return db.dropUser('connor')
        .then(() => db.getUsers())
        .then(users => expect(users.map(u => u.user)).not.to.contain('connor'))
    });
  });

  describe('retention policies', () => {
    const expectPolicy = (policy: any): Promise<void> => {
      return db.showRetentionPolicies()
        .then(rps => expect(rps).to.contain(policy));
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
        default: true,
      }).then(() => {
        expectPolicy({
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
        .then(rps => expect(rps.map(rp => rp.name)).to.not.contain('7d'))
    })
  });
});
