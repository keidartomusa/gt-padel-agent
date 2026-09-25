import {CONFIG} from "./config.js";
import {addDays,localDateParts,min,rangesFor} from "./time.js";

// The monitor is deliberately single-venue today. The venue name is data in every alert
// so notifications can later be routed by club without changing the template body.
export const RELEASE_TEMPLATE={name:"gt_court_release_v1",language:"he",category:"UTILITY",body:"עדכון למעקב זמינות שביקשת: במועדון {{1}} התפנו שעות למגרש בתאריך {{2}}, בין {{3}} ל-{{4}}. בדוק זמינות עדכנית לפני הזמנה."};
export const releaseTemplateDefinition=()=>({name:RELEASE_TEMPLATE.name,language:RELEASE_TEMPLATE.language,category:RELEASE_TEMPLATE.category,components:[{type:"BODY",text:RELEASE_TEMPLATE.body,example:{body_text:[["GT PADEL","26.9.2026","18:00","19:30"]]}}]});
const headers={apikey:CONFIG.anonKey,Authorization:`Bearer ${CONFIG.anonKey}`,Origin:CONFIG.siteOrigin,Referer:`${CONFIG.siteOrigin}/`};
async function page(path,fetchImpl){const response=await fetchImpl(`${CONFIG.apiBase}/${path}`,{headers});if(!response.ok)throw Error(`Matchpointer ${response.status}`);const rows=await response.json();if(!Array.isArray(rows))throw Error("Matchpointer response is not an array");return rows;}
async function all(path,fetchImpl){const rows=[];for(let offset=0;offset<=10000;offset+=500){const batch=await page(`${path}&limit=500&offset=${offset}`,fetchImpl);rows.push(...batch);if(batch.length<500)return rows;}throw Error("Matchpointer pagination limit reached");}
const pad=n=>String(n).padStart(2,"0");
const clock=m=>`${pad(Math.floor(m/60)%24)}:${pad(m%60)}`;
const dateLabel=iso=>`${Number(iso.slice(8,10))}.${Number(iso.slice(5,7))}.${iso.slice(0,4)}`;
const keyOf=(date,court,minute)=>`${date}|${court}|${minute}`;
const validTime=t=>/^\d{1,2}:\d{2}/.test(String(t||""));
export async function courtSnapshot({fetchImpl=fetch,now=new Date()}={}){
 const from=localDateParts(now).iso,to=addDays(from,2);
 const venues=await page(`venues?slug=eq.${CONFIG.venueSlug}&select=id,name,opening_hours,advance_booking_days`,fetchImpl);
 const venue=venues.find(v=>v.id===CONFIG.venueId);if(!venue)throw Error("Configured venue missing");
 const courts=await all(`courts?venue_id=eq.${CONFIG.venueId}&is_active=eq.true&sport=eq.padel&select=id,name,sport,is_active`,fetchImpl);
 if(!courts.length)throw Error("No active padel courts");
 const courtIds=new Set(courts.map(c=>c.id));
 const reservations=await all(`reservation_slots?select=court_id,date,start_time,end_time,id,status&date=gte.${from}&date=lte.${to}&status=neq.cancelled`,fetchImpl);
 const occupied=new Set(),startMs=now.getTime(),endMs=startMs+48*60*60*1000;
 for(const r of reservations){if(!courtIds.has(r.court_id)||!validTime(r.start_time)||!validTime(r.end_time))continue;
  const start=min(r.start_time),end=min(r.end_time);if(end<=start||start%30||end%30)continue;
  for(let minute=start;minute<end;minute+=30)occupied.add(keyOf(r.date,r.court_id,minute));}
 const cells=[];
 for(const date of [from,addDays(from,1),to])for(const court of courts)for(const range of rangesFor(venue,date)){
  const open=min(range.openTime),close=min(range.closeTime);
  for(let minute=Math.ceil(open/30)*30;minute+30<=close;minute+=30){
   const dateTime=new Date(`${date}T00:00:00Z`).getTime()+minute*60000;
   // Compare against Israel's actual local offset, including DST changes.
   const offset=new Intl.DateTimeFormat("en-US",{timeZone:CONFIG.timezone,timeZoneName:"longOffset"}).formatToParts(new Date(dateTime)).find(x=>x.type==="timeZoneName")?.value;
   const match=/GMT([+-])(\d{2}):(\d{2})/.exec(offset||"");const off=match?(match[1]==="-"?-1:1)*(Number(match[2])*60+Number(match[3])):0;
   const wallMs=dateTime-off*60000;if(wallMs<startMs||wallMs>=endMs)continue;
   cells.push({date,courtId:court.id,courtName:court.name,minute,occupied:occupied.has(keyOf(date,court.id,minute))});
  }
 }
 return {venueId:venue.id,venueName:venue.name,from,to,at:now.toISOString(),cells};
}
export function freedWindows(before,after){if(!before||before.venueId!==after.venueId)return [];
 const old=new Map(before.cells.map(c=>[keyOf(c.date,c.courtId,c.minute),c]));
 const released=after.cells.filter(c=>!c.occupied&&old.get(keyOf(c.date,c.courtId,c.minute))?.occupied);
 released.sort((a,b)=>a.date.localeCompare(b.date)||a.courtId.localeCompare(b.courtId)||a.minute-b.minute);
 const windows=[];for(const c of released){const last=windows.at(-1);if(last&&last.date===c.date&&last.courtId===c.courtId&&last.endMinute===c.minute)last.endMinute+=30;
 else windows.push({venueId:after.venueId,venueName:after.venueName,courtId:c.courtId,courtName:c.courtName,date:c.date,startMinute:c.minute,endMinute:c.minute+30});}
 return windows;}
export const releaseVariables=w=>[w.venueName,dateLabel(w.date),clock(w.startMinute),clock(w.endMinute)];
export async function scanCourtReleases(store,{now=new Date(),fetchSnapshot=courtSnapshot,notify=async()=>({sent:false,reason:"not_configured"})}={}){
 // The caller supplies a send gate. A disabled scan never touches the provider or store.
 const snapshot=await fetchSnapshot({now});const key=`court-release/snapshot/${snapshot.venueId}`;
 const previous=await store.get(key);const windows=freedWindows(previous,snapshot);
 // Save a complete scan only after all provider reads succeeded; a failed read cannot create false releases.
 await store.set(key,snapshot);
 let sent=0,failed=0;
 for(const w of windows){const result=await notify(w);if(result.sent)sent++;else failed++;}
 return {status:previous?"scanned":"primed",venue:snapshot.venueName,at:snapshot.at,windows:windows.length,sent,failed};
}
