"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.expect = exports.testStealth = exports.test = void 0;
const test_1 = require("@playwright/test");
Object.defineProperty(exports, "expect", { enumerable: true, get: function () { return test_1.expect; } });
const playwright_utils_1 = require("@lcrespilho/playwright-utils");
const playwright_extra_1 = require("playwright-extra");
const puppeteer_extra_plugin_stealth_1 = __importDefault(require("puppeteer-extra-plugin-stealth"));
playwright_extra_1.chromium.use((0, puppeteer_extra_plugin_stealth_1.default)());
const contextFixture = async ({ browserType, context }, use) => {
    if (browserType === 'default') {
        await use(context);
    }
    else if (browserType === 'cdp') {
        if (context.pages().length === 0) {
            await context.close();
        }
        try {
            const browser = await test_1.chromium.connectOverCDP('http://127.0.0.1:9222');
            await use(browser.contexts()[0]);
        }
        catch (error) {
            console.error('Failed to connect over CDP. Ensure Chrome is running with --remote-debugging-port=9222');
            throw error;
        }
    }
};
const pageFixture = async ({ browserType, context, page, baseURL, }, use) => {
    if (browserType === 'cdp') {
        if (page.url() === 'about:blank') {
            await page.close();
        }
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
};
const gaFixture = async ({ page, gaRegex }, use) => {
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
};
const dataLayerFixture = async ({ page }, use) => {
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
                        argArray.forEach((o) => {
                            o._perfNow = Math.round(performance.now());
                            window.dlTransfer(o);
                        });
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
};
const facebookFixture = async ({ page, facebookRegex }, use) => {
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
};
// Writing playwright fixtures
exports.test = test_1.test.extend({
    browserType: ['default', { option: true }],
    gaRegex: [/(?<!kwai.*)google.*collect\?v=2/, { option: true }],
    facebookRegex: [/facebook\.com\/tr/, { option: true }],
    context: contextFixture,
    page: pageFixture,
    ga: gaFixture,
    dataLayer: dataLayerFixture,
    facebook: facebookFixture,
});
exports.testStealth = test_1.test.extend({
    browser: [
        async ({ launchOptions }, use) => {
            const browser = await playwright_extra_1.chromium.launch(launchOptions);
            await use(browser);
            await browser.close();
        },
        { scope: 'worker' },
    ],
    browserType: ['default', { option: true }],
    gaRegex: [/(?<!kwai.*)google.*collect\?v=2/, { option: true }],
    facebookRegex: [/facebook\.com\/tr/, { option: true }],
    context: contextFixture,
    page: pageFixture,
    ga: gaFixture,
    dataLayer: dataLayerFixture,
    facebook: facebookFixture,
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