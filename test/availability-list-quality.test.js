import test from "node:test";
import assert from "node:assert/strict";
import { availabilityChoices, findAvailability, formatHebrew, nearestGroups, formatNearest } from "../src/availability.js";
import { routeIncoming } from "../src/webhook.js";
import { memoryStore } from "../src/store.js";
import { clearCache } from "../src/matchpointer.js";

const snap = JSON.parse(await (await import("node:fs/promises")).readFile(new URL("./provider-snapshot-2026-09-23.json", import.meta.url), "utf8"));
const fakeFetch = async url => {
  const u = String(url);
  const body = u.includes("/venues?") ? [snap.venue] : u.includes("/courts?") ? snap.courts : u.includes("/pricing_rules?") ? snap.pricing : u.includes("/pricing_date_overrides?") ? snap.overrides : u.includes("/reservation_slots?") ? snap.reservations : [];
  return { ok: true, json: async () => body };
};
const many = () => { const slots = []; for (const courtName of ["1", "2", "3"]) for (let h = 7; h < 23; h++) slots.push({ courtId: `c${courtName}`, courtName, start: `${String(h).padStart(2, "0")}:00`, end: `${String(h + 1).padStart(2, "0")}:30`, durationMinutes: 90, price: 240 + Number(courtName) }); return { kind: "availability", date: "2026-09-25", slots }; };

test("slot row titles are never truncated: full time range in title, courts and price in description", () => {
  const rows = availabilityChoices([many()]);
  for (const r of rows) { assert.match(r.title, /^\d\d:\d\d–\d\d:\d\d$/); assert(r.title.length <= 24); assert.match(r.description, /^מגרש 1 · ₪241$|^מגרש 2 · ₪242$|^מגרש 3 · ₪243$/); assert(r.description.length <= 72); }
});

test("slot list plus menu row never exceeds Meta's 10-row limit", async () => {
  const r = await routeIncoming({ userId: "rows", text: "יש מגרש ביום שישי ל90 דקות?", store: memoryStore(), now: new Date("2026-09-23T08:00:00+03:00") });
  const rows = r.list?.sections.flatMap(s => s.rows) || [];
  assert(rows.length <= 10, `rows=${rows.length}`);
  assert.equal(availabilityChoices([many()]).length, 9);
});

test("summary text counts the extra list rows instead of asking the user to narrow", () => {
  const text = formatHebrew(many());
  assert.match(text, /ועוד \d+ שעות ברשימה/);
  assert.doesNotMatch(text, /כתוב לי/);
});

test("multi-day slot rows carry their date so rows from different days are distinguishable", () => {
  const a = many(), b = { ...many(), date: "2026-09-26" };
  const rows = availabilityChoices([a, b]);
  assert(rows.every(r => /^\d{1,2}\.\d{1,2} \d\d:\d\d–\d\d:\d\d$/.test(r.title)), rows.map(r => r.title).join("|"));
});

test("today never offers slots that already started", async () => {
  clearCache();
  const date = snap.date, now = new Date(`${date}T20:00:00+03:00`);
  const r = await findAvailability({ date, startMinute: 0, endMinute: 1440, durationMinutes: 60 }, { fetchImpl: fakeFetch, now });
  assert(r.slots.every(s => s.start >= "20:00"), r.slots.map(s => s.start).join(","));
  clearCache();
});

test("empty requested range offers nearest same-day slots without a dangling question", () => {
  const day = many();
  const groups = nearestGroups(day, { startMinute: 0, endMinute: 6 * 60 });
  assert(groups.length === 3 && groups[0].start === "07:00");
  const text = formatNearest(day, groups);
  assert.match(text, /השעות הכי קרובות באותו יום/);
  assert.doesNotMatch(text, /\?$/);
});

test("a fully booked day ends with a clear statement, not a yes/no question", () => {
  const text = formatHebrew({ kind: "availability", date: "2026-09-25", slots: [] });
  assert.doesNotMatch(text, /רוצה שאבדוק/);
  assert.doesNotMatch(text, /\?$/);
});

test("availability questions with numeric dates, clock times or 'יש משהו' reach availability, not the menu", async () => {
  const now = new Date("2026-09-23T08:00:00+03:00");
  for (const [i, text] of ["25/9 בצהריים ל120 דקות", "26/9 בשעה 12:00 ל90 דקות", "יש משהו ביום ראשון אחרי 19:00?", "אפשר מחר ב16:00 לשעתיים?", "מחר לפני 19:00 לשעתיים"].entries()) {
    const r = await routeIncoming({ userId: `route-${i}`, text, store: memoryStore(), now });
    assert.doesNotMatch(r.text, /ברוכים הבאים|לא הצלחתי להבין/, text);
    assert.match(r.text, /זמינות|אין מגרש פנוי/, text);
  }
});

test("time answers inside the players flow stay in registration even when they look like availability", async () => {
  const s = memoryStore(), now = new Date("2026-09-23T08:00:00+03:00");
  for (const actionId of ["players", "oneoff", "level:3–3.5"]) await routeIncoming({ userId: "flow", actionId, store: s, now });
  const r = await routeIncoming({ userId: "flow", text: "מחר אחרי 19:00", store: s, now });
  assert.doesNotMatch(r.text, /יש זמינות|אין מגרש פנוי/);
  assert((await s.get("state/flow")).step !== "when");
});
