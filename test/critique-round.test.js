import { noDur } from "./no-duration.mjs";
// Critique round 23.9 (Tom: "תתקן הכל") + Tom 14:58 (pending answer beats menu words) + Tom 15:01 (שלח הודעה) + Tom 15:16 (club contact).
import test from "node:test";
import assert from "node:assert/strict";
import { handleConversation, cleanName, durationFromText, CLUB_URL, NAME_ASK, fieldEditIntent } from "../src/conversation.js";
import { routeIncoming } from "../src/webhook.js";
import { bookingCard } from "../src/webhook.js";
import { findMatches, dailySweep } from "../src/matching.js";
import { formatHebrew } from "../src/availability.js";
import { memoryStore as rawStore } from "../src/store.js";
import { memoryStore, named } from "./named-store.mjs";
const now = new Date("2026-09-23T08:00:00+03:00");
const available = async i => ({ kind: "availability", date: i.date, slots: [{ courtId: "c1", courtName: "1", start: "19:00", end: "20:30", durationMinutes: i.durationMinutes || 90, price: 300 }] });
const none = async i => ({ kind: "availability", date: i.date, slots: [] });
const H = (s, u, displayName = "שחקן/ית", availabilityFn = available) => noDur(o => handleConversation({ userId: u, displayName, store: s, now, availabilityFn, ...o }));
const rows = r => (r.list?.sections || []).flatMap(x => x.rows);
async function create(s, u, name, { when = "מחר אחרי 19:00", pc = "pc:1:yes", level = "level:3" } = {}) {
  await named(s, u, name); const h = H(s, u, name);
  await h({ actionId: "oneoff" }); await h({ actionId: level }); await h({ actionId: pc }); await h({ text: when });
  let r = await h({ actionId: "duration:90" }); if (/גמישים/.test(r.text)) r = await h({ actionId: "flex:60" }); return r;
}
const mine = async (s, u) => (await s.list("request/")).map(x => x.value).filter(x => x.userId === u);

// Tom 14:58
test("'שלום' typed as the name is saved as the name, not the welcome", async () => {
  const s = rawStore(), h = H(s, "n1");
  await h({ actionId: "oneoff" }); await h({ actionId: "level:3" }); await h({ actionId: "pc:1:yes" }); await h({ text: "מחר אחרי 19:00" });
  const ask = await h({ actionId: "duration:90" }); assert.match(ask.text, /באיזה שם להציג אתכם בלוח המשחקים\?$/); assert.doesNotMatch(ask.text, /כמה זמן/);
  const r = await h({ text: "שלום" }); assert.match(r.text, /הבקשה נשמרה|נשמרו \d+ בקשות/); assert.equal((await s.get("profile/n1")).name, "שלום");
  assert.equal(cleanName("שלום"), null); assert.equal(cleanName("שלום", { asked: true }), "שלום");
});
test("'ביטול' at the name step clears it without saving a name", async () => {
  const s = rawStore(), h = H(s, "n2");
  for (const a of ["oneoff", "level:3", "pc:1:yes"]) await h({ actionId: a }); await h({ text: "מחר אחרי 19:00" }); await h({ actionId: "duration:90" });
  const r = await h({ text: "ביטול" }); assert.equal(r.text, "בסדר, לא שמרתי את הבקשה."); assert.equal((await s.get("profile/n2"))?.name ?? null, null); assert.equal((await mine(s, "n2")).length, 0);
});
for (const [label, steps, re] of [
  ["time question", [{ actionId: "players" }, { actionId: "oneoff" }, { actionId: "level:3" }, { actionId: "pc:1:yes" }], /^באיזה שעה\?/],
  ["recurring days question", [{ actionId: "players" }, { actionId: "recurring" }, { actionId: "level:3" }, { actionId: "pc:1:yes" }], /^באילו ימים ושעות/],
  ["level question", [{ actionId: "players" }, { actionId: "oneoff" }], /^מה הרמה שלכם/],
  ["party+court question", [{ actionId: "players" }, { actionId: "oneoff" }, { actionId: "level:3" }], /^כמה אתם, והאם/],
  ["court availability question", [{ actionId: "availability" }], /^מתי תרצו לשחק\? בחרו/],
  ["board question", [{ actionId: "players" }, { actionId: "board" }], /^מתי תרצו לשחק\? בחרו/],
]) for (const g of ["שלום", "היי"]) test(`greeting '${g}' while the ${label} waits asks it again and keeps the progress`, async () => {
  const s = memoryStore(), h = H(s, "g"); for (const st of steps) await h(st);
  const before = await s.get("state/g"), r = await h({ text: g });
  assert.match(r.text, re); assert.doesNotMatch(r.text, /ברוכים הבאים/); assert.deepEqual(await s.get("state/g"), before);
  const m = await h({ text: "תפריט" }); assert.match(m.text, /מה תרצו לעשות|ברוכים הבאים/); assert.deepEqual(await s.get("state/g"), {});
});

// Items 3, 9, 10, 14
test("item 3: no court and nothing free -> said right after the time, before duration", async () => {
  const s = memoryStore(), h = H(s, "c", "דנה", none);
  for (const a of ["oneoff", "level:3", "pc:2:no"]) await h({ actionId: a });
  const r = await h({ text: "מחר אחרי 19:00" }); assert.match(r.text, /^רשמתי: .*\n\nלא מצאתי מגרש פנוי בחלון הזה/); assert.deepEqual(r.buttons.map(b => b.id), ["retry_when", "availability"]);
  assert.equal((await s.get("state/c")).step, "when");
});
test("item 9: a duration in the time text skips the duration question; last request's level and duration are reused", async () => {
  assert.deepEqual(durationFromText("מחר אחרי 19 ל-90 דקות"), [90]); assert.deepEqual(durationFromText("שעתיים"), [120]); assert.equal(durationFromText("מחר אחרי 19"), null);
  const s = memoryStore(), h = H(s, "d", "דנה"); await named(s, "d", "דנה");
  for (const a of ["oneoff", "level:3", "pc:1:yes"]) await h({ actionId: a });
  const r = await h({ text: "מחר אחרי 19:00 ל120 דקות" }); assert.match(r.text, /הבקשה נשמרה|נשמרו \d+ בקשות/);
  // Tom 23.9 18:51: duration is gone from partner finding - only the level is reused and offered for a fix.
  const again = await h({ actionId: "oneoff" }); assert.match(again.text, /^לקחתי מהבקשה הקודמת: רמה 3–3\.5\.\n\nכמה אתם/); assert.deepEqual(rows(again).filter(x => x.id.startsWith("pc_")).map(x => [x.id, x.title]), [["pc_level", "עדכן רמה"]]);
});
test("item 10: day understood without an hour -> ask only the hour, then continue", async () => {
  const s = memoryStore(), h = H(s, "t", "דנה");
  for (const a of ["oneoff", "level:3", "pc:1:yes"]) await h({ actionId: a });
  const q = await h({ text: "מחר אחרי העבודה" }); assert.equal(q.text, "חמישי 24.9 - מאיזו שעה?"); assert.deepEqual(q.buttons.map(b => b.id), ["tm:17", "tm:18", "tm:19"]);
  const r = await h({ actionId: "tm:18" }); assert.match(r.text, /^רשמתי: יום חמישי 24\.9, אחרי 18:00\.\n\n(?!כמה זמן)/);
});
test("item 14: recurring availability is echoed", async () => {
  const s = memoryStore(), h = H(s, "r", "דנה");
  for (const a of ["recurring", "level:3", "pc:1:yes"]) await h({ actionId: a });
  const r = await h({ text: "שני ורביעי אחרי 20:00" }); assert.match(r.text, /^רשמתי: כל שני ורביעי, אחרי 20:00\.\n\n(?!כמה זמן)/);
});

// Items 4-8
test("item 4: the requester gets the matches as connect rows", async () => {
  const s = memoryStore(); await create(s, "a", "דנה"); const r = await create(s, "b", "נועם");
  const cr = rows(r).filter(x => x.id.startsWith("connect:")); assert.equal(cr.length, 1); assert.equal(cr[0].title, "דנה · 3–3.5"); assert.equal(cr[0].description, "שחקן אחד · יש מגרש");
});
test("item 5: alert shows party, court, duration and the combined count", async () => {
  const s = memoryStore(); await create(s, "a", "דנה"); const r = await create(s, "b", "נועם", { pc: "pc:2:no" });
  assert.match(r.notifications[0].response.text, /נועם · חמישי 24\.9 · אחרי 19:00 · רמה 3–3\.5\n2 שחקנים · בלי מגרש\nיחד: 3 מתוך 4\n\nתרצו להתחבר\?$/);
});
test("item 6: sides that together exceed 4 never match", async () => {
  const s = memoryStore(); await create(s, "a", "דנה", { pc: "pc:3:yes" }); const r = await create(s, "b", "נועם", { pc: "pc:2:yes" });
  assert.equal((r.notifications || []).length, 0); assert.equal((await dailySweep(s, now)).length, 0);
});
test("item 6: accepting below 4 keeps the owner's request with the new count and closes the joiner's; at 4 the joiner's closes and the full game stays listed (Tom 19:13)", async () => {
  const s = memoryStore(); await create(s, "a", "דנה"); await create(s, "b", "נועם");
  const [ra] = await mine(s, "a"), [rb] = await mine(s, "b");
  await H(s, "b", "נועם")({ actionId: `connect:${ra.id}` }); const c = (await s.list("connection/"))[0].value;
  const acc = await H(s, "a", "דנה")({ actionId: `accept:${c.id}` });
  assert.match(acc.text, /יחד אתם 2 מתוך 4\. הבקשה נשארת בלוח \(חסר 2\)/);
  assert.equal((await s.get(`request/${ra.id}`)).partySize, 2); assert.equal((await s.get(`request/${rb.id}`)).active, false);
  assert.doesNotMatch(JSON.stringify(acc), /closed:|סגרתם משחק/); /* Tom 23.9 16:25: no closing question */ assert.doesNotMatch(JSON.stringify(acc), /https?:\/\/(?!wa\.me)/);
  const closed = await H(s, "a", "דנה")({ actionId: `closed:${ra.id}` }); assert.match(closed.text, /הורדתי את הבקשה מהלוח/); assert.equal((await s.get(`request/${ra.id}`)).active, false);
  const s2 = memoryStore(); await create(s2, "x", "גל", { pc: "pc:2:yes" }); await create(s2, "y", "רון", { pc: "pc:2:yes" });
  const [rx] = await mine(s2, "x"), [ry] = await mine(s2, "y");
  await H(s2, "y", "רון")({ actionId: `connect:${rx.id}` }); const c2 = (await s2.list("connection/"))[0].value;
  const full = await H(s2, "x", "גל")({ actionId: `accept:${c2.id}` }); assert.match(full.text, /יחד אתם 4 - רביעייה מלאה!/);
  assert.equal((await s2.get(`request/${rx.id}`)).active, true); assert.equal((await s2.get(`request/${rx.id}`)).full, true); assert.equal((await s2.get(`request/${ry.id}`)).active, false); assert.ok(!full.notifications.some(n => n.to === "x"));
});
test("item 7 + Tom 15:01: after approval both sides get a 'שלח הודעה' wa.me button, no number in the text", async () => {
  const s = memoryStore(); await create(s, "972501110001", "דנה"); const [ra] = await mine(s, "972501110001");
  await named(s, "972501110002", "נועם"); await H(s, "972501110002", "נועם")({ actionId: `connect:${ra.id}` });
  const c = (await s.list("connection/"))[0].value, acc = await H(s, "972501110001", "דנה")({ actionId: `accept:${c.id}` });
  assert.deepEqual(acc.ctaUrl, { displayText: "שלח הודעה", url: "https://wa.me/972501110002" });
  const other = acc.notifications.find(n => n.to === "972501110002").response; assert.deepEqual(other.ctaUrl, { displayText: "שלח הודעה", url: "https://wa.me/972501110001" });
  for (const t of [acc.text, other.text]) assert.doesNotMatch(t, /05\d-?\d{7}|9725\d{8}/);
});
test("item 8: 'לא הפעם' hides only that match, both ways, instant and daily", async () => {
  const s = memoryStore(); await create(s, "a", "דנה"); const r = await create(s, "b", "נועם");
  const [rb] = await mine(s, "b"); const nb = r.notifications[0].response.buttons.find(b => b.id.startsWith("notnow:")); assert.equal(nb.id, `notnow:${rb.id}`);
  const x = await H(s, "a", "דנה")({ actionId: nb.id }); assert.equal(x.text, "בסדר, לא אציע לכם את ההתאמה הזאת שוב.");
  assert.equal((await findMatches(s, rb, now)).length, 0); assert.equal((await dailySweep(s, now)).length, 0);
  const r3 = await create(s, "c", "רון"); assert.ok(r3.notifications.some(n => n.to === "a"));
});

// Items 11-13, 15-20
test("item 11 + Tom 15:16: unknown questions offer the club; club button opens Tom's WhatsApp; menu always carries it", async () => {
  const s = memoryStore(), h = H(s, "q", "דנה");
  const r = await h({ text: "כמה עולה מנוי?" }); assert.deepEqual(r.buttons.map(b => b.id), ["availability", "players", "club"]);
  const c = await h({ actionId: "club" }); assert.deepEqual(c.ctaUrl, { displayText: "דבר עם המועדון", url: CLUB_URL }); assert.equal(CLUB_URL, "https://wa.me/972544819860");
  const typed = await h({ text: "דבר עם המועדון" }); assert.equal(typed.ctaUrl.url, CLUB_URL);
  const m = await h({ text: "היי" }); assert.deepEqual(m.buttons.map(b => b.id), ["availability", "players", "club"]); assert.doesNotMatch(m.text, /https?:/);
  await create(s, "q", "דנה"); const m2 = await h({ text: "תפריט" }); assert.deepEqual(m2.buttons.map(b => b.id), ["availability", "players", "my_requests"]); assert.match(m2.text, /לשאלות על המועדון כתבו: דבר עם המועדון$/);
});
test("item 12: booking card names court, range, price and says booking ends on the site", async () => {
  assert.equal(bookingCard({ start: "17:30", durationMinutes: 90, price: 300 }, "2"), "מגרש 2 · 17:30–19:00 · ₪300\nההזמנה מסתיימת באתר.");
  assert.equal(bookingCard({ start: "23:00", durationMinutes: 60 }, ""), "23:00–00:00\nההזמנה מסתיימת באתר.");
});
test("item 13: extra list rows are 'אפשרויות', not 'שעות'", () => {
  const slots = []; for (const start of ["17:00", "17:30", "18:00", "18:30", "19:00"]) slots.push({ courtName: "1", start, end: "21:00", price: 160 });
  const t = formatHebrew({ kind: "availability", date: "2026-09-25", slots }); assert.match(t, /ועוד 3 אפשרויות ברשימה/); assert.doesNotMatch(t, /שעות ברשימה/);
});
test("item 15: after an edit the card is shown again with 'עריכה נוספת'", async () => {
  const s = memoryStore(); await create(s, "e", "דנה"); const [q] = await mine(s, "e"), h = H(s, "e", "דנה");
  await h({ actionId: `ef:${q.id}:level` }); const r = await h({ actionId: "level:4" });
  assert.match(r.text, /^עדכנתי\.\n\n\*חמישי 24\.9 · אחרי 19:00\*\nחד-פעמית · רמה 3\.5–4 · שחקן אחד · יש מגרש/); assert.deepEqual(r.buttons.map(b => b.id), [`edit:${q.id}`, "menu"]);
});
test("item 16 + 17: level question has the hint; no singular address left in the source", async () => {
  const r = await H(memoryStore(), "l")({ actionId: "oneoff" }); assert.equal(r.text, "מה הרמה שלכם?\nלא בטוחים? בחרו את הקרובה ביותר, אפשר לשנות אחר כך.");
  const src = (await import("node:fs")).readFileSync(new URL("../src/conversation.js", import.meta.url), "utf8");
  for (const w of ["מה הרמה שלך?", "מה השם שלך", "לבקשה שלך", "אין לך ", "יש לך ", "התכוונת ל", "אותך", "אליך ", "פותח לך"]) assert(!src.includes(w), w);
});
test("item 18: the full greeting once, then a short menu", async () => {
  const s = rawStore(), a = await routeIncoming({ userId: "m", text: "היי", store: s, now }); assert.match(a.text, /ברוכים הבאים/);
  const b = await routeIncoming({ userId: "m", text: "תפריט", store: s, now }); assert.match(b.text, /^מה תרצו לעשות\?/); assert.doesNotMatch(b.text, /ברוכים הבאים/);
});
test("item 19: the WhatsApp profile name is offered with one tap", async () => {
  const s = rawStore(), h = H(s, "p", "Tom K");
  for (const a of ["oneoff", "level:3", "pc:1:yes"]) await h({ actionId: a }); await h({ text: "מחר אחרי 19:00" });
  const ask = await h({ actionId: "duration:90" }); assert.match(ask.text, /להופיע בלוח המשחקים בתור Tom K\?$/); assert.deepEqual(ask.buttons.map(b => b.id), ["name_wa", "name_other"]);
  const r = await h({ actionId: "name_wa" }); assert.match(r.text, /הבקשה נשמרה|נשמרו \d+ בקשות/); assert.equal((await s.get("profile/p")).name, "Tom K");
  const s2 = rawStore(), h2 = H(s2, "p2", "Tom K"); for (const a of ["oneoff", "level:3", "pc:1:yes"]) await h2({ actionId: a }); await h2({ text: "מחר אחרי 19:00" }); await h2({ actionId: "duration:90" });
  assert.equal((await h2({ actionId: "name_other" })).text, NAME_ASK); await h2({ text: "תום" }); assert.equal((await s2.get("profile/p2")).name, "תום");
});
test("item 20: name-change confirmation reads naturally for Hebrew and Latin names", async () => {
  const s = memoryStore(); await named(s, "z", "תום"); const c = await H(s, "z")({ text: "קוראים לי אבי" }); assert.equal(c.text, "לשנות את השם מתום לאבי?");
  const s2 = memoryStore(); await named(s2, "z", "Tom"); const c2 = await H(s2, "z")({ text: "קוראים לי אבי" }); assert.equal(c2.text, "לשנות את השם מ-Tom לאבי?");
});

test("prefilled level/duration: one-tap fix buttons and free-text 'אני רוצה לשנות רמה'", async () => {
  assert.equal(fieldEditIntent("אני רוצה לשנות רמה"), "level"); assert.equal(fieldEditIntent("לעדכן משך זמן"), "duration"); assert.equal(fieldEditIntent("רמה אחרת"), "level"); assert.equal(fieldEditIntent("מחר אחרי 19 ל-90 דקות"), null); assert.equal(fieldEditIntent("רוצה לשנות משך"), "duration"); assert.equal(fieldEditIntent("בשעה אחרת"), "duration");
  const s = memoryStore(), h = H(s, "e", "דנה"); await named(s, "e", "דנה");
  for (const a of ["oneoff", "level:3", "pc:1:yes"]) await h({ actionId: a }); await h({ text: "מחר אחרי 19:00 ל120 דקות" });
  let r = await h({ actionId: "oneoff" }); assert.match(r.text, /^לקחתי מהבקשה הקודמת/);
  r = await h({ text: "אני רוצה לשנות רמה" }); assert.match(r.text, /^מה הרמה שלכם/);
  r = await h({ actionId: "level:4" }); assert.match(r.text, /^כמה אתם/); assert.ok(!rows(r).some(x => x.id === "pc_dur"));
  const st = await s.get("state/e"); assert.notEqual(st.draft.level, (await mine(s, "e"))[0].level);
  r = await h({ actionId: "pc_level" }); assert.match(r.text, /^מה הרמה שלכם/);
});

test("live 16:32: 'לשנות רמה ומשך' (text or the old row) asks the level again, then the party question (no duration since 18:51)", async () => {
  assert.equal(fieldEditIntent("לשנות רמה ומשך"), "both");
  for (const how of [{ text: "לשנות רמה ומשך" }, { actionId: "pc_reset" }]) {
    const s = memoryStore(), h = H(s, "f", "דנה"); await named(s, "f", "דנה");
    for (const a of ["oneoff", "level:3", "pc:1:yes"]) await h({ actionId: a }); await h({ text: "מחר אחרי 19:00 ל120 דקות" });
    await h({ actionId: "oneoff" });
    let r = await h(how); assert.match(r.text, /^מה הרמה שלכם/);
    r = await h({ actionId: "level:3.5" }); assert.match(r.text, /^כמה אתם/); assert.doesNotMatch(r.text, /כמה זמן/);
  }
});

test("Tom 16:35: weekly game never asks about a court; menu copy says each week needs a new approval", async () => {
  const s = memoryStore(), h = H(s, "w", "דנה"); await named(s, "w", "דנה");
  let r = await h({ actionId: "recurring" }); assert.match(r.text, /^מה הרמה/);
  r = await h({ actionId: "level:3" }); assert.equal(r.text, "כמה שחקנים אתם?"); assert.deepEqual(rows(r).map(x => x.id).filter(x => x.startsWith("party:")), ["party:1", "party:2", "party:3"]); assert.ok(!rows(r).some(x => /מגרש/.test(x.title + (x.description || ""))));
  r = await h({ actionId: "party:2" }); assert.doesNotMatch(r.text, /מגרש/);
  const st = await s.get("state/w"); assert.equal(st.draft.hasCourt, false); assert.notEqual(st.step, "court");
  r = await h({ text: "שני ורביעי אחרי 20:00" }); for (let i = 0; i < 4 && !/נשמרה|נשמרו/.test(r.text); i++) { assert.doesNotMatch(r.text, /מגרש\?/); const id = (r.buttons?.[0] || rows(r)[0])?.id; r = await h({ actionId: id }); }
  assert.match(r.text, /הבקשה נשמרה|נשמרו \d+ בקשות/);
  const req = (await mine(s, "w"))[0]; const e = await h({ actionId: `edit:${req.id}` }); assert.ok(!rows(e).some(x => x.id.endsWith(":court")));
  const again = await h({ actionId: "recurring" }); assert.match(again.text, /לקחתי מהבקשה הקודמת[\s\S]*כמה שחקנים אתם\?$/); assert.ok(rows(again).some(x => x.id === "pc_level"));
});

test("Tom 17:04: own board requests are marked (אתה) and cannot be picked", async () => {
  const s = memoryStore(); await named(s, "me", "תום"); await named(s, "o", "דנה");
  for (const [u, n, t] of [["me", "תום", "מחר אחרי 21:00 ל90 דקות"], ["o", "דנה", "מחר אחרי 20:00 ל90 דקות"]]) { const h = H(s, u, n); for (const a of ["oneoff", "level:3", "pc:1:yes"]) await h({ actionId: a }); await h({ text: t }); }
  const h = H(s, "me", "תום"); const b = await h({ actionId: "bwhen:2" });
  assert.match(b.text, /תום \(אתה\)/); assert.doesNotMatch(b.text, /דנה \(אתה\)/);
  const mineId = (await mine(s, "me"))[0].id; assert.ok(!rows(b).some(x => x.id === `connect:${mineId}`)); assert.ok(rows(b).some(x => x.id.startsWith("connect:")));
  // only own request on the board -> text with (אתה), no list, buttons instead
  const s2 = memoryStore(); await named(s2, "me", "תום"); const h2 = H(s2, "me", "תום"); for (const a of ["oneoff", "level:3", "pc:1:yes"]) await h2({ actionId: a }); await h2({ text: "מחר אחרי 21:00 ל90 דקות" });
  const b2 = await h2({ actionId: "bwhen:2" }); assert.match(b2.text, /תום \(אתה\)/); assert.ok(!b2.list); assert.doesNotMatch(b2.text, /בחרו בקשה/); assert.ok(b2.buttons.some(x => x.id === "my_requests"));
});

test("Tom 17:09: with a court the time question is 'באיזה שעה?', without a court it stays 'מתי תרצו לשחק?'", async () => {
  for (const [pc, re] of [["pc:1:yes", /^באיזה שעה\? אפשר לכתוב למשל: מחר ב-19:00$/], ["pc:1:no", /^מתי תרצו לשחק\?/]]) {
    const s = memoryStore(), h = H(s, "c", "דנה"); await named(s, "c", "דנה");
    await h({ actionId: "oneoff" }); await h({ actionId: "level:3" }); const r = await h({ actionId: pc }); assert.match(r.text, re);
  }
  const s = memoryStore(), h = H(s, "c", "דנה"); await named(s, "c", "דנה");
  for (const a of ["oneoff", "level:3", "pc:1:yes"]) await h({ actionId: a }); const r = await h({ text: "מחר ב-19:00 ל90 דקות" }); assert.match(r.text, /הבקשה נשמרה|רשמתי/);
});

test("Tom 17:12: 'די' and other stop words are never saved as a name", async () => {
  for (const w of ["די", "מספיק", "תודה", "סבבה", "רגע"]) assert.equal(cleanName(w, { asked: true }), null, w);
  assert.equal(cleanName("תום", { asked: true }), "תום");
});

test("Tom 18:51: no duration question after the time, with or without a court", async () => {
  // Tom 23.9 18:51 supersedes 18:37: no duration question at all, with or without a court.
  for (const [pc, re] of [["pc:1:yes", /^(?!כמה זמן)/], ["pc:1:no", /^(?!כמה זמן)/]]) {
    const s = memoryStore(), h = H(s, "k", "דנה"); await named(s, "k", "דנה");
    for (const a of ["oneoff", "level:3", pc]) await h({ actionId: a }); const r = await h({ text: "מחר אחרי 19:00" }); assert.match(r.text.split("\n\n").pop(), re);
  }
});
