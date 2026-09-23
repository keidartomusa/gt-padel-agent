// Renders /tmp/demo/events.json into 1080x1920 frames (caption bar + WhatsApp-style phone). Usage: node qa/demo/render.mjs
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { plainDashes } from "../../src/whatsapp.js";
const ev = JSON.parse(readFileSync("/tmp/demo/events.json", "utf8")), OUT = "/tmp/demo/frames";
rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true });
const NAMES = { dana: "דנה", michal: "מיכל", ron: "רון" };
const esc = x => plainDashes(String(x ?? "")).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\*([^*\n]+)\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
const bub = m => m.me ? `<div class="b me">${esc(m.t)}</div>` : `<div class="b">${esc(m.r.text)}${m.r.ctaUrl ? `<div class="btn">↗ ${esc(m.r.ctaUrl.displayText)}</div>` : ""}${(m.r.buttons || []).map(x => `<div class="btn">${esc(x.title)}</div>`).join("")}${m.r.list ? `<div class="btn">☰ ${esc(m.r.list.button)}</div><div class="rows">${m.r.list.sections.flatMap(x => x.rows).map(x => `<div class="row"><b>${esc(x.title)}</b>${x.description ? `<br><small>${esc(x.description)}</small>` : ""}</div>`).join("")}</div>` : ""}</div>`;
const CSS = `*{box-sizing:border-box}body{margin:0;width:540px;height:960px;background:linear-gradient(160deg,#0b3d91,#0a7cc4);font-family:Arial,sans-serif;overflow:hidden}
.cap{height:150px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;text-align:center;padding:0 24px}
.cap .n{font-size:15px;opacity:.8;margin-bottom:6px}.cap .t{font-size:27px;font-weight:bold;line-height:1.25}
.phone{position:absolute;top:160px;left:50%;transform:translateX(-50%);width:400px;height:780px;border-radius:36px;background:#111;padding:10px;box-shadow:0 12px 40px #0006}
.scr{width:100%;height:100%;border-radius:28px;overflow:hidden;display:flex;flex-direction:column;background:#efe7dd}
.hd{background:#075e54;color:#fff;padding:14px 14px 10px;display:flex;align-items:center;gap:10px;direction:rtl}.av{width:34px;height:34px;border-radius:50%;background:#fff;color:#075e54;font-weight:bold;display:flex;align-items:center;justify-content:center;font-size:12px}
.hd .nm{font-weight:bold;font-size:15px}.hd .sb{font-size:11px;opacity:.85}
.chat{flex:1;display:flex;flex-direction:column;justify-content:flex-end;overflow:hidden;padding:8px 10px;direction:rtl;font-size:13.5px}
.b{background:#fff;border-radius:8px;padding:7px 9px;margin:4px 34px 4px 0;box-shadow:0 1px 1px #0002;line-height:1.35}.me{background:#d9fdd3;margin:4px 0 4px 34px}
.btn{color:#027eb5;text-align:center;border-top:1px solid #eee;margin-top:5px;padding-top:5px}.rows{background:#f7f7f7;border-radius:6px;margin-top:5px}.row{padding:4px 8px;border-bottom:1px solid #e5e5e5}small{color:#667}
.img{flex:1;background:#fff no-repeat center top/contain}.url{background:#f1f3f4;color:#333;font-size:11px;padding:8px 12px;direction:ltr;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;text-align:center;padding:40px;direction:rtl}.card h1{font-size:40px;margin:0 0 18px}.card p{font-size:22px;line-height:1.5;margin:6px 0;opacity:.95}`;
let n = 0; const frames = [];
const shot = (html, secs) => { const f = `${OUT}/f${String(++n).padStart(3, "0")}`; writeFileSync(`${f}.html`, `<html dir="rtl"><meta charset="utf-8"><style>${CSS}</style><body>${html}</body></html>`);
  execFileSync("google-chrome", ["--headless", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--window-size=540,960", "--force-device-scale-factor=2", `--screenshot=${f}.png`, `file://${f}.html`], { stdio: "ignore", timeout: 60000 }); frames.push({ file: `${f}.png`, secs }); };
const cap = (num, text) => `<div class="cap">${num ? `<div class="n">${num}</div>` : ""}<div class="t">${esc(text)}</div></div>`;
const phone = (who, inner) => `<div class="phone"><div class="scr"><div class="hd"><div class="av">GT</div><div><div class="nm">GT PADEL</div><div class="sb">הטלפון של ${NAMES[who]} (משתמש/ת דמו)</div></div></div>${inner}</div></div>`;
shot(`<div class="card"><h1>GT PADEL בוואטסאפ</h1><p>מגרש פנוי ושותפים למשחק - בהודעה אחת</p><p style="font-size:16px;opacity:.75;margin-top:30px">זמינות ומחירים אמיתיים מהמועדון · משתמשי דמו בדויים</p></div>`, 3);
for (const sc of ev.scenes) {
  const label = `${sc.id} / ${ev.scenes.length}`;
  for (const k of sc.shots) { const msgs = sc.chat.slice(0, k); shot(cap(label, sc.caption) + phone(sc.phone, `<div class="chat">${msgs.map(bub).join("")}</div>`), msgs.length && !msgs[msgs.length - 1].me ? Math.min(6, 2.5 + String(msgs[msgs.length - 1].r?.text || "").length / 90) : 2); }
  if (sc.id === 2 && existsSync("/tmp/demo/mp-book.png")) shot(cap(label, "לחיצה על 'להזמנה' פותחת את מסך ההזמנה האמיתי של המועדון ב-Matchpointer") + `<div class="phone"><div class="scr"><div class="url">matchpointer.app/he/clubs/gt-padel/book</div><div class="img" style="background-image:url(file:///tmp/demo/mp-book.png)"></div></div></div>`, 5);
}
for (const d of ["overview", "live", "chats", "clicks"]) { const p = `/tmp/demo/dash-${d}.png`; if (existsSync(p)) shot(cap("דשבורד", { overview: "דשבורד למועדון - תמונת מצב", live: "בקשות וחיבורים", chats: "כל השיחות במקום אחד", clicks: "לחיצות על 'להזמנה' (לא נספרות כהזמנות)" }[d]) + `<div class="phone" style="width:500px"><div class="scr" style="background:#fff"><div class="img" style="background-image:url(file://${p})"></div></div></div>`, 4); }
shot(`<div class="card"><h1>GT PADEL</h1><p>שואלים על מגרש, מוצאים שותפים, ומזמינים באתר המועדון</p></div>`, 3);
writeFileSync(`${OUT}/list.txt`, frames.map(f => `file '${f.file}'\nduration ${f.secs.toFixed(2)}`).join("\n") + `\nfile '${frames.at(-1).file}'\n`);
console.log(frames.length, "frames", frames.reduce((a, f) => a + f.secs, 0).toFixed(1), "s");
