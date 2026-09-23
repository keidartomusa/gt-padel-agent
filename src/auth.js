// Shared bearer-token check for admin endpoints. Constant-time compare (hashed so lengths never leak) and a hard
// refusal when the secret is not configured - otherwise the header "Bearer undefined" would match an unset env var.
import { createHash, timingSafeEqual } from "node:crypto";
const digest = s => createHash("sha256").update(String(s)).digest();
export function bearerOk(req, secret = process.env.ADMIN_DASHBOARD_TOKEN) {
  if (typeof secret !== "string" || !secret.trim()) return false;
  const got = req?.headers?.get?.("authorization") || "";
  return timingSafeEqual(digest(got), digest(`Bearer ${secret}`));
}
