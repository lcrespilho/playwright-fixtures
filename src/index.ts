import { test as base, expect, chromium, Request, type Page } from '@playwright/test'
import { ZodTypeAny } from 'zod'
import { flatRequestUrl } from '@lcrespilho/playwright-utils'

// TYPES
declare global {
  interface Window {
    dataLayer: DatalayerMessage[]
    dlTransfer: (arg0: DatalayerMessage) => void
  }
}
type Subscriber<TMessage> = (msg: TMessage) => void
type BaseWaitForMessageOptions = {
  timeout: number
  timeoutMessage?: string
}
type BaseFixture<TMessage, TOptions> = {
  messages: TMessage[]
  waitForMessage: (options: TOptions) => Promise<TMessage>
}

// GA specific types
export type GAMessage = string
type WaitForGAMessageOptionsRegex = BaseWaitForMessageOptions & {
  regex: RegExp
}
type WaitForGAMessageOptionsPredicate = BaseWaitForMessageOptions & {
  predicate: (msg: GAMessage) => boolean
}
export type WaitForGAMessageOptions = WaitForGAMessageOptionsRegex | WaitForGAMessageOptionsPredicate
type GAFixture = BaseFixture<GAMessage, WaitForGAMessageOptions>

// Datalayer specific types
export type DatalayerMessage = Record<string, any>
type WaitForDatalayerMessageOptionsMatchObject = BaseWaitForMessageOptions & {
  matchObject: DatalayerMessage
}
type WaitForDatalayerMessageOptionsZodMatchObject = BaseWaitForMessageOptions & {
  matchZodObject: ZodTypeAny
}
type WaitForDatalayerMessageOptionsPredicate = BaseWaitForMessageOptions & {
  predicate: (msg: DatalayerMessage) => boolean
}
export type WaitForDatalayerMessageOptions =
  | WaitForDatalayerMessageOptionsMatchObject
  | WaitForDatalayerMessageOptionsPredicate
  | WaitForDatalayerMessageOptionsZodMatchObject
type DatalayerFixture = BaseFixture<DatalayerMessage, WaitForDatalayerMessageOptions>

// Facebook specific types (Example)
export type FacebookMessage = string
type WaitForFacebookMessageOptionsRegex = BaseWaitForMessageOptions & {
  regex: RegExp
}
type WaitForFacebookMessageOptionsPredicate = BaseWaitForMessageOptions & {
  predicate: (msg: FacebookMessage) => boolean
}
export type WaitForFacebookMessageOptions = WaitForFacebookMessageOptionsRegex | WaitForFacebookMessageOptionsPredicate
type FacebookFixture = BaseFixture<FacebookMessage, WaitForFacebookMessageOptions>

// Combined PageFixtures type
type PageFixtures = {
  ga: GAFixture
  dataLayer: DatalayerFixture
  facebook: FacebookFixture
}

export type FixturesOptions = {
  /**
   * Regex that matches a GA hit. Default: /(?<!kwai.*)google.*collect\?v=2/
   */
  gaRegex: RegExp
  /**
   * Regex that matches a Facebook Pixel hit. Default: /facebook\.com\/tr/
   */
  facebookRegex: RegExp
  /**
   * Indicates if connecting to Chrome with remote debugging port enabled ("cdp") or opening
   * the Playwright's default browser ("default" behavior). For example http://localhost:9222/.
   */
  browserType: 'default' | 'cdp'
}

// Writing playwright fixtures
export const test = base.extend<PageFixtures & FixturesOptions>({
  // Provide default values for optional options
  browserType: ['default', { option: true }],
  gaRegex: [/(?<!kwai.*)google.*collect\?v=2/, { option: true }],
  facebookRegex: [/facebook\.com\/tr/, { option: true }],

  // --- Browser/Context/Page Setup ---
  context: async ({ browserType, context }, use) => {
    if (browserType === 'default') {
      await use(context)
    } else if (browserType === 'cdp') {
      try {
        await context.close()
        const browser = await chromium.connectOverCDP('http://localhost:9222')
        await use(browser.contexts()[0])
      } catch (error) {
        console.error('Failed to connect over CDP. Ensure Chrome is running with --remote-debugging-port=9222')
        throw error
      }
    }
  },
  page: async ({ browserType, context, page, baseURL }, use) => {
    if (browserType === 'cdp') {
      await page.close()
      const newPage = await context.newPage()
      const originalGoto = newPage.goto.bind(newPage)
      newPage.goto = async (url: Parameters<Page['goto']>[0], options?: Parameters<Page['goto']>[1]) => {
        const fullUrl = baseURL ? new URL(url, baseURL).href : url
        return originalGoto(fullUrl, options)
      }
      await use(newPage)
    } else {
      await use(page)
    }
  },
  ga: async ({ page, gaRegex }, use) => {
    const pubSub = new PubSub<GAMessage>()
    const requestListener = (request: Request) => {
      const flatUrl = flatRequestUrl(request)
      if (gaRegex.test(flatUrl)) {
        pubSub.publish(flatUrl)
      }
    }
    page.on('request', requestListener)
    const fixture: GAFixture = {
      messages: pubSub.messages,
      waitForMessage: (options: WaitForGAMessageOptions): Promise<GAMessage> => {
        let predicate: (msg: GAMessage) => boolean
        if ('predicate' in options) {
          predicate = options.predicate
        } else if ('regex' in options) {
          predicate = (msg: GAMessage) => options.regex.test(msg)
        } else {
          throw new Error(`Invalid options for waitForMessage: requires 'predicate' or 'regex'.`)
        }
        return pubSub.waitForMessage(predicate, options)
      },
    }
    await use(fixture)
    page.off('request', requestListener)
  },
  dataLayer: async ({ page }, use) => {
    const pubSub = new PubSub<DatalayerMessage>()
    await page.exposeFunction('dlTransfer', (o: DatalayerMessage): void => pubSub.publish(o))
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
    const fixture: DatalayerFixture = {
      messages: pubSub.messages,
      waitForMessage: (options: WaitForDatalayerMessageOptions): Promise<DatalayerMessage> => {
        let predicate: (msg: DatalayerMessage) => boolean

        if ('predicate' in options) {
          predicate = options.predicate
        } else if ('matchObject' in options) {
          predicate = (msg: DatalayerMessage) => {
            try {
              expect(msg).toMatchObject(options.matchObject)
              return true
            } catch {
              return false
            }
          }
        } else if ('matchZodObject' in options) {
          predicate = (msg: DatalayerMessage) => options.matchZodObject.safeParse(msg).success
        } else {
          throw new Error(
            "Invalid options for waitForMessage: requires 'predicate', 'matchObject', or 'matchZodObject'."
          )
        }

        return pubSub.waitForMessage(predicate, options)
      },
    }

    await use(fixture)
  },
  facebook: async ({ page, facebookRegex }, use) => {
    const pubSub = new PubSub<FacebookMessage>()
    const requestListener = (request: Request) => {
      const flatUrl = flatRequestUrl(request)
      if (facebookRegex.test(flatUrl)) {
        pubSub.publish(flatUrl)
      }
    }
    page.on('request', requestListener)
    const fixture: FacebookFixture = {
      messages: pubSub.messages,
      waitForMessage: (options: WaitForFacebookMessageOptions): Promise<FacebookMessage> => {
        let predicate: (msg: FacebookMessage) => boolean
        if ('predicate' in options) {
          predicate = options.predicate
        } else if ('regex' in options) {
          predicate = (msg: FacebookMessage) => options.regex.test(msg)
        } else {
          throw new Error(`Invalid options for waitForMessage: requires 'predicate' or 'regex'.`)
        }
        return pubSub.waitForMessage(predicate, options)
      },
    }
    await use(fixture)
    page.off('request', requestListener)
  },
})

/**
 * Generic PubSub class responsible only for managing messages and subscribers.
 * The page publishes messages. Playwright code consumes them.
 */
class PubSub<TMessage> {
  private subscribers: Set<Subscriber<TMessage>> = new Set()
  messages: TMessage[] = []

  /**
   * Publish messages. Called internally by fixtures.
   */
  publish(message: TMessage) {
    this.messages.push(message)
    this.subscribers.forEach(subscriber => subscriber(message)) // Notify all subscribers
  }

  /**
   * Generic method to wait for a message based on a predicate function.
   * Returns a promise that resolves with the message or rejects on timeout.
   */
  waitForMessage(predicate: (msg: TMessage) => boolean, options: BaseWaitForMessageOptions): Promise<TMessage> {
    return new Promise((resolve, reject) => {
      // set up subscriber and timeout
      const timeoutId = setTimeout(() => {
        this.subscribers.delete(subscriber) // Clean up subscriber on timeout
        reject(new Error(options.timeoutMessage || `Timeout waiting for message after ${options.timeout}ms`))
      }, options.timeout)

      const subscriber: Subscriber<TMessage> = message => {
        if (predicate(message)) {
          clearTimeout(timeoutId) // Clear timeout
          this.subscribers.delete(subscriber) // Clean up subscriber
          resolve(message)
        }
      }

      this.subscribers.add(subscriber)
    })
  }
}

export { expect } // Re-export expect
