"use strict";
const urlModule = require("url");
class Host {
    /**
     * Creates a new Host instance.
     * @param {String} url
     * @param {BackoffStrategy} backoff
     */
    constructor(url, backoff) {
        this.backoff = backoff;
        this.url = urlModule.parse(url);
    }
    /**
     * Marks a failure on the host and returns the length of time it
     * should be removed from the pool
     * @return {Number} removal time in milliseconds
     */
    fail() {
        const value = this.backoff.getDelay();
        this.backoff = this.backoff.next();
        return value;
    }
    /**
     * Should be called when a successful operation is run against the host.
     * It resets the host's backoff strategy.
     */
    success() {
        this.backoff = this.backoff.reset();
    }
}
exports.Host = Host;
