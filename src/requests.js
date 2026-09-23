// Multi-request management (Tom 23.9 13:18 approved: list / edit / delete / add, cap 5, no notice to the other side on edit).
import { activeRequests, levelTitle } from "./matching.js";
export const MAX_ACTIVE_REQUESTS = 7; // Tom 23.9 19:01: cap 7 (was 5)
const HE_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const hhmm = m => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export function timeLabel(r) {
  const s = r.startMinute, e = r.endMinute;
  if (s == null) return "כל היום";
  if (e == null || e >= 1440) return `אחרי ${hhmm(s)}`;
  if (s === 0) return `לפני ${hhmm(e)}`;
  return `${hhmm(s)}–${hhmm(Math.min(e, 1439))}`;
}
export function dayLabel(r) {
  if (r.recurring) return (r.weekdays || []).map(d => HE_DAYS[d]).join(", ");
  if (!r.date) return "";
  const d = new Date(`${r.date}T12:00:00Z`);
  return `${HE_DAYS[d.getUTCDay()]} ${d.getUTCDate()}.${d.getUTCMonth() + 1}`;
}
export const reqTitle = r => `${r.recurring ? "קבועה · " : ""}${dayLabel(r)} · ${timeLabel(r)}`;
export function reqDesc(r) {
  const dur = "";
  return [r.recurring ? "קבועה" : "חד-פעמית", r.level ? `רמה ${r.level}` : "", dur].filter(Boolean).join(" · ");
}
export async function userActiveRequests(store, userId, now) {
  return (await activeRequests(store, now)).filter(x => x.userId === userId).sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
}
export async function lastRequest(store, userId) {
  return (await store.list("request/")).map(x => x.value).filter(x => x?.userId === userId && x.level)
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))[0] || null;
}
