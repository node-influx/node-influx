"use strict";
const exponential_1 = require("../../src/backoff/exponential");
const pool_1 = require("../../src/pool");
const helpers_1 = require("./helpers");
const http = require("http");
const async = require("async");
const sinon = require("sinon");
describe('pool', () => {
    let pool;
    let clock;
    let servers;
    beforeEach(done => {
        clock = sinon.useFakeTimers();
        pool = new pool_1.Pool({
            backoff: new exponential_1.ExponentialBackoff({
                initial: 300,
                random: 0,
                max: 10 * 1000
            })
        });
        servers = [];
        async.times(2, (i, done) => {
            const server = http.createServer((req, res) => server.onRequest(req, res));
            server.listen(0, () => {
                servers.push(server);
                pool.addHost(`http://127.0.0.1:${server.address().port}`);
                done(null, null);
            });
        }, done);
    });
    afterEach(done => {
        if (clock) {
            clock.restore();
        }
        async.each(servers, (server, done) => server.close(() => done()), done);
    });
    describe('request generators', () => {
        it('makes a text request', () => {
            servers[0].onRequest = (req, res) => {
                helpers_1.expect(req.method).to.equal('GET');
                helpers_1.expect(req.url).to.equal('/foo');
                res.writeHead(200);
                res.end('ok');
            };
            return pool.text({ method: 'GET', path: '/foo' })
                .then(data => helpers_1.expect(data).to.equal('ok'));
        });
        it('includes request query strings and bodies', () => {
            servers[0].onRequest = (req, res) => {
                let data = '';
                req.on('data', chunk => {
                    data += chunk.toString();
                });
                req.on('end', () => {
                    helpers_1.expect(data).to.equal('asdf');
                    helpers_1.expect(req.method).to.equal('POST');
                    helpers_1.expect(req.url).to.equal('/bar?a=42');
                    res.writeHead(200);
                    res.end('ok');
                });
            };
            return pool.text({
                method: 'POST',
                path: '/bar',
                query: { a: 42 },
                body: 'asdf'
            }).then(data => helpers_1.expect(data).to.equal('ok'));
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
                .then(data => helpers_1.expect(data).to.deep.equal({ foo: 42 }));
        });
        it('errors if JSON parsing fails', () => {
            servers[0].onRequest = (req, res) => {
                res.writeHead(200);
                res.end('{');
            };
            return pool.json({ method: 'GET', path: '/' })
                .then(() => { throw new Error('Expected to have thrown'); })
                .catch(err => helpers_1.expect(err).to.be.an.instanceof(SyntaxError));
        });
    });
    it('round robins requests', done => {
        servers[0].onRequest = (req, res) => {
            res.writeHead(204);
            res.end();
            let served;
            servers[1].onRequest = (req, res) => {
                served = true;
                res.writeHead(204);
                res.end();
            };
            pool.discard({ method: 'GET', path: '/' })
                .then(() => helpers_1.expect(served).to.be.true)
                .then(() => done())
                .catch(done);
        };
        pool.discard({ method: 'GET', path: '/' });
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
        pool.timeout = 1;
        return pool.text({ method: 'GET', path: '/' })
            .then(() => { throw new Error('Expected to have thrown'); })
            .catch(err => helpers_1.expect(err).be.an.instanceof(pool_1.ServiceNotAvailableError));
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
            .then(body => helpers_1.expect(body).to.equal('ok now'));
    });
    it('fails if too many errors happen', () => {
        servers.forEach(server => {
            server.onRequest = (req, res) => {
                res.writeHead(502);
                res.end();
            };
        });
        helpers_1.expect(pool.hostIsAvailable()).to.be.true;
        return pool.discard({ method: 'GET', path: '/' })
            .then(() => { throw new Error('Expected to have thrown'); })
            .catch(err => {
            helpers_1.expect(err).to.be.an.instanceof(pool_1.ServiceNotAvailableError);
            helpers_1.expect(pool.hostIsAvailable()).to.be.false;
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
            helpers_1.expect(err).to.be.an.instanceof(pool_1.RequestError);
            helpers_1.expect(err.res.statusCode).to.equal(400);
            helpers_1.expect(pool.hostIsAvailable()).to.be.true;
        });
    });
    it('gets enabled/disabled hosts', () => {
        const serverPorts = servers.map(s => s.address().port);
        helpers_1.expect(pool.getHostsAvailable()
            .map((h) => Number(h.url.port)))
            .to.deep.equal(serverPorts);
        helpers_1.expect(pool.getHostsDisabled().length).to.equal(0);
        servers[0].onRequest = (req, res) => {
            res.writeHead(502);
            res.end();
        };
        servers[1].onRequest = (req, res) => {
            res.writeHead(200);
            res.end('ok now');
        };
        return pool.discard({ method: 'GET', path: '/' }).then(() => {
            helpers_1.expect(pool.getHostsAvailable().map((h) => Number(h.url.port))).to.deep.equal([serverPorts[1]]);
            helpers_1.expect(pool.getHostsDisabled().map((h) => Number(h.url.port))).to.deep.equal([serverPorts[0]]);
        });
    });
    it('pings servers', () => {
        servers[0].onRequest = (req, res) => {
            res.setHeader('X-Influxdb-Version', 'v1.0.0');
            res.writeHead(200);
            res.end();
        };
        servers[1].onRequest = (req, res) => {
            res.writeHead(500);
            res.end();
        };
        return pool.ping(50).then(results => {
            helpers_1.expect(results[0].online).to.be.true;
            helpers_1.expect(results[0].version).to.equal('v1.0.0');
            helpers_1.expect(results[1].online).to.be.false;
        });
    });
    it('times out in pings', () => {
        clock.restore();
        clock = null;
        servers.forEach(server => {
            server.onRequest = (req, res) => {
                setTimeout(() => {
                    res.writeHead(200);
                    res.end();
                }, 2);
            };
        });
        return pool.ping(1).then(results => {
            helpers_1.expect(results[0].online).to.be.false;
            helpers_1.expect(results[1].online).to.be.false;
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
            return pool.discard({ method: 'GET', path: '/' }).catch(() => { });
        });
        it('should error if there are no available hosts', () => {
            return pool.discard({ method: 'GET', path: '/' })
                .then(() => { throw new Error('Expected to have thrown'); })
                .catch(err => {
                helpers_1.expect(err).to.be.an.instanceof(pool_1.ServiceNotAvailableError);
                helpers_1.expect(err.message).to.equal('No host available');
            });
        });
        it('should reenable hosts after the backoff expires', () => {
            helpers_1.expect(pool.hostIsAvailable()).to.be.false;
            clock.tick(300);
            helpers_1.expect(pool.hostIsAvailable()).to.be.true;
        });
        it('should back off if failures continue', () => {
            clock.tick(300);
            helpers_1.expect(pool.hostIsAvailable()).to.be.true;
            return pool.discard({ method: 'GET', path: '/' })
                .then(() => { throw new Error('Expected to have thrown'); })
                .catch(err => {
                helpers_1.expect(err).to.be.an.instanceof(pool_1.ServiceNotAvailableError);
                helpers_1.expect(pool.hostIsAvailable()).to.be.false;
                clock.tick(300);
                helpers_1.expect(pool.hostIsAvailable()).to.be.false;
                clock.tick(300);
                helpers_1.expect(pool.hostIsAvailable()).to.be.true;
            });
        });
        it('should reset backoff after success', () => {
            clock.tick(300);
            helpers_1.expect(pool.hostIsAvailable()).to.be.true;
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
                helpers_1.expect(err).not.to.be.undefined;
                helpers_1.expect(pool.hostIsAvailable()).to.be.false;
                clock.tick(300);
                helpers_1.expect(pool.hostIsAvailable()).to.be.true;
            });
        });
    });
});
