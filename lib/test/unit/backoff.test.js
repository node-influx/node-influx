"use strict";
const exponential_1 = require("../../src/backoff/exponential");
const chai_1 = require("chai");
describe("backoff strategies", () => {
    describe("exponential strategy", () => {
        it("appears to work", () => {
            let exp = new exponential_1.ExponentialBackoff({
                initial: 500,
                max: 5000,
                random: 1,
            });
            function next() {
                const value = exp.getDelay();
                exp = exp.next();
                return value;
            }
            const checkSequence = () => {
                chai_1.expect(next()).to.equal(500);
                chai_1.expect(next()).to.be.oneOf([500, 1000]);
                chai_1.expect(next()).to.be.oneOf([1000, 2000]);
                chai_1.expect(next()).to.be.oneOf([2000, 4000]);
                chai_1.expect(next()).to.be.oneOf([4000, 5000]);
                chai_1.expect(next()).to.equal(5000);
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
