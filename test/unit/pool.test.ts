/* eslint-env node, browser, mocha */
/* eslint-disable no-unused-expressions */
/* eslint-disable @typescript-eslint/no-var-requires */

import { expect } from "chai";
import * as http from "http";
import * as sinon from "sinon";
import * as https from "https";

import { ExponentialBackoff } from "../../src/backoff/exponential";
import { IBackoffStrategy } from "../../src/backoff/backoff";
import { ConstantBackoff, IConstantOptions } from "../../src/backoff/constant";
import { Pool, RequestError, ServiceNotAvailableError } from "../../src/pool";

const hosts = 2;

describe("pool", () => {
  let pool: Pool;
  let clock: sinon.SinonFakeTimers;
  let server: http.Server;
  let sid: string; // Random string to avoid conflicts with other running tests

  const createPool = (backoff?: IBackoffStrategy): Pool => {
    return new Pool({
      backoff:
        backoff ||
        new ExponentialBackoff({
          initial: 300,
          random: 0,
          max: 10 * 1000,
        }),
    });
  };

  beforeEach((done) => {
    pool = createPool();

    sid = `${Date.now()}${Math.random()}`;
    if (process.env.WEBPACK) {
      for (let i = 0; i < hosts; i += 1) {
        pool.addHost(location.origin);
      }

      done();
    } else {
      const handler = require("../fixture/pool-middleware"); // eslint-disable-line @typescript-eslint/no-require-imports
      server = http.createServer(handler());
      server.listen(3005, () => {
        for (let i = 0; i < hosts; i += 1) {
          pool.addHost(`http://127.0.0.1:${3005}`);
        }

        done();
      });
    }
  });

  afterEach((done) => {
    if (clock) {
      clock.restore();
    }

    if (process.env.WEBPACK) {
      done();
    } else {
      server.close(() => done());
    }
  });

  it("attempts to make an https request", () => {
    const p = createPool();
    p.addHost("https://httpbin.org");
    return p.json({ method: "GET", path: "/get" });
  });

  it("passes through request options", () => {
    const spy = sinon.spy(https, "request");
    const p = createPool();
    p.addHost("https://httpbin.org", { rejectUnauthorized: false });

    return p.json({ method: "GET", path: "/get" }).then(() => {
      expect((spy.args[0][0] as any).rejectUnauthorized).to.be.false;
    });
  });

  it("valid request data content length", () => {
    const p = createPool();
    const body = "\u00FF";
    p.addHost("https://httpbin.org");
    p.json({ method: "POST", path: "/post", body: body }).then((data) =>
      expect(data.data).to.equal(body)
    );
  });

  it("handles unicode chunks correctly", () => {
    const p = createPool();
    const body = "درود".repeat(40960);
    p.addHost("https://httpbin.org");
    p.json({ method: "POST", path: "/post", body: body }).then((data) =>
      expect(data.data).to.equal(body)
    );
  });

  describe("request generators", () => {
    it("makes a text request", () => {
      return pool
        .text({ method: "GET", path: "/pool/json" })
        .then((data) => expect(data).to.equal('{"ok":true}'));
    });

    it("includes request query strings and bodies", () => {
      return pool
        .json({
          method: "POST",
          path: "/pool/echo",
          query: { a: 42 },
          body: "asdf",
        })
        .then((data) => {
          expect(data).to.deep.equal({
            query: "a=42",
            body: "asdf",
            method: "POST",
          });
        });
    });

    it("discards responses", () => {
      return pool.discard({ method: "GET", path: "/pool/204" });
    });

    it("parses JSON responses", () => {
      return pool
        .json({ method: "GET", path: "/pool/json" })
        .then((data) => expect(data).to.deep.equal({ ok: true }));
    });

    it("sends Basic Authorization header when auth is set", () => {
      const auth = "user:pass";
      const expected = Buffer.from(auth).toString("base64");
      return pool
        .json({ method: "GET", path: "/pool/echo-headers", auth })
        .then((data) => {
          expect(data.headers["authorization"]).to.equal(`Basic ${expected}`);
        });
    });

    it("errors if JSON parsing fails", () => {
      return pool
        .json({ method: "GET", path: "/pool/badjson" })
        .then(() => {
          throw new Error("Expected to have thrown");
        })
        .catch((err) => expect(err).to.be.an.instanceof(SyntaxError));
    });
  });

  it("times out requests", () => {
    (pool as any)._timeout = 1;
    return pool
      .text({ method: "GET", path: "/pool/wait-json" })
      .then(() => {
        throw new Error("Expected to have thrown");
      })
      .catch((err) => expect(err).be.an.instanceof(ServiceNotAvailableError))
      .then(() => {
        (pool as any)._timeout = 10000;
      });
  });

  it("retries on a request error", () => {
    return pool
      .text({ method: "GET", path: `/pool/altFail-${sid}/json` })
      .then((body) => expect(body).to.equal('{"ok":true}'));
  });

  it("fails if too many errors happen", () => {
    expect(pool.hostIsAvailable()).to.be.true;

    return pool
      .discard({ method: "GET", path: "/pool/502" })
      .then(() => {
        throw new Error("Expected to have thrown");
      })
      .catch((err) => {
        expect(err).to.be.an.instanceof(ServiceNotAvailableError);
        expect(pool.hostIsAvailable()).to.be.false;
      });
  });

  it("calls back immediately on un-retryable error", () => {
    return pool
      .discard({ method: "GET", path: "/pool/400" })
      .then(() => {
        throw new Error("Expected to have thrown");
      })
      .catch((err) => {
        expect(err).to.be.an.instanceof(RequestError);
        expect((err as RequestError).res.statusCode).to.equal(400);
        expect(pool.hostIsAvailable()).to.be.true;
      });
  });

  it("pings servers", () => {
    return pool.ping(1000, `/pool/altFail-${sid}/ping`).then((results) => {
      if (results[0].online) {
        [results[0], results[1]] = [results[1], results[0]];
      }

      expect(results[0].online).to.be.false;
      expect(results[1].online).to.be.true;
      expect(results[1].version).to.equal("v1.0.0");
    });
  });

  it("times out in pings", () => {
    return pool.ping(1).then((results) => {
      expect(results[0].online).to.be.false;
      expect(results[1].online).to.be.false;
    });
  });

  describe("backoff", () => {
    describe("exponential", () => {
      beforeEach(() => {
        clock = sinon.useFakeTimers();
        return pool.discard({ method: "GET", path: "/pool/502" }).catch(() => {
          /* ignore */
        });
      });

      it("should error if there are no available hosts", () => {
        return pool
          .discard({ method: "GET", path: "/pool/json" })
          .then(() => {
            throw new Error("Expected to have thrown");
          })
          .catch((err) => {
            expect(err).to.be.an.instanceof(ServiceNotAvailableError);
            expect(err.message).to.equal("No host available");
          });
      });

      it("should reenable hosts after the backoff expires", () => {
        expect(pool.hostIsAvailable()).to.be.false;
        clock.tick(300);
        expect(pool.hostIsAvailable()).to.be.true;
      });

      it("should back off if failures continue", () => {
        clock.tick(300);
        expect(pool.hostIsAvailable()).to.be.true;

        return pool
          .discard({ method: "GET", path: "/pool/502" })
          .then(() => {
            throw new Error("Expected to have thrown");
          })
          .catch((err) => {
            expect(err).to.be.an.instanceof(ServiceNotAvailableError);
            expect(pool.hostIsAvailable()).to.be.false;

            clock.tick(300);
            expect(pool.hostIsAvailable()).to.be.false;
            clock.tick(300);
            expect(pool.hostIsAvailable()).to.be.true;
          });
      });

      it("should reset backoff after success", () => {
        clock.tick(300);
        expect(pool.hostIsAvailable()).to.be.true;

        return pool
          .discard({ method: "GET", path: "/pool/204" })
          .then(() => {
            return pool.discard({ method: "GET", path: "/pool/502" });
          })
          .then(() => {
            throw new Error("Expected to have thrown");
          })
          .catch((err) => {
            expect(err).not.to.be.undefined;
            expect(pool.hostIsAvailable()).to.be.false;
            clock.tick(300);
            expect(pool.hostIsAvailable()).to.be.true;
          });
      });
    });

    describe("constant", () => {
      const createConstantBackoffPool = (options: IConstantOptions): Pool => {
        const p = createPool(new ConstantBackoff(options));

        for (let i = 0; i < hosts; i += 1) {
          p.addHost(
            process.env.WEBPACK ? location.origin : `http://127.0.0.1:${3005}`
          );
        }

        return p;
      };

      it("should disable hosts if backoff delay is greater than zero", () => {
        const p = createConstantBackoffPool({ delay: 300, jitter: 0 });

        return p
          .discard({ method: "GET", path: "/pool/502" })
          .then(() => {
            throw new Error("Expected to have thrown");
          })
          .catch((err) => {
            expect(err).to.be.an.instanceof(ServiceNotAvailableError);
            expect(err.message).to.equal("Bad Gateway");

            expect(p.getHostsDisabled().length).to.be.greaterThan(0);
          });
      });

      it("should not disable hosts if backoff delay is zero", () => {
        const p = createConstantBackoffPool({ delay: 0, jitter: 0 });

        return p
          .discard({ method: "GET", path: "/pool/502" })
          .then(() => {
            throw new Error("Expected to have thrown");
          })
          .catch((err) => {
            expect(err).to.be.an.instanceof(ServiceNotAvailableError);
            expect(err.message).to.equal("Bad Gateway");

            expect(p.getHostsDisabled().length).to.be.equal(0);
          });
      });
    });
  });
});
