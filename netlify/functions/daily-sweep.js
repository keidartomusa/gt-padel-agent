import { getStore } from "@netlify/blobs";
import { dailySweep } from "../../src/matching.js";
import { netlifyStore } from "../../src/store.js";
import { sendResponse } from "../../src/whatsapp.js";
export default async()=>{const store=netlifyStore(getStore("gt-padel-matching")),pairs=await dailySweep(store);let sent=0;for(const[a,b]of pairs){const text=`מצאתי התאמה אפשרית: ${a.date} · רמות ${a.level} / ${b.level}. תרצו להתחבר?`;for(const r of[a,b]){const other=r===a?b:a;await sendResponse(r.userId,{text:`${text}\nעם ${other.displayName}.`,buttons:[{id:`connect:${other.id}`,title:"רוצה להתחבר"},{id:"mute_week",title:"השתקה לשבוע"},{id:"mute_custom",title:"השתקה אחרת"}]});sent++;}}return Response.json({ok:true,pairs:pairs.length,sent});};
export const config={schedule:"17 7 * * *"};
