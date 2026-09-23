// QA round 23.9 (Tom 13:42 "סבב בדיקות לכל התהליכים") + Tom 13:47 mute steering. Every finding is locked here.
import test from "node:test";
import assert from "node:assert/strict";
import { handleConversation } from "../src/conversation.js";
import { withMenu } from "../src/webhook.js";
import { formatHebrew } from "../src/availability.js";
import { parseWhen } from "../src/when.js";
import { answerResponse } from "../src/agent.js";
import { UNCLEAR_WHEN } from "../src/timeres.js";
import { isMuted } from "../src/matching.js";
import { memoryStore, named } from "./named-store.mjs";
const now = new Date("2026-09-23T08:00:00+03:00");
const available = async i => ({ kind: "availability", date: i.date, slots: [{ courtId: "c1", courtName: "1", start: "19:00", end: "20:30", durationMinutes: 90, price: 300 }] });
const H = (s, u, name) => o => handleConversation({ userId: u, displayName: name, store: s, now, availabilityFn: available, ...o });
const ids = r => [...(r.buttons || []), ...(r.list?.sections || []).flatMap(x => x.rows)];
const quiet = async f => { const o = console.log; console.log = () => {}; try { return await f(); } finally { console.log = o; } };
async function create(s, u, name, { when = "מחר אחרי 19:00", level = "level:3", court = "yes", party = "party:1" } = {}) {
  await named(s, u, name); const h = H(s, u, name);
  for (const o of [{ actionId: "oneoff" }, { actionId: level }, { text: when }, { actionId: "duration:90" }, { actionId: party }]) await quiet(() => h(o));
  let r = await quiet(() => h({ actionId: `court:${court}` })); if (court === "no") r = await quiet(() => h({ actionId: "flex:60" })); return r;
}
const noKey = async f => { const k = process.env.OPENAI_API_KEY; delete process.env.OPENAI_API_KEY; try { return await quiet(f); } finally { if (k) process.env.OPENAI_API_KEY = k; } };

test("one match: 'מצאתי התאמה אפשרית', never 'מצאתי 1 התאמות'", async () => {
  const s = memoryStore(); await create(s, "a", "דנה"); const r = await create(s, "b", "נועם");
  assert.match(r.text, /מצאתי התאמה אפשרית ושלחתי הצעה:/); assert.doesNotMatch(r.text, /מצאתי 1 /);
});
test("match notification: weekday + date + window, no ISO date; mute button renamed 'השתקה למשך זמן…'", async () => {
  const s = memoryStore(); await create(s, "a", "דנה"); const r = await create(s, "b", "נועם");
  const n = r.notifications[0].response;
  assert.match(n.text, /נועם · חמישי 24\.9 · אחרי 19:00 · רמה 3–3\.5/); assert.doesNotMatch(n.text, /2026-/);
  assert.deepEqual(ids(n).map(x => x.title), ["רוצה להתחבר", "השתקה לשבוע", "השתקה למשך זמן…"]);
  assert.ok(ids(n).every(x => x.title.length <= 20));
});
test("'השתקה למשך זמן…' asks for how long; 1 day reads 'יום אחד'", async () => {
  const s = memoryStore(), h = H(s, "a", "דנה"); await named(s, "a", "דנה");
  const r = await h({ actionId: "mute_custom" });
  assert.match(r.text, /לכמה זמן להשתיק/);
  assert.deepEqual(ids(r).map(x => x.title), ["יום אחד", "3 ימים", "7 ימים", "14 ימים", "30 ימים"]);
  assert.equal((await h({ actionId: "mute_1" })).text, "ההתראות הושתקו ליום אחד.");
  assert.equal((await h({ actionId: "mute_3" })).text, "ההתראות הושתקו ל־3 ימים.");
});
test("no 'השתקה אחרת' anywhere in settings", async () => {
  const s = memoryStore(), r = await H(s, "a", "דנה")({ text: "הגדרות" });
  assert.ok(!ids(r).some(x => x.title === "השתקה אחרת")); assert.ok(ids(r).some(x => x.title === "השתקה למשך זמן…"));
});
test("muted user can unmute from settings (the mute message promises it)", async () => {
  const s = memoryStore(), h = H(s, "a", "דנה");
  assert.match((await h({ actionId: "mute_week" })).text, /דרך תפריט ההגדרות/);
  const set1 = await h({ text: "הגדרות" });
  assert.match(set1.text, /ההתראות מושתקות כרגע/); assert.ok(ids(set1).some(x => x.id === "unmute" && x.title === "ביטול השתקה"));
  assert.equal((await h({ actionId: "unmute" })).text, "ההתראות חזרו לפעול.");
  assert.equal(await isMuted(s, "a", now), false);
  const set2 = await h({ text: "הגדרות" }); assert.ok(ids(set2).some(x => x.id === "mute_week")); assert.ok(!ids(set2).some(x => x.id === "unmute"));
});
test("connect request and answers: weekday date, gender-neutral copy", async () => {
  const s = memoryStore(); await create(s, "a", "יוסי"); const req = (await s.list("request/"))[0].value;
  await named(s, "b", "דנה"); const sent = await H(s, "b", "דנה")({ actionId: `connect:${req.id}` });
  assert.equal(sent.text, "שלחתי בקשת חיבור ליוסי. אעדכן כשתגיע תשובה.");
  const ask = sent.notifications[0].response.text;
  assert.match(ask, /^דנה רוצה להתחבר לבקשה שלך: חמישי 24\.9 · אחרי 19:00 · רמה 3–3\.5\./); assert.doesNotMatch(ask, /2026-/);
  const c = (await s.list("connection/"))[0].value, acc = await H(s, "a", "יוסי")({ actionId: `accept:${c.id}` });
  assert.match(acc.notifications[0].response.text, /^החיבור עם יוסי אושר! אפשר ליצור קשר: /);
  for (const t of [sent.text, ask, acc.text, acc.notifications[0].response.text]) assert.doesNotMatch(t, /\/ה|\/תאשר/);
});
test("board: 'שחקן אחד', open-ended window as 'אחרי 19:00', at most 9 requests + menu row", async () => {
  const s = memoryStore(); for (let i = 0; i < 12; i++) await create(s, `u${i}`, `שחקן${i}`);
  const r = withMenu(await quiet(() => H(s, "viewer", "צופה")({ text: "מי מחפש משחק מחר בערב?" })));
  assert.match(r.text, /רמה 3–3\.5 · אחרי 19:00 · שחקן אחד · יש מגרש/); assert.doesNotMatch(r.text, /1 שחקנים|–00:00|24:00/);
  const rows = r.list.sections.flatMap(x => x.rows); assert.ok(rows.length <= 10, String(rows.length));
  assert.equal(rows.filter(x => x.id === "menu").length, 1); assert.equal(rows.filter(x => x.id.startsWith("connect:")).length, 9);
  assert.ok(rows.every(x => x.title.length <= 24 && (x.description || "").length <= 72));
});
test("withMenu never duplicates a menu row ('הבקשות שלי' showed לתפריט twice)", async () => {
  const s = memoryStore(); await create(s, "a", "דנה");
  const r = withMenu(await H(s, "a", "דנה")({ actionId: "my_requests" }));
  assert.equal(r.list.sections.flatMap(x => x.rows).filter(x => x.id === "menu").length, 1);
});
test("availability slot list ends with a menu row and stays within 10 rows", () => {
  const choices = Array.from({ length: 9 }, (_, i) => ({ id: `bk:${i}`, title: `1${i}:00–1${i}:30`, description: "מגרש 2 · ₪300" }));
  const rows = withMenu({ text: "יש זמינות", choices }).list.sections[0].rows;
  assert.equal(rows.length, 10); assert.equal(rows.at(-1).id, "menu");
});
test("Hebrew date label has no comma ('ביום חמישי 24.9')", () => {
  const t = formatHebrew({ kind: "availability", date: "2026-09-24", slots: [] });
  assert.match(t, /ביום חמישי 24\.9 /); assert.doesNotMatch(t, /חמישי, /);
});
test("'אחרי/לפני' + non-time words asks instead of showing the whole day", async () => {
  for (const t of ["מחר אחרי העבודה", "שישי אחרי האימון", "מחר לפני העבודה"]) assert.equal((await noKey(() => parseWhen(t, now))).needsClarification, "unclear", t);
  for (const t of ["מחר אחרי 19:00", "מחר", "מחר אחרי הצהריים", "שישי בבוקר"]) assert.notEqual((await noKey(() => parseWhen(t, now))).needsClarification, "unclear", t);
  assert.equal((await noKey(() => answerResponse("מחר אחרי העבודה", { now }))).text, UNCLEAR_WHEN);
});
test("every request-saved path offers the menu, never mute (Tom 13:15 + 13:47)", async () => {
  const s = memoryStore(), paths = [
    await create(s, "p1", "א"), await create(s, "p2", "ב", { court: "no" }), await create(s, "p3", "ג", { party: "party:3" }),
  ];
  // recurring
  await named(s, "p4", "ד"); const h = H(s, "p4", "ד"); let r;
  for (const o of [{ actionId: "recurring" }, { actionId: "level:3" }, { text: "שני ורביעי אחרי 20:00" }, { actionId: "duration:90" }, { actionId: "party:1" }]) r = await quiet(() => h(o));
  r = await quiet(() => h({ actionId: "court:yes" })); paths.push(r);
  // name asked first (no stored name)
  const { memoryStore: bare } = await import("../src/store.js"); const s2 = bare(), h2 = H(s2, "p5", "ה");
  for (const o of [{ actionId: "oneoff" }, { actionId: "level:3" }, { text: "מחר אחרי 19:00" }, { actionId: "duration:90" }, { actionId: "party:1" }, { actionId: "court:yes" }]) await quiet(() => h2(o));
  paths.push(await quiet(() => h2({ text: "הדס" })));
  for (const p of paths) { assert.match(p.text, /הבקשה נשמרה/); assert.ok(!ids(withMenu(p)).some(x => /^mute/.test(x.id)), JSON.stringify(ids(p))); assert.ok(ids(withMenu(p)).some(x => x.id === "menu")); }
});
test("'לנסות זמן אחר' after a no-court request keeps the answers and asks only for a new time", async () => {
  const none = async i => ({ kind: "availability", date: i.date, slots: [] });
  const s = memoryStore(); await named(s, "a", "הילה");
  let fn = none; const h = o => handleConversation({ userId: "a", displayName: "הילה", store: s, now, availabilityFn: (...x) => fn(...x), ...o });
  for (const o of [{ actionId: "oneoff" }, { actionId: "level:3" }, { text: "מחר בערב" }, { actionId: "duration:90" }, { actionId: "party:1" }, { actionId: "court:no" }]) await quiet(() => h(o));
  const no = await quiet(() => h({ actionId: "flex:60" }));
  assert.match(no.text, /הבקשה לא פורסמה/); assert.ok(ids(no).some(x => x.id === "retry_when" && x.title === "לנסות זמן אחר"));
  const ask = await h({ actionId: "retry_when" }); assert.match(ask.text, /^מתי תרצו לשחק\?/);
  fn = available; let r = await quiet(() => h({ text: "ראשון אחרי 19:00" }));
  for (let i = 0; i < 6 && !/הבקשה נשמרה/.test(r.text); i++) { const b = ids(r).find(x => /^(duration:90|party:1|court:no|flex:60)$/.test(x.id)); assert.ok(b, r.text); r = await quiet(() => h({ actionId: b.id })); }
  assert.match(r.text, /הבקשה נשמרה/);
  const req = (await s.list("request/")).map(x => x.value).find(x => x.active); assert.equal(req.level, "3–3.5"); assert.equal(req.date, "2026-09-27");
});
test("edit confirmation shows party size and court, so a party/court edit is visible", async () => {
  const s = memoryStore(); await create(s, "a", "אלון"); const req = (await s.list("request/"))[0].value, h = H(s, "a", "אלון");
  await h({ actionId: `ef:${req.id}:party` }); const r = await quiet(() => h({ actionId: "party:3" }));
  assert.match(r.text, /^עדכנתי: .* · 3 שחקנים · יש מגרש\.$/m);
});
