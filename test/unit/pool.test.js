'use strict'

const ExponentialBackoff = require('../../lib/backoff/exponential').ExponentialBackoff
const Pool = require('../../lib/pool')
const sinon = require('sinon')
const http = require('http')
const async = require('async')

describe('pool', () => {

  let pool
  let request
  let clock
  let servers

  beforeEach(done => {
    clock = sinon.useFakeTimers()
    pool = new Pool.Pool({
      backoff: new ExponentialBackoff({
        initial: 300,
        random: 0,
        max: 10 * 1000
      })
    })

    servers = []
    async.times(2, (i, done) => {
      const server = http.createServer((req, res) => server.onRequest(req, res))
      server.listen(0, () => {
        servers.push(server)
        pool.addHost(`http://127.0.0.1:${server.address().port}`)
        done()
      })
    }, done)
  })

  afterEach(done => {
    clock.restore()
    async.each(
      servers,
      (server, done) => server.close(() => done()),
      done
    )
  })

  describe('request generators', () => {
    it('makes a text request', (done) => {
      servers[0].onRequest = (req, res) => {
        expect(req.method).to.equal('GET')
        expect(req.url).to.equal('/foo')
        res.writeHead(200)
        res.end('ok')
      }

      pool.text({ method: 'GET', path: '/foo' }, (err, data) => {
        expect(err).to.be.undefined
        expect(data).to.equal('ok')
        done()
      })
    })

    it('includes request query strings and bodies', (done) => {
      servers[0].onRequest = (req, res) => {
        let data = ''
        req.on('data', chunk => {
          data += chunk.toString()
        })
        req.on('end', () => {
          expect(data).to.equal('asdf')
          expect(req.method).to.equal('POST')
          expect(req.url).to.equal('/bar?a=42')
          res.writeHead(200)
          res.end('ok')
        })
      }

      pool.text({
        method: 'POST',
        path: '/bar',
        query: { a: 42 },
        body: 'asdf',
      }, (err, data) => {
        expect(err).to.be.undefined
        expect(data).to.equal('ok')
        done()
      })
    })

    it('discards responses', (done) => {
      servers[0].onRequest = (req, res) => {
        res.writeHead(204)
        res.end()
      }

      pool.discard({ method: 'GET', path: '/' }, (err) => {
        expect(err).to.be.undefined
        done()
      })
    })

    it('parses JSON responses', (done) => {
      servers[0].onRequest = (req, res) => {
        res.writeHead(200)
        res.end('{"foo":42}')
      }

      pool.json({ method: 'GET', path: '/' }, (err, data) => {
        expect(err).to.be.undefined
        expect(data).to.deep.equal({ foo: 42 })
        done()
      })
    })

    it('errors if JSON parsing fails', (done) => {
      servers[0].onRequest = (req, res) => {
        res.writeHead(200)
        res.end('{')
      }

      pool.json({ method: 'GET', path: '/' }, err => {
        expect(err).to.not.be.undefined
        done()
      })
    })

    describe('request source error handling', done => {
      const methods = ['json', 'text', 'discard'];
      beforeEach(done => {
        async.each(
          servers,
          (server, done) => server.close(done),
          done
        );
      })
      methods.forEach(method => {
        it(method, done => {
          pool[method]({ method: 'GET', path: '/' }, err => {
            expect(err).not.be.undefined
            done()
          })
        })
      })
    })
  })

  it('round robins requests', done => {
    servers[0].onRequest = (req, res) => {
      res.writeHead(204)
      res.end()

      let served
      servers[1].onRequest = (req, res) => {
        served = true
        res.writeHead(204)
        res.end()
      }

      pool.discard({ method: 'GET', path: '/' }, () => {
        expect(served).to.be.true
        done()
      })
    }

    pool.discard({ method: 'GET', path: '/' }, () => {
    })
  })

  it('times out requests', done => {
    clock.restore()

    servers.forEach(server => {
      server.onRequest = (req, res) => {
        setTimeout(() => {
          res.writeHead(204)
          res.end()
        }, 100)
      }
    })

    pool.timeout = 1
    pool.text({ method: 'GET', path: '/' }, err => {
      expect(err).be.an.instanceof(Pool.ServiceNotAvailableError)
      done()
    })
  })

  it('retries on a request error', (done) => {
    servers[0].onRequest = (req, res) => {
      res.writeHead(502)
      res.end()
    }
    servers[1].onRequest = (req, res) => {
      res.writeHead(200)
      res.end('ok now')
    }

    pool.text({ method: 'GET', path: '/' }, (err, body) => {
      expect(err).to.be.undefined
      expect(body).to.equal('ok now')
      done()
    })
  })

  it('fails if too many errors happen', (done) => {
    servers.forEach(server => {
      server.onRequest = (req, res) => {
        res.writeHead(502)
        res.end()
      }
    })

    expect(pool.hostIsAvailable()).to.be.true
    pool.discard({ method: 'GET', path: '/' }, (err) => {
      expect(err).to.be.an.instanceof(Pool.ServiceNotAvailableError)
      expect(pool.hostIsAvailable()).to.be.false
      done()
    })
  })

  it('calls back immediately on un-retryable error', (done) => {
    servers[0].onRequest = (req, res) => {
      res.writeHead(400)
      res.end()
    }

    pool.discard({ method: 'GET', path: '/' }, (err) => {
      expect(err).to.be.an.instanceof(Pool.RequestError)
      expect(err.res.statusCode).to.equal(400)
      expect(pool.hostIsAvailable()).to.be.true
      done()
    })
  })

  it('gets enabled/disabled hosts', done => {
    const serverPorts = servers.map(s => s.address().port)
    expect(pool.getHostsAvailable()
      .map((h) => Number(h.url.port)))
      .to.deep.equal(serverPorts)
    expect(pool.getHostsDisabled().length).to.equal(0)

    servers[0].onRequest = (req, res) => {
      res.writeHead(502)
      res.end()
    }
    servers[1].onRequest = (req, res) => {
      res.writeHead(200)
      res.end('ok now')
    }

    pool.discard({ method: 'GET', path: '/' }, () => {
      expect(pool.getHostsAvailable().map((h) => Number(h.url.port))).to.deep.equal([serverPorts[1]])
      expect(pool.getHostsDisabled().map((h) => Number(h.url.port))).to.deep.equal([serverPorts[0]])
      done()
    })
  })

  describe('backoff', () => {
    beforeEach(done => {
      servers.forEach(server => {
        server.onRequest = (req, res) => {
          res.writeHead(502)
          res.end()
        }
      })
      pool.discard({ method: 'GET', path: '/' }, () => done())
    })

    it('should error if there are no available hosts', (done) => {
      pool.discard({ method: 'GET', path: '/' }, (err) => {
        expect(err).to.be.an.instanceof(Pool.ServiceNotAvailableError)
        expect(err.message).to.equal('No host available')
        done()
      })
    })

    it('should reenable hosts after the backoff expires', () => {
      expect(pool.hostIsAvailable()).to.be.false
      clock.tick(300)
      expect(pool.hostIsAvailable()).to.be.true
    })

    it('should back off if failures continue', done => {
      clock.tick(300)
      expect(pool.hostIsAvailable()).to.be.true
      pool.discard({ method: 'GET', path: '/' }, () => {
        expect(pool.hostIsAvailable()).to.be.false

        clock.tick(300)
        expect(pool.hostIsAvailable()).to.be.false
        clock.tick(300)
        expect(pool.hostIsAvailable()).to.be.true
        done()
      })
    })

    it('should reset backoff after success', done => {
      clock.tick(300)
      expect(pool.hostIsAvailable()).to.be.true
      servers.forEach(server => {
        server.onRequest = (req, res) => {
          res.writeHead(200)
          res.end()
        }
      })

      pool.discard({ method: 'GET', path: '/' }, err => {
        expect(err).to.be.undefined

        servers.forEach(server => {
          server.onRequest = (req, res) => {
            res.writeHead(502)
            res.end()
          }
        })

        pool.discard({ method: 'GET', path: '/' }, err => {
          expect(pool.hostIsAvailable()).to.be.false
          clock.tick(300)
          expect(pool.hostIsAvailable()).to.be.true
          done()
        })
      })
    })
  })
})
