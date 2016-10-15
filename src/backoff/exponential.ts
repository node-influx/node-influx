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
export class ExponentialBackoff implements BackoffStrategy {

  private counter: number;

  /**
   * Creates a new exponential backoff strategy.
   * @see https://en.wikipedia.org/wiki/Exponential_backoff
   * @param {ExponentialOptions} options
   */
  constructor (protected options: ExponentialOptions) {
    this.counter = 0;
  }

  /**
   * @inheritDoc
   */
  public getDelay(): number {
    const count = this.counter - Math.round(Math.random() * this.options.random);
    return Math.min(this.options.max, this.options.initial * Math.pow(2, Math.max(count, 0)));
  }

  /**
   * @inheritDoc
   */
  public next(): BackoffStrategy {
    const next = new ExponentialBackoff(this.options);
    next.counter = this.counter + 1;
    return next;
  }

  /**
   * @inheritDoc
   */
  public reset(): BackoffStrategy {
    return new ExponentialBackoff(this.options);
  }

}
