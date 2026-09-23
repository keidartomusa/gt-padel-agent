// Mines real pilot messages (inbound free text) for the time corpus. Tom approved item 2 on 23.9 12:26 ("2. מאשר"): logging to function logs only, no dashboard UI.
// No WhatsApp numbers or names leave the store: user ids are dropped and long digit runs are redacted.
import { parseIntentLocal } from "./intent.js";
import { localConfident } from "./when.js";
export const TIME_CUE=/\d|היום|הערב|מחר|מחרתיים|ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת|מוצ|סופ|שבוע|בוקר|צהר|ערב|לילה|אחה|שעה|אחרי|לפני|עכשיו|tomorrow|today|tonight/i;
export const redact=t=>String(t||"").replace(/\+?\d[\d\s-]{6,}\d/g,"[מספר]").slice(0,300);
export async function minePilot(store){
 const rows=(await store.list("msg/")).map(x=>x.value).filter(v=>v&&v.direction==="in"&&v.kind==="user"&&typeof v.body==="string");
 const free=rows.filter(v=>v.body&&!/^[a-z_]+(:[\w:-]*)?$/i.test(v.body)); // drop button/list ids
 const seen=new Set(),out=[];
 for(const v of free.sort((a,b)=>a.at.localeCompare(b.at))){const text=redact(v.body).trim();if(!text||seen.has(text))continue;seen.add(text);
  const timeRelated=TIME_CUE.test(text),p=timeRelated?parseIntentLocal(text,new Date(v.at)):null;
  out.push({at:v.at,text,timeRelated,local:p?{date:p.date,start:p.startMinute,end:p.endMinute,ambiguousHour:p.ambiguousHour||undefined,confident:localConfident(p,text)}:undefined});}
 return{inboundTotal:rows.length,freeText:free.length,unique:out.length,timeRelated:out.filter(x=>x.timeRelated).length,items:out};
}
