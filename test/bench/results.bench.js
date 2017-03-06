'use strict'

const results = require('../../lib/src/results')
const helpers = require('../../lib/test/unit/helpers')
const count = 1000

suite(`(json) results: ${count} grouped results`, () => {
  const series = []
  const grouped = { results: [{ series }] }

  for (let i = 0; i < count; i++) {
    series.push({
      name: 'test_series',
      tags: { tag: `value${i}` },
      columns: [
        'time',
        'mean'
      ],
      values: [
        [14748199717, 42],
        [14748212719, 44]
      ]
    })
  }

  let r
  const incoming = helpers.fakeIncoming(grouped)
  before(next => {
    results.parse(incoming).then(data => {
      r = data
      next()
    })
  })

  bench('parsing ms', next => results.parse(incoming, 'ms').then(next))
  bench('parsing ns', next => results.parse(incoming, 'n').then(next))
  bench('computing groups', () => r.groups())
  bench('searching for present', () => r.group({ tag: `value${count - 1}` }))
  bench('searching for absent', () => r.group({ tag: 'a' }))
  bench('searching for wrong type', () => r.group({ tag2: 'a' }))
})

suite(`(json) results: ${count} flat results`, () => {
  const grouped = {
    results: [{
      series: [{
        name: 'test_series',
        columns: [
          'time',
          'mean'
        ],
        values: []
      }]
    }]
  }

  for (let i = 0; i < count; i++) {
    grouped.results[0].series[0].values.push([1474819971787272, 42])
  }

  const incoming = helpers.fakeIncoming(grouped)
  bench('parsing ms', next => results.parse(incoming, 'ms').then(next))
  bench('parsing ns', next => results.parse(incoming, 'n').then(next))
  bench('parsing (old)', () => parseOld(grouped.results))
})
