/// <reference types="node" />
import { BackoffStrategy } from "./backoff/backoff";
import * as urlModule from "url";
export declare class Host {
    private backoff;
    url: urlModule.Url;
    /**
     * Creates a new Host instance.
     * @param {String} url
     * @param {BackoffStrategy} backoff
     */
    constructor(url: string, backoff: BackoffStrategy);
    /**
     * Marks a failure on the host and returns the length of time it
     * should be removed from the pool
     * @return {Number} removal time in milliseconds
     */
    fail(): number;
    /**
     * Should be called when a successful operation is run against the host.
     * It resets the host's backoff strategy.
     */
    success(): void;
}
