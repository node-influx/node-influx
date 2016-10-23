import { IBackoffStrategy } from './backoff';

/**
 * IExponentialOptions are passed into the ExponentialBackoff constructor. The
 * backoff equation is, in general, min(max, initial ^ n), where `n` is
 * an incremented backoff factor. The result of the equation is a delay
 * given in milliseconds.
 *
 * @typedef {Object} IExponentialOptions
 * @property {Number} initial The initial delay passed to the equation.
 * @property {Number} random Random factor to subtract from the `n` count.
 * @property {Number} max Max is the maximum value of the delay.
 */
export interface IExponentialOptions {

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
 * @implements {IBackoffStrategy}
 */
export class ExponentialBackoff implements IBackoffStrategy {

  private counter: number;

  /**
   * Creates a new exponential backoff strategy.
   * @see https://en.wikipedia.org/wiki/Exponential_backoff
   * @param {IExponentialOptions} options
   */
  constructor (protected options: IExponentialOptions) {
    this.counter = 0;
  }

  /**
   * @inheritDoc
   */
  public getDelay(): number {
    const count = this.counter - Math.round(Math.random() * this.options.random); // tslint:disable-line
    return Math.min(this.options.max, this.options.initial * Math.pow(2, Math.max(count, 0)));
  }

  /**
   * @inheritDoc
   */
  public next(): IBackoffStrategy {
    const next = new ExponentialBackoff(this.options);
    next.counter = this.counter + 1;
    return next;
  }

  /**
   * @inheritDoc
   */
  public reset(): IBackoffStrategy {
    return new ExponentialBackoff(this.options);
  }

}
