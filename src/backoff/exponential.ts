import { BackoffStrategy } from "./backoff";

/**
 * ExponentialOptions are passed into the ExponentialBackoff constructor. The
 * backoff equation is, in general, min(max, initial ^ n), where `n` is
 * an incremented backoff factor. The result of the equation is a delay
 * given in milliseconds.
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

export class ExponentialBackoff implements BackoffStrategy {

  private counter: number;

  /**
   * Creates a new exponential backoff strategy.
   * @see {@link https://en.wikipedia.org/wiki/Exponential_backoff}
   */
  constructor (protected options: ExponentialOptions) {
    this.counter = 0;
  }

  public getDelay(): number {
    const count = this.counter - Math.round(Math.random() * this.options.random);
    return Math.min(this.options.max, this.options.initial * Math.pow(2, Math.max(count, 0)));
  }

  public next(): BackoffStrategy {
    const next = new ExponentialBackoff(this.options);
    next.counter = this.counter + 1;
    return next;
  }

  public reset(): BackoffStrategy {
    return new ExponentialBackoff(this.options);
  }

}
