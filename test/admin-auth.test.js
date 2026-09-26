// Tom 23.9 19:51: the dashboard flashed the password screen on refresh, and he asked how the password is protected.
import test from "node:test"; import assert from "node:assert/strict";
import { bearerOk } from "../src/auth.js";
import { html } from "../netlify/functions/admin.js";
const req = h => new Request("https://x/.netlify/functions/admin-data", { headers: h ? { authorization: h } : {} });
test("bearer check: exact match only, and an unset secret never matches (no 'Bearer undefined' bypass)", () => {
  assert.equal(bearerOk(req("Bearer s3cret-value"), "s3cret-value"), true);
  assert.equal(bearerOk(req("Bearer s3cret-valuE"), "s3cret-value"), false);
  assert.equal(bearerOk(req("s3cret-value"), "s3cret-value"), false);
  assert.equal(bearerOk(req(null), "s3cret-value"), false);
  for (const unset of [undefined, "", "   "]) { assert.equal(bearerOk(req("Bearer undefined"), unset), false); assert.equal(bearerOk(req("Bearer "), unset), false); }
});
test("the admin endpoints gate refuses 'Bearer undefined' when the secret is not configured", async () => {
  const { authGate } = await import("../src/auth.js"), { memoryStore } = await import("../src/store.js");
  const saved = process.env.ADMIN_DASHBOARD_TOKEN; delete process.env.ADMIN_DASHBOARD_TOKEN;
  try { assert.equal((await authGate(req("Bearer undefined"), memoryStore())).status, 401); } finally { if (saved !== undefined) process.env.ADMIN_DASHBOARD_TOKEN = saved; }
  for (const f of ["admin-data.js", "booking-confirm.js", "club-contact.js"]) { const src = (await import("node:fs")).readFileSync(new URL(`../netlify/functions/${f}`, import.meta.url), "utf8"); assert.match(src, /dashboardGate\(req,/); assert.doesNotMatch(src, /!==`Bearer \$\{process\.env/); }
});
test("the admin page never embeds the secret and hides the login before first paint when a session exists", () => {
  assert.ok(!/ADMIN_DASHBOARD_TOKEN|process\.env/.test(html));
  const pre = html.indexOf('classList.add("authing")'), login = html.indexOf('<div id="login"');
  assert.ok(pre > 0 && pre < login, "pre-paint check runs before the login form is parsed");
  assert.match(html, /\.authing #login\{display:none\}/);
  assert.match(html, /catch\(e=>\{document\.documentElement\.classList\.remove\('authing'\)/, "a rejected saved password brings the login back");
});
test("Tom 20:02: 5 wrong passwords from one IP lock it out for 15 minutes, even with the right password; other IPs unaffected", async () => {
  const { authGate, LOCK } = await import("../src/auth.js"), { memoryStore } = await import("../src/store.js");
  const s = memoryStore(), SECRET = "right-one-123", t0 = Date.parse("2026-09-23T20:00:00Z");
  const r = (pw, ip = "1.2.3.4") => new Request("https://x/", { headers: { authorization: `Bearer ${pw}`, "x-nf-client-connection-ip": ip } });
  for (let i = 1; i < LOCK.maxFails; i++) assert.equal((await authGate(r("wrong"), s, { now: t0 + i, secret: SECRET })).status, 401);
  const lock = await authGate(r("wrong"), s, { now: t0 + 10, secret: SECRET }); assert.equal(lock.status, 429); assert.equal((await lock.json()).retryAfterMinutes, 15);
  assert.equal((await authGate(r(SECRET), s, { now: t0 + 60000, secret: SECRET })).status, 429, "locked even with the right password");
  assert.equal(await authGate(r(SECRET, "9.9.9.9"), s, { now: t0 + 60000, secret: SECRET }), null, "another IP is not locked");
  assert.equal(await authGate(r(SECRET), s, { now: t0 + 10 + LOCK.lockMs + 1, secret: SECRET }), null, "unlocks after 15 minutes");
  assert.equal((await authGate(r("wrong"), s, { now: t0 + LOCK.lockMs + 20, secret: SECRET })).status, 401, "a success resets the counter");
  assert.ok(!(await s.list("authfail/")).some(x => JSON.stringify(x).includes("1.2.3.4")), "raw IP never stored");
});
test("wrong attempts spread beyond the 15-minute window do not add up", async () => {
  const { authGate, LOCK } = await import("../src/auth.js"), { memoryStore } = await import("../src/store.js");
  const s = memoryStore(), t0 = Date.parse("2026-09-23T20:00:00Z"), r = new Request("https://x/", { headers: { authorization: "Bearer no", "x-nf-client-connection-ip": "5.5.5.5" } });
  for (let i = 0; i < 8; i++) assert.equal((await authGate(r, s, { now: t0 + i * (LOCK.windowMs / 4 + 1000), secret: "abc-secret" })).status, 401);
});
