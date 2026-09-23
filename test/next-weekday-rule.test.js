// Tom 23.9 10:43 (wamid ...M0FCNEU3RDRBRkI1QUVGRjZFNzUA): "חמישי הבא מדבר על יום חמישי בשבוע הבא (לא מחר)".
// Rule: "<weekday> הבא" = that weekday in next calendar week (Sun-Sat). Bare weekday = next occurrence.
import test from "node:test";
import assert from "node:assert/strict";
import { parseIntentLocal } from "../src/intent.js";
import { rulesText } from "../src/timeres.js";
const wed = new Date("2026-09-23T10:36:00+03:00"), sun = new Date("2026-09-27T10:00:00+03:00"), sat = new Date("2026-09-26T10:00:00+03:00");
const cases = [
  [wed, "חמישי הבא", "2026-10-01"], [wed, "ביום חמישי הבא בשעה שש", "2026-10-01"], [wed, "ראשון הבא", "2026-09-27"],
  [wed, "שני הבא", "2026-09-28"], [wed, "שלישי הבא", "2026-09-29"], [wed, "רביעי הבא", "2026-09-30"],
  [wed, "שישי הבא", "2026-10-02"], [wed, "שבת הבאה", "2026-10-03"], [wed, "יום חמישי", "2026-09-24"], [wed, "בחמישי", "2026-09-24"],
  [sun, "ראשון הבא", "2026-10-04"], [sun, "חמישי הבא", "2026-10-08"], [sun, "חמישי", "2026-10-01"],
  [sat, "ראשון הבא", "2026-09-27"], [sat, "שבת הבאה", "2026-10-03"],
];
for (const [now, t, d] of cases) test(`${now.toISOString().slice(0,10)} "${t}" -> ${d}`, () => assert.equal(parseIntentLocal(t, now).date, d));
test("model prompt states the next-week rule", () => assert.match(rulesText(), /הבא.*NEXT calendar week/));
