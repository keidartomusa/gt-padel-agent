import { getStore } from "@netlify/blobs";
import { dailySweep, matchAlert, allowAlert, dueFollowups } from "../../src/matching.js";
import { netlifyStore } from "../../src/store.js";
import { sendResponse, sendTemplate } from "../../src/whatsapp.js";
import { deliver } from "../../src/notify.js";
export default async()=>{const store=netlifyStore(getStore("gt-padel-matching")),pairs=await dailySweep(store);let sent=0;// Critique 23.9: same alert as instant matches (party, court, duration, "לא הפעם"); the old mute buttons are gone.
const io={send:(to,x)=>sendResponse(to,x),sendTemplate:(to,t)=>sendTemplate(to,t.name,t.language,t.payloads)};
// Tom 23.9 15:36: at most ALERTS_PER_DAY alerts per person per day; then the closing-flow questions.
for(const[a,b]of pairs){for(const r of[a,b]){const other=r===a?b:a;if(!await allowAlert(store,r.userId))continue;await deliver(store,r.userId,matchAlert(r,other),io);sent++;}}
const followups=await dueFollowups(store);for(const f of followups)await deliver(store,f.to,f.response,io);
return Response.json({ok:true,pairs:pairs.length,sent,followups:followups.length});};
export const config={schedule:"17 7 * * *"};
