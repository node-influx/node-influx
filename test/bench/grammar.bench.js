'use strict'

const grammar = require('../../lib/grammar')
const escapeTables = require('../fixture/escapeTables')

suite('grammar: escape many replacements', () => {
  const escaper = grammar.tagEscaper
  const re = s => s.replace(/[,= ]/g, '\\$&')

  escapeTables.tagEscaper.forEach(test => {
    bench(`escapes \`${test[0]}\` (sqlstring-esque)`, () => {
      escaper.escape(test[0])
    })
    bench(`escapes \`${test[0]}\` (single-re)`, () => {
      re(test[0])
    })
  })
})

suite('grammar: escape single replacement', () => {
  const escaper = grammar.quoteEscaper
  const re = s => '"' + s.replace(/"/g, '\\$&') + '"'

  escapeTables.quoteEscaper.forEach(test => {
    bench(`escapes \`${test[0]}\` (sqlstring-esque)`, () => {
      escaper.escape(test[0])
    })
    bench(`escapes \`${test[0]}\` (single-re)`, () => {
      re(test[0])
    })
  })
})
