import { RequestOptions } from 'https';
import * as urlModule from 'url';

import { IBackoffStrategy } from './backoff/backoff';

export class Host {
  public readonly url: urlModule.Url;
  private backoff: IBackoffStrategy;
  public readonly options: RequestOptions;

  /**
   * Creates a new Host instance.
   * @param url
   * @param backoff
   */
  constructor(url: string, backoff: IBackoffStrategy, options: RequestOptions) {
    this.backoff = backoff;
    this.options = options;
    this.url = urlModule.parse(url);
  }

  /**
   * Marks a failure on the host and returns the length of time it
   * should be removed from the pool
   * @return removal time in milliseconds
   */
  public fail(): number {
    const value = this.backoff.getDelay();
    this.backoff = this.backoff.next();
    return value;
  }

  /**
   * Should be called when a successful operation is run against the host.
   * It resets the host's backoff strategy.
   */
  public success(): void {
    this.backoff = this.backoff.reset();
  }
}
