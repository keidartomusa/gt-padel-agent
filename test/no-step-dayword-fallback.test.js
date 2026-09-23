// Tom 23.9 ~12:58: "״לא הבנתי״ זו תשובה טובה ל״מחר אחרי העבודה״" - with no open step, day-word text without a clear time is NOT routed to the time parser.
import test from "node:test";
import assert from "node:assert/strict";
import { routeIncoming } from "../src/webhook.js";
import { memoryStore } from "./named-store.mjs";
const now = new Date("2026-09-23T12:45:00+03:00");
test("no-step 'מחר אחרי העבודה' gets the לא הבנתי menu", async () => {
  const s = memoryStore();
  await routeIncoming({ userId: "lock", text: "היי", store: s, now });
  const r = await routeIncoming({ userId: "lock", text: "מחר אחרי העבודה", store: s, now });
  assert.match(r.text, /^לא הבנתי/);
  assert.deepEqual(r.buttons.slice(0, 2).map(b => b.id), ["availability", "players"]);
});
