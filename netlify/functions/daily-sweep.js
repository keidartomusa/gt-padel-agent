import { getStore } from "@netlify/blobs";
import { dailySweep, matchAlert } from "../../src/matching.js";
import { netlifyStore } from "../../src/store.js";
import { sendResponse, sendTemplate } from "../../src/whatsapp.js";
import { deliver } from "../../src/notify.js";
export default async()=>{const store=netlifyStore(getStore("gt-padel-matching")),pairs=await dailySweep(store);let sent=0;// Critique 23.9: same alert as instant matches (party, court, duration, "לא הפעם"); the old mute buttons are gone.
for(const[a,b]of pairs){for(const r of[a,b]){const other=r===a?b:a;await deliver(store,r.userId,matchAlert(r,other),{send:(to,x)=>sendResponse(to,x),sendTemplate:(to,t)=>sendTemplate(to,t.name,t.language,t.payloads)});sent++;}}return Response.json({ok:true,pairs:pairs.length,sent});};
export const config={schedule:"17 7 * * *"};
