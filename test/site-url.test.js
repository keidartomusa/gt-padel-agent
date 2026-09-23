// Regression 23.9: project renamed to gtpadel; the old jolly-souffle host 404s, so links must never use it.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { bookingUrl } from "../src/availability.js";
test("booking link defaults to gtpadel host", () => {
  const saved = process.env.PUBLIC_SITE_URL; delete process.env.PUBLIC_SITE_URL;
  try {
    const u = bookingUrl("2026-09-24", { courtId: "c1", start: "19:00", durationMinutes: 90, price: 200 });
    assert.ok(u.startsWith("https://gtpadel.netlify.app/go/book?"), u);
  } finally { if (saved !== undefined) process.env.PUBLIC_SITE_URL = saved; }
});
test("no source file references the dead jolly-souffle host", () => {
  const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
  for (const f of [...walk("src"), ...walk("netlify")].filter(f => /\.(m?js|html|toml)$/.test(f)))
    assert.ok(!readFileSync(f, "utf8").includes("jolly-souffle"), f);
});
