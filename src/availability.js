import { CONFIG } from "./config.js";
import { staticData, occupied } from "./matchpointer.js";
import { addDays, hhmm, min, rangesFor, weekdayIndex } from "./time.js";
function overlaps(a,b,c,d){ return a<d && c<b; }
function priceFor(data,courtId,date,start,duration){
  const rules=data.overrides.filter(r=>r.court_id===courtId&&r.override_date===date);
  const base=rules.length?rules:data.pricing.filter(r=>r.court_id===courtId&&r.day_of_week===weekdayIndex(date));
  const r=base.find(r=>start>=min(r.start_time)&&start<min(r.end_time));
  if(!r) return null;
  if(duration===90&&r.price_90!=null) return r.price_90;
  if(duration===120&&r.price_120!=null) return r.price_120;
  return Math.round(Number(r.price)*(duration/60));
}
export async function findAvailability(intent,{fetchImpl=fetch,today}={}){
  const data=await staticData(fetchImpl);
  const base=today||new Intl.DateTimeFormat("en-CA",{timeZone:CONFIG.timezone}).format(new Date());
  if(intent.date<base||intent.date>addDays(base,data.venue.advance_booking_days??CONFIG.advanceDays)) return {kind:"outside_window",date:intent.date,advanceDays:data.venue.advance_booking_days??CONFIG.advanceDays,slots:[]};
  const busy=await occupied(intent.date,intent.date,data.courts.map(c=>c.id),fetchImpl);
  const duration=intent.durationMinutes||60, slots=[];
  for(const court of data.courts) for(const range of rangesFor(data.venue,intent.date)){
    const lo=Math.max(min(range.openTime),intent.startMinute??0), hi=Math.min(min(range.closeTime),intent.endMinute??1440);
    for(let start=Math.ceil(lo/30)*30;start+duration<=hi;start+=30){
      if(busy.some(b=>b.court_id===court.id&&b.date===intent.date&&overlaps(start,start+duration,min(b.start_time),min(b.end_time)))) continue;
      slots.push({courtId:court.id,courtName:court.name,start:hhmm(start),end:hhmm(start+duration),durationMinutes:duration,price:priceFor(data,court.id,intent.date,start,duration)});
    }
  }
  return {kind:"availability",date:intent.date,slots};
}
export function formatHebrew(result,limit=8){
  if(result.kind==="outside_window") return `אפשר לבדוק זמינות עד ${result.advanceDays} ימים קדימה.`;
  if(!result.slots.length) return `לא מצאתי מגרש פנוי ב-${result.date} בטווח שביקשת.`;
  const lines=result.slots.slice(0,limit).map(s=>`מגרש ${s.courtName}: ${s.start}–${s.end}${s.price!=null?` · ₪${s.price}`:""}`);
  const more=result.slots.length>limit?`\nיש עוד ${result.slots.length-limit} אפשרויות.`:"";
  return `מצאתי זמינות ב-${result.date}:\n${lines.join("\n")}${more}\n\nהמידע חי לרגע הבדיקה ואינו הזמנה.`;
}
