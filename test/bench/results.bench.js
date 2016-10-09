'use strict'

const results = require('../../lib/src/results')
const _ = require('lodash')
const count = 1000

function parseOld (response) {
  let results = []
  _.each(response, function (result) {
    let tmp = []
    if (result.series) {
      _.each(result.series, function (series) {
        let rows = _.map(series.values, function (values) {
          return _.extend(_.zipObject(series.columns, values), series.tags)
        })
        tmp = _.chain(tmp).concat(rows).value()
      })
    }
    results.push(tmp)
  })
  return results
}

suite(`results: ${count} grouped results`, () => {
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
        [1474819971787272, 42],
        [1474821271999944, 44]
      ]
    })
  }

  const r = results.parse(grouped)
  bench('parsing', () => results.parse(grouped))
  bench('parsing (old)', () => parseOld(grouped.results))
  bench('computing groups', () => r.groups())
  bench('searching for present', () => r.group({ tag: `value${count - 1}` }))
  bench('searching for absent', () => r.group({ tag: 'a' }))
  bench('searching for wrong type', () => r.group({ tag2: 'a' }))
})

suite(`results: ${count} flat results`, () => {
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

  bench('parsing', () => results.parse(grouped))
  bench('parsing (old)', () => parseOld(grouped.results))
})
