import { BackoffStrategy } from "./backoff";
/**
 * ExponentialOptions are passed into the ExponentialBackoff constructor. The
 * backoff equation is, in general, min(max, initial ^ n), where `n` is
 * an incremented backoff factor. The result of the equation is a delay
 * given in milliseconds.
 *
 * @typedef {Object} ExponentialOptions
 * @property {Number} initial The initial delay passed to the equation.
 * @property {Number} random Random factor to subtract from the `n` count.
 * @property {Number} max Max is the maximum value of the delay.
 */
export interface ExponentialOptions {
    /**
     * The initial delay passed to the equation.
     */
    initial: number;
    /**
     * Random factor to subtract from the `n` count.
     */
    random: number;
    /**
     * max is the maximum value of the delay.
     */
    max: number;
}
/**
 * @class
 * @implements {BackoffStrategy}
 */
export declare class ExponentialBackoff implements BackoffStrategy {
    protected options: ExponentialOptions;
    private counter;
    /**
     * Creates a new exponential backoff strategy.
     * @see https://en.wikipedia.org/wiki/Exponential_backoff
     * @param {ExponentialOptions} options
     */
    constructor(options: ExponentialOptions);
    /**
     * @inheritDoc
     */
    getDelay(): number;
    /**
     * @inheritDoc
     */
    next(): BackoffStrategy;
    /**
     * @inheritDoc
     */
    reset(): BackoffStrategy;
}
