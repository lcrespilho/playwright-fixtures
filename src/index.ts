import { test as base, expect } from '@playwright/test'
export { expect } from '@playwright/test'
import { ZodTypeAny } from 'zod'
import { flatRequestUrl } from '@lcrespilho/playwright-utils'

// TYPES
declare global {
  interface Window {
    dataLayer: DatalayerMessage[]
    dlTransfer: (arg0: DatalayerMessage) => void
  }
}
export type GAHitMessage = string
export type DatalayerMessage = Record<string, any>
type WaitForGAMessageOptionsRegex = {
  timeout: number
  timeoutMessage?: string
  regex: RegExp
}
type WaitForGAMessageOptionsPredicate = {
  timeout: number
  timeoutMessage?: string
  predicate: (msg: GAHitMessage) => boolean
}
type WaitForGAMessageOptions = WaitForGAMessageOptionsRegex | WaitForGAMessageOptionsPredicate
type WaitForDatalayerMessageOptionsMatchObject = {
  timeout: number
  timeoutMessage?: string
  matchObject: DatalayerMessage
}
type WaitForDatalayerMessageOptionsPredicate = {
  timeout: number
  timeoutMessage?: string
  predicate: (msg: DatalayerMessage) => boolean
}
type WaitForDatalayerMessageOptionsZodMatchObject = {
  timeout: number
  timeoutMessage?: string
  matchZodObject: ZodTypeAny
}
type WaitForDatalayerMessageOptions =
  | WaitForDatalayerMessageOptionsMatchObject
  | WaitForDatalayerMessageOptionsPredicate
  | WaitForDatalayerMessageOptionsZodMatchObject
type Subscriber<TMessage> = (msg: TMessage) => void

/**
 * Utilizes the Observer Pattern, where the [Page](https://playwright.dev/docs/api/class-page)
 * is the producer and the Node Playwright Test is the consumer. Every time the Page produces
 * a message (window.dataLayer.push, or GA-Universal/GA4 network request), the consumer's
 * subscribers callbacks are called.
 */
class PubSub<
  TMessage extends DatalayerMessage | GAHitMessage,
  TWaitForMessageOptions extends WaitForDatalayerMessageOptions | WaitForGAMessageOptions
> {
  private subscribers: Set<Subscriber<TMessage>> = new Set()
  messages: TMessage[] = []
  constructor() {}

  /**
   * Subscribe for messages. Called by the consumer.
   *
   * @param subscriber callback function to be executed once the message arrives
   */
  subscribe(subscriber: Subscriber<TMessage>) {
    this.subscribers.add(subscriber)
  }
  /**
   * Unsubscribe from messages. Called by the consumer.
   *
   * @param subscriber reference to a callback function previously subscribed
   */
  unsubscribe(subscriber: Subscriber<TMessage>) {
    this.subscribers.delete(subscriber)
  }
  /**
   * Publish messages. Called by the producer.
   *
   * @param message message published.
   */
  publish(message: TMessage) {
    this.messages.push(message)
    for (const subscriber of this.subscribers) subscriber(message)
  }
  /**
   * Returns a promise that will be resolved when a message matching `TWaitForMessageOptions` is found,
   * or rejected if `TWaitForMessageOptions.timeout` is reached. Called by the consumer.
   *
   * @return message published.
   */
  waitForMessage(config: TWaitForMessageOptions): Promise<TMessage> {
    return new Promise((resolve, reject) => {
      setTimeout(reject, config.timeout, config.timeoutMessage || 'timeout')
      const subscriber: Subscriber<TMessage> = message => {
        if ('predicate' in config) {
          if (!config.predicate(message as GAHitMessage & DatalayerMessage)) return
        } else if ('matchObject' in config) {
          try {
            // Used for test dataLayer subobjects
            expect(message as DatalayerMessage).toMatchObject(config.matchObject)
          } catch (error) {
            return
          }
        } else if ('matchZodObject' in config) {
          const result = config.matchZodObject.safeParse(message as DatalayerMessage)
          if (!result.success) return
        } else if ('regex' in config) {
          if (!config.regex.test(message as GAHitMessage)) return
        }
        this.unsubscribe(subscriber)
        resolve(message)
      }
      this.subscribe(subscriber)
    })
  }
}

type PageFixtures = {
  collects_ga3: PubSub<GAHitMessage, WaitForGAMessageOptions>
  collects_ga4: PubSub<GAHitMessage, WaitForGAMessageOptions>
  dataLayer: PubSub<DatalayerMessage, WaitForDatalayerMessageOptions>
}

export type FixturesOptions = {
  /**
   * Regex that matches a GA4 hit. Default: /(?<!kwai.*)google.*collect\\?v=2/
   */
  ga4HitRegex: RegExp
  /**
   * Regex that matches a GA3 hit. Default: /(?<!kwai.*)google.*collect(?!\\?v=2)/
   */
  ga3HitRegex: RegExp
}

// Writing playwright fixtures

export const test = base.extend<PageFixtures & FixturesOptions>({
  ga4HitRegex: [/(?<!kwai.*)google.*collect\?v=2/, { option: true }],
  ga3HitRegex: [/(?<!kwai.*)google.*collect(?!\?v=2)/, { option: true }],
  collects_ga3: async ({ page, ga3HitRegex }, use) => {
    const collects = new PubSub<GAHitMessage, WaitForGAMessageOptions>()
    page.on('request', request => {
      const flatUrl = flatRequestUrl(request)
      if (ga3HitRegex.test(flatUrl)) {
        collects.publish(flatUrl)
      }
    })
    await use(collects)
  },
  collects_ga4: async ({ page, ga4HitRegex }, use) => {
    const collects = new PubSub<GAHitMessage, WaitForGAMessageOptions>()
    page.on('request', request => {
      const flatUrl = flatRequestUrl(request)
      if (ga4HitRegex.test(flatUrl)) {
        collects.publish(flatUrl)
      }
    })
    await use(collects)
  },
  dataLayer: async ({ page }, use) => {
    const dataLayer = new PubSub<DatalayerMessage, WaitForDatalayerMessageOptions>()
    await page.exposeFunction('dlTransfer', (o: DatalayerMessage): void => dataLayer.publish(o))
    await page.addInitScript(() => {
      Object.defineProperty(window, 'dataLayer', {
        enumerable: true,
        configurable: true,
        set(value: DatalayerMessage[]) {
          if (Array.isArray(value)) {
            // Se o dataLayer foi inicializado já com algum objeto.
            for (const o of value) window.dlTransfer(o)
          }
          // Permite ou não sobrescritas futuras do dataLayer.
          Object.defineProperty(window, 'dataLayer', {
            enumerable: true,
            configurable: true,
            value,
            writable: true,
          })
          window.dataLayer.push = new Proxy(window.dataLayer.push, {
            apply(target, thisArg, argArray) {
              const o: DatalayerMessage = argArray[0]
              o._perfNow = Math.round(performance.now())
              window.dlTransfer(o)
              return Reflect.apply(target, thisArg, argArray)
            },
          })
        },
      })
    })
    await use(dataLayer)
  },
})
