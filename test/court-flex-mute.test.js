// Tom 23.9 13:14: "אם כבר יש לי מגרש אין טעם לשאול אם אנחנו גמישים בשעה" -> with a court, no flex question (exact time).
// Tom 23.9 13:15: "אם ״הבקשה נשמרה״ - לא צריך להציע להשתיק. ההצעה להשתיק צריכה לבוא רק בהתראה".
import test from "node:test";
import assert from "node:assert/strict";
import { handleConversation } from "../src/conversation.js";
import { memoryStore, named } from "./named-store.mjs";
const now = new Date("2026-09-23T08:00:00+03:00");
const available = async i => ({ kind: "availability", date: i.date, slots: [{ courtId: "c1", courtName: "1", start: "19:00", end: "20:30", durationMinutes: 90, price: 300 }] });
async function upToCourt(s, u, name, when = "מחר אחרי 19:00") {
  await named(s, u, name);
  const h = o => handleConversation({ userId: u, displayName: name, store: s, now, availabilityFn: available, ...o });
  for (const o of [{ actionId: "oneoff" }, { actionId: "level:3–3.5" }, { text: when }, { actionId: "duration:90" }, { actionId: "party:1" }]) await h(o);
  return h;
}
const ids = r => [...(r.buttons || []).map(b => b.id), ...(r.list?.sections || []).flatMap(x => x.rows.map(y => y.id))];
test("court: yes skips the flex question and saves an exact-time request", async () => {
  const s = memoryStore(), h = await upToCourt(s, "a", "דנה");
  const r = await h({ actionId: "court:yes" });
  assert.doesNotMatch(r.text, /גמישים/);
  assert.match(r.text, /הבקשה נשמרה/);
  const req = (await s.list("request/"))[0].value;
  assert.equal(req.hasCourt, true); assert.equal(req.flexMinutes, 0);
});
test("court: no still asks the flex question", async () => {
  const s = memoryStore(), h = await upToCourt(s, "b", "נועם");
  const r = await h({ actionId: "court:no" });
  assert.equal(r.text, "עד כמה אתם גמישים בשעה?");
});
test("request-saved confirmation offers no mute", async () => {
  for (const [court, flex] of [["yes", null], ["no", "60"]]) {
    const s = memoryStore(), h = await upToCourt(s, "c" + court, "רון");
    let r = await h({ actionId: `court:${court}` });
    if (flex) r = await h({ actionId: `flex:${flex}` });
    assert.match(r.text, /הבקשה נשמרה/);
    assert.ok(!ids(r).some(x => x.startsWith("mute")), JSON.stringify(ids(r)));
  }
});
// Tom 23.9 14:13 supersedes "mute only in notifications": no mute anywhere.
test("match notification offers only the connect action, no mute", async () => {
  const s = memoryStore();
  await (await upToCourt(s, "x", "דנה"))({ actionId: "court:yes" });
  const r = await (await upToCourt(s, "y", "נועם"))({ actionId: "court:yes" });
  assert.match(r.text, /מצאתי התאמה אפשרית ושלחתי הצעה/);
  assert.ok(r.notifications?.length);
  for (const n of r.notifications) assert.deepEqual(ids(n.response), [`connect:${(await s.list("request/")).map(x => x.value).find(x => x.userId === "y").id}`]);
});
