import { noDur } from "./no-duration.mjs";
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
const H = (s, u, name) => noDur(o => handleConversation({ userId: u, displayName: name, store: s, now, availabilityFn: available, ...o }));
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
  assert.match(r.text, /מצאתי התאמה אפשרית ושלחתי הצעה\./); assert.doesNotMatch(r.text, /מצאתי 1 /);
});
test("match notification: weekday + date + window, no ISO date; connect + לא הפעם, no mute (Tom 14:13, critique item 8)", async () => {
  const s = memoryStore(); await create(s, "a", "דנה"); const r = await create(s, "b", "נועם");
  const n = r.notifications[0].response;
  assert.match(n.text, /נועם · חמישי 24\.9 · אחרי 19:00 · רמה 3–3\.5/); assert.doesNotMatch(n.text, /2026-/);
  assert.deepEqual(ids(n).map(x => x.title), ["רוצה להתחבר", "לא הפעם"]);
  // Critique item 5: party, court, duration and the combined count.
  assert.match(n.text, /\nשחקן אחד · יש מגרש\nיחד: 2 מתוך 4\n/);
});
test("connect request to the owner has no mute button", async () => {
  const s = memoryStore(); await create(s, "a", "יוסי"); const req = (await s.list("request/"))[0].value;
  await named(s, "b", "דנה"); const sent = await H(s, "b", "דנה")({ actionId: `connect:${req.id}` });
  assert.deepEqual(ids(sent.notifications[0].response).map(x => x.title), ["כן, לחבר", "לא מתאים"]);
});
test("no mute wording anywhere in settings, lists or alerts", async () => {
  const s = memoryStore(); await create(s, "a", "דנה"); const r = await create(s, "b", "נועם");
  const set1 = await H(s, "a", "דנה")({ text: "הגדרות" }), mine = withMenu(await H(s, "a", "דנה")({ actionId: "my_requests" }));
  for (const x of [set1, mine, r, ...r.notifications.map(n => n.response)]) assert.doesNotMatch(JSON.stringify(x), /השתק|mute/);
});
test("leave the list: from settings, from 'הבקשות שלי', or by typing; confirm; requests removed; no more alerts", async () => {
  const s = memoryStore(); await create(s, "a", "דנה"); await create(s, "a", "דנה", { when: "שישי בבוקר" });
  const h = H(s, "a", "דנה");
  assert.ok(ids(await h({ text: "הגדרות" })).some(x => x.id === "leave" && x.title === "מחיקת כל הבקשות"));
  assert.ok(ids(await h({ actionId: "my_requests" })).some(x => x.id === "leave"));
  for (const t of ["תסירו אותי מהרשימה", "הסר אותי", "אני רוצה להפסיק לקבל הודעות", "stop"]) { const q = await h({ text: t }); assert.equal(q.text, "למחוק את כל הבקשות שלכם?", t); }
  const no = await h({ actionId: "leave_no" }); assert.equal(no.text, "בסדר, לא מחקתי כלום.");
  assert.equal((await s.list("request/")).filter(x => x.value.active).length, 2);
  const ask = await h({ actionId: "leave" }); assert.deepEqual(ids(ask).map(x => x.id), ["leave_yes", "leave_no"]);
  const done = await h({ actionId: "leave_yes" }); assert.match(done.text, /^מחקתי את כל הבקשות שלכם\./);
  assert.equal((await s.list("request/")).filter(x => x.value.active && x.value.userId === "a").length, 0);
  assert.ok((await s.get("profile/a")).optedOutAt);
  const other = await create(s, "b", "נועם"); assert.ok(!(other.notifications || []).some(n => n.to === "a"));
  assert.doesNotMatch(other.text, /דנה/);
  const board = await quiet(() => H(s, "c", "גל")({ text: "מי מחפש משחק מחר בערב?" })); assert.doesNotMatch(board.text, /דנה/);
});
test("a normal message containing 'הסר' is not an opt-out", async () => {
  const s = memoryStore(); const r = await quiet(() => H(s, "a", "דנה")({ text: "איך מסירים בקשה אחת?" }));
  assert.doesNotMatch(r.text || "", /להסיר אותך מהרשימה/);
});
test("old mute buttons in chat history lead to the leave option, not an error", async () => {
  const s = memoryStore(); for (const a of ["mute_week", "mute_custom", "mute_3", "unmute"]) { const r = await H(s, "a", "דנה")({ actionId: a }); assert.ok(ids(r).some(x => x.id === "leave"), a); }
});
test("connect request and answers: weekday date, gender-neutral copy", async () => {
  const s = memoryStore(); await create(s, "a", "יוסי"); const req = (await s.list("request/"))[0].value;
  await named(s, "b", "דנה"); const sent = await H(s, "b", "דנה")({ actionId: `connect:${req.id}` });
  assert.match(sent.text, /^שלחתי בקשת חיבור ליוסי\. אעדכן כשתגיע תשובה\./);
  const ask = sent.notifications[0].response.text;
  assert.match(ask, /^דנה רוצה להתחבר לבקשה שלכם: חמישי 24\.9 · אחרי 19:00 · רמה 3–3\.5\./); assert.doesNotMatch(ask, /2026-/);
  const c = (await s.list("connection/"))[0].value, acc = await H(s, "a", "יוסי")({ actionId: `accept:${c.id}` });
  assert.match(acc.notifications[0].response.text, /^החיבור עם יוסי אושר! אפשר לשלוח הודעה בלחיצה\./);
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
  for (const o of [{ actionId: "recurring" }, { actionId: "level:3" }, { actionId: "party:1" }, { text: "שני ורביעי אחרי 20:00" }]) r = await quiet(() => h(o));
  r = await quiet(() => h({ actionId: "duration:90" })); paths.push(r);
  // name asked first (no stored name)
  const { memoryStore: bare } = await import("../src/store.js"); const s2 = bare(), h2 = H(s2, "p5", "ה");
  for (const o of [{ actionId: "oneoff" }, { actionId: "level:3" }, { text: "מחר אחרי 19:00" }, { actionId: "duration:90" }, { actionId: "party:1" }, { actionId: "court:yes" }]) await quiet(() => h2(o));
  paths.push(await quiet(() => h2({ text: "הדס" })));
  for (const p of paths) { assert.match(p.text, /הבקשה נשמרה|נשמרו \d+ בקשות/); assert.ok(!ids(withMenu(p)).some(x => /^mute/.test(x.id)), JSON.stringify(ids(p))); assert.ok(ids(withMenu(p)).some(x => x.id === "menu")); }
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
  for (let i = 0; i < 6 && !/הבקשה נשמרה|נשמרו \d+ בקשות/.test(r.text); i++) { const b = ids(r).find(x => /^(duration:90|party:1|court:no|flex:60)$/.test(x.id)); assert.ok(b, r.text); r = await quiet(() => h({ actionId: b.id })); }
  assert.match(r.text, /הבקשה נשמרה|נשמרו \d+ בקשות/);
  const req = (await s.list("request/")).map(x => x.value).find(x => x.active); assert.equal(req.level, "3–3.5"); assert.equal(req.date, "2026-09-27");
});
test("edit confirmation shows party size and court, so a party/court edit is visible", async () => {
  const s = memoryStore(); await create(s, "a", "אלון"); const req = (await s.list("request/"))[0].value, h = H(s, "a", "אלון");
  await h({ actionId: `ef:${req.id}:party` }); const r = await quiet(() => h({ actionId: "party:3" }));
  assert.match(r.text, /^חד-פעמית · .* · 3 שחקנים · יש מגרש$/m);
});
test("Tom 14:12: board never shows phones; they pass only after the owner approves the connection", async () => {
  const s = memoryStore(); await create(s, "972501110021", "טל");
  const b = withMenu(await quiet(() => H(s, "972501110022", "גיל")({ text: "מי מחפש משחק מחר בערב?" })));
  const all = JSON.stringify({ t: b.text, r: b.list.sections.flatMap(x => x.rows).map(r => [r.title, r.description]) });
  assert.doesNotMatch(all, /050-1110021|0501110021|972501110021(?!")/);
  const row = b.list.sections.flatMap(x => x.rows).find(r => r.id.startsWith("connect:"));
  await named(s, "972501110022", "גיל"); const sent = await H(s, "972501110022", "גיל")({ actionId: row.id });
  assert.doesNotMatch(JSON.stringify(sent), /050-1110021/); assert.doesNotMatch(sent.notifications[0].response.text, /050-1110022/);
  const c = (await s.list("connection/"))[0].value, acc = await H(s, "972501110021", "טל")({ actionId: `accept:${c.id}` });
  // Tom 15:01: a "שלח הודעה" button instead of the number in the text.
  assert.equal(acc.ctaUrl.url, "https://wa.me/972501110022"); assert.equal(acc.notifications[0].response.ctaUrl.url, "https://wa.me/972501110021");
  assert.doesNotMatch(acc.text + acc.notifications[0].response.text, /050-111002/);
});
