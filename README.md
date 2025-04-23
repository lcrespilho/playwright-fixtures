<a name="PubSub"></a>

## PubSub
Generic PubSub class responsible only for managing messages and subscribers.
The page publishes messages. Playwright code consumes them.

**Kind**: global class  

* [PubSub](#PubSub)
    * [.publish()](#PubSub+publish)
    * [.waitForMessage()](#PubSub+waitForMessage)

<a name="PubSub+publish"></a>

### pubSub.publish()
Publish messages. Called internally by fixtures.

**Kind**: instance method of [<code>PubSub</code>](#PubSub)  
<a name="PubSub+waitForMessage"></a>

### pubSub.waitForMessage()
Generic method to wait for a message based on a predicate function.
Returns a promise that resolves with the message or rejects on timeout.

**Kind**: instance method of [<code>PubSub</code>](#PubSub)  
---

## How to publish to npm registry

https://www.youtube.com/watch?v=Nh9xW2-ZOEU

