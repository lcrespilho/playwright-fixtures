import { test as base, expect, type Request } from '@playwright/test';

declare global {
  interface Window {
    dataLayer: Record<string, unknown>[];
    dlTransfer: Function;
  }
  type Message = string | Record<string, unknown>;
  type WaitForMessageOptions =
    | {
        timeout?: number;
        regex?: RegExp;
        matchObject?: never;
      }
    | {
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
class PubSub {
  #subscribers: Set<Function> = new Set();
  messages: Message[] = [];

  /**
   * Subscribe for messages. Used by the consumer.
   *
   * @param {Function} subscriber callback function to be executed once the message arrives
   * @memberof PubSub
   */
  subscribe(subscriber: Function) {
    this.#subscribers.add(subscriber);
  }
  /**
   * Unsubscribe from messages. Used by the consumer.
   *
   * @param {Function} subscriber reference to a callback function previously subscribed
   * @memberof PubSub
   */
  unsubscribe(subscriber: Function) {
    this.#subscribers.delete(subscriber);
  }
  /**
   * Publish messages. Used by the producer.
   *
   * @param {Message} message message published.
   * @memberof PubSub
   */
  publish(message: Message) {
    this.messages.push(message);
    for (const subscriber of this.#subscribers) subscriber(message);
  }
  /**
   * Returns a promise that will be resolved when a message matching `WaitForMessageOptions` is found,
   * or rejected if `WaitForMessageOptions.timeout` is reached. Used by the consumer.
   *
   * @param {WaitForMessageOptions} [config]
   * @return {Promise<Message>} message published.
   * @memberof PubSub
   */
  waitForMessage(config?: WaitForMessageOptions): Promise<Message> {
    return new Promise((resolve, reject) => {
      if (config?.timeout) setTimeout(reject, config.timeout, 'timeout');
      const subscriber = (message: Message) => {
        if (config?.regex && !config?.regex?.test(message as string)) return;
        if (config?.matchObject) {
          try {
            // Used for test dataLayer subobjects
            expect(message).toMatchObject(config.matchObject as unknown as Record<string, unknown>);
          } catch (error) {
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

function flatRequestUrl(req: Request): string {
  return (req.url() + '&' + (req.postData() || ''))
    .replace(/\r\n|\n|\r/g, '&')
    .replace(/&&/g, '&')
    .replace(/&$/g, '');
}

type PageFixtures = {
  collects_ga3: PubSub;
  collects_ga4: PubSub;
  dataLayer: PubSub;
};

// Writing playwright fixtures

export const test = base.extend<PageFixtures>({
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
    await page.exposeFunction('dlTransfer', (o: Record<string, unknown>) => dataLayer.publish(o));
    await page.addInitScript(() => {
      Object.defineProperty(window, 'dataLayer', {
        enumerable: true,
        configurable: true,
        set(value: Record<string, unknown>[]) {
          if (Array.isArray(value)) {
            // Se o dataLayer foi inicializado já com algum objeto.
            for (const o of value) window.dlTransfer(o);
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
              const o: Record<string, unknown> = argArray[0];
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
