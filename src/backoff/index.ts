import { BackoffStrategy } from "./backoff";
import { ExponentialBackoff, ExponentialOptions } from "./exponential";

let backoffs: { [propName: string]: (options: {}) => BackoffStrategy; } = {
  exponential: (options) => new ExponentialBackoff(<ExponentialOptions> options),
};

export default backoffs;
