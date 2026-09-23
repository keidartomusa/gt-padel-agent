import test from "node:test"; import assert from "node:assert/strict";
import { memoryStore } from "../src/store.js"; import { runSeed } from "../src/seed.js";
const now = new Date("2026-09-23T14:40:00Z");
const free = async i => ({ kind: "availability", date: i.date, slots: [{ courtId: "c1", courtName: "1", start: "21:00", end: "22:30", startMinute: 1260, endMinute: 1350 }] });
test("seed: Timor one-off today 21:00 and Orna weekly Wednesday evening, both 3-3.5, fictitious numbers", async () => {
  const s = memoryStore(), r = await runSeed(s, { now, availabilityFn: free });
  const [t, o] = r.requests; assert.equal(t.userId, "972500000001"); assert.equal(o.userId, "972500000002");
  assert.ok(t.requestId && o.requestId, JSON.stringify(r)); assert.equal(t.level, "3–3.5"); assert.equal(o.level, "3–3.5");
  assert.equal(t.date, "2026-09-23"); assert.deepEqual([t.startMinute, t.endMinute], [1260, 1440]); assert.equal(o.recurring, true); assert.deepEqual(o.weekdays, [3]);
});
test("seed: no free court -> Timor is stored anyway (forced)", async () => {
  const s = memoryStore(), r = await runSeed(s, { now, availabilityFn: async i => ({ kind: "availability", date: i.date, slots: [] }) });
  assert.equal(r.requests[0].forced, true); assert.ok(r.requests[0].requestId); assert.equal((await s.get(`request/${r.requests[0].requestId}`)).active, true);
});
