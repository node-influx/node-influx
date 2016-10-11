export interface BackoffStrategy {

  /**
   * getDelay returns the amount of delay of the current backoff.
   */
  getDelay(): number;

  /**
   * Next is called when a failure occurs on a host to
   * return the next backoff amount.
   */
  next(): BackoffStrategy;

  /**
   * Returns a strategy with a reset backoff counter.
   */
  reset(): BackoffStrategy;

}


/**
 * @interface
 */
export class BackoffStrategy { // Purely for esdoc

  /**
   * getDelay returns the amount of delay of the current backoff.
   * @return {Number}
   */
  getDelay(): number { return 0; }

  /**
   * Next is called when a failure occurs on a host to
   * return the next backoff amount.
   * @return {BackoffStrategy}
   */
  next(): BackoffStrategy { return this; }

  /**
   * Returns a strategy with a reset backoff counter.
   * @return {BackoffStrategy}
   */
  reset(): BackoffStrategy { return this; }
}
