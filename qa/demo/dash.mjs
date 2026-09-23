// Renders the real admin page offline with the demo run's data (/tmp/demo/store.json + events.json). Message cost is hidden for the video (Tom 19:50).
// Usage: node qa/demo/dash.mjs <tab> <out.html>   tab: overview | live | chats | clicks
import fs from "node:fs";
import { summarizeAdmin } from "../../src/admin.js";
import { liveConnections, openRequests } from "../../src/connections.js";
import { gameOver } from "../../src/matching.js";
import { describe, previewText } from "../../src/messagelog.js";
const [tab = "overview", out = "/tmp/demo/dash.html"] = process.argv.slice(2);
const ev = JSON.parse(fs.readFileSync("/tmp/demo/events.json", "utf8")), store = JSON.parse(fs.readFileSync("/tmp/demo/store.json", "utf8"));
const PH = { dana: "972500000011", michal: "972500000012", ron: "972500000013" };
const vals = p => store.filter(x => x.key.startsWith(p)).map(x => x.value);
const requests = vals("request/"), connections = vals("connection/"), profilesArr = vals("profile/"), profiles = Object.fromEntries(profilesArr.map(p => [p.userId, p])), names = Object.fromEntries(profilesArr.map(p => [p.userId, p.name]));
const at0 = Date.parse(ev.at || "2026-09-23T16:40:00Z"); let t = at0 - 20 * 60000;
// The booking tap in scene 2 is what production records as a click (via /go/book); the demo never opened that link, so it is reconstructed here from the card.
const cta = ev.bookingCard?.ctaUrl ? new URL(ev.bookingCard.ctaUrl.url).searchParams : null;
const clicks = cta ? [{ id: "demo-click", clickedAt: new Date(at0 - 17 * 60000).toISOString(), source: cta.get("source"), date: cta.get("date"), time: cta.get("time"), duration: Number(cta.get("duration")), price: Number(cta.get("price")), status: "clicked", userId: cta.get("user"), userName: names[cta.get("user")] || null }] : [];
const conv = {};
for (const sc of ev.scenes) { const ph = PH[sc.phone]; for (const m of sc.chat) { t += m.me ? 40000 : 3000; (conv[ph] ||= []).push(m.me ? { direction: "in", kind: "user", body: m.t, sent: true, at: new Date(t).toISOString() } : { direction: "out", kind: "service", body: describe(m.r), sent: true, at: new Date(t).toISOString() }); } }
const users = Object.entries(conv).map(([id, m]) => { const o = m.filter(x => x.direction === "out"); return { userId: id, name: names[id], received: m.length - o.length, sent: o.length, service: o.length, template: 0, failed: 0, lastAt: m.at(-1).at, estimatedUsd: 0, lastText: previewText(m.at(-1).body), lastDirection: m.at(-1).direction }; }).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
const tot = users.reduce((a, u) => ({ received: a.received + u.received, sent: a.sent + u.sent, service: a.service + u.service, template: 0, failed: 0 }), { received: 0, sent: 0, service: 0, template: 0, failed: 0 });
const now = new Date(at0);
const data = { generatedAt: now.toISOString(), ...summarizeAdmin({ requests, connections, clicks }), messages: { users, totals: { ...tot, estimatedUsd: 0 } }, requests, connections,
  live: liveConnections({ requests, connections, profiles, now }), open: openRequests({ requests, connections, profiles, now, isOver: x => !x.recurring && gameOver(x, now) }), bookingClicks: clicks };
let html = await (await (await import("../../netlify/functions/admin.js")).default()).text();
const before = html.length;
html = html.replace(/,\['עלות הודעות',usd\(m\.estimatedUsd\),[^\]]*\]/, "").replace(" · עלות '+usd(u.estimatedUsd)+'", "'+'");
if (html.length === before || html.includes("'עלות הודעות'") || html.includes("עלות '+usd(u.estimatedUsd)")) throw new Error("cost hiding did not apply - admin page changed");
const mock = `<script>sessionStorage.setItem('gt-admin-token','x');window.fetch=async u=>{const m=/user=(\\d+)/.exec(u);const D=${JSON.stringify(data)},C=${JSON.stringify(conv)},N=${JSON.stringify(names)};return{ok:true,json:async()=>m?{userId:m[1],name:N[m[1]]||null,messages:C[m[1]]}:D}}</script>`;
const tabJs = tab !== "overview" ? `<script>setTimeout(()=>{const b=document.querySelector('[data-v="${tab}"]');b&&b.click();${tab === "chats" ? `setTimeout(()=>{const u=document.querySelector('#users .u');u&&u.click()},500)` : ""}},600)</script>` : "";
fs.writeFileSync(out, html.replace("<script>", mock + "<script>") + tabJs);
console.log(out, users.length, "users", data.live?.length, "live", data.open?.length, "open", clicks.length, "clicks");
