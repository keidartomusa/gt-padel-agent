// Renders the admin page offline with mock data from the QA round (/tmp/full-round.json) for screenshots.
import fs from "node:fs";
const [src = "netlify/functions/admin.js", out = "/tmp/dash.html", hash = ""] = process.argv.slice(2);
const html = await (await (await import("../" + src + "?" + Date.now())).default()).text();
const R = JSON.parse(fs.readFileSync("/tmp/full-round.json", "utf8"));
const conv = {}, names = {}; let t = Date.parse("2026-09-23T09:00:00Z");
for (const sc of R.scenarios.slice(0, 9)) for (const e of sc.log) {
  const ph = sc.actors[e.who].phone; names[ph] = e.name; t += 45000;
  (conv[ph] ||= []).push({ direction: "in", kind: "user", body: e.input.text ?? e.input.tap, sent: true, at: new Date(t).toISOString() });
  for (const o of e.out) { const p2 = sc.actors[o.to]?.phone || ph; t += 3000;
    const body = [o.text, o.buttons?.length ? "[כפתורים] " + o.buttons.map(b => b.title).join(" | ") : "", o.rows?.length ? "[רשימה] " + o.rows.map(r => r.title).join(" | ") : "", o.cta ? "[קישור] " + o.cta.label + " " + o.cta.url : ""].filter(Boolean).join("\n");
    (conv[p2] ||= []).push({ direction: "out", kind: o.template ? "template" : "service", body, sent: true, at: new Date(t).toISOString() }); }
}
const first = Object.keys(conv)[2]; conv[first].push({ direction: "out", kind: "template", body: "[תבנית match_alert] יש התאמה חדשה", sent: false, reason: "131047", at: new Date(t += 60000).toISOString() });
const users = Object.entries(conv).map(([id, m]) => { const o = m.filter(x => x.direction === "out"), ok = o.filter(x => x.sent); return { userId: id, name: names[id], received: m.length - o.length, sent: ok.length, service: ok.filter(x => x.kind !== "template").length, template: ok.filter(x => x.kind === "template").length, failed: o.length - ok.length, lastAt: m.at(-1).at, estimatedUsd: +(ok.length * 0.0053).toFixed(4) }; }).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
const tot = users.reduce((a, u) => ({ received: a.received + u.received, sent: a.sent + u.sent, service: a.service + u.service, template: a.template + u.template, failed: a.failed + u.failed }), { received: 0, sent: 0, service: 0, template: 0, failed: 0 });
const data = { summary: { registrations: users.length, activeRequests: 4, matches: 5, acceptedMatches: 3, bookingClicks: 3, verifiedBookings: 1, attributedRevenue: 300, incrementalCourtHours: 1.5 }, revenueBySource: { availability: 300, matching: 0 },
  bookingClicks: [{ id: "c1", clickedAt: "2026-09-23T10:01:22Z", source: "availability", date: "2026-09-24", time: "18:30", duration: 90, status: "clicked", price: 300 }, { id: "c2", clickedAt: "2026-09-22T21:22:07Z", source: "matching", date: "2026-09-25", time: "17:00", duration: 90, status: "user_confirmed", price: 300 }, { id: "c3", clickedAt: "2026-09-23T10:00:21Z", source: "availability", date: "2026-09-24", time: "18:30", duration: 60, status: "clicked", price: null }],
  messages: { users, totals: { ...tot, estimatedUsd: +(tot.sent * 0.0053).toFixed(4) } } };
const mock = `<script>sessionStorage.setItem('gt-admin-token','x');${hash ? `history.replaceState(null,'','${hash}');` : ""}window.fetch=async u=>{const m=/user=(\\d+)/.exec(u);const D=${JSON.stringify(data)},C=${JSON.stringify(conv)},N=${JSON.stringify(names)};return{ok:true,json:async()=>m?{userId:m[1],name:N[m[1]]||null,messages:C[m[1]]}:D}}</script>`;
fs.writeFileSync(out, html.replace("<script>", mock + "<script>"));
console.log(out, users.length, "users");
