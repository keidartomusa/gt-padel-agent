// Tom 23.9 16:03: dashboard "חיבורים" tab - live connections, one-off vs recurring, all details, soonest first.
import test from "node:test";
import assert from "node:assert/strict";
import { handleConversation } from "../src/conversation.js";
import { liveConnections, nextDate } from "../src/connections.js";
import { memoryStore, named } from "./named-store.mjs";
const now = new Date("2026-09-23T08:00:00+03:00");
const available = async i => ({ kind: "availability", date: i.date, slots: [{ courtId: "c1", courtName: "1", start: "19:00", end: "20:30", durationMinutes: i.durationMinutes || 90, price: 300 }] });
const H = (s, u, n) => o => handleConversation({ userId: u, displayName: n, store: s, now, availabilityFn: available, ...o });
async function create(s, u, n, { when = "מחר אחרי 19:00", pc = "pc:1:yes", flow = "oneoff" } = {}) {
  await named(s, u, n); const h = H(s, u, n); await h({ actionId: flow }); await h({ actionId: "level:3" }); await h({ actionId: pc }); await h({ text: when });
  let r = await h({ actionId: "duration:90" }); if (/גמישים/.test(r.text)) r = await h({ actionId: "flex:60" }); if (/מאיזו שעה/.test(r.text || "")) r = await h({ actionId: r.buttons[0].id }); return r;
}
const all = async (s, p) => (await s.list(p)).map(x => x.value);
const join = async (s, u, n, owner, ownerName) => { await named(s, u, n); const R = (await all(s, "request/")).find(x => x.userId === owner && x.active); await H(s, u, n)({ actionId: `connect:${R.id}` });
  const c = (await all(s, "connection/")).find(x => x.fromUserId === u && x.status === "pending"); await H(s, owner, ownerName)({ actionId: `accept:${c.id}` }); };
const live = async (s, at = now) => liveConnections({ requests: await all(s, "request/"), connections: await all(s, "connection/"), profiles: {}, now: at });

test("live connections: grouped per game, one-off and recurring, participants with party sizes, soonest first", async () => {
  const s = memoryStore();
  await create(s, "o1", "עומר", { when: "שישי בבוקר" }); await join(s, "a", "אבי", "o1", "עומר");
  await create(s, "o2", "נועה", { when: "מחר אחרי 19:00", pc: "pc:2:yes" }); await join(s, "b", "בני", "o2", "נועה"); await join(s, "c", "גל", "o2", "נועה");
  await create(s, "o3", "רון", { flow: "recurring", when: "כל שני בערב" }); await join(s, "d", "דנה", "o3", "רון");
  await create(s, "p", "פז"); await named(s, "q", "קים"); await H(s, "q", "קים")({ actionId: `connect:${(await all(s, "request/")).find(x => x.userId === "p").id}` }); // pending: not live
  const L = await live(s);
  assert.deepEqual(L.map(g => g.participants[0].name), ["נועה", "עומר", "רון"]);
  const [thu, fri, mon] = L;
  assert.equal(thu.type, "oneoff"); assert.equal(thu.total, 4); assert.equal(thu.full, true); assert.deepEqual(thu.participants.map(p => [p.name, p.party]), [["נועה", 2], ["בני", 1], ["גל", 1]]);
  assert.equal(fri.total, 2); assert.equal(fri.full, false); assert.equal(fri.level, "3-3.5".replace("-", "–"));
  assert.equal(mon.type, "recurring"); assert.match(mon.when, /^כל שני/); assert.equal(mon.nextDate, "2026-09-28");
});
test("past one-off games and deleted requests are not live", async () => {
  const s = memoryStore(); await create(s, "o", "עומר"); await join(s, "a", "אבי", "o", "עומר");
  assert.equal((await live(s)).length, 1);
  assert.equal((await live(s, new Date("2026-09-25T08:00:00+03:00"))).length, 0);
  const R = (await all(s, "request/")).find(x => x.userId === "o"); await s.set(`request/${R.id}`, { ...R, deletedAt: now.toISOString() });
  assert.equal((await live(s)).length, 0);
});
test("recurring next date is the next matching weekday from today", () => {
  assert.equal(nextDate({ recurring: true, weekdays: [3] }, "2026-09-23"), "2026-09-23");
  assert.equal(nextDate({ recurring: true, weekdays: [1, 5] }, "2026-09-23"), "2026-09-25");
});
test("dashboard has a חיבורים tab rendering one card per game with type, status and participants", async () => {
  const html = await (await (await import("../netlify/functions/admin.js")).default()).text();
  assert.match(html, /data-v="live">בקשות וחיבורים</); assert.match(html, /function liveView\(\)/); assert.match(html, /'קבוע':'חד-פעמי'/); assert.match(html, /מלא · 4\/4/);
  const js = html.split("<script>")[1].split("</script>")[0]; assert.doesNotThrow(() => new Function(js));
});
