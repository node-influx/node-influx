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
