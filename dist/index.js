"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.test = exports.expect = void 0;
const test_1 = require("@playwright/test");
var test_2 = require("@playwright/test");
Object.defineProperty(exports, "expect", { enumerable: true, get: function () { return test_2.expect; } });
const playwright_utils_1 = require("@lcrespilho/playwright-utils");
/**
 * Utilizes the Observer Pattern, where the [Page](https://playwright.dev/docs/api/class-page)
 * is the producer and the Node Playwright Test is the consumer. Every time the Page produces
 * a message (window.dataLayer.push, or GA-Universal/GA4 network request), the consumer's
 * subscribers callbacks are called.
 */
class PubSub {
    subscribers = new Set();
    messages = [];
    constructor() { }
    /**
     * Subscribe for messages. Called by the consumer.
     *
     * @param subscriber callback function to be executed once the message arrives
     */
    subscribe(subscriber) {
        this.subscribers.add(subscriber);
    }
    /**
     * Unsubscribe from messages. Called by the consumer.
     *
     * @param subscriber reference to a callback function previously subscribed
     */
    unsubscribe(subscriber) {
        this.subscribers.delete(subscriber);
    }
    /**
     * Publish messages. Called by the producer.
     *
     * @param message message published.
     */
    publish(message) {
        this.messages.push(message);
        for (const subscriber of this.subscribers)
            subscriber(message);
    }
    /**
     * Returns a promise that will be resolved when a message matching `TWaitForMessageOptions` is found,
     * or rejected if `TWaitForMessageOptions.timeout` is reached. Called by the consumer.
     *
     * @return message published.
     */
    waitForMessage(config) {
        return new Promise((resolve, reject) => {
            setTimeout(reject, config.timeout, config.timeoutMessage || 'timeout');
            const subscriber = message => {
                if ('predicate' in config) {
                    if (!config.predicate(message))
                        return;
                }
                else if ('matchObject' in config) {
                    try {
                        // Used for test dataLayer subobjects
                        (0, test_1.expect)(message).toMatchObject(config.matchObject);
                    }
                    catch (error) {
                        return;
                    }
                }
                else if ('matchZodObject' in config) {
                    const result = config.matchZodObject.safeParse(message);
                    if (!result.success)
                        return;
                }
                else if ('regex' in config) {
                    if (!config.regex.test(message))
                        return;
                }
                this.unsubscribe(subscriber);
                resolve(message);
            };
            this.subscribe(subscriber);
        });
    }
}
// Writing playwright fixtures
exports.test = test_1.test.extend({
    ga4HitRegex: [/(?<!kwai.*)google.*collect\?v=2/, { option: true }],
    ga3HitRegex: [/(?<!kwai.*)google.*collect(?!\?v=2)/, { option: true }],
    collects_ga3: async ({ page, ga3HitRegex }, use) => {
        const collects = new PubSub();
        page.on('request', request => {
            const flatUrl = (0, playwright_utils_1.flatRequestUrl)(request);
            if (ga3HitRegex.test(flatUrl)) {
                collects.publish(flatUrl);
            }
        });
        await use(collects);
    },
    collects_ga4: async ({ page, ga4HitRegex }, use) => {
        const collects = new PubSub();
        page.on('request', request => {
            const flatUrl = (0, playwright_utils_1.flatRequestUrl)(request);
            if (ga4HitRegex.test(flatUrl)) {
                collects.publish(flatUrl);
            }
        });
        await use(collects);
    },
    dataLayer: async ({ page }, use) => {
        const dataLayer = new PubSub();
        await page.exposeFunction('dlTransfer', (o) => dataLayer.publish(o));
        await page.addInitScript(() => {
            Object.defineProperty(window, 'dataLayer', {
                enumerable: true,
                configurable: true,
                set(value) {
                    if (Array.isArray(value)) {
                        // Se o dataLayer foi inicializado já com algum objeto.
                        for (const o of value)
                            window.dlTransfer(o);
                    }
                    // Permite ou não sobrescritas futuras do dataLayer.
                    Object.defineProperty(window, 'dataLayer', {
                        enumerable: true,
                        configurable: true,
                        value,
                        writable: true,
                    });
                    window.dataLayer.push = new Proxy(window.dataLayer.push, {
                        apply(target, thisArg, argArray) {
                            const o = argArray[0];
                            o._perfNow = Math.round(performance.now());
                            window.dlTransfer(o);
                            return Reflect.apply(target, thisArg, argArray);
                        },
                    });
                },
            });
        });
        await use(dataLayer);
    },
});
//# sourceMappingURL=index.js.map