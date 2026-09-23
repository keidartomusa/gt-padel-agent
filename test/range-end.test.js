import test from "node:test"; import assert from "node:assert/strict";
import { parseIntentLocal } from "../src/intent.js";
const now = new Date("2026-09-23T14:00:00Z");
test("Tom 17:19: an explicit time range keeps the end the user wrote", () => {
  for (const [t, s, e] of [["מחר 18:00-20:00", 1080, 1200], ["מחר 20:30-22:00", 1230, 1320], ["מחר בין 18 ל-20", 1080, 1200], ["מחר מ-18 עד 20", 1080, 1200], ["מחר בין 7 ל-9 בערב", 1140, 1260], ["24.9 18:00-20:00", 1080, 1200], ["מחר 21:00-00:00", 1260, 1440]]) {
    const p = parseIntentLocal(t, now); assert.deepEqual([p.startMinute, p.endMinute], [s, e], t);
  }
  for (const [t, s, e] of [["מחר אחרי 19:00", 1140, 1440], ["מחר ב-19:00 ל90 דקות", 1140, 1320], ["מחר 19:00 ל-2 שעות", 1140, 1320]]) { const p = parseIntentLocal(t, now); assert.deepEqual([p.startMinute, p.endMinute], [s, e], t); }
});
