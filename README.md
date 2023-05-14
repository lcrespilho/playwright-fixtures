# Playwright fixtures for dataLayer, collects_ga3 and collects_ga4

Utilizes the Observer Pattern, where the [Page](https://playwright.dev/docs/api/class-page) is the producer and the Node Playwright Test is the consumer. Every time the Page produces a message (window.dataLayer.push, or GA-Universal/GA4 network request), the consumer's subscribers callbacks are called.

# API

<a name="PubSub"></a>

## PubSub
**Kind**: global class  

* [PubSub](#PubSub)
    * [new PubSub()](#new_PubSub_new)
    * [.subscribe(subscriber)](#PubSub_subscribe)
    * [.unsubscribe(subscriber)](#PubSub_unsubscribe)
    * [.publish(message)](#PubSub_publish)
    * [.waitForMessage([config])](#PubSub_waitForMessage) ⇒ <code>Promise.&lt;Message&gt;</code>

<a name="new_PubSub_new"></a>

### new PubSub()
Utilizes the Observer Pattern, where the [Page](https://playwright.dev/docs/api/class-page)
is the producer and the Node Playwright Test is the consumer. Every time the Page produces
a message (window.dataLayer.push, or GA-Universal/GA4 network request), the consumer's
subscribers callbacks are called.

<a name="PubSub_subscribe"></a>

### pubSub.subscribe(subscriber)
Subscribe for messages. Used by the consumer.

**Kind**: instance method of [<code>PubSub</code>](#PubSub)  

| Param | Type | Description |
| --- | --- | --- |
| subscriber | <code>function</code> | callback function to be executed once the message arrives |

<a name="PubSub_unsubscribe"></a>

### pubSub.unsubscribe(subscriber)
Unsubscribe from messages. Used by the consumer.

**Kind**: instance method of [<code>PubSub</code>](#PubSub)  

| Param | Type | Description |
| --- | --- | --- |
| subscriber | <code>function</code> | reference to a callback function previously subscribed |

<a name="PubSub_publish"></a>

### pubSub.publish(message)
Publish messages. Used by the producer.

**Kind**: instance method of [<code>PubSub</code>](#PubSub)  

| Param | Type | Description |
| --- | --- | --- |
| message | <code>Message</code> | message published. |

<a name="PubSub_waitForMessage"></a>

### pubSub.waitForMessage([config]) ⇒ <code>Promise.&lt;Message&gt;</code>
Returns a promise that will be resolved when a message matching `WaitForMessageOptions` is found,
or rejected if `WaitForMessageOptions.timeout` is reached. Used by the consumer.

**Kind**: instance method of [<code>PubSub</code>](#PubSub)  
**Returns**: <code>Promise.&lt;Message&gt;</code> - message published.  

| Param | Type |
| --- | --- |
| [config] | <code>WaitForMessageOptions</code> | 

<hr>

# Examples

## Example 1

```ts
import { expect } from '@playwright/test';
import { test } from '@lcrespilho/playwright-fixtures';

test('GA4 page_view on https://ga-dev-tools.google/ga4/enhanced-ecommerce/', async ({ page, collects_ga4 }) => {
  let dummy = false;  
  collects_ga4.subscribe(() => dummy = true)
  const [_, page_view] = await Promise.all([
    page.goto('https://ga-dev-tools.google/ga4/enhanced-ecommerce/'),
    collects_ga4.waitForMessage({
      timeout: 10000,
      regex: /page_view/
    }),
  ]);
  expect(page_view).toBeDefined();
  expect(collects_ga4.messages.length).toBe(1);
  expect(dummy).toBeTruthy();
});
```

#### How to publish to npm registry

https://www.youtube.com/watch?v=Nh9xW2-ZOEU

