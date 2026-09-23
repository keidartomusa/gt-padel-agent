import test from "node:test"; import assert from "node:assert/strict"; import { readFileSync } from "node:fs";
import { openRequests } from "../src/connections.js";
const now = new Date("2026-09-23T14:00:00Z");
test("Tom 17:12: open requests = active, ahead, no accepted connection; soonest first", () => {
  const requests = [
    { id: "a", userId: "1", displayName: "א", active: true, date: "2026-09-24", startMinute: 1140, endMinute: 1320, level: "3–3.5", durations: [90], partySize: 1 },
    { id: "b", userId: "2", displayName: "ב", active: true, date: "2026-09-23", startMinute: 1260, endMinute: 1440, level: "3–3.5", durations: [90], partySize: 2 },
    { id: "c", userId: "3", displayName: "ג", active: true, date: "2026-09-23", startMinute: 1000, endMinute: 1100 },
    { id: "d", userId: "4", active: false, date: "2026-09-24", startMinute: 1000, endMinute: 1100 },
    { id: "e", userId: "5", active: true, recurring: true, weekdays: [3], date: "2026-09-30", startMinute: 1140, endMinute: 1380 },
    { id: "f", userId: "6", active: true, date: "2026-09-22", startMinute: 1140, endMinute: 1380 }];
  const connections = [{ requestId: "c", status: "accepted" }, { requestId: "a", status: "pending" }];
  const o = openRequests({ requests, connections, now, isOver: r => r.id === "x" });
  assert.deepEqual(o.map(g => g.requestId), ["e", "b", "a"]); assert.equal(o[0].nextDate, "2026-09-23"); assert.equal(o[1].total, 2); assert.equal(o[1].kind, "open");
});
test("tab is named בקשות וחיבורים and marks open vs connection cards", () => {
  const src = readFileSync(new URL("../netlify/functions/admin.js", import.meta.url), "utf8");
  assert.match(src, /<button data-v="live">בקשות וחיבורים<\/button>/); assert.match(src, /בקשה פתוחה/); assert.match(src, /\.game\.open\{/);
  assert.match(readFileSync(new URL("../netlify/functions/admin-data.js", import.meta.url), "utf8"), /open:openRequests\(/);
});
