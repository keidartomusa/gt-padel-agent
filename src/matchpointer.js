import { CONFIG } from "./config.js";
import {GT_VENUE} from "./venues.js";
const cache=new Map();
const headersFor=venue=>({apikey:venue.anonKey,Authorization:`Bearer ${venue.anonKey}`,Origin:venue.siteOrigin,Referer:`${venue.siteOrigin}/`,"User-Agent":"Mozilla/5.0 GT-Padel-Availability/1.0"});
async function get(path,fetchImpl=fetch,venue=GT_VENUE){
 const res=await fetchImpl(`${venue.apiBase}/${path}`,{headers:headersFor(venue)});
 if(!res.ok)throw new Error(`Matchpointer ${res.status}`);
 return res.json();
}
export async function staticData(fetchImpl=fetch,now=Date.now(),venue=GT_VENUE){
 const cached=cache.get(venue.venueId);if(cached&&cached.expires>now)return cached.value;
 const [venues,courts,pricing,overrides]=await Promise.all([
  get(`venues?slug=eq.${venue.venueSlug}&select=id,name,timezone,opening_hours,advance_booking_days,allow_unbookable_time`,fetchImpl,venue),
  get(`courts?venue_id=eq.${venue.venueId}&is_active=eq.true&select=id,name,sport,court_type,is_active`,fetchImpl,venue),
  get(`pricing_rules?venue_id=eq.${venue.venueId}&select=court_id,day_of_week,start_time,end_time,price,price_90,price_120,label`,fetchImpl,venue),
  get(`pricing_date_overrides?venue_id=eq.${venue.venueId}&select=court_id,override_date,start_time,end_time,price,price_90,price_120,label`,fetchImpl,venue)
 ]);
 const selected=venues.find(v=>v.id===venue.venueId);if(!selected)throw Error("Configured venue missing");
 const value={venue:selected,courts:courts.filter(c=>c.sport==="padel"),pricing,overrides};
 if(!value.courts.length)throw Error("No active padel courts");
 cache.set(venue.venueId,{value,expires:now+(venue.staticTtlMs??CONFIG.staticTtlMs)});
 return value;
}
export async function occupied(from,to,courtIds,fetchImpl=fetch,venue=GT_VENUE){
 const q=`reservation_slots?select=court_id,date,start_time,end_time,id,status&date=gte.${from}&date=lte.${to}&status=neq.cancelled`;
 const rows=await get(q,fetchImpl,venue),ids=new Set(courtIds);
 return rows.filter(r=>ids.has(r.court_id));
}
export function clearCache(){cache.clear();}
