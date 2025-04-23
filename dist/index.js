"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expect = exports.test = void 0;
const test_1 = require("@playwright/test");
Object.defineProperty(exports, "expect", { enumerable: true, get: function () { return test_1.expect; } });
const playwright_utils_1 = require("@lcrespilho/playwright-utils");
// Writing playwright fixtures
exports.test = test_1.test.extend({
    // Provide default values for optional options
    browserType: ['default', { option: true }],
    gaRegex: [/(?<!kwai.*)google.*collect\?v=2/, { option: true }],
    facebookRegex: [/facebook\.com\/tr/, { option: true }],
    // --- Browser/Context/Page Setup ---
    context: async ({ browserType, context }, use) => {
        if (browserType === 'default') {
            await use(context);
        }
        else if (browserType === 'cdp') {
            try {
                await context.close();
                const browser = await test_1.chromium.connectOverCDP('http://localhost:9222');
                await use(browser.contexts()[0]);
            }
            catch (error) {
                console.error('Failed to connect over CDP. Ensure Chrome is running with --remote-debugging-port=9222');
                throw error;
            }
        }
    },
    page: async ({ browserType, context, page, baseURL }, use) => {
        if (browserType === 'cdp') {
            await page.close();
            const newPage = await context.newPage();
            const originalGoto = newPage.goto.bind(newPage);
            newPage.goto = async (url, options) => {
                const fullUrl = baseURL ? new URL(url, baseURL).href : url;
                return originalGoto(fullUrl, options);
            };
            await use(newPage);
        }
        else {
            await use(page);
        }
    },
    ga: async ({ page, gaRegex }, use) => {
        const pubSub = new PubSub();
        const requestListener = (request) => {
            const flatUrl = (0, playwright_utils_1.flatRequestUrl)(request);
            if (gaRegex.test(flatUrl)) {
                pubSub.publish(flatUrl);
            }
        };
        page.on('request', requestListener);
        const fixture = {
            messages: pubSub.messages,
            waitForMessage: (options) => {
                let predicate;
                if ('predicate' in options) {
                    predicate = options.predicate;
                }
                else if ('regex' in options) {
                    predicate = (msg) => options.regex.test(msg);
                }
                else {
                    throw new Error(`Invalid options for waitForMessage: requires 'predicate' or 'regex'.`);
                }
                return pubSub.waitForMessage(predicate, options);
            },
        };
        await use(fixture);
        page.off('request', requestListener);
    },
    dataLayer: async ({ page }, use) => {
        const pubSub = new PubSub();
        await page.exposeFunction('dlTransfer', (o) => pubSub.publish(o));
        await page.addInitScript(() => {
            Object.defineProperty(window, 'dataLayer', {
                enumerable: true,
                configurable: true,
                set(value) {
                    if (!Array.isArray(value))
                        throw new Error('dataLayer was supposed to be an array. Instead it is:', value);
                    value.forEach(window.dlTransfer); // Se o dataLayer for inicializado já com algum objeto.
                    Object.defineProperty(window, 'dataLayer', {
                        enumerable: true,
                        configurable: true, // Permite sobrescritas futuras do dataLayer.
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
        const fixture = {
            messages: pubSub.messages,
            waitForMessage: (options) => {
                let predicate;
                if ('predicate' in options) {
                    predicate = options.predicate;
                }
                else if ('matchObject' in options) {
                    predicate = (msg) => {
                        try {
                            (0, test_1.expect)(msg).toMatchObject(options.matchObject);
                            return true;
                        }
                        catch {
                            return false;
                        }
                    };
                }
                else if ('matchZodObject' in options) {
                    predicate = (msg) => options.matchZodObject.safeParse(msg).success;
                }
                else {
                    throw new Error("Invalid options for waitForMessage: requires 'predicate', 'matchObject', or 'matchZodObject'.");
                }
                return pubSub.waitForMessage(predicate, options);
            },
        };
        await use(fixture);
    },
    facebook: async ({ page, facebookRegex }, use) => {
        const pubSub = new PubSub();
        const requestListener = (request) => {
            const flatUrl = (0, playwright_utils_1.flatRequestUrl)(request);
            if (facebookRegex.test(flatUrl)) {
                pubSub.publish(flatUrl);
            }
        };
        page.on('request', requestListener);
        const fixture = {
            messages: pubSub.messages,
            waitForMessage: (options) => {
                let predicate;
                if ('predicate' in options) {
                    predicate = options.predicate;
                }
                else if ('regex' in options) {
                    predicate = (msg) => options.regex.test(msg);
                }
                else {
                    throw new Error(`Invalid options for waitForMessage: requires 'predicate' or 'regex'.`);
                }
                return pubSub.waitForMessage(predicate, options);
            },
        };
        await use(fixture);
        page.off('request', requestListener);
    },
});
/**
 * Generic PubSub class responsible only for managing messages and subscribers.
 * The page publishes messages. Playwright code consumes them.
 */
class PubSub {
    subscribers = new Set();
    messages = [];
    /**
     * Publish messages. Called internally by fixtures.
     */
    publish(message) {
        this.messages.push(message);
        this.subscribers.forEach(subscriber => subscriber(message)); // Notify all subscribers
    }
    /**
     * Generic method to wait for a message based on a predicate function.
     * Returns a promise that resolves with the message or rejects on timeout.
     */
    waitForMessage(predicate, options) {
        return new Promise((resolve, reject) => {
            // set up subscriber and timeout
            const timeoutId = setTimeout(() => {
                this.subscribers.delete(subscriber); // Clean up subscriber on timeout
                reject(new Error(options.timeoutMessage || `Timeout waiting for message after ${options.timeout}ms`));
            }, options.timeout);
            const subscriber = message => {
                if (predicate(message)) {
                    clearTimeout(timeoutId); // Clear timeout
                    this.subscribers.delete(subscriber); // Clean up subscriber
                    resolve(message);
                }
            };
            this.subscribers.add(subscriber);
        });
    }
}
//# sourceMappingURL=index.js.map