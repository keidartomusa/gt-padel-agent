import test from "node:test"; import assert from "node:assert/strict";
import { handleConversation } from "../src/conversation.js";
import { memoryStore, named } from "./named-store.mjs";
const now = new Date("2026-09-23T08:00:00+03:00");
const available = async i => ({ kind: "availability", date: i.date, slots: [{ courtId: "c1", courtName: "1", start: "19:00", end: "20:30", durationMinutes: i.durationMinutes || 90, price: 300 }] });
const H = (s, u, n) => o => handleConversation({ userId: u, displayName: n, store: s, now, availabilityFn: available, ...o });
const rows = r => (r.list?.sections || []).flatMap(x => x.rows);
const reqs = async (s, u) => (await s.list("request/")).map(x => x.value).filter(r => r.userId === u && r.active);
async function seed(s, u, n, when = "מחר אחרי 19:00 ל90 דקות", pc = "pc:1:yes") { await named(s, u, n); const h = H(s, u, n); for (const a of ["oneoff", "level:3", pc]) await h({ actionId: a }); await h({ text: when }); return (await reqs(s, u))[0]; }
async function pending(s, from) { return (await s.list("connection/")).map(x => x.value).filter(c => c.fromUserId === from && c.status === "pending"); }

test("live 18:25: picking from the board also opens the picker's own request (party asked), request is sent", async () => {
  const s = memoryStore(); const t = await seed(s, "t", "תימור"); const o = await seed(s, "o", "אורנה"); await named(s, "me", "תום");
  const h = H(s, "me", "תום"); await h({ actionId: "board" }); const b = await h({ actionId: "bwhen:2" });
  const r = await h({ actionId: `connect:${t.id}` });
  assert.match(r.text, /^שלחתי בקשת חיבור לתימור/); assert.match(r.text, /אני פותח גם לכם בקשה בלוח/); assert.match(r.text, /מה הרמה שלכם|כמה אתם/);
assert.ok(r.notifications.some(n => n.to === "t" && /רוצה להתחבר/.test(n.response.text)));
  let x = r; if (/מה הרמה/.test(x.text)) x = await h({ actionId: "level:3" });
  x = await h({ actionId: "pc:2:yes" }); for (let i = 0; i < 4 && !/נשמרה/.test(x.text || ""); i++) { const all = [...(x.buttons || []), ...rows(x)], id = (all.find(b => b.id === "duration:90") || all[0])?.id; x = await h({ actionId: id }); }
  assert.match(x.text, /הבקשה נשמרה/);
  const mine = await reqs(s, "me"); assert.equal(mine.length, 1); assert.equal(mine[0].date, t.date); assert.equal(mine[0].partySize, 2);
  // multi-pick: the matches offered after saving do not repeat Timor (already asked), Orna is offered
  assert.ok(!rows(x).some(r => r.id === `connect:${t.id}`)); assert.ok(rows(x).some(r => r.id === `connect:${o.id}`));
  const y = await h({ actionId: `connect:${o.id}` }); assert.match(y.text, /^שלחתי בקשת חיבור לאורנה/);
  assert.equal((await pending(s, "me")).length, 2);
});

test("Tom 18:25: with an own request already, a pick offers the rest of the board for another pick", async () => {
  const s = memoryStore(); const t = await seed(s, "t", "תימור"); const o = await seed(s, "o", "אורנה"); await seed(s, "me", "תום", "מחר אחרי 19:00 ל90 דקות", "pc:1:yes");
  const h = H(s, "me", "תום"); await h({ actionId: "board" }); await h({ actionId: "bwhen:2" });
  const r = await h({ actionId: `connect:${t.id}` }); assert.match(r.text, /אפשר לשלוח בקשה גם למשחק נוסף/);
  assert.deepEqual(rows(r).filter(x => x.id.startsWith("connect:")).map(x => x.id), [`connect:${o.id}`]);
  const r2 = await h({ actionId: `connect:${o.id}` }); assert.ok(!rows(r2).some(x => x.id.startsWith("connect:"))); assert.equal((await pending(s, "me")).length, 2);
});

test("Tom 18:28: a pair counts as 2 seats - pair + single = 3, + single = 4 full, a pair cannot join a 3", async () => {
  const s = memoryStore(); const t = await seed(s, "t", "תימור"); const pair = await seed(s, "p", "זוג", "מחר אחרי 19:00 ל90 דקות", "pc:2:yes");
  assert.equal(pair.partySize, 2);
  const hp = H(s, "p", "זוג"), ht = H(s, "t", "תימור");
  await hp({ actionId: `connect:${t.id}` }); const c1 = (await pending(s, "p"))[0]; await ht({ actionId: `accept:${c1.id}` });
  let T = await s.get(`request/${t.id}`); assert.equal(T.partySize, 3); assert.ok(!T.full);
  const p2 = await seed(s, "q", "זוג2", "מחר אחרי 19:00 ל90 דקות", "pc:2:yes"); const blocked = await H(s, "q", "זוג2")({ actionId: `connect:${t.id}` }); assert.match(blocked.text, /אין מספיק מקום/);
  await seed(s, "o", "אורן"); await H(s, "o", "אורן")({ actionId: `connect:${t.id}` }); const c2 = (await pending(s, "o"))[0]; await ht({ actionId: `accept:${c2.id}` });
  T = await s.get(`request/${t.id}`); assert.equal(T.partySize, 4); assert.equal(T.full, true);
});

test("live 18:38: registering with a court for 120 min is offered the open 90-min requests right away", async () => {
  const s = memoryStore(); const t = await seed(s, "t", "תימור", "מחר אחרי 21:00 ל90 דקות"); const o = await seed(s, "o", "אורנה", "מחר אחרי 19:00 ל90 דקות");
  await named(s, "me", "תום"); const h = H(s, "me", "תום"); for (const a of ["oneoff", "level:3", "pc:1:yes"]) await h({ actionId: a });
  const r = await h({ text: "מחר ב-21:00 ל120 דקות" });
  assert.match(r.text, /הבקשה נשמרה/); assert.doesNotMatch(r.text, /אעדכן כשאמצא התאמה/); assert.match(r.text, /מצאתי 2 התאמות/);
  assert.deepEqual(rows(r).filter(x => x.id.startsWith("connect:")).map(x => x.id).sort(), [`connect:${t.id}`, `connect:${o.id}`].sort());
});

test("live 18:41: 'הבקשות שלי' lists the requests in the message body with a pointer to the button", async () => {
  const s = memoryStore(); await seed(s, "me", "תום", "מחר אחרי 19:00 ל90 דקות"); await seed(s, "me", "תום", "שישי אחרי 08:00 ל90 דקות");
  const r = await H(s, "me", "תום")({ actionId: "my_requests" });
  assert.match(r.text, /^\*הבקשות שלי\* \(2\)/); assert.match(r.text, /1\. .*אחרי 19:00/); assert.match(r.text, /2\. .*אחרי 08:00/); assert.match(r.text, /רמה 3/); assert.match(r.text, /לחצו על 'לבקשות'/);
  assert.equal(r.list.button, "לבקשות");
});
