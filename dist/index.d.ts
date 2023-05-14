declare global {
    interface Window {
        dataLayer: Record<string, unknown>[];
        dlTransfer: Function;
    }
    type Message = string | Record<string, unknown>;
    type WaitForMessageOptions = {
        timeout?: number;
        regex?: RegExp;
        matchObject?: never;
    } | {
        timeout?: number;
        matchObject?: Record<string, unknown>;
        regex?: never;
    };
}
/**
 * Utilizes the Observer Pattern, where the [Page](https://playwright.dev/docs/api/class-page)
 * is the producer and the Node Playwright Test is the consumer. Every time the Page produces
 * a message (window.dataLayer.push, or GA-Universal/GA4 network request), the consumer's
 * subscribers callbacks are called.
 *
 * @class PubSub
 */
declare class PubSub {
    #private;
    messages: Message[];
    /**
     * Subscribe for messages. Used by the consumer.
     *
     * @param {Function} subscriber callback function to be executed once the message arrives
     * @memberof PubSub
     */
    subscribe(subscriber: Function): void;
    /**
     * Unsubscribe from messages. Used by the consumer.
     *
     * @param {Function} subscriber reference to a callback function previously subscribed
     * @memberof PubSub
     */
    unsubscribe(subscriber: Function): void;
    /**
     * Publish messages. Used by the producer.
     *
     * @param {Message} message message published.
     * @memberof PubSub
     */
    publish(message: Message): void;
    /**
     * Returns a promise that will be resolved when a message matching `WaitForMessageOptions` is found,
     * or rejected if `WaitForMessageOptions.timeout` is reached. Used by the consumer.
     *
     * @param {WaitForMessageOptions} [config]
     * @return {Promise<Message>} message published.
     * @memberof PubSub
     */
    waitForMessage(config?: WaitForMessageOptions): Promise<Message>;
}
type PageFixtures = {
    collects_ga3: PubSub;
    collects_ga4: PubSub;
    dataLayer: PubSub;
};
export declare const test: import("@playwright/test").TestType<import("@playwright/test").PlaywrightTestArgs & import("@playwright/test").PlaywrightTestOptions & PageFixtures, import("@playwright/test").PlaywrightWorkerArgs & import("@playwright/test").PlaywrightWorkerOptions>;
export {};
