import { expect } from 'chai';
import * as http from 'http';
import * as sinon from 'sinon';

import { ExponentialBackoff } from '../../src/backoff/exponential';
import { Pool, RequestError, ServiceNotAvailableError } from '../../src/pool';

const hosts = 2;

function parseJSON(res: http.IncomingMessage) {
    return new Promise(resolve => {
      let output = '';
      res.on('data', str => output = output + str.toString());
      res.on('end', () => resolve(JSON.parse(output)));
    });
}

describe('pool', () => {
  let pool: Pool;
  let clock: sinon.SinonFakeTimers;
  let server: http.Server;
  let sid: string; // random string to avoid conflicts with other running tests

  const createPool = () => {
    return  new Pool({
      backoff: new ExponentialBackoff({
        initial: 300,
        random: 0,
        max: 10 * 1000,
      }),
    });
  };

  beforeEach(done => {
    pool = createPool();

    sid = `${Date.now()}${Math.random()}`; // tslint:disable-line
    if (!process.env.WEBPACK) {
      const handler = require('../fixture/pool-middleware');
      server = http.createServer(handler());
      server.listen(0, () => {
        for (let i = 0; i < hosts; i += 1) {
          pool.addHost(`http://127.0.0.1:${server.address().port}`);
        }
        done();
      });
     } else {
      for (let i = 0; i < hosts; i += 1) {
        pool.addHost(location.origin);
      }
      done();
     }
  });

  afterEach(done => {
    if (clock) {
      clock.restore();
    }

    if (!process.env.WEBPACK) {
      server.close(() => done());
    } else {
      done();
    }
  });

  it('attempts to make an https request', () => {
    const p = createPool();
    p.addHost('https://httpbin.org/get');
    return p.discard({ method: 'GET', path: '/get' });
  });

  it('passes through request options', () => {
    const spy = sinon.spy(http, 'request');
    const p = createPool();
    p.addHost('https://httpbin.org/get', { rejectUnauthorized: false });

    return p.discard({ method: 'GET', path: '/get' }).then(() => {
      expect(spy.args[0][0].rejectUnauthorized).to.be.false;
    });
  });

  describe('request generators', () => {
    it('makes a text request', () => {
      return pool.stream({ method: 'GET', path: '/pool/json' })
        .then(parseJSON)
        .then(data => expect(data).to.deep.equal({ ok: true }));
    });

    it('includes request query strings and bodies', () => {
      return pool.stream({
        method: 'POST',
        path: '/pool/echo',
        query: { a: 42 },
        body: 'asdf',
      }).then(parseJSON)
        .then(data => {
          expect(data).to.deep.equal({
            query: 'a=42',
            body: 'asdf',
            method: 'POST',
          });
        });
    });

    it('discards responses', () => {
      return pool.discard({ method: 'GET', path: '/pool/204' });
    });
  });

  it('times out requests', () => {
    (<any> pool).timeout = 1;
    return pool.discard({ method: 'GET', path: '/pool/json' })
      .then(() => { throw new Error('Expected to have thrown'); })
      .catch(err => expect(err).be.an.instanceof(ServiceNotAvailableError))
      .then(() => (<any> pool).timeout = 10000);
  });

  it('retries on a request error', () => {
    return pool.stream({ method: 'GET', path: `/pool/altFail-${sid}/json` })
      .then(parseJSON)
      .then(body => expect(body).to.deep.equal({ ok: true }));
  });

  it('fails if too many errors happen', () => {
    expect(pool.hostIsAvailable()).to.be.true;

    return pool.discard({ method: 'GET', path: '/pool/502' })
      .then(() => { throw new Error('Expected to have thrown'); })
      .catch(err => {
        expect(err).to.be.an.instanceof(ServiceNotAvailableError);
        expect(pool.hostIsAvailable()).to.be.false;
      });
  });

  it('calls back immediately on un-retryable error', () => {
    return pool.discard({ method: 'GET', path: '/pool/400' })
      .then(() => { throw new Error('Expected to have thrown'); })
      .catch(err => {
        expect(err).to.be.an.instanceof(RequestError);
        expect((<RequestError> err).res.statusCode).to.equal(400);
        expect(pool.hostIsAvailable()).to.be.true;
      });
  });

  it('pings servers', () => {
    return pool.ping(1000, `/pool/altFail-${sid}/ping`).then(results => {
      if (results[0].online) {
        [results[0], results[1]] = [results[1], results[0]];
      }

      expect(results[0].online).to.be.false;
      expect(results[1].online).to.be.true;
      expect(results[1].version).to.equal('v1.0.0');
    });
  });

  it('times out in pings', () => {
    return pool.ping(1).then(results => {
      expect(results[0].online).to.be.false;
      expect(results[1].online).to.be.false;
    });
  });

  describe('backoff', () => {
    beforeEach(() => {
      clock = sinon.useFakeTimers();
      return pool.discard({ method: 'GET', path: '/pool/502' })
        .catch(() => { /* ignore */ });
    });

    it('should error if there are no available hosts', () => {
      return pool.discard({ method: 'GET', path: '/pool/json' })
        .then(() => { throw new Error('Expected to have thrown'); })
        .catch(err => {
          expect(err).to.be.an.instanceof(ServiceNotAvailableError);
          expect(err.message).to.equal('No host available');
        });
    });

    it('should reenable hosts after the backoff expires', () => {
      expect(pool.hostIsAvailable()).to.be.false;
      clock.tick(300);
      expect(pool.hostIsAvailable()).to.be.true;
    });

    it('should back off if failures continue', () => {
      clock.tick(300);
      expect(pool.hostIsAvailable()).to.be.true;

      return pool.discard({ method: 'GET', path: '/pool/502' })
        .then(() => { throw new Error('Expected to have thrown'); })
        .catch(err => {
          expect(err).to.be.an.instanceof(ServiceNotAvailableError);
          expect(pool.hostIsAvailable()).to.be.false;

          clock.tick(300);
          expect(pool.hostIsAvailable()).to.be.false;
          clock.tick(300);
          expect(pool.hostIsAvailable()).to.be.true;
        });
    });

    it('should reset backoff after success', () => {
      clock.tick(300);
      expect(pool.hostIsAvailable()).to.be.true;

      return pool.discard({ method: 'GET', path: '/pool/204' }).then(() => {
        return pool.discard({ method: 'GET', path: '/pool/502' });
      })
      .then(() => { throw new Error('Expected to have thrown'); })
      .catch(err => {
        expect(err).not.to.be.undefined;
        expect(pool.hostIsAvailable()).to.be.false;
        clock.tick(300);
        expect(pool.hostIsAvailable()).to.be.true;
      });
    });
  });
});
