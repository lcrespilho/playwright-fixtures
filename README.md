<a name="PubSub"></a>

## PubSub
Utilizes the Observer Pattern, where the [Page](https://playwright.dev/docs/api/class-page)
is the producer and the Node Playwright Test is the consumer. Every time the Page produces
a message (window.dataLayer.push, or GA4 network request), the consumer's
subscribers callbacks are called.

**Kind**: global class  

* [PubSub](#PubSub)
    * [.publish(message)](#PubSub+publish)
    * [.waitForMessage()](#PubSub+waitForMessage) ⇒

<a name="PubSub+publish"></a>

### pubSub.publish(message)
Publish messages. Called by the producer.
Obs: you are not supposed to call this function on user/test code. It's an
internal function that I could not hide enough. :)

**Kind**: instance method of [<code>PubSub</code>](#PubSub)  

| Param | Description |
| --- | --- |
| message | message published. |

<a name="PubSub+waitForMessage"></a>

### pubSub.waitForMessage() ⇒
Returns a promise that will be resolved when a message matching `TWaitForMessageOptions` is found,
or rejected if `TWaitForMessageOptions.timeout` is reached. Called by the consumer.

**Kind**: instance method of [<code>PubSub</code>](#PubSub)  
**Returns**: message published.  
---

## How to publish to npm registry

https://www.youtube.com/watch?v=Nh9xW2-ZOEU

