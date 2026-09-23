// Renders a scripted conversation (in-memory store) as WhatsApp-like HTML for screenshots. Usage: node qa/chat-shot.mjs <out.html> <scenario>
import { writeFileSync } from "node:fs";
import { handleConversation } from "../src/conversation.js";
import { plainDashes } from "../src/whatsapp.js";
import { memoryStore, named } from "../test/named-store.mjs";
const now = new Date("2026-09-23T18:38:00+03:00");
const available = async i => ({ kind: "availability", date: i.date, slots: [{ courtId: "c1", courtName: "1", start: "21:00", end: "22:30", durationMinutes: 90, price: 300 }] });
const s = memoryStore(); const log = [];
const H = (u, n, show) => async o => { const r = await handleConversation({ userId: u, displayName: n, store: s, now, availabilityFn: available, ...o }); if (show) { log.push({ me: true, t: o.label || o.text || o.actionId }); log.push({ me: false, r }); } return r; };
async function seed(u, n, when) { await named(s, u, n); const h = H(u, n); for (const a of ["oneoff", "level:3", "pc:1:yes"]) await h({ actionId: a }); await h({ text: when }); }
await seed("972500000001", "תימור", "היום אחרי 21:00 ל90 דקות"); await seed("972500000002", "אורנה", "היום אחרי 19:00 ל90 דקות");
await named(s, "me", "תום"); const h = H("me", "תום", true), q = H("me", "תום");
const sc = process.argv[3];
if (sc === "register") { for (const a of ["oneoff", "level:3"]) await q({ actionId: a }); await h({ actionId: "pc:1:yes", label: "רק אני · יש מגרש" }); await h({ text: "היום ב-21:00" }); await h({ actionId: "duration:120", label: "120 דקות" }); }
if (sc === "myreq") { for (const a of ["oneoff", "level:3", "pc:1:yes"]) await q({ actionId: a }); await q({ text: "היום ב-21:00 ל120 דקות" }); await h({ actionId: "my_requests", label: "הבקשות שלי" }); }
if (sc === "pick") { await q({ actionId: "board" }); const b = await h({ actionId: "bwhen:0", label: "היום בערב" }); const ids = (b.list?.sections || []).flatMap(x => x.rows).filter(x => x.id.startsWith("connect:")); await h({ actionId: ids[0].id, label: ids[0].title }); }
const esc = x => plainDashes(String(x ?? "")).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\*([^*\n]+)\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
const bub = m => m.me ? `<div class="b me">${esc(m.t)}</div>` : `<div class="b">${esc(m.r.text)}${(m.r.buttons || []).map(x => `<div class="btn">${esc(x.title)}</div>`).join("")}${m.r.list ? `<div class="btn">☰ ${esc(m.r.list.button)}</div><div class="rows">${m.r.list.sections.flatMap(x => x.rows).map(x => `<div class="row"><b>${esc(x.title)}</b>${x.description ? `<br><small>${esc(x.description)}</small>` : ""}</div>`).join("")}</div>` : ""}</div>`;
writeFileSync(process.argv[2], `<html dir="rtl"><meta charset="utf-8"><style>body{background:#efe7dd;font:15px Arial;margin:0;padding:12px;width:390px}.b{background:#fff;border-radius:8px;padding:8px 10px;margin:6px 40px 6px 0;box-shadow:0 1px 1px #0002}.me{background:#d9fdd3;margin:6px 0 6px 40px}.btn{color:#027eb5;text-align:center;border-top:1px solid #eee;margin-top:6px;padding-top:6px}.rows{background:#f7f7f7;border-radius:6px;margin-top:6px}.row{padding:5px 8px;border-bottom:1px solid #e5e5e5}small{color:#667}</style>${log.map(bub).join("")}</html>`);
