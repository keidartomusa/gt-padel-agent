import crypto from 'node:crypto';
import {ACTIVE_VENUES,venueByKey,bookingTargetAllowed} from './venues.js';
import {findAvailability,bookingUrl} from './availability.js';
import {occupied,staticData} from './matchpointer.js';
const prefix='court-release/book/';
export async function createReleaseBookingToken(store,window,{random=crypto.randomUUID,now=new Date()}={}){
 const venue=ACTIVE_VENUES.find(v=>v.venueId===window.venueId);
 if(!venue||!/^\d{4}-\d\d-\d\d$/.test(window.date)||!window.courtId||!Number.isInteger(window.startMinute)||!Number.isInteger(window.endMinute)||![60,90,120].includes(window.endMinute-window.startMinute)||window.startMinute%30||window.endMinute%30)throw Error('Invalid release window');
 const token=random();if(!/^[0-9a-f-]{36}$/.test(token))throw Error('Invalid token');
 await store.set(prefix+token,{venueKey:venue.key,date:window.date,courtId:window.courtId,startMinute:window.startMinute,durationMinutes:window.endMinute-window.startMinute,createdAt:now.toISOString()});
 return token;
}
export async function resolveReleaseBooking(store,token,{now=new Date(),availability=findAvailability,providerStatic=staticData,providerOccupied=occupied}={}){
 if(!/^[0-9a-f-]{36}$/.test(token||''))return{status:404};
 const item=await store.get(prefix+token);if(!item)return{status:404};
 const venue=venueByKey(item.venueKey);if(!venue)return{status:404};
 if(now.getTime()-new Date(item.createdAt).getTime()>48*3600000)return{status:410};
 // Check fresh provider reservations directly, then apply the normal booking-page rules.
 const live=await providerStatic(fetch,Date.now(),venue);
 if(live.venue?.id!==venue.venueId||!live.courts.some(c=>c.id===item.courtId))return{status:410};
 const reservations=await providerOccupied(item.date,item.date,[item.courtId],fetch,venue);
 const clash=reservations.some(r=>r.court_id===item.courtId&&r.date===item.date&&((Number(r.start_time.slice(0,2))*60+Number(r.start_time.slice(3,5)))<item.startMinute+item.durationMinutes)&&item.startMinute<(Number(r.end_time.slice(0,2))*60+Number(r.end_time.slice(3,5))));
 if(clash)return{status:410};
 const data=await availability({date:item.date,startMinute:item.startMinute,endMinute:item.startMinute+item.durationMinutes,durationMinutes:item.durationMinutes},{venue,now});
 const slot=data.slots?.find(s=>s.courtId===item.courtId&&s.durationMinutes===item.durationMinutes&&s.start===`${String(Math.floor(item.startMinute/60)).padStart(2,'0')}:${String(item.startMinute%60).padStart(2,'0')}`);
 if(!slot)return{status:410};
 const target=bookingUrl(item.date,slot,{source:'court-release',venue});
 const parsed=new URL(target);const destination=parsed.searchParams.get('target');
 if(parsed.searchParams.get('venue')!==venue.key||!bookingTargetAllowed(venue,destination))return{status:410};
 return{status:302,location:destination};
}
