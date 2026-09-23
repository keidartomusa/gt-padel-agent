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
test("admin-data and booking-confirm refuse 'Bearer undefined' when the secret is not configured", async () => {
  const saved = process.env.ADMIN_DASHBOARD_TOKEN; delete process.env.ADMIN_DASHBOARD_TOKEN;
  try {
    const data = (await import("../netlify/functions/admin-data.js")).default, confirm = (await import("../netlify/functions/booking-confirm.js")).default;
    assert.equal((await data(req("Bearer undefined"))).status, 401);
    assert.equal((await confirm(new Request("https://x/", { method: "POST", headers: { authorization: "Bearer undefined" }, body: "{}" }))).status, 401);
  } finally { if (saved !== undefined) process.env.ADMIN_DASHBOARD_TOKEN = saved; }
});
test("the admin page never embeds the secret and hides the login before first paint when a session exists", () => {
  assert.ok(!/ADMIN_DASHBOARD_TOKEN|process\.env/.test(html));
  const pre = html.indexOf('classList.add("authing")'), login = html.indexOf('<div id="login"');
  assert.ok(pre > 0 && pre < login, "pre-paint check runs before the login form is parsed");
  assert.match(html, /\.authing #login\{display:none\}/);
  assert.match(html, /catch\(e=>\{document\.documentElement\.classList\.remove\('authing'\)/, "a rejected saved password brings the login back");
});
