const Base = require('../../lib/backoff/base')
const Exp = require('../../lib/backoff/exponential')
const pkg = require('../../lib/backoff')

describe('backoff strategies', () => {
  it('exposes backoff strategies in the index package', () => {
    expect(pkg.exponential).to.equal(Exp)
  })

  it('throws an error in base methods', () => {
    const base = new Base()
    expect(() => base.next()).to.throw(/not implemented/)
    expect(() => base.reset()).to.throw(/not implemented/)
  })

  describe('exponential strategy', () => {
    it('appears to work', () => {
      const exp = new Exp({
        initial: 500,
        random: 1,
        max: 5000
      })

      const checkSequence = () => {
        expect(exp.next()).to.equal(500)
        expect(exp.next()).to.be.oneOf([500, 1000])
        expect(exp.next()).to.be.oneOf([1000, 2000])
        expect(exp.next()).to.be.oneOf([2000, 4000])
        expect(exp.next()).to.be.oneOf([4000, 5000])
        expect(exp.next()).to.equal(5000)
      }

      checkSequence()
      exp.reset()
      checkSequence()
    })
  })
})
