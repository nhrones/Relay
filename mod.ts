
import { serve } from "./deps.ts"

const RELAYPORT = parseInt(Deno.env.get('PORT') as string) || 9099
const DEBUG = true//(Deno.env.get('DEBUG') === 'true') ? true: false;

// look for any 'help' request
if (Deno.args[0] === '-h' || Deno.args[0] === '?') {
   console.log(`
Relay Service Help --
Usage:
commandline options:
-h  or ? this help text.
This service is used To stream data between apps. 
This service uses a fixed Port number 9099.
`);
   Deno.exit(0);
};


// Start our Server
serve(handleRequest, { hostname: "localhost", port: RELAYPORT })
   .then(() => console.log("Server closed"))
   .catch((err) => console.info('Server caught error - ', err))

console.log('Service started on port:', RELAYPORT)


// Handle all http requests
async function handleRequest(request: Request): Promise<Response> {

   // get our path-name and any search parameters
   const { pathname, searchParams } = new URL(request.url);
   
   // a request to subscribe to a relay-stream (SSE)
   if (pathname.includes("subscribe")) {
      
      // get any channel name in the url (if none, we default to 'relay')
      const channel = searchParams.get("channel") || "relay"
      
      if (DEBUG) console.log('Recieved a subscription request. channel ', channel)
      
      // register the new client for a named stream - (channel)
      return registerClient(request, channel)
   }

   // A client is publishing a message  
   else if (request.method === 'POST') {
      
      // The request body will contain a channel-name and data-payload
      const {channel, data} = await request.json();

      if (DEBUG) console.log(`Client posted: ${JSON.stringify(data)}, to channel: ${channel}`)
      
      // broadcast this payload to all subscribed listener on this channel 
      const bc = new BroadcastChannel(channel);
      bc.postMessage(data);
      bc.close();
      
      // acknowledge reciept of this request with appropriate headers
      return new Response("", {
         status: 200,
         headers: {
            "content-type": "text/event-stream",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-store"
         },
      })
   }

   // An unknown request - report it! 
   else {
      return await Promise.resolve(new Response(
         "Unknown request recieved: " + pathname, { status: 404 }
      ))
   }
}

/**             
 * Server Sent Events
 * Subscribes a client to a named relay channel stream
 */
function registerClient(_req: Request, chan: string): Response {
   
   const channel = chan
   // named channel per connection
   const relayChannel = new BroadcastChannel(channel);
   
   // configure a stream for this client on this channel name
   const stream = new ReadableStream({
      start: (controller) => {

         // listening for relayChannel messages
         relayChannel.onmessage = (e) => {
            // pack it
            const reply = JSON.stringify({
               channel: channel,
               data: e.data
            })
            // send it
            controller.enqueue('data: ' + reply + '\n\n');
         }
      },
      cancel() {
         relayChannel.close();
      }
   })

   // stream all relay messages with cors header 
   return new Response(stream.pipeThrough(new TextEncoderStream()), {
      headers: {
         "content-type": "text/event-stream",
         "Access-Control-Allow-Origin": "*",
         "Cache-Control": "no-store"
      },
   })
}

/** 
 * the Relay client module 
 */
export {publish, subscribe} from './client.ts'
