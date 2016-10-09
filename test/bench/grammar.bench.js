'use strict'

const grammar = require('../../lib/src/grammar')
const escapeTables = require('../fixture/escapeTables')

suite('grammar: escape many replacements', () => {
  const escaper = grammar.escape.tag
  const re = s => s.replace(/[,= ]/g, '\\$&')

  escapeTables.tagEscaper.forEach(test => {
    bench(`escapes \`${test[0]}\` (sqlstring-esque)`, () => {
      escaper(test[0])
    })
    bench(`escapes \`${test[0]}\` (single-re)`, () => {
      re(test[0])
    })
  })
})

suite('grammar: escape single replacement', () => {
  const escaper = grammar.escape.quote
  const re = s => '"' + s.replace(/"/g, '\\$&') + '"'

  escapeTables.quoteEscaper.forEach(test => {
    bench(`escapes \`${test[0]}\` (sqlstring-esque)`, () => {
      escaper(test[0])
    })
    bench(`escapes \`${test[0]}\` (single-re)`, () => {
      re(test[0])
    })
  })
})
