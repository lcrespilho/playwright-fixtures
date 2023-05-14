"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.test = void 0;
const test_1 = require("@playwright/test");
/**
 * Utilizes the Observer Pattern, where the [Page](https://playwright.dev/docs/api/class-page)
 * is the producer and the Node Playwright Test is the consumer. Every time the Page produces
 * a message (window.dataLayer.push, or GA-Universal/GA4 network request), the consumer's
 * subscribers callbacks are called.
 *
 * @class PubSub
 */
class PubSub {
    #subscribers = new Set();
    messages = [];
    /**
     * Subscribe for messages. Used by the consumer.
     *
     * @param {Function} subscriber callback function to be executed once the message arrives
     * @memberof PubSub
     */
    subscribe(subscriber) {
        this.#subscribers.add(subscriber);
    }
    /**
     * Unsubscribe from messages. Used by the consumer.
     *
     * @param {Function} subscriber reference to a callback function previously subscribed
     * @memberof PubSub
     */
    unsubscribe(subscriber) {
        this.#subscribers.delete(subscriber);
    }
    /**
     * Publish messages. Used by the producer.
     *
     * @param {Message} message message published.
     * @memberof PubSub
     */
    publish(message) {
        this.messages.push(message);
        for (const subscriber of this.#subscribers)
            subscriber(message);
    }
    /**
     * Returns a promise that will be resolved when a message matching `WaitForMessageOptions` is found,
     * or rejected if `WaitForMessageOptions.timeout` is reached. Used by the consumer.
     *
     * @param {WaitForMessageOptions} [config]
     * @return {Promise<Message>} message published.
     * @memberof PubSub
     */
    waitForMessage(config) {
        return new Promise((resolve, reject) => {
            if (config?.timeout)
                setTimeout(reject, config.timeout, 'timeout');
            const subscriber = (message) => {
                if (config?.regex && !config?.regex?.test(message))
                    return;
                if (config?.matchObject) {
                    try {
                        // Used for test dataLayer subobjects
                        (0, test_1.expect)(message).toMatchObject(config.matchObject);
                    }
                    catch (error) {
                        return;
                    }
                }
                this.unsubscribe(subscriber);
                resolve(message);
            };
            this.subscribe(subscriber);
        });
    }
}
function flatRequestUrl(req) {
    return (req.url() + '&' + (req.postData() || ''))
        .replace(/\r\n|\n|\r/g, '&')
        .replace(/&&/g, '&')
        .replace(/&$/g, '');
}
// Writing playwright fixtures
exports.test = test_1.test.extend({
    collects_ga3: async ({ page }, use) => {
        const collects = new PubSub();
        page.on('request', request => {
            const flatUrl = flatRequestUrl(request);
            if (/google.*collect(?!\?v=2)/.test(flatUrl)) {
                collects.publish(flatUrl);
            }
        });
        await use(collects);
    },
    collects_ga4: async ({ page }, use) => {
        const collects = new PubSub();
        page.on('request', request => {
            const flatUrl = flatRequestUrl(request);
            if (/google.*collect\?v=2/.test(flatUrl)) {
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
                    // Não permite sobrescritas futuras do dataLayer.
                    Object.defineProperty(window, 'dataLayer', {
                        enumerable: true,
                        configurable: false,
                        value,
                        writable: false,
                    });
                    window.dataLayer.push = new Proxy(window.dataLayer.push, {
                        apply(target, thisArg, argArray) {
                            const o = argArray[0];
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