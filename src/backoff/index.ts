import { ExponentialBackoff, ExponentialOptions } from "./exponential";
import { BackoffStrategy } from "./backoff";

let backoffs: { [propName: string]: (options: {}) => BackoffStrategy; } = {
  exponential: (options) => new ExponentialBackoff(<ExponentialOptions> options),
}

export default backoffs;
