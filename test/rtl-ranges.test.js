// Tom 23.9 14:51 ("לא ראיתי, תתקן"): ranges render reversed inside Hebrew text; every outbound range is wrapped in LRI/PDI.
import test from "node:test";
import assert from "node:assert/strict";
import { bidiRanges, bidiResponse, sendResponse } from "../src/whatsapp.js";
const L = "\u2066", P = "\u2069";
test("level, time and slot ranges are wrapped", () => {
  assert.equal(bidiRanges("רמה 3–3.5 · בינוניים+"), `רמה ${L}3-3.5${P} · בינוניים+`);
  assert.equal(bidiRanges("2–2.5 · מתחילים+"), `${L}2-2.5${P} · מתחילים+`);
  assert.equal(bidiRanges("• 17:30–19:00 · מגרש 2 · ₪300"), `• ${L}17:30-19:00${P} · מגרש 2 · ₪300`);
  assert.equal(bidiRanges("חמישי 24.9 · 06:00–12:00"), `חמישי 24.9 · ${L}06:00-12:00${P}`);
  assert.equal(bidiRanges("19:00-20:30"), `${L}19:00-20:30${P}`);
});
test("phones, dates, single times, ISO dates and 4+ are untouched; wrapping is idempotent", () => {
  for (const t of ["050-1110021", "24.9", "אחרי 19:00", "2026-09-24", "4+ · מתקדמים", "₪300", "מגרשים 2, 3"]) assert.equal(bidiRanges(t), t);
  const once = bidiRanges("רמה 3–3.5, 17:30–19:00"); assert.equal(bidiRanges(once), once);
});
test("every field of a response is wrapped and Meta length limits still hold", () => {
  const r = bidiResponse({ text: "רמה 3–3.5", buttons: [{ id: "a", title: "3.5–4 · בינוניים-גבוה" }], list: { button: "x", sections: [{ title: "s", rows: [{ id: "r", title: "3.5–4 · בינוניים-גבוהים", description: "17:30–19:00 · מגרש 2" }] }] }, ctaUrl: { displayText: "להזמנה 17:30–19:00", url: "u" } });
  assert.ok(r.text.includes(L));
  assert.ok(r.buttons[0].title.length <= 20); assert.ok(r.list.sections[0].rows[0].title.length <= 24);
  assert.ok(r.list.sections[0].rows[0].description.includes(L)); assert.ok(r.ctaUrl.displayText.length <= 20);
  // a title that would exceed the limit falls back to plain text rather than cutting a mark in half
  for (const t of [r.buttons[0].title, r.list.sections[0].rows[0].title, r.ctaUrl.displayText]) assert.equal((t.match(/\u2066/g) || []).length, (t.match(/\u2069/g) || []).length);
});
test("sendResponse puts the marks on the wire (text, buttons, list rows)", async () => {
  const bodies = [], f = async (u, o) => { bodies.push(JSON.parse(o.body)); return { ok: true, json: async () => ({}) }; };
  const env = { ...process.env }; process.env.DISABLE_OUTBOUND = "false"; process.env.WHATSAPP_ACCESS_TOKEN = "t"; process.env.WHATSAPP_PHONE_NUMBER_ID = "1";
  try {
    await sendResponse("972500000000", { text: "מה הרמה?", list: { button: "לבחירה", sections: [{ title: "s", rows: [{ id: "level:3", title: "3–3.5 · בינוניים+" }] }] } }, null, f);
    await sendResponse("972500000000", { text: "יש זמינות: 18:00–19:30", buttons: [{ id: "b", title: "18:00–19:30" }] }, null, f);
    await sendResponse("972500000000", { text: "רמה 3–3.5" }, null, f);
  } finally { process.env = env; }
  assert.equal(bodies[0].interactive.action.sections[0].rows[0].title, `${L}3-3.5${P} · בינוניים+`);
  assert.equal(bodies[1].interactive.body.text, `יש זמינות: ${L}18:00-19:30${P}`); assert.equal(bodies[1].interactive.action.buttons[0].reply.title, `${L}18:00-19:30${P}`);
  assert.equal(bodies[2].text.body, `רמה ${L}3-3.5${P}`);
});

// Tom 23.9 15:27: a regular hyphen instead of long dashes in everything users see.
test("outbound text uses a regular hyphen, never en/em dashes", async () => {
  const { bidiResponse, plainDashes } = await import("../src/whatsapp.js");
  assert.equal(plainDashes("GT PADEL — מערכת · 3–3.5"), "GT PADEL - מערכת · 3-3.5");
  const r = bidiResponse({ text: "רמה 3–3.5 — x", buttons: [{ id: "a", title: "17:30–19:00" }], list: { button: "b", sections: [{ title: "s", rows: [{ id: "r", title: "3.5–4 · בינוניים-גבוהים", description: "18:00–19:30 — y" }] }] }, ctaUrl: { displayText: "להזמנה 17:30", url: "https://x" } });
  assert.doesNotMatch(JSON.stringify(r), /[–—]/);
});
test("dashboard has the new title, no long dashes and no revenue line on login", async () => {
  const src = (await import("node:fs")).readFileSync(new URL("../netlify/functions/admin.js", import.meta.url), "utf8");
  assert.match(src, /<h1>GT PADEL - מערכת ניהול<\/h1>/); assert.match(src, /<title>GT PADEL - מערכת ניהול<\/title>/); assert.doesNotMatch(src, /[—]|ניהול התאמות|הזמנה מאומתת בלבד נספרת/);
});
