import { BackoffStrategy } from "../../src/backoff/backoff";
import { ExponentialBackoff } from "../../src/backoff/exponential";
import { expect } from "chai";

describe("backoff strategies", () => {
  describe("exponential strategy", () => {
    it("appears to work", () => {
      let exp: BackoffStrategy = new ExponentialBackoff({
        initial: 500,
        max: 5000,
        random: 1,
      });

      function next () {
        const value = exp.getDelay();
        exp = exp.next();
        return value;
      }

      const checkSequence = () => {
        expect(next()).to.equal(500);
        expect(next()).to.be.oneOf([500, 1000])
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
