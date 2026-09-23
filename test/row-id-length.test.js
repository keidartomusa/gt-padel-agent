// Live 23.9 12:45: Tom tapped מגרש פנוי, wrote "מחר בערב" and got no reply. Meta rejected the list with
// (#131009) "Row id is too long. Max length is 200" because row ids were base64 of the tracking URL (455 chars).
import test from "node:test";
import assert from "node:assert/strict";
import { routeIncoming } from "../src/webhook.js";
import { availabilityChoices, slotActionId, slotFromActionId } from "../src/availability.js";
import { memoryStore } from "./named-store.mjs";
const now = new Date("2026-09-23T12:45:00+03:00");
const uuid = "3f2b8c1e-1234-4abc-9def-0123456789ab";
const slots = d => [{ courtId: uuid, courtName: "3", start: "17:30", end: "19:00", durationMinutes: 90, price: 300 }, { courtId: uuid, courtName: "3", start: "20:00", end: "21:30", durationMinutes: 90, price: 240.5 }];
const idsOk = r => { for (const s of r.list?.sections || []) for (const row of s.rows) { assert.ok(row.id.length <= 200, `row id ${row.id.length} chars`); assert.match(row.id, /^[\x20-\x7e]+$/); } for (const b of r.buttons || []) assert.ok(b.id.length <= 256); };
test("availability list row ids are short ASCII", () => {
  const rows = availabilityChoices([{ kind: "availability", date: "2026-09-24", slots: slots() }]);
  assert.ok(rows.length >= 1);
  for (const r of rows) { assert.ok(r.id.length <= 200, r.id); assert.match(r.id, /^bk:[\x21-\x7e]+$/); }
});
test("slot id round-trips", () => {
  for (const s of slots()) { const d = slotFromActionId(slotActionId("2026-09-24", s)); assert.equal(d.date, "2026-09-24"); assert.equal(d.slot.courtId, uuid); assert.equal(d.slot.start, s.start); assert.equal(d.slot.durationMinutes, 90); assert.equal(d.slot.price, s.price); }
  assert.equal(slotFromActionId("bk:garbage"), null);
});
test("Tom's 12:45 flow: tap מגרש פנוי, write מחר בערב, get a sendable list, tap a slot, get the booking link", async () => {
  const s = memoryStore(), fn = async i => ({ kind: "availability", date: i.date, slots: slots() });
  let r = await routeIncoming({ userId: "tom", actionId: "availability", store: s, now, availabilityFn: fn }); idsOk(r);
  r = await routeIncoming({ userId: "tom", text: "מחר בערב", store: s, now, availabilityFn: fn }); idsOk(r);
  const row = r.list.sections[0].rows.find(x => x.id.startsWith("bk:"));
  assert.ok(row, JSON.stringify(r.list.sections[0].rows.map(x => x.id)));
  r = await routeIncoming({ userId: "tom", actionId: row.id, store: s, now, availabilityFn: fn });
  assert.ok(r.ctaUrl?.url.startsWith("https://gtpadel.netlify.app/go/book?"), JSON.stringify(r));
  const target = new URL(new URL(r.ctaUrl.url).searchParams.get("target"));
  const d = slotFromActionId(row.id);
  assert.equal(target.searchParams.get("court"), d.slot.courtId);
  assert.equal(target.searchParams.get("date"), d.date);
  assert.equal(target.searchParams.get("time"), d.slot.start);
});
test("whatsapp function reads conversation state with strong consistency", async () => {
  const { readFileSync } = await import("node:fs");
  assert.match(readFileSync(new URL("../netlify/functions/whatsapp.js", import.meta.url), "utf8"), /consistency:\s*"strong"/);
});
