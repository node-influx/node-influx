export interface BackoffStrategy {

  /**
   * Next increments the backoff counter and
   * returns the next backoff duration.
   * @return {Number} duration in milliseconds
   */
  next(): number;

  /**
   * Resets the backoff counter.
   */
  reset(): void;

}
