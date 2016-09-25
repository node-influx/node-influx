'use strict'

const Results = require('../../lib/results').Results
const count = 10000

suite(`results: ${count} grouped results`, () => {
  const series = []
  const grouped = { results: [{ series }] }

  for (let i = 0; i < count; i++) {
    series.push({
      name: 'test_series',
      tags: { tag: `value${i}` },
      columns: [
        'time',
        'mean',
      ],
      values: [
        [1474819971787272, 42],
        [1474821271999944, 44],
      ],
    })
  }

  const r = Results.parse(grouped)
  bench('parsing', () => Results.parse(grouped))
  bench('getting all groups', () => r.groups())
  bench('searching for present', () => r.group({ tag: `value${count - 1}` }))
  bench('searching for absent', () => r.group({ tag: `a` }))
  bench('searching for wrong type', () => r.group({ tag2: `a` }))
})

suite(`results: ${count} flat results`, () => {
  const series = []
  const grouped = {
    results: [{
      series: [{
        name: 'test_series',
        columns: [
          'time',
          'mean',
        ],
        values: []
      }]
    }]
  }

  for (let i = 0; i < count; i++) {
    grouped.results[0].series[0].values.push([1474819971787272, 42])
  }

  bench('parsing', () => Results.parse(grouped))
})
