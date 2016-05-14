/* global describe, it, expect */

const Pool = require('../lib/pool')

describe('pool', function () {
  it('does something', function () {
    expect(new Pool()).to.be.an.instanceof(Pool)
  })
})
