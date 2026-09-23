const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
export const min = t => { const [h,m] = t.slice(0,5).split(":").map(Number); return h*60+m; };
export const hhmm = n => `${String(Math.floor(n/60)).padStart(2,"0")}:${String(n%60).padStart(2,"0")}`;
export function localDateParts(date, timezone="Asia/Jerusalem") {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit",weekday:"long"}).formatToParts(date).filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));
  return { iso:`${parts.year}-${parts.month}-${parts.day}`, weekday:parts.weekday };
}
export function addDays(iso, days) { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate()+days); return d.toISOString().slice(0,10); }
export function weekdayIndex(iso) { return new Date(`${iso}T12:00:00Z`).getUTCDay(); }
export function rangesFor(venue, iso) {
  const name = dayNames[weekdayIndex(iso)];
  const d = venue.opening_hours.find(x=>x.day===name);
  if (!d?.isOpen) return [];
  return d.timeRanges?.length ? d.timeRanges : [{openTime:d.openTime,closeTime:d.closeTime}];
}

// Epoch ms of a local wall-clock minute on an ISO date (handles DST via the zone's real offset that day).
export function zonedMs(iso, minute, timezone = "Asia/Jerusalem") {
  const [y, m, d] = iso.split("-").map(Number), guess = Date.UTC(y, m - 1, d, 0, minute);
  const off = new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName: "longOffset" }).formatToParts(new Date(guess)).find(p => p.type === "timeZoneName")?.value || "GMT";
  const mm = /GMT([+-])(\d{2}):?(\d{2})?/.exec(off), sign = mm?.[1] === "-" ? -1 : 1, offMin = mm ? sign * (Number(mm[2]) * 60 + Number(mm[3] || 0)) : 0;
  return guess - offMin * 60000;
}
