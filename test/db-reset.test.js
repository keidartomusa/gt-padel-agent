import test from "node:test"; import assert from "node:assert/strict";
import { memoryStore } from "../src/store.js"; import { resetStore } from "../src/reset.js";
test("db reset removes every key and leaves only the marker", async () => {
  const s = memoryStore(); for (const k of ["profile/1", "request/a", "connection/b", "skip/c", "state/1", "msg/1/x", "pair/a:b"]) await s.set(k, { x: 1 });
  const r = await resetStore(s, new Date("2026-09-23T14:00:00Z"), "abc");
  assert.equal(r.deleted, 7); assert.equal(r.left, 0); assert.deepEqual(await s.keys(""), ["meta/last-reset"]); assert.equal((await s.get("meta/last-reset")).at, "2026-09-23T14:00:00.000Z");
});
test("deploy-succeeded triggers db reset only with the [db-reset] tag", async () => {
  const src = (await import("node:fs")).readFileSync(new URL("../netlify/functions/deploy-succeeded.js", import.meta.url), "utf8"); assert.match(src, /\["db-reset","db-reset-background"\]/);
});
test("db reset keeps opt-outs (only userId + optedOutAt) so removed people are never messaged again", async () => {
  const s = memoryStore(); await s.set("profile/9", { userId: "9", name: "x", optedOutAt: "2026-09-23T10:00:00Z", lastInboundAt: "y" }); await s.set("profile/8", { userId: "8", name: "y" });
  const r = await resetStore(s); assert.equal(r.keptOptOuts, 1); assert.deepEqual(await s.get("profile/9"), { userId: "9", optedOutAt: "2026-09-23T10:00:00Z" }); assert.equal(await s.get("profile/8"), null);
});
test("db reset keeps booking clicks (not in Tom's 17:21 list)", async () => {
  const s = memoryStore(); await s.set("booking-click/x", { a: 1 }); await s.set("request/a", {}); const r = await resetStore(s);
  assert.equal(r.keptClicks, 1); assert.equal(r.left, 1); assert.deepEqual(await s.get("booking-click/x"), { a: 1 }); assert.equal(await s.get("request/a"), null);
});
test("db reset with clicks:true empties everything", async () => {
  const s = memoryStore(); await s.set("booking-click/x", {}); await s.set("profile/1", {}); const r = await resetStore(s, new Date(), null, { clicks: true });
  assert.equal(r.keptClicks, 0); assert.equal(r.left, 0); assert.deepEqual(await s.keys(""), ["meta/last-reset"]);
});
