'use strict'

/**
 * @interface
 */
class BackoffStrategy {

  /**
   * Next increments the backoff counter and
   * returns the next backoff duration.
   * @return {Number} duration in milliseconds
   */
  next () {
    throw new Error('not implemented')
  }

  /**
   * Resets the backoff counter.
   */
  reset () {
    throw new Error('not implemented')
  }
}

module.exports = BackoffStrategy
