import { IBackoffStrategy } from "./backoff";

/**
 * IConstantOptions are passed into the ConstantBackoff constructor. The
 * backoff equation is, the simplest possible, a constant delay with an
 * optional jitter, delay*(1-random_jitter) and delay*(1+random_jitter).
 *
 */
export interface IConstantOptions {
  /**
   * The constant delay passed to the equation.
   */
  delay: number;

  /**
   * Random factor between 0 and 1 to avoid the thundering herd problem.
   */
  jitter?: number;
}

/**
 * Constant Backoff
 */
export class ConstantBackoff implements IBackoffStrategy {
  protected options: IConstantOptions;

  /**
   * Creates a new constant backoff strategy.
   * @param options
   */
  constructor(options: IConstantOptions) {
    this.options = {
      delay: Math.max(options.delay, 0),
      jitter: Math.min(Math.max(options.jitter || 0, 0), 1),
    };
  }

  /**
   * @inheritDoc
   */
  public getDelay(): number {
    let delay: number = this.options.delay;

    if (this.options.jitter > 0) {
      const min = delay * (1 - this.options.jitter);
      const max = delay * (1 + this.options.jitter);
      delay = Math.random() * (max - min) + min;
    }

    return delay;
  }

  /**
   * @inheritDoc
   */
  public next(): IBackoffStrategy {
    return this;
  }

  /**
   * @inheritDoc
   */
  public reset(): IBackoffStrategy {
    return this;
  }
}
