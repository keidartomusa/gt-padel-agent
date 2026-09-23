import { getStore } from "@netlify/blobs";
import { dailySweep, levelNote } from "../../src/matching.js";
import { netlifyStore } from "../../src/store.js";
import { sendResponse, sendTemplate } from "../../src/whatsapp.js";
import { deliver } from "../../src/notify.js";
export default async()=>{const store=netlifyStore(getStore("gt-padel-matching")),pairs=await dailySweep(store);let sent=0;for(const[a,b]of pairs){const text=`מצאתי התאמה אפשרית: ${a.date} · רמות ${a.level} / ${b.level}. תרצו להתחבר?`;for(const r of[a,b]){const other=r===a?b:a;await deliver(store,r.userId,{text:`${text}\nעם ${other.displayName} · רמה ${other.level}${levelNote(r.level,other.level)}.`,buttons:[{id:`connect:${other.id}`,title:"רוצה להתחבר"},{id:"mute_week",title:"השתקה לשבוע"},{id:"mute_custom",title:"השתקה אחרת"}]},{send:(to,x)=>sendResponse(to,x),sendTemplate:(to,t)=>sendTemplate(to,t.name,t.language,t.payloads)});sent++;}}return Response.json({ok:true,pairs:pairs.length,sent});};
export const config={schedule:"17 7 * * *"};
