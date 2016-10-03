import { ExponentialBackoff} from "../../src/backoff/exponential";
import { Pool, ServiceNotAvailableError, RequestError } from "../../src/pool";
import { expect } from "./helpers";

import * as http from "http";
import * as async from "async";
import * as sinon from "sinon";

describe('pool', () => {
  let pool: Pool
  let clock: sinon.SinonFakeTimers
  let servers: any[]

  beforeEach(done => {
    clock = sinon.useFakeTimers()
    pool = new Pool({
      backoff: new ExponentialBackoff({
        initial: 300,
        random: 0,
        max: 10 * 1000
      })
    });

    servers = []
    async.times(2, (i, done) => {
      const server = http.createServer((req, res) => server.onRequest(req, res))
      server.listen(0, () => {
        servers.push(server)
        pool.addHost(`http://127.0.0.1:${server.address().port}`)
        done(null, null)
      });
    }, done);
  });

  afterEach(done => {
    clock.restore()
    async.each(
      servers,
      (server, done) => server.close(() => done()),
      done
    );
  });

  describe('request generators', () => {
    it('makes a text request', () => {
      servers[0].onRequest = (req, res) => {
        expect(req.method).to.equal('GET')
        expect(req.url).to.equal('/foo')
        res.writeHead(200)
        res.end('ok')
      };

      return pool.text({ method: 'GET', path: '/foo' })
        .then(data => expect(data).to.equal('ok'));
    });

    it('includes request query strings and bodies', () => {
      servers[0].onRequest = (req, res) => {
        let data = '';
        req.on('data', chunk => {
          data += chunk.toString();
        });
        req.on('end', () => {
          expect(data).to.equal('asdf');
          expect(req.method).to.equal('POST');
          expect(req.url).to.equal('/bar?a=42');
          res.writeHead(200);
          res.end('ok');
        });
      };

      return pool.text({
        method: 'POST',
        path: '/bar',
        query: { a: 42 },
        body: 'asdf'
      }).then(data => expect(data).to.equal('ok'));
    });

    it('discards responses', () => {
      servers[0].onRequest = (req, res) => {
        res.writeHead(204);
        res.end();
      };

      return pool.discard({ method: 'GET', path: '/' });
    });

    it('parses JSON responses', () => {
      servers[0].onRequest = (req, res) => {
        res.writeHead(200);
        res.end('{"foo":42}');
      };

      return pool.json({ method: 'GET', path: '/' })
        .then(data => expect(data).to.deep.equal({ foo: 42 }));
    });

    it('errors if JSON parsing fails', () => {
      servers[0].onRequest = (req, res) => {
        res.writeHead(200);
        res.end('{');
      };

      return pool.json({ method: 'GET', path: '/' })
        .then(() => { throw new Error('Expected to have thrown'); })
        .catch(err => expect(err).to.be.an.instanceof(SyntaxError));
    });
  });

  it('round robins requests', done => {
    servers[0].onRequest = (req, res) => {
      res.writeHead(204)
      res.end()

      let served
      servers[1].onRequest = (req, res) => {
        served = true;
        res.writeHead(204);
        res.end();
      };


      pool.discard({ method: 'GET', path: '/' })
        .then(() => expect(served).to.be.true)
        .then(() => done())
        .catch(done);
    };

    return pool.discard({ method: 'GET', path: '/' });
  });

  it('times out requests', () => {
    clock.restore();

    servers.forEach(server => {
      server.onRequest = (req, res) => {
        setTimeout(() => {
          res.writeHead(204);
          res.end();
        }, 100);
      };
    });

    (<any> pool).timeout = 1;
    return pool.text({ method: 'GET', path: '/' })
      .then(() => { throw new Error('Expected to have thrown'); })
      .catch(err => expect(err).be.an.instanceof(ServiceNotAvailableError));
  });

  it('retries on a request error', () => {
    servers[0].onRequest = (req, res) => {
      res.writeHead(502);
      res.end();
    };
    servers[1].onRequest = (req, res) => {
      res.writeHead(200);
      res.end('ok now');
    };

    return pool.text({ method: 'GET', path: '/' })
      .then(body => expect(body).to.equal('ok now'));
  });

  it('fails if too many errors happen', () => {
    servers.forEach(server => {
      server.onRequest = (req, res) => {
        res.writeHead(502);
        res.end();
      };
    });

    expect(pool.hostIsAvailable()).to.be.true;

    return pool.discard({ method: 'GET', path: '/' })
      .then(() => { throw new Error('Expected to have thrown'); })
      .catch(err => {
        expect(err).to.be.an.instanceof(ServiceNotAvailableError);
        expect(pool.hostIsAvailable()).to.be.false;
      });
  });

  it('calls back immediately on un-retryable error', () => {
    servers[0].onRequest = (req, res) => {
      res.writeHead(400);
      res.end();
    };

    return pool.discard({ method: 'GET', path: '/' })
      .then(() => { throw new Error('Expected to have thrown'); })
      .catch(err => {
        expect(err).to.be.an.instanceof(RequestError);
        expect((<RequestError> err).res.statusCode).to.equal(400);
        expect(pool.hostIsAvailable()).to.be.true;
      });
  });

  it('gets enabled/disabled hosts', () => {
    const serverPorts = servers.map(s => s.address().port);
    expect(pool.getHostsAvailable()
      .map((h) => Number(h.url.port)))
      .to.deep.equal(serverPorts)
    expect(pool.getHostsDisabled().length).to.equal(0);

    servers[0].onRequest = (req, res) => {
      res.writeHead(502);
      res.end();
    };
    servers[1].onRequest = (req, res) => {
      res.writeHead(200);
      res.end('ok now');
    };

    return pool.discard({ method: 'GET', path: '/' }).then(() => {
      expect(pool.getHostsAvailable().map((h) => Number(h.url.port))).to.deep.equal([serverPorts[1]]);
      expect(pool.getHostsDisabled().map((h) => Number(h.url.port))).to.deep.equal([serverPorts[0]]);
    });
  });

  describe('backoff', () => {
    beforeEach(() => {
      servers.forEach(server => {
        server.onRequest = (req, res) => {
          res.writeHead(502);
          res.end();
        };
      });
      return pool.discard({ method: 'GET', path: '/' }).catch(() => {});
    });

    it('should error if there are no available hosts', () => {
      return pool.discard({ method: 'GET', path: '/' })
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

      return pool.discard({ method: 'GET', path: '/' })
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
      servers.forEach(server => {
        server.onRequest = (req, res) => {
          res.writeHead(200);
          res.end();
        };
      });

      return pool.discard({ method: 'GET', path: '/' }).then(() => {
        servers.forEach(server => {
          server.onRequest = (req, res) => {
            res.writeHead(502);
            res.end();
          };
        });

        return pool.discard({ method: 'GET', path: '/' });
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
