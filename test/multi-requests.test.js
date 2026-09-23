// Tom 23.9 13:12 + 13:18 ("a. כן / B. כן / C. כן"): empty board opens a request (reusing level/duration), several requests per user,
// list / edit one field / delete, cap 5, no notice to the other player on edit.
import test from "node:test";
import assert from "node:assert/strict";
import { handleConversation } from "../src/conversation.js";
import { memoryStore, named } from "./named-store.mjs";
const now = new Date("2026-09-23T08:00:00+03:00");
const available = async i => ({ kind: "availability", date: i.date, slots: [{ courtId: "c1", courtName: "1", start: "19:00", end: "20:30", durationMinutes: i.durationMinutes || 90, price: 300 }] });
const none = async i => ({ kind: "availability", date: i.date, slots: [] });
const H = (s, u, name = "דנה", fn = available) => o => handleConversation({ userId: u, displayName: name, store: s, now, availabilityFn: fn, ...o });
const ids = r => [...(r.buttons || []).map(b => b.id), ...(r.list?.sections || []).flatMap(x => x.rows.map(y => y.id))];
async function create(s, u, { when = "מחר אחרי 19:00", level = "level:2", court = "yes", name = "דנה" } = {}) {
  await named(s, u, name); const h = H(s, u, name);
  await h({ actionId: "oneoff" }); await h({ actionId: level }); await h({ text: when }); await h({ actionId: "duration:90" }); await h({ actionId: "party:1" });
  let r = await h({ actionId: `court:${court}` }); if (court === "no") r = await h({ actionId: "flex:60" }); return r;
}
const mine = async (s, u) => (await s.list("request/")).map(x => x.value).filter(x => x.userId === u && x.active);

test("saved confirmation: הבקשות שלי | בקשה נוספת | לתפריט, no mute", async () => {
  const s = memoryStore(), r = await create(s, "a");
  assert.match(r.text, /הבקשה נשמרה/);
  assert.deepEqual(r.buttons.map(b => [b.id, b.title]), [["my_requests", "הבקשות שלי"], ["players", "בקשה נוספת"], ["menu", "לתפריט"]]);
});
test("a second request is allowed and both are listed", async () => {
  const s = memoryStore(); await create(s, "a"); await create(s, "a", { when: "שישי בבוקר" });
  assert.equal((await mine(s, "a")).length, 2);
  const r = await H(s, "a")({ actionId: "my_requests" });
  const rows = r.list.sections[0].rows;
  assert.equal(rows.filter(x => x.id.startsWith("req:")).length, 2);
  assert.ok(rows.some(x => x.id === "players" && x.title === "➕ בקשה חדשה"));
  assert.ok(rows.some(x => x.id === "menu"));
  for (const x of rows) { assert.ok(x.title.length <= 24, x.title); assert.ok(x.id.length <= 200); assert.match(x.id, /^[\x20-\x7e]+$/); }
  assert.match(rows[0].title, /^חמישי 24\.9 · אחרי 19:00$/);
  assert.match(rows[0].description, /חד-פעמית · רמה .* · 90 דק׳/);
});
test("typed 'הבקשות שלי' opens the list; empty state offers a new request", async () => {
  const s = memoryStore(); await named(s, "e", "דנה");
  const r = await H(s, "e")({ text: "הבקשות שלי" });
  assert.equal(r.text, "אין לכם כרגע בקשות פעילות.");
  assert.deepEqual(r.buttons.map(b => b.id), ["players", "menu"]);
});
test("tap a request -> עריכה | מחיקה | חזרה", async () => {
  const s = memoryStore(); await create(s, "a"); const [q] = await mine(s, "a");
  const r = await H(s, "a")({ actionId: `req:${q.id}` });
  assert.deepEqual(r.buttons.map(b => b.title), ["עריכה", "מחיקה", "חזרה"]);
});
test("delete asks to confirm, then deactivates", async () => {
  const s = memoryStore(); await create(s, "a"); const [q] = await mine(s, "a"), h = H(s, "a");
  let r = await h({ actionId: `del:${q.id}` });
  assert.match(r.text, /^למחוק את הבקשה ל/); assert.deepEqual(r.buttons.map(b => b.title), ["כן, למחוק", "לא"]);
  r = await h({ actionId: `delok:${q.id}` });
  assert.equal(r.text, "מחקתי את הבקשה."); assert.equal((await mine(s, "a")).length, 0);
});
test("someone else cannot view, edit or delete my request", async () => {
  const s = memoryStore(); await create(s, "a"); const [q] = await mine(s, "a"); await named(s, "z", "זר");
  for (const a of [`req:${q.id}`, `edit:${q.id}`, `del:${q.id}`, `delok:${q.id}`]) assert.equal((await H(s, "z", "זר")({ actionId: a })).text, "הבקשה כבר לא פעילה.");
  assert.equal((await mine(s, "a")).length, 1);
});
test("edit menu hides גמישות when the request has a court", async () => {
  const s = memoryStore(); await create(s, "a"); const [q] = await mine(s, "a");
  const r = await H(s, "a")({ actionId: `edit:${q.id}` });
  const titles = r.list.sections[0].rows.map(x => x.title);
  assert.deepEqual(titles, ["יום ושעה", "רמה", "משך", "מספר שחקנים", "מגרש", "חזרה"]);
  const s2 = memoryStore(); await create(s2, "b", { court: "no" }); const [q2] = await mine(s2, "b");
  assert.ok((await H(s2, "b")({ actionId: `edit:${q2.id}` })).list.sections[0].rows.some(x => x.title === "גמישות"));
});
for (const [field, answer, check] of [
  ["level", { actionId: "level:4" }, q => assert.notEqual(q.level, undefined)],
  ["duration", { actionId: "duration:120" }, q => assert.deepEqual(q.durations, [120])],
  ["party", { actionId: "party:3" }, q => assert.equal(q.partySize, 3)],
  ["when", { text: "שישי אחרי 20:00" }, q => { assert.equal(q.date, "2026-09-25"); assert.equal(q.startMinute, 1200); }],
  ["court", { actionId: "court:no" }, q => assert.equal(q.hasCourt, false)],
]) test(`edit ${field} changes only that field and confirms`, async () => {
  const s = memoryStore(); await create(s, "a"); const [before] = await mine(s, "a"), h = H(s, "a");
  await h({ actionId: `ef:${before.id}:${field}` });
  const r = await h(answer);
  assert.match(r.text, /^עדכנתי: /); assert.deepEqual(r.buttons.map(b => b.id), ["my_requests", "menu"]);
  const [after] = await mine(s, "a"); check(after);
  for (const k of ["level", "durations", "partySize", "date", "startMinute", "hasCourt"]) if (!{ level: ["level"], duration: ["durations"], party: ["partySize"], when: ["date", "startMinute"], court: ["hasCourt"] }[field].includes(k)) assert.deepEqual(after[k], before[k], k);
});
test("edit flex on a no-court request", async () => {
  const s = memoryStore(); await create(s, "b", { court: "no" }); const [q] = await mine(s, "b"), h = H(s, "b");
  await h({ actionId: `ef:${q.id}:flex` }); await h({ actionId: "flex:any" });
  assert.ok((await mine(s, "b"))[0].flexMinutes > 60);
});
test("edit court to yes sets exact time", async () => {
  const s = memoryStore(); await create(s, "b", { court: "no" }); const [q] = await mine(s, "b"), h = H(s, "b");
  await h({ actionId: `ef:${q.id}:court` }); await h({ actionId: "court:yes" });
  const [a] = await mine(s, "b"); assert.equal(a.hasCourt, true); assert.equal(a.flexMinutes, 0);
});
test("edit when with an ambiguous hour asks am/pm and then saves", async () => {
  const s = memoryStore(); await create(s, "a"); const [q] = await mine(s, "a"), h = H(s, "a");
  await h({ actionId: `ef:${q.id}:when` });
  let r = await h({ text: "שישי ב-9" }); assert.match(r.text, /בבוקר או/);
  r = await h({ actionId: "ampm:pm" }); assert.match(r.text, /^עדכנתי: /);
  const [a] = await mine(s, "a"); assert.equal(a.date, "2026-09-25"); assert.equal(a.startMinute, 1260);
});
test("editing a request with an approved connection sends the other player nothing", async () => {
  const s = memoryStore(); await create(s, "a"); const [q] = await mine(s, "a");
  await s.set("connection/c1", { id: "c1", fromUserId: "b", toUserId: "a", requestId: q.id, status: "accepted" });
  const h = H(s, "a"); await h({ actionId: `ef:${q.id}:party` }); const r = await h({ actionId: "party:2" });
  assert.ok(!(r.notifications || []).some(n => n.to === "b"));
  assert.equal((await s.get("connection/c1")).status, "accepted");
});
test("cap: a 6th request is refused with the cap text", async () => {
  const s = memoryStore();
  for (const w of ["מחר אחרי 19:00", "שישי בבוקר", "שבת בבוקר", "ראשון בערב", "שני בערב"]) await create(s, "a", { when: w });
  assert.equal((await mine(s, "a")).length, 5);
  const r = await H(s, "a")({ actionId: "oneoff" });
  assert.equal(r.text, "יש לכם כבר 5 בקשות פעילות. אפשר למחוק אחת דרך 'הבקשות שלי'.");
  const l = await H(s, "a")({ actionId: "my_requests" });
  assert.ok(!l.list.sections[0].rows.some(x => x.id === "players"));
});
test("empty board opens a request: first time asks level, date is kept, never asks מתי", async () => {
  const s = memoryStore(); await named(s, "n", "נועם"); const h = H(s, "n", "נועם");
  await h({ actionId: "board" });
  let r = await h({ text: "מחר אחרי 18:00" });
  assert.equal(r.text, "אין כרגע משחקים פתוחים ביום חמישי 24.9 אחרי 18:00, אז אני פותח לך בקשה ואחפש לך שחקנים. מה הרמה שלך?");
  assert.ok(ids(r).includes("cancel_req"));
  r = await h({ actionId: "level:2" }); assert.equal(r.text, "כמה זמן תרצו לשחק?");
  r = await h({ actionId: "duration:90" }); r = await h({ actionId: "party:1" }); r = await h({ actionId: "court:yes" });
  assert.match(r.text, /הבקשה נשמרה/);
  const [q] = await mine(s, "n"); assert.equal(q.date, "2026-09-24"); assert.equal(q.startMinute, 1080);
});
test("empty board reuses level and duration from the last request", async () => {
  const s = memoryStore(); await create(s, "a", { when: "שבת בבוקר", level: "level:4" }); const [prev] = await mine(s, "a"), h = H(s, "a");
  await h({ actionId: "board" });
  const r = await h({ text: "מחר אחרי 18:00" });
  assert.match(r.text, /^אין כרגע משחקים פתוחים ביום חמישי 24\.9 אחרי 18:00, אז אני פותח לך בקשה ואחפש לך שחקנים\./);
  assert.match(r.text, new RegExp(`לקחתי מהבקשה הקודמת: רמה ${prev.level.replace(/[.+]/g, "\\$&")}, 90 דקות`));
  assert.match(r.text, /כמה שחקנים אתם\?$/);
  await h({ actionId: "party:2" }); const done = await h({ actionId: "court:yes" });
  assert.match(done.text, /הבקשה נשמרה/);
  const qs = await mine(s, "a"); const q = qs.find(x => x.id !== prev.id);
  assert.equal(q.level, prev.level); assert.deepEqual(q.durations, [90]); assert.equal(q.partySize, 2);
});
test("empty-board auto-open can be cancelled", async () => {
  const s = memoryStore(); await named(s, "c", "רון"); const h = H(s, "c", "רון");
  await h({ actionId: "board" }); await h({ text: "מחר אחרי 18:00" });
  const r = await h({ actionId: "cancel_req" });
  assert.equal(r.text, "בסדר, לא פתחתי בקשה."); assert.equal((await mine(s, "c")).length, 0);
});
test("welcome shows הבקשות שלי only when the user has an active request", async () => {
  const s = memoryStore(); await named(s, "w", "דנה");
  let r = await H(s, "w")({ text: "תפריט" }); assert.deepEqual(r.buttons.map(b => b.id), ["availability", "players"]);
  await create(s, "w"); r = await H(s, "w")({ text: "תפריט" });
  assert.deepEqual(r.buttons.map(b => b.id), ["availability", "players", "my_requests"]);
});
