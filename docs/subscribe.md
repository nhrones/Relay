# Relay Subscriptions   

To subscribe to Relay messages, we instantiate a new EventSource on the client with a channel name as follows:
```ts 
// port 9099 is just a convention I use for Relay
const relayURL = `https://localhost:9099/subscribe/?channel="LOG"`;
const relayStream = new EventSource(relayURL);
```
This will register the client for a stream of messages from the `LOG` channel.   

NOTE: If no `/?channel="xxx"` parameter is included in the request url, the service will subscribe this client to a default channel named 'relay'.  This client will then only recieve events published with either no channel name, or published with the name 'relay'.

<br/>

![Alt text](sub-flow.png)

1. Client app calls the relay-stubs subscribe function:
```ts
subscribe("LOG", document.getElementById('logger'))
```
2. client relay-stub instantiates an EventSource instance:
```ts
   // this is our Relay client; we'll call her `eventSource`
   const eventSource = new EventSource(SERVICE_URL + `/subscribe/?channel=${channelName}`);
   // catch all messages from the Relay service
   eventSource.addEventListener("message", (evt) => {
      const { data } = JSON.parse(evt.data)
      const { TS, from, payload } = data
      log(`Recieved: payload: ${payload} from: ${from} at: ${TS}`)
   });
```
3. Browser sends a `subscribe` request:
4. Relay Service unpacks subscribe request to find the `channel` name, and calls: 
```ts
// registers this new client for a named stream (channel)
return registerClient(request, channel)
```
5. The registration opens a BroadcastChannel for this `channel-name`, and then creates a new ReadableStream to service this clients EventSource. 
```ts
/**             
 * Server Sent Events
 * Subscribes a client to a named relay channel stream
 */
function registerClient(_req: Request, channel: string): Response {

   // named channel per connection
   const relayChannel = new BroadcastChannel(channel);
   
   // configure a stream for this client on this channel name
   const stream = new ReadableStream({
      start: (controller) => {

         // listening for relayChannel messages
         relayChannel.onmessage = (e) => {
            const { channel, data } = e.data
            if (DEBUG) console.info(data)
            // pack it
            const reply = JSON.stringify({
               channel: channel,
               data: data
            })
            // send it
            controller.enqueue('data: ' + reply + '\n\n');
         }
      },
      cancel() {
         relayChannel.close();
      }
   })

   // ...
   // see below
   // ...
}
```
6., 7.,8.,  The Relay service returns a `Stream-Response` with a permisive `Access-Control` header.
```ts
   // stream all relay messages with cors header 
   return new Response(stream.pipeThrough(new TextEncoderStream()), {
      headers: {
         "content-type": "text/event-stream",
         "Access-Control-Allow-Origin": "*",
         "Cache-Control": "no-cache"
      },
   })
```  
That completes the Relay subscription registration.
From this point on, any publication payload addressed to this channel name from any connected client on any Deploy isolate/region, will have that payload streamed to this client.
