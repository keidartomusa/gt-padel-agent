import test from "node:test";
import assert from "node:assert/strict";
import handler from "../netlify/functions/admin.js";

const page = async () => (await handler(new Request("https://x/admin"))).text();

test("dashboard shows the value of booking clicks in ILS, labeled as potential and not bookings", async () => {
  const html = await page();
  assert.ok(html.includes("'שווי הלחיצות',ils(clickValue())"));
  assert.ok(html.includes("פוטנציאל, לא הזמנות"));
  assert.ok(html.includes("לא נספרות כהזמנות"));
});

test("click value sums only numeric prices and formats as '<n> ₪'", async () => {
  const html = await page();
  const src = html.match(/function ils\(n\)\{[^}]*\}\nfunction clickValue\(\)\{[^\n]*\}/)[0];
  const f = new Function("D", src + ";return [clickValue(), ils(clickValue())]");
  const [v, s] = f({ bookingClicks: [{ price: 300 }, { price: null }, { price: "200" }, {}] });
  assert.equal(v, 500); assert.equal(s, "500 ₪");
  assert.equal(f({})[0], 0);
});

test("side menu uses the chosen sky blue theme", async () => {
  const html = await page();
  assert.ok(html.includes("linear-gradient(180deg,#eff6ff,#dbeafe)"));
  assert.ok(html.includes(".tabs button.on{background:#2563eb"));
});
