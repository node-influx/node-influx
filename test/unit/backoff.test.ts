/* eslint-env node, mocha */

import { expect } from "chai";

import { IBackoffStrategy } from "../../src/backoff/backoff";
import { ConstantBackoff } from "../../src/backoff/constant";
import { ExponentialBackoff } from "../../src/backoff/exponential";

describe("backoff strategies", () => {
  describe("constant strategy", () => {
    it("appears to work", () => {
      let exp: IBackoffStrategy = new ConstantBackoff({
        delay: 500,
        jitter: 0.5,
      });

      function next(): number {
        const value = exp.getDelay();
        exp = exp.next();
        return value;
      }

      const checkSequence = (): void => {
        expect(next()).to.be.within(500 * (1 - 0.5), 500 * (1 + 0.5));
        expect(next()).to.be.within(500 * (1 - 0.5), 500 * (1 + 0.5));
        expect(next()).to.be.within(500 * (1 - 0.5), 500 * (1 + 0.5));
        expect(next()).to.be.within(500 * (1 - 0.5), 500 * (1 + 0.5));
        expect(next()).to.be.within(500 * (1 - 0.5), 500 * (1 + 0.5));
        expect(next()).to.be.within(500 * (1 - 0.5), 500 * (1 + 0.5));
      };

      checkSequence();
      exp = exp.reset();
      const dupe = exp.reset();
      checkSequence();
      exp = dupe;
      checkSequence();
    });
  });

  describe("exponential strategy", () => {
    it("appears to work", () => {
      let exp: IBackoffStrategy = new ExponentialBackoff({
        initial: 500,
        max: 5000,
        random: 1,
      });

      function next(): number {
        const value = exp.getDelay();
        exp = exp.next();
        return value;
      }

      const checkSequence = (): void => {
        expect(next()).to.equal(500);
        expect(next()).to.be.oneOf([500, 1000]);
        expect(next()).to.be.oneOf([1000, 2000]);
        expect(next()).to.be.oneOf([2000, 4000]);
        expect(next()).to.be.oneOf([4000, 5000]);
        expect(next()).to.equal(5000);
      };

      checkSequence();
      exp = exp.reset();
      const dupe = exp.reset();
      checkSequence();
      exp = dupe;
      checkSequence();
    });
  });
});
