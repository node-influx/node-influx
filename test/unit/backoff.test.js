'use strict'

const Exp = require('../../lib/backoff/exponential').ExponentialBackoff

describe('backoff strategies', () => {
  describe('exponential strategy', () => {
    it('appears to work', () => {
      let exp = new Exp({
        initial: 500,
        random: 1,
        max: 5000
      })

      function next () {
        const value = exp.getDelay()
        exp = exp.next()
        return value
      }

      const checkSequence = () => {
        expect(next()).to.equal(500)
        expect(next()).to.be.oneOf([500, 1000])
        expect(next()).to.be.oneOf([1000, 2000])
        expect(next()).to.be.oneOf([2000, 4000])
        expect(next()).to.be.oneOf([4000, 5000])
        expect(next()).to.equal(5000)
      }

      checkSequence()
      exp = exp.reset()
      const dupe = exp.reset()
      checkSequence()
      exp = dupe
      checkSequence()
    })
  })
})
