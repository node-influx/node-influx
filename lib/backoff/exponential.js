'use strict'

const Base = require('./base')

class ExponentialBackoff extends Base {

  /**
   * Creates a new exponential backoff strategy.
   *
   * @param {Object} options
   * @param {Object} options.initial initial base delay
   * @param {Object} options.random random maximum amount to subtract from
   * the counter when returning the next delay
   * @param {Object} options.max maximum delay time after which
   * the counter will reset
   * @see {@link https://en.wikipedia.org/wiki/Exponential_backoff}
   */
  constructor (options) {
    super()
    this.counter = 0
    this.initial = options.initial
    this.random = options.random
    this.max = options.max
  }

  next () {
    const count = (this.counter++) - Math.round(Math.random() * this.random)
    return Math.min(this.max, this.initial * (1 << Math.max(count, 0)))
  }

  reset () {
    this.counter = 0
  }
}

module.exports = ExponentialBackoff
