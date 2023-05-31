/// <reference lib="dom" />

/*================================================
NOTE: This file is used in applications that 
      use esbuild to bundle deno client side code. 
//===============================================*/


const SERVICE_URL = `http://localhost:9099`;
const DEBUG = true;

/** 
 * an optional screen logging element 
 */
let loggingGUI: HTMLElement | null
/** 
 * of our Relay channel name 
 */
let channelName: string

/** 
 * subscribes to Relay messages   
 * initializes an EventSource channel
 * @argument {string} channel - the name of a channel to subscribe to
 * @argument {HTMLElement} loggerDomElement - a screen element to log to  
 */ 
export const subscribe = (channelName: string, loggerDomElement: HTMLElement | null = null) => {
   
   // any local GUI log element
   loggingGUI = loggerDomElement
   
   // this is our Relay client; we'll call her `eventSource`
   const eventSource = new EventSource(SERVICE_URL + `/subscribe/?channel=${channelName}`);
   
   // report an initial state
   log("CONNECTING");

   // on open; we'll notify UI
   eventSource.addEventListener("open", () => {
      // report the new state
      log("CONNECTED")
   });

   // notify any eventSource state change 
   eventSource.addEventListener("error", (_e) => {
      switch (eventSource.readyState) {
         case EventSource.OPEN:
            log("CONNECTED");
            break;
         case EventSource.CONNECTING:
            log("CONNECTING");
            break;
         case EventSource.CLOSED:
            log("DISCONNECTED");
            break;
      }
   });

   // catch all messages from the Relay service
   eventSource.addEventListener("message", (evt) => {
      const { data } = JSON.parse(evt.data)
      const { TS, from, payload } = data
      const msg = `payload: ${payload} from: ${from} at: ${TS}`
      if (DEBUG) console.info('Recieved: ', msg);
      log('Recieved: ' + msg)
   });
};

/**
 * Publish to a channel on the Relay service
 * @param {string}  payload - string or json-string to publish
 * @param {string}  chan - channel name
 */
export function publish( payload = '', chan = channelName, ) {
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

/** 
 * logs to the screen if available, or else to the console 
 * @argument {string} what - optional string to log
 */
 function log(what = '') {
   if (loggingGUI) {
      loggingGUI.textContent += what + '\n'
   } else {
      console.log(what)
   }
 }
