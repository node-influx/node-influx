'use strict'

const grammar = require('../../lib/grammar')
const escapeTables = require('./escapeTables.fixture')

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
})
