'use strict'

class Host {

  /**
   * Creates a new Host instance.
   * @param  {String} url
   * @param {BackoffStrategy} backoff
   */
  constructor (url, backoff) {
    this.backoff = backoff
    this.url = url
  }

  /**
   * Marks a failure on the host and returns the length of time it
   * should be removed from the pool
   * @return {Number} removal time in milliseconds
   */
  backoff () {
    return this.backoff.next()
  }

  /**
   * Should be called when a successful operation is run against the host.
   * It resets the host's backoff strategy.
   */
  success () {
    this.backoff.reset()
  }
}

module.exports = Host
