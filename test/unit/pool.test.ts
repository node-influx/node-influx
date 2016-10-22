import { ExponentialBackoff } from "../../src/backoff/exponential";
import { Host } from "../../src/host";
import { Pool, ServiceNotAvailableError, RequestError } from "../../src/pool";
import { expect } from "chai";

import * as http from "http";
import * as sinon from "sinon";

const hosts = 2;

describe('pool', () => {
  let pool: Pool
  let clock: sinon.SinonFakeTimers
  let server: http.Server
  let sid: string // random string to avoid conflicts with other running tests

  const createPool = () => {
    return  new Pool({
      backoff: new ExponentialBackoff({
        initial: 300,
        random: 0,
        max: 10 * 1000
      })
    });
  };

  beforeEach(done => {
    pool = createPool();

    sid = `${Date.now()}${Math.random()}`
    if (!process.env.WEBPACK) {
      const handler = require('../fixture/pool-middleware');
      server = http.createServer(handler())
      server.listen(0, () => {
        for (let i = 0; i < hosts; i++) {
          pool.addHost(`http://127.0.0.1:${server.address().port}`)
        }
        done()
      });
     } else {
      for (let i = 0; i < hosts; i++) {
        pool.addHost(location.origin)
      }
      done()
     }
  });

  afterEach(done => {
    if (clock) {
      clock.restore()
    }

    if (!process.env.WEBPACK) {
      server.close(() => done())
    } else {
      done()
    }
  });

  it('attempts to make an https request', () => {
    const pool = createPool();
    pool.addHost('https://httpbin.org/get');
    return pool.json({ method: 'GET', path: '/get' });
  });

  describe('request generators', () => {
    it('makes a text request', () => {
      return pool.text({ method: 'GET', path: '/pool/json' })
        .then(data => expect(data).to.equal('{"ok":true}'));
    });

    it('includes request query strings and bodies', () => {
      return pool.json({
        method: 'POST',
        path: '/pool/echo',
        query: { a: 42 },
        body: 'asdf'
      }).then(data => {
        expect(data).to.deep.equal({
          query: 'a=42',
          body: 'asdf',
          method: 'POST',
        })
      });
    });

    it('discards responses', () => {
      return pool.discard({ method: 'GET', path: '/pool/204' });
    });

    it('parses JSON responses', () => {
      return pool.json({ method: 'GET', path: '/pool/json' })
        .then(data => expect(data).to.deep.equal({ ok: true }));
    });

    it('errors if JSON parsing fails', () => {
      return pool.json({ method: 'GET', path: '/pool/badjson' })
        .then(() => { throw new Error('Expected to have thrown'); })
        .catch(err => expect(err).to.be.an.instanceof(SyntaxError));
    });
  });

  it('times out requests', () => {
    (<any> pool).timeout = 1;
    return pool.text({ method: 'GET', path: '/pool/json' })
      .then(() => { throw new Error('Expected to have thrown'); })
      .catch(err => expect(err).be.an.instanceof(ServiceNotAvailableError))
      .then(() => (<any> pool).timeout = 10000);
  });

  it('retries on a request error', () => {
    return pool.text({ method: 'GET', path: `/pool/altFail-${sid}/json` })
      .then(body => expect(body).to.equal('{"ok":true}'));
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
      clock = sinon.useFakeTimers()
      return pool.discard({ method: 'GET', path: '/pool/502' }).catch(() => {});
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
