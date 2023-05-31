# Publish to Relay
To publish a payload to a Relay channel, we simply use fetch to 'POST' the serialized payload to the Relay service provider (localhost:9099).  
 
NOTE: anything that can be stringified, can be places in the `body` of the request. We strongly recommend that it contain the optional string property named `channel`. This property is used to stream messages to all subscribers of that channel.  
 
The Relay service uses this channel-name to create named Deno BroadcastChannels used to distrubute messages to like-named SSE-subscriptions.    

If a payload does not contain a channel property, the service will default to a channel named 'relay'.  If so, only subscribers that during registration, did not provide a channel name, or provided the name 'relay' will recieve these publications. 

<br/>

![Alt text](/docs/pub-flow1.png)

1. The app calls the relay-clients publish function with the channelName and a payload:
```ts
   const payLoad = { 
      channel: 'LOG', 
      user:{ 
         name: 'Me', 
         age: 74 
      } 
   }
   publish(channel, JSON.stringify(payLoad))
```
2. The relay client `POST`s a request with the channel and payload to the Relay service.   
The channel-name and payload are both serialized in the body of the request:
```ts
/**
 * Publish a message to a channel on the Relay service
 * @param {string} a string or json-string to publish
 */
export function publish(chan = channelName, payload = '') {
   fetch(SERVICE_URL + "/", {
      method: "POST",
      body: JSON.stringify({
         channel: chan,
         data: {
            TS: new Date().toLocaleTimeString('en-US'),
            from: "me",
            payload: payload
         }
      })
   });
   log('Published: ' + payload)
}
```
3. The relay-client makes a post request to the service.
4. The service on method-POST, unpacks the request body to discover the channel name.   
It then creates a temporary Deno BroadcastChannel with that channel-name. 
This temp-BroadcastChannel then posts the payload to the channel before closing it.   
It will then responds with an `ok` confirmation response that has a permisive cors header:
```ts
   // A POST request: client is publishing a message  
   else if (request.method === 'POST') {
      
      // unpack the envelope
      const data = await request.json();
      
      // get the channel name to publish to
      const channel = data.channel || 'relay'

      // broadcast this payload to all listeners
      const bc = new BroadcastChannel(channel);
      bc.postMessage(data);
      bc.close();
      
      // acknowledge reciept of this request with a cors headers
      return new Response("", {
         status: 200,
         headers: {
            "content-type": "text/event-stream",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-cache"
         },
      })
   }
```
5. Any SSE streams that were created with a subscription, and have a BroadcastChannel with this channel-name, will recieve this message and will stream the payload to all subscribed clients.

## For each subscriber ...   

<br/>

![Alt text](/docs/pub-flow2.png)

<br/>

6. All registered clients will listen for these channel-messages and `on-message`, will serialize the payload, and queue it to the stream:
```ts
         // listening for relayChannel messages
         relayChannel.onmessage = (e) => {
            const { channel, data } = e.data
            // pack it
            const reply = JSON.stringify({
               channel: channel,
               data: data
            })
            // send it
            controller.enqueue('data: ' + reply + '\n\n');
         }
```
7., 8. Deno + os will then transport the serialized payload to the clients EventSource.   
9. The relay-clients eventSource will watch for messages with its onMessage eventhandler.   
Remember, the service discrimates based on channel-name, so this client only recieves messages from the channel it registered for. This includes any it has published itself:
```ts
   // catch all messages from the Relay service
   eventSource.addEventListener("message", (evt) => {
      const { data } = JSON.parse(evt.data)
      const { TS, from, payload } = data
      const msg = `payload: ${payload} from: ${from} at: ${TS}`
      log('Recieved: ' + msg)
      post(msg) // some client handler
   });
```
10. The client should handle the message event and payload as required by the app!