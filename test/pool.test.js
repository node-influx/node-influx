'use strict'

const Pool = require('../lib/pool')
const sinon = require('sinon')

describe('pool', () => {
  let pool
  let request
  let clock
  beforeEach(() => {
    request = sinon.stub()
    clock = sinon.useFakeTimers()
    pool = new Pool({
      request,
      backoff: {
        kind: 'exponential',
        initial: 300,
        random: 0,
        max: 10 * 1000
      }
    })

    for (let i = 0; i < 2; i++) {
      pool.addHost('127.0.0.1', 1000 + i, 'http')
    }
  })

  const resetRequest = () => {
    request = pool.options.request = sinon.stub()
    return request
  }

  afterEach(() => {
    clock.restore()
  })

  it('makes a GET request', (done) => {
    request.yields(undefined, { statusCode: 200 }, 'ok')
    pool.get({ uri: '/foo' }, (err, res, body) => {
      expect(err).to.be.undefined
      expect(res.statusCode).to.equal(200)
      expect(body).to.equal('ok')

      expect(request).to.have.been.calledWith({
        baseUrl: 'http://127.0.0.1:1000',
        uri: '/foo',
        retries: 1,
        timeout: 30000
      })
      done()
    })
  })

  it('makes a POST request', (done) => {
    request.yields(undefined, { statusCode: 200 }, 'ok')
    pool.post({ uri: '/foo' }, (err, res, body) => {
      expect(err).to.be.undefined
      expect(res.statusCode).to.equal(200)
      expect(body).to.equal('ok')

      expect(request).to.have.been.calledWithMatch({
        method: 'POST',
        uri: '/foo'
      })
      done()
    })
  })

  it('adjusts the request timeout', (done) => {
    pool.setRequestTimeout(1000)
    request.yields(undefined, { statusCode: 200 }, 'ok')
    pool.get({}, (err, res, body) => {
      expect(err).to.be.undefined
      expect(request).to.have.been.calledWithMatch({ timeout: 1000 })
      done()
    })
  })

  it('round robins requests', () => {
    pool.get({}, () => {
    })
    expect(request).to.have.been.calledWithMatch({ baseUrl: 'http://127.0.0.1:1000' })
    resetRequest()

    pool.get({}, () => {
    })
    expect(request).to.have.been.calledWithMatch({ baseUrl: 'http://127.0.0.1:1001' })
    resetRequest()

    pool.get({}, () => {
    })
    expect(request).to.have.been.calledWithMatch({ baseUrl: 'http://127.0.0.1:1000' })
  })

  it('retries on a request error', (done) => {
    request.onCall(0).yields(undefined, { statusCode: 502 })
    request.onCall(1).yields(undefined, { statusCode: 200 }, 'ok now')

    pool.get({}, (err, res, body) => {
      expect(err).to.be.undefined
      expect(body).to.equal('ok now')
      done()
    })
  })

  it('fails if too many errors happen', (done) => {
    request.yields(undefined, { statusCode: 502 })

    pool.get({}, (e, res, body) => {
      expect(e).to.be.an.instanceof(Pool.ServiceNotAvailableError)
      expect(pool.hostIsAvailable()).to.be.false
      done()
    })
  })

  it('calls back immediately on un-retryable error', (done) => {
    const err = new Error('oh no!')
    request.yields(err)

    pool.get({ url: '/foo' }, (e) => {
      expect(request).to.have.callCount(1)
      expect(e).to.equal(err)
      expect(pool.hostIsAvailable()).to.be.true
      done()
    })
  })

  it('gets enabled/disabled hosts', () => {
    expect(pool.getHostsAvailable().map((h) => h.url)).to.deep.equal([
      'http://127.0.0.1:1000',
      'http://127.0.0.1:1001'
    ])
    expect(pool.getHostsDisabled().length).to.equal(0)

    request.onCall(0).yields(undefined, { statusCode: 502 })
    request.onCall(1).yields(undefined, { statusCode: 200 }, 'ok now')

    pool.get({}, () => {
      expect(pool.getHostsAvailable().map((h) => h.url)).to.deep.equal(['http://127.0.0.1:1001'])
      expect(pool.getHostsDisabled().map((h) => h.url)).to.deep.equal(['http://127.0.0.1:1000'])
    })
  })

  describe('backoff', () => {
    beforeEach((done) => {
      // cause all hosts to be killed
      request.yields(undefined, { statusCode: 502 })
      pool.get({}, () => done())
    })

    it('should error if there are no available hosts', (done) => {
      pool.get({}, (err) => {
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

    it('should back off is failures continue', () => {
      clock.tick(300)
      expect(pool.hostIsAvailable()).to.be.true
      pool.get({}, () => {
      })
      expect(pool.hostIsAvailable()).to.be.false

      clock.tick(300)
      expect(pool.hostIsAvailable()).to.be.false
      clock.tick(300)
      expect(pool.hostIsAvailable()).to.be.true
    })

    it('should reset backoff after success', () => {
      clock.tick(300)
      expect(pool.hostIsAvailable()).to.be.true
      resetRequest().yields(undefined, { statusCode: 200 })
      pool.get({}, () => {
      })

      resetRequest().yields(undefined, { statusCode: 502 })
      pool.get({}, () => {
      })
      expect(pool.hostIsAvailable()).to.be.false
      clock.tick(300)
      expect(pool.hostIsAvailable()).to.be.true
    })
  })
})
