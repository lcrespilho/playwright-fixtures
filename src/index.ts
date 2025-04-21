import { test as base, expect, chromium } from '@playwright/test'
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
type PageFixtures = {
  collects_ga4: PubSub<GAHitMessage, WaitForGAMessageOptions>
  dataLayer: PubSub<DatalayerMessage, WaitForDatalayerMessageOptions>
}
export type FixturesOptions = {
  /**
   * Regex that matches a GA4 hit. Default: /(?<!kwai.*)google.*collect\\?v=2/
   */
  ga4HitRegex: RegExp
  /**
   * Indicates if connecting to Chrome with remote debugging port enabled ("cdp") or opening
   * the Playwright's default browser ("default" behavior). For example http://localhost:9222/.
   */
  browserType: 'default' | 'cdp'
}

/**
 * Utilizes the Observer Pattern, where the [Page](https://playwright.dev/docs/api/class-page)
 * is the producer and the Node Playwright Test is the consumer. Every time the Page produces
 * a message (window.dataLayer.push, or GA4 network request), the consumer's
 * subscribers callbacks are called.
 */
class PubSub<
  TMessage extends DatalayerMessage | GAHitMessage,
  TWaitForMessageOptions extends WaitForDatalayerMessageOptions | WaitForGAMessageOptions
> {
  private subscribers: Set<Subscriber<TMessage>> = new Set()
  messages: TMessage[] = []

  /**
   * Publish messages. Called by the producer.
   * Obs: you are not supposed to call this function on user/test code. It's an
   * internal function that I could not hide enough. :)
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
          const { success } = config.matchZodObject.safeParse(message as DatalayerMessage)
          if (!success) return
        } else if ('regex' in config) {
          if (!config.regex.test(message as GAHitMessage)) return
        }
        this.subscribers.delete(subscriber)
        resolve(message)
      }
      this.subscribers.add(subscriber)
    })
  }
}

// Writing playwright fixtures
export const test = base.extend<PageFixtures & FixturesOptions>({
  ga4HitRegex: [/(?<!kwai.*)google.*collect\?v=2/, { option: true }],
  browserType: ['default', { option: true }],
  context: async ({ browserType, context }, use) => {
    if (browserType === 'default') {
      await use(context)
    } else if (browserType === 'cdp') {
      const browser = await chromium.connectOverCDP('http://localhost:9222')
      await use(browser.contexts()[0])
    }
  },
  page: async ({ browserType, context, page }, use) => {
    if (browserType === 'cdp') {
      await use(await context.newPage())
    } else {
      await use(page)
    }
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
          if (!Array.isArray(value)) throw new Error('dataLayer was supposed to be an array. Instead it is:', value)
          value.forEach(window.dlTransfer) // Se o dataLayer for inicializado já com algum objeto.
          Object.defineProperty(window, 'dataLayer', {
            enumerable: true,
            configurable: true, // Permite sobrescritas futuras do dataLayer.
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
