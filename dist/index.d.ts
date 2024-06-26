export { expect } from '@playwright/test';
import { ZodTypeAny } from 'zod';
declare global {
    interface Window {
        dataLayer: DatalayerMessage[];
        dlTransfer: (arg0: DatalayerMessage) => void;
    }
}
export type GAHitMessage = string;
export type DatalayerMessage = Record<string, any>;
type WaitForGAMessageOptionsRegex = {
    timeout: number;
    timeoutMessage?: string;
    regex: RegExp;
};
type WaitForGAMessageOptionsPredicate = {
    timeout: number;
    timeoutMessage?: string;
    predicate: (msg: GAHitMessage) => boolean;
};
type WaitForGAMessageOptions = WaitForGAMessageOptionsRegex | WaitForGAMessageOptionsPredicate;
type WaitForDatalayerMessageOptionsMatchObject = {
    timeout: number;
    timeoutMessage?: string;
    matchObject: DatalayerMessage;
};
type WaitForDatalayerMessageOptionsPredicate = {
    timeout: number;
    timeoutMessage?: string;
    predicate: (msg: DatalayerMessage) => boolean;
};
type WaitForDatalayerMessageOptionsZodMatchObject = {
    timeout: number;
    timeoutMessage?: string;
    matchZodObject: ZodTypeAny;
};
type WaitForDatalayerMessageOptions = WaitForDatalayerMessageOptionsMatchObject | WaitForDatalayerMessageOptionsPredicate | WaitForDatalayerMessageOptionsZodMatchObject;
type Subscriber<TMessage> = (msg: TMessage) => void;
/**
 * Utilizes the Observer Pattern, where the [Page](https://playwright.dev/docs/api/class-page)
 * is the producer and the Node Playwright Test is the consumer. Every time the Page produces
 * a message (window.dataLayer.push, or GA-Universal/GA4 network request), the consumer's
 * subscribers callbacks are called.
 */
declare class PubSub<TMessage extends DatalayerMessage | GAHitMessage, TWaitForMessageOptions extends WaitForDatalayerMessageOptions | WaitForGAMessageOptions> {
    private subscribers;
    messages: TMessage[];
    constructor();
    /**
     * Subscribe for messages. Called by the consumer.
     *
     * @param subscriber callback function to be executed once the message arrives
     */
    subscribe(subscriber: Subscriber<TMessage>): void;
    /**
     * Unsubscribe from messages. Called by the consumer.
     *
     * @param subscriber reference to a callback function previously subscribed
     */
    unsubscribe(subscriber: Subscriber<TMessage>): void;
    /**
     * Publish messages. Called by the producer.
     *
     * @param message message published.
     */
    publish(message: TMessage): void;
    /**
     * Returns a promise that will be resolved when a message matching `TWaitForMessageOptions` is found,
     * or rejected if `TWaitForMessageOptions.timeout` is reached. Called by the consumer.
     *
     * @return message published.
     */
    waitForMessage(config: TWaitForMessageOptions): Promise<TMessage>;
}
type PageFixtures = {
    collects_ga3: PubSub<GAHitMessage, WaitForGAMessageOptions>;
    collects_ga4: PubSub<GAHitMessage, WaitForGAMessageOptions>;
    dataLayer: PubSub<DatalayerMessage, WaitForDatalayerMessageOptions>;
};
export type FixturesOptions = {
    /**
     * Regex that matches a GA4 hit. Default: /(?<!kwai.*)google.*collect\\?v=2/
     */
    ga4HitRegex: RegExp;
    /**
     * Regex that matches a GA3 hit. Default: /(?<!kwai.*)google.*collect(?!\\?v=2)/
     */
    ga3HitRegex: RegExp;
};
export declare const test: import("@playwright/test").TestType<import("@playwright/test").PlaywrightTestArgs & import("@playwright/test").PlaywrightTestOptions & PageFixtures & FixturesOptions, import("@playwright/test").PlaywrightWorkerArgs & import("@playwright/test").PlaywrightWorkerOptions>;
