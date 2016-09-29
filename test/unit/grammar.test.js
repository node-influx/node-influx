'use strict'

const grammar = require('../../lib/grammar')
const escapeTables = require('../fixture/escapeTables')

describe('grammar', () => {
  Object.keys(escapeTables).forEach(escaper => {
    describe(escaper, () => {
      escapeTables[escaper].forEach(test => {
        it(`escapes \`${test[0]}\` as \`${test[1]}\``, () => {
          expect(grammar[escaper].escape(test[0])).to.equal(test[1])
        })
      })
    })
  })

  it('formats dates correctly', () => {
    const d = new Date(1475121809184)
    expect(grammar.formatDate(d)).to.equal('"2016-08-04 04:03:29.184"')
    d.getMicrotime = () => 1841234567
    expect(grammar.formatDate(d)).to.equal('"2016-08-04 04:03:29.1841234567"')
  })
})
