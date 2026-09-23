// Shared bearer-token check for admin endpoints. Constant-time compare (hashed so lengths never leak) and a hard
// refusal when the secret is not configured - otherwise the header "Bearer undefined" would match an unset env var.
import { createHash, timingSafeEqual } from "node:crypto";
const digest = s => createHash("sha256").update(String(s)).digest();
export function bearerOk(req, secret = process.env.ADMIN_DASHBOARD_TOKEN) {
  if (typeof secret !== "string" || !secret.trim()) return false;
  const got = req?.headers?.get?.("authorization") || "";
  return timingSafeEqual(digest(got), digest(`Bearer ${secret}`));
}

// Tom 23.9 20:02: lock an IP out for 15 minutes after repeated wrong passwords. Only a hash of the IP is stored.
export const LOCK = { maxFails: 5, windowMs: 15 * 60000, lockMs: 15 * 60000 };
export function clientIp(req, context) { return context?.ip || req.headers.get("x-nf-client-connection-ip") || (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown"; }
const ipKey = ip => `authfail/${createHash("sha256").update(`gt-padel:${ip}`).digest("hex").slice(0, 32)}`;
// Returns null when the request may proceed, or a Response (401 wrong password / 429 locked out).
export async function authGate(req, store, { context, now = Date.now(), secret } = {}) {
  const key = ipKey(clientIp(req, context)), rec = (await store.get(key)) || null;
  if (rec?.lockedUntil && rec.lockedUntil > now) { const mins = Math.ceil((rec.lockedUntil - now) / 60000); return new Response(JSON.stringify({ error: "locked", retryAfterMinutes: mins }), { status: 429, headers: { "content-type": "application/json", "retry-after": String(Math.ceil((rec.lockedUntil - now) / 1000)) } }); }
  if (bearerOk(req, secret === undefined ? process.env.ADMIN_DASHBOARD_TOKEN : secret)) { if (rec) await store.delete(key); return null; }
  const fresh = !rec || !rec.firstAt || now - rec.firstAt > LOCK.windowMs, fails = fresh ? 1 : (rec.fails || 0) + 1;
  const next = { fails, firstAt: fresh ? now : rec.firstAt, lockedUntil: fails >= LOCK.maxFails ? now + LOCK.lockMs : null };
  await store.set(key, next);
  if (next.lockedUntil) { console.log(JSON.stringify({ event: "admin_auth_lockout", key: key.slice(9, 17) })); return new Response(JSON.stringify({ error: "locked", retryAfterMinutes: Math.ceil(LOCK.lockMs / 60000) }), { status: 429, headers: { "content-type": "application/json" } }); }
  return new Response("unauthorized", { status: 401 });
}
