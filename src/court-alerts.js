import crypto from 'node:crypto';
import {ACTIVE_VENUES} from './venues.js';
import {localDateParts,zonedMs} from './time.js';

const key=id=>`court-alert/subscription/${id}`;
const clock=m=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
const validMinutes=m=>Number.isInteger(m)&&m>=0&&m<=1410&&m%30===0;
const ISO=/^\d{4}-\d{2}-\d{2}$/;
export function proposedAlert(intent,venue,now=new Date()){
 if(!ACTIVE_VENUES.includes(venue)||!ISO.test(intent.date)||intent.date<localDateParts(now).iso||!validMinutes(intent.startMinute)||!Number.isInteger(intent.durationMinutes)||![60,90,120].includes(intent.durationMinutes))return null;
 const start=Math.max(0,intent.startMinute-60),end=Math.min(1410,intent.startMinute+60);
 return {venueKey:venue.key,date:intent.date,starts:Array.from({length:(end-start)/30+1},(_,i)=>start+i*30),durations:[intent.durationMinutes],origin:'search'};
}
export function alertSummary(spec,venue){return `התראה למועדון ${venue.name} ב-${spec.date}: תחילת משחק ${spec.starts.length===1?clock(spec.starts[0]):`${clock(spec.starts[0])}-${clock(spec.starts.at(-1))}`}, ${spec.durations.length===1?`בדיוק ${spec.durations[0]}`:`לפחות ${Math.min(...spec.durations)}`} דקות. אשלח הודעה בוואטסאפ אם תזוהה זמינות מתאימה. הזמינות יכולה להשתנות.`;}
export function changeAlert(spec,text){const t=String(text).replace(/[–—]/g,'-').trim();let changed={...spec};
 const dur=t.match(/(?:בדיוק|רק|לפחות|מינימום|לא פחות מ-?)?\s*(60|90|120)\s*(?:דק|דקות)?/)||t.match(/(שעה וחצי|שעתיים|שעה)/);
 if(dur){const n=Number(dur[1])||({'שעה':60,'שעה וחצי':90,'שעתיים':120})[dur[1]];changed.durations=/לפחות|מינימום|לא פחות/.test(t)?[60,90,120].filter(x=>x>=n):[n];}
 if(/^(?:כן|לא|תפריט|ביטול)$/.test(t))return null;
 const times=[...t.matchAll(/(?:^|\D)(\d{1,2})(?::(00|30))(?=$|\D)/g)].map(x=>Number(x[1])*60+Number(x[2]));
 if(times.length){if(times.some(m=>!validMinutes(m)))return null;
  if(times.length===2&&/בין|עד|מ-/.test(t)&&!/בדיוק|רק בשעות/.test(t)){if(times[1]<times[0])return null;changed.starts=Array.from({length:(times[1]-times[0])/30+1},(_,i)=>times[0]+30*i);}
  else changed.starts=[...new Set(times)].sort((a,b)=>a-b);
 }else if(/שעה|שעות|זמן|בדיוק/.test(t)&&!dur)return null;
 return changed.durations.length&&changed.starts.length&&changed.starts.length<=16?changed:null;
}
export async function saveAlert(store,userId,spec,{now=new Date(),id=crypto.randomUUID,origin='search',consentText}={}){
 if(!spec||!userId||!consentText||!/^\d{4}-\d{2}-\d{2}$/.test(spec.date||'')||!ACTIVE_VENUES.some(v=>v.key===spec.venueKey)||!Array.isArray(spec.starts)||!spec.starts.length||spec.starts.some(x=>!validMinutes(x)||x>1410)||!Array.isArray(spec.durations)||!spec.durations.length||spec.durations.some(x=>![60,90,120].includes(x)))throw Error('Invalid alert');
 if(spec.date<localDateParts(now).iso||!spec.starts.some(m=>zonedMs(spec.date,m,ACTIVE_VENUES.find(v=>v.key===spec.venueKey).timezone)>now.getTime()))throw Error('Expired alert');
 const alert={...spec,id:id(),userId,status:'active',origin,consentText,consentedAt:now.toISOString(),createdAt:now.toISOString()};await store.set(key(alert.id),alert);return alert;
}
export async function alertsFor(store,userId,now=new Date()){return(await store.list('court-alert/subscription/')).map(x=>x.value).filter(a=>a.userId===userId&&a.status==='active'&&a.date>=localDateParts(now).iso);}
export async function cancelAlert(store,userId,id,now=new Date()){const a=await store.get(key(id));if(!a||a.userId!==userId)return false;await store.set(key(id),{...a,status:'cancelled',cancelledAt:now.toISOString()});return true;}
export function alertMatches(a,w,venue,now=new Date()){
 if(a.status!=='active'||a.venueKey!==venue.key||a.date!==w.date)return false;
 return a.starts.some(m=>a.durations.some(d=>m>=w.startMinute&&m+d<=w.endMinute&&zonedMs(w.date,m,venue.timezone)>now.getTime()));
}
function gameCandidates(r,w,venue,now){
 if(!r.active||r.recurring||r.hasCourt||!r.courtAlertConsent||r.date!==w.date||r.courtAlertVenueKey!==venue.key)return false;
 const durations=r.durations?.length?r.durations:[90];
 return durations.some(d=>[60,90,120].includes(d)&&Array.from({length:Math.max(0,Math.floor((w.endMinute-w.startMinute-d)/30)+1)},(_,i)=>w.startMinute+30*i).some(m=>m>=r.startMinute&&m<r.endMinute&&zonedMs(w.date,m,venue.timezone)>now.getTime()));
}

export async function recordAlertCandidates(store,windows,venue,{now=new Date()}={}){
 const alerts=(await store.list('court-alert/subscription/')).map(x=>x.value),recorded=[];
 for(const {value:r} of await store.list('request/'))if(r?.noCourtAvailable&&r?.courtAlertConsent&&r?.courtAlertVenueKey===venue.key){
  alerts.push({id:`game-${r.id}`,userId:r.userId,venueKey:venue.key,date:r.date,status:r.active?'active':'closed',gameRequestId:r.id,request:r});
 }

 for(const a of alerts)for(const w of windows)if(a.request?gameCandidates(a.request,w,venue,now):alertMatches(a,w,venue,now)){
  if(await store.get(`court-alert/fired/${a.id}`)||await store.get(`court-alert/optout/${a.userId}`))continue;
  const event=`court-alert/outbox/${a.id}/${w.date}/${w.courtId}/${w.startMinute}`;
  if((await store.list(`court-alert/outbox/${a.id}/`)).length)continue;
  const row={alertId:a.id,userId:a.userId,venueKey:a.venueKey,window:w,status:'recorded',origin:a.request?'game_request':'search',at:now.toISOString()};await store.set(event,row);recorded.push(row);
 }
 return recorded;
}
