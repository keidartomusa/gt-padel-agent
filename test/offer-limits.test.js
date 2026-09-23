// Tom 23.9 15:36: when several people match one person - offer limits, capacity, and the closing flow.
import test from "node:test";
import assert from "node:assert/strict";
import { handleConversation, PLAYERS_MENU } from "../src/conversation.js";
import { dailySweep, ALERTS_PER_DAY, autoClose, activeRequests, gameEndMs } from "../src/matching.js";
import { memoryStore, named } from "./named-store.mjs";
const now = new Date("2026-09-23T08:00:00+03:00");
const available = async i => ({ kind: "availability", date: i.date, slots: [{ courtId: "c1", courtName: "1", start: "19:00", end: "20:30", durationMinutes: i.durationMinutes || 90, price: 300 }] });
const H = (s, u, displayName, at = now) => o => handleConversation({ userId: u, displayName, store: s, now: at, availabilityFn: available, ...o });
async function create(s, u, name, { when = "מחר אחרי 19:00", pc = "pc:1:yes", level = "level:3" } = {}) {
  await named(s, u, name); const h = H(s, u, name);
  await h({ actionId: "oneoff" }); await h({ actionId: level }); await h({ actionId: pc }); await h({ text: when });
  let r = await h({ actionId: "duration:90" }); if (/גמישים/.test(r.text)) r = await h({ actionId: "flex:60" }); return r;
}
const reqOf = async (s, u) => (await s.list("request/")).map(x => x.value).find(x => x.userId === u);
const conns = async s => (await s.list("connection/")).map(x => x.value);
const connectTo = async (s, u, name, owner) => { await named(s, u, name); return H(s, u, name)({ actionId: `connect:${(await reqOf(s, owner)).id}` }); };
const accept = async (s, owner, ownerName, from) => { const c = (await conns(s)).find(x => x.fromUserId === from && x.toUserId === owner); return H(s, owner, ownerName)({ actionId: `accept:${c.id}` }); };

test("3 people match a 4th: the 4th sees all 3, each of the 3 gets exactly one offer, and the daily sweep never repeats it", async () => {
  const s = memoryStore();
  for (const [u, n] of [["a", "אבי"], ["b", "בני"], ["c", "גל"]]) await create(s, u, n);
  const r = await create(s, "d", "דנה");
  assert.equal(r.list.sections[0].rows.filter(x => x.id.startsWith("connect:")).length, 3);
  assert.deepEqual(r.notifications.map(n => n.to).sort(), ["a", "b", "c"]);
  assert.equal((await dailySweep(s, new Date("2026-09-24T07:17:00+03:00"))).length, 0);
});
test(`a person gets at most ${ALERTS_PER_DAY} match alerts a day`, async () => {
  const s = memoryStore(); await create(s, "x", "איקס"); let toX = 0;
  for (const u of ["y1", "y2", "y3", "y4", "y5"]) toX += ((await create(s, u, "שחקן " + u)).notifications || []).filter(n => n.to === "x").length;
  assert.equal(toX, ALERTS_PER_DAY);
});
test("connect is refused when the group would pass 4, and a second pending request to the same game is not sent", async () => {
  const s = memoryStore(); await create(s, "o", "עומר", { pc: "pc:3:yes" });
  await create(s, "j2", "יעל", { pc: "pc:2:yes" });
  const big = await connectTo(s, "j2", "יעל", "o"); assert.match(big.text, /כבר אין מספיק מקום/); assert.equal((await conns(s)).length, 0);
  const ok = await connectTo(s, "j1", "רון", "o"); assert.match(ok.text, /שלחתי בקשת חיבור/);
  const dup = await connectTo(s, "j1", "רון", "o"); assert.match(dup.text, /כבר שלחתי בקשת חיבור/); assert.equal((await conns(s)).length, 1);
});
test("when the game fills, other pending requests close and those players are told; a stale accept does not connect", async () => {
  const s = memoryStore(); await create(s, "o", "עומר", { pc: "pc:3:yes" });
  await connectTo(s, "a", "אבי", "o"); await connectTo(s, "b", "בני", "o");
  const full = await accept(s, "o", "עומר", "a");
  assert.match(full.text, /רביעייה מלאה/);
  assert(full.notifications.some(n => n.to === "b" && /כבר התמלא/.test(n.response.text)));
  assert.equal((await conns(s)).find(c => c.fromUserId === "b").status, "closed");
  const stale = await accept(s, "o", "עומר", "b"); assert.match(stale.text, /כבר סגורה/); assert.equal(stale.ctaUrl, undefined); assert.equal(stale.notifications, undefined);
});
test("the joiner's own request closes only after mutual approval", async () => {
  const s = memoryStore(); await create(s, "o", "עומר"); await create(s, "a", "אבי");
  await connectTo(s, "a", "אבי", "o"); assert.equal((await reqOf(s, "a")).active, true);
  await accept(s, "o", "עומר", "a"); const a = await reqOf(s, "a");
  assert.equal(a.active, false); assert.equal(a.closedReason, "merged");
  const s2 = memoryStore(); await create(s2, "o", "עומר"); await create(s2, "a", "אבי"); await connectTo(s2, "a", "אבי", "o");
  const c = (await conns(s2))[0]; await H(s2, "o", "עומר")({ actionId: `decline:${c.id}` }); assert.equal((await reqOf(s2, "a")).active, true);
});
test("no closing question: the request closes by itself 4 hours after the game window ends (Tom 16:25)", async () => {
  const s = memoryStore(); await create(s, "o", "עומר", { when: "מחר 18:00-20:00" }); await connectTo(s, "a", "אבי", "o"); const acc = await accept(s, "o", "עומר", "a");
  assert.doesNotMatch(JSON.stringify(acc), /הסתדר|סגרתם משחק|closed:/);
  const R = await reqOf(s, "o"), end = gameEndMs(R); assert.ok(end > Date.parse("2026-09-24T15:00:00Z") && end <= Date.parse("2026-09-24T21:00:00Z"));
  const before = new Date(end + 4 * 3600000 - 60000), after = new Date(end + 4 * 3600000);
  assert.equal((await activeRequests(s, before)).length, 1); assert.deepEqual(await autoClose(s, before), []);
  assert.equal((await activeRequests(s, after)).length, 0, "off the board at end + 4h");
  assert.deepEqual(await autoClose(s, after), [R.id]); const R2 = await reqOf(s, "o"); assert.equal(R2.active, false); assert.equal(R2.closedReason, "time_passed");
  assert.equal((await conns(s))[0].status, "done");
});
test("auto-close uses the booked court's end when there is one; open-ended windows end at midnight; recurring never auto-closes", async () => {
  assert.equal(new Date(gameEndMs({ date: "2026-09-24", endMinute: 1380, courtSlot: { end: "20:30" } })).toISOString(), "2026-09-24T17:30:00.000Z");
  assert.equal(new Date(gameEndMs({ date: "2026-09-24", startMinute: 1140, endMinute: 1440 })).toISOString(), "2026-09-24T21:00:00.000Z");
  const s = memoryStore(); await create(s, "r", "רון", { when: "כל שני בערב" });
  const r = await H(s, "r", "רון")({ actionId: "recurring" });
  assert.deepEqual(await autoClose(s, new Date("2026-12-01T12:00:00+02:00")), (await s.list("request/")).map(x => x.value).filter(x => !x.recurring && x.date).map(x => x.id));
});
test("players menu no longer claims the user has a court", () => {
  assert.match(PLAYERS_MENU, /חסרים לי שחקנים - מחפשים שחקנים להשלמת רביעייה, עם מגרש או בלי\./); assert.doesNotMatch(PLAYERS_MENU, /יש לכם מגרש וזמן/);
});
test("accept never takes a group past 4 (a join that was fine when requested but not anymore)", async () => {
  const s = memoryStore(); await create(s, "o", "עומר", { pc: "pc:2:yes" });
  await create(s, "b", "בני", { pc: "pc:2:yes" }); await connectTo(s, "b", "בני", "o"); await connectTo(s, "a", "אבי", "o");
  await accept(s, "o", "עומר", "a"); assert.equal((await reqOf(s, "o")).partySize, 3);
  const r = await accept(s, "o", "עומר", "b"); assert.match(r.text, /אין מספיק מקום/); assert.equal(r.ctaUrl, undefined);
  assert.equal((await reqOf(s, "b")).active, true); assert.equal((await reqOf(s, "o")).partySize, 3);
});
test("group: one join request to all members, any one approves; the listing leaves the board only when all approved (Tom 16:27-16:29)", async () => {
  const s = memoryStore(); await create(s, "o", "עומר"); await connectTo(s, "a", "אבי", "o"); await accept(s, "o", "עומר", "a");
  await connectTo(s, "b", "בני", "o"); const R = await reqOf(s, "o"); assert.deepEqual(R.joinedNames, ["אבי"]);
  // the 4th player sees one match with all names
  const d = await create(s, "d", "דנה"); const row = d.list.sections[0].rows.find(x => x.id === `connect:${R.id}`);
  assert.match(row.title, /^עומר ועוד 1/); assert.match(row.description, /עומר ואבי/);
  const alertToD = (await import("../src/matching.js")).matchAlert({ partySize: 1, level: R.level }, R); assert.match(alertToD.text, /עומר ואבי \(כבר מחוברים ביניהם\)/);
  const j = await connectTo(s, "c", "גל", "o"); assert.match(j.text, /לקבוצה של עומר ואבי/); assert.deepEqual(j.notifications.map(n => n.to).sort(), ["a", "o"]);
  assert.match(j.notifications[0].response.text, /מספיק שאחד מכם יאשר/);
});
test("group of 3 + 1: a member (not the opener) approves; full game stays listed until everyone approved", async () => {
  const s = memoryStore(); await create(s, "o", "עומר", { pc: "pc:2:yes" }); await connectTo(s, "a", "אבי", "o"); await accept(s, "o", "עומר", "a");
  await connectTo(s, "c", "גל", "o"); const c = (await conns(s)).find(x => x.fromUserId === "c");
  const byA = await H(s, "a", "אבי")({ actionId: `accept:${c.id}` });
  assert.match(byA.text, /רביעייה מלאה! המשחק יירד מהלוח כשכל חברי הקבוצה יאשרו/); assert.equal(byA.ctaUrl.url.includes("wa.me"), true);
  assert(byA.notifications.some(n => n.to === "o" && /עדכון: גל הצטרף\/ה/.test(n.response.text)));
  assert.equal((await reqOf(s, "o")).active, true); assert.equal((await reqOf(s, "o")).full, true);
  const dup = await H(s, "a", "אבי")({ actionId: `decline:${c.id}` }); assert.match(dup.text, /כבר אישר/);
  const byO = await H(s, "o", "עומר")({ actionId: `accept:${c.id}` }); assert.match(byO.text, /כולם אישרו, אז הורדתי את המשחק מהלוח/);
  assert.equal((await reqOf(s, "o")).active, false);
});
