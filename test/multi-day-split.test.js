import test from "node:test"; import assert from "node:assert/strict";
import { handleConversation } from "../src/conversation.js";
import { parseWhen } from "../src/when.js";
import { memoryStore, named } from "./named-store.mjs";
const now = new Date("2026-09-23T18:44:00+03:00");
const H = (s, u, n) => o => handleConversation({ userId: u, displayName: n, store: s, now, availabilityFn: async () => ({ slots: [] }), ...o });
const reqs = async (s, u) => (await s.list("request/")).map(x => x.value).filter(r => r.userId === u && r.active);
async function recurring(s, u, n, text) { await named(s, u, n); const h = H(s, u, n); for (const a of ["recurring", "level:3", "pc:1:yes"]) await h({ actionId: a }); let r = await h({ text }); if (!/נשמר|אפשר עד|כל יום נשמר/.test(r.text)) r = await h({ actionId: "duration:90" }); return r; }

test("live 18:45: 'שישי ושבת ב6 וחצי בבוקר' saves two separate requests, one per day, at 06:30", async () => {
  const s = memoryStore(); const r = await recurring(s, "me", "תום", "שישי ושבת ב6 וחצי בבוקר");
  assert.match(r.text, /נשמרו 2 בקשות נפרדות, אחת לכל יום \(שישי, שבת\)/);
  const rs = await reqs(s, "me"); assert.equal(rs.length, 2);
  assert.deepEqual(rs.map(x => x.weekdays).sort(), [[5], [6]]); assert.ok(rs.every(x => x.startMinute === 390)); assert.notEqual(rs[0].id, rs[1].id);
});
test("multi-day split: each day matches, and is deleted, on its own", async () => {
  const s = memoryStore(); await recurring(s, "o", "אורנה", "שבת ב6 וחצי בבוקר");
  const r = await recurring(s, "me", "תום", "שישי ושבת ב6 וחצי בבוקר");
  assert.match(r.text, /מצאתי התאמה אפשרית/);
  const rs = await reqs(s, "me"), sat = rs.find(x => x.weekdays[0] === 6), fri = rs.find(x => x.weekdays[0] === 5);
  assert.equal(r.notifications.filter(n => n.to === "o").length, 1);
  const h = H(s, "me", "תום"); await h({ actionId: `delok:${fri.id}` });
  assert.deepEqual((await reqs(s, "me")).map(x => x.id), [sat.id]);
});
test("multi-day split respects the 7-request cap before saving anything", async () => {
  const s = memoryStore(); await recurring(s, "me", "תום", "ראשון ושני אחרי 20:00"); await recurring(s, "me", "תום", "שלישי ורביעי אחרי 20:00");
  const r = await recurring(s, "me", "תום", "חמישי שישי שבת ראשון אחרי 08:00");
  assert.match(r.text, /כל יום נשמר כבקשה נפרדת, ואפשר עד 7 בקשות פעילות\. יש לכם כבר 4, אז אפשר להוסיף עוד 3 ימים/);
  assert.equal((await reqs(s, "me")).length, 4);
});
test("'6 וחצי' / '7 ורבע' parse to :30 / :15, 'שעה וחצי' stays a duration", async () => {
  const p = async t => parseWhen(t, now, { log: false });
  assert.equal((await p("מחר ב6 וחצי בבוקר")).startMinute, 390);
  assert.equal((await p("מחר ב7 ורבע בערב")).startMinute, 1155);
  const d = await p("מחר ב-19:00 לשעה וחצי"); assert.equal(d.startMinute, 1140); assert.equal(d.durationMinutes, 90);
});
