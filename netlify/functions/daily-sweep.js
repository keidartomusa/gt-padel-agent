import {selectorStore,selectionKey} from "../../src/club-selection.js";
import {ACTIVE_VENUES,isolatedStoreName} from "../../src/venues.js";
import { getStore } from "@netlify/blobs";
import { dailySweep, matchAlert, allowAlert } from "../../src/matching.js";
import { netlifyStore } from "../../src/store.js";
import { sendResponse, sendTemplate } from "../../src/whatsapp.js";
import { deliver } from "../../src/notify.js";
export default async()=>{let sent=0,totalPairs=0;const selections=selectorStore();for(const venue of ACTIVE_VENUES){const store=netlifyStore(getStore(isolatedStoreName(venue))),pairs=await dailySweep(store);totalPairs+=pairs.length;// Critique 23.9: same alert as instant matches (party, court, duration, "לא הפעם"); the old mute buttons are gone.
const io={send:(to,x)=>sendResponse(to,x),sendTemplate:(to,t)=>sendTemplate(to,t.name,t.language,t.payloads)};
// Tom 23.9 15:36: at most ALERTS_PER_DAY alerts per person per day.
for(const[a,b]of pairs){for(const r of[a,b]){const other=r===a?b:a;const selection=await selections.get(selectionKey(r.userId));if(selection&&selection.venueKey!==venue.key)continue;if(!await allowAlert(store,r.userId))continue;await deliver(store,r.userId,matchAlert(r,other),{...io,venue});sent++;}}
}return Response.json({ok:true,pairs:totalPairs,sent});};
export const config={schedule:"17 7 * * *"};
