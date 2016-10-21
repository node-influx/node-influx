"use strict";
const exponential_1 = require("../../src/backoff/exponential");
const pool_1 = require("../../src/pool");
const chai_1 = require("chai");
const http = require("http");
const sinon = require("sinon");
const hosts = 2;
describe('pool', () => {
    let pool;
    let clock;
    let server;
    beforeEach(done => {
        pool = new pool_1.Pool({
            backoff: new exponential_1.ExponentialBackoff({
                initial: 300,
                random: 0,
                max: 10 * 1000
            })
        });
        if (!process.env.WEBPACK) {
            const handler = require('../fixture/pool-middleware');
            server = http.createServer(handler());
            server.listen(0, () => {
                for (let i = 0; i < hosts; i++) {
                    pool.addHost(`http://127.0.0.1:${server.address().port}`);
                }
                done();
            });
        }
        else {
            for (let i = 0; i < hosts; i++) {
                pool.addHost(`http://127.0.0.1:9876`);
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
        }
        else {
            done();
        }
    });
    describe('request generators', () => {
        it('makes a text request', () => {
            return pool.text({ method: 'GET', path: '/pool/json' })
                .then(data => chai_1.expect(data).to.equal('{"ok":true}'));
        });
        it('includes request query strings and bodies', () => {
            return pool.json({
                method: 'POST',
                path: '/pool/echo',
                query: { a: 42 },
                body: 'asdf'
            }).then(data => {
                chai_1.expect(data).to.deep.equal({
                    query: 'a=42',
                    body: 'asdf',
                    method: 'POST',
                });
            });
        });
        it('discards responses', () => {
            return pool.discard({ method: 'GET', path: '/pool/204' });
        });
        it('parses JSON responses', () => {
            return pool.json({ method: 'GET', path: '/pool/json' })
                .then(data => chai_1.expect(data).to.deep.equal({ ok: true }));
        });
        it('errors if JSON parsing fails', () => {
            return pool.json({ method: 'GET', path: '/pool/badjson' })
                .then(() => { throw new Error('Expected to have thrown'); })
                .catch(err => chai_1.expect(err).to.be.an.instanceof(SyntaxError));
        });
    });
    it('times out requests', () => {
        pool.timeout = 1;
        return pool.text({ method: 'GET', path: '/pool/json' })
            .then(() => { throw new Error('Expected to have thrown'); })
            .catch(err => chai_1.expect(err).be.an.instanceof(pool_1.ServiceNotAvailableError));
    });
    it('retries on a request error', () => {
        return pool.text({ method: 'GET', path: '/pool/failFirst/json' })
            .then(body => chai_1.expect(body).to.equal('{"ok":true}'));
    });
    it('fails if too many errors happen', () => {
        chai_1.expect(pool.hostIsAvailable()).to.be.true;
        return pool.discard({ method: 'GET', path: '/pool/502' })
            .then(() => { throw new Error('Expected to have thrown'); })
            .catch(err => {
            chai_1.expect(err).to.be.an.instanceof(pool_1.ServiceNotAvailableError);
            chai_1.expect(pool.hostIsAvailable()).to.be.false;
        });
    });
    it('calls back immediately on un-retryable error', () => {
        return pool.discard({ method: 'GET', path: '/pool/400' })
            .then(() => { throw new Error('Expected to have thrown'); })
            .catch(err => {
            chai_1.expect(err).to.be.an.instanceof(pool_1.RequestError);
            chai_1.expect(err.res.statusCode).to.equal(400);
            chai_1.expect(pool.hostIsAvailable()).to.be.true;
        });
    });
    it('pings servers', () => {
        return pool.ping(50).then(results => {
            chai_1.expect(results[0].online).to.be.false;
            chai_1.expect(results[1].online).to.be.true;
            chai_1.expect(results[1].version).to.equal('v1.0.0');
        });
    });
    it('times out in pings', () => {
        return pool.ping(1).then(results => {
            chai_1.expect(results[0].online).to.be.false;
            chai_1.expect(results[1].online).to.be.false;
        });
    });
    describe('backoff', () => {
        beforeEach(() => {
            clock = sinon.useFakeTimers();
            return pool.discard({ method: 'GET', path: '/pool/502' }).catch(() => { });
        });
        it('should error if there are no available hosts', () => {
            return pool.discard({ method: 'GET', path: '/pool/json' })
                .then(() => { throw new Error('Expected to have thrown'); })
                .catch(err => {
                chai_1.expect(err).to.be.an.instanceof(pool_1.ServiceNotAvailableError);
                chai_1.expect(err.message).to.equal('No host available');
            });
        });
        it('should reenable hosts after the backoff expires', () => {
            chai_1.expect(pool.hostIsAvailable()).to.be.false;
            clock.tick(300);
            chai_1.expect(pool.hostIsAvailable()).to.be.true;
        });
        it('should back off if failures continue', () => {
            clock.tick(300);
            chai_1.expect(pool.hostIsAvailable()).to.be.true;
            return pool.discard({ method: 'GET', path: '/pool/502' })
                .then(() => { throw new Error('Expected to have thrown'); })
                .catch(err => {
                chai_1.expect(err).to.be.an.instanceof(pool_1.ServiceNotAvailableError);
                chai_1.expect(pool.hostIsAvailable()).to.be.false;
                clock.tick(300);
                chai_1.expect(pool.hostIsAvailable()).to.be.false;
                clock.tick(300);
                chai_1.expect(pool.hostIsAvailable()).to.be.true;
            });
        });
        it('should reset backoff after success', () => {
            clock.tick(300);
            chai_1.expect(pool.hostIsAvailable()).to.be.true;
            return pool.discard({ method: 'GET', path: '/pool/204' }).then(() => {
                return pool.discard({ method: 'GET', path: '/pool/502' });
            })
                .then(() => { throw new Error('Expected to have thrown'); })
                .catch(err => {
                chai_1.expect(err).not.to.be.undefined;
                chai_1.expect(pool.hostIsAvailable()).to.be.false;
                clock.tick(300);
                chai_1.expect(pool.hostIsAvailable()).to.be.true;
            });
        });
    });
});
