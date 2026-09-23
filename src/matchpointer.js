import { CONFIG } from "./config.js";
let cache = { expires: 0, value: null };
const headers = { apikey: CONFIG.anonKey, Authorization: `Bearer ${CONFIG.anonKey}`, Origin: CONFIG.siteOrigin, Referer: `${CONFIG.siteOrigin}/`, "User-Agent": "Mozilla/5.0 GT-Padel-Availability/1.0" };
async function get(path, fetchImpl = fetch) {
  const res = await fetchImpl(`${CONFIG.apiBase}/${path}`, { headers });
  if (!res.ok) throw new Error(`Matchpointer ${res.status}`);
  return res.json();
}
export async function staticData(fetchImpl = fetch, now = Date.now()) {
  if (cache.value && cache.expires > now) return cache.value;
  const [venues, courts, pricing, overrides] = await Promise.all([
    get(`venues?slug=eq.${CONFIG.venueSlug}&select=id,name,timezone,opening_hours,advance_booking_days,allow_unbookable_time`, fetchImpl),
    get(`courts?venue_id=eq.${CONFIG.venueId}&is_active=eq.true&select=id,name,sport,court_type,is_active`, fetchImpl),
    get(`pricing_rules?venue_id=eq.${CONFIG.venueId}&select=court_id,day_of_week,start_time,end_time,price,price_90,price_120,label`, fetchImpl),
    get(`pricing_date_overrides?venue_id=eq.${CONFIG.venueId}&select=court_id,override_date,start_time,end_time,price,price_90,price_120,label`, fetchImpl)
  ]);
  const venue = venues[0];
  if (!venue) throw new Error("GT Padel venue missing");
  const value = { venue, courts: courts.filter(c => c.sport === "padel"), pricing, overrides };
  if (value.courts.length !== 3) throw new Error(`Expected 3 active padel courts, got ${value.courts.length}`);
  cache = { value, expires: now + CONFIG.staticTtlMs };
  return value;
}
export async function occupied(from, to, courtIds, fetchImpl = fetch) {
  const q = `reservation_slots?select=court_id,date,start_time,end_time,id,status&date=gte.${from}&date=lte.${to}&status=neq.cancelled`;
  const rows = await get(q, fetchImpl);
  const ids = new Set(courtIds);
  return rows.filter(r => ids.has(r.court_id));
}
export function clearCache() { cache = { expires: 0, value: null }; }

