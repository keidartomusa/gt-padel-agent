// Demo video script: runs the production conversation code with the LIVE club availability and fictitious demo users.
// Output: /tmp/demo/events.json (per scene, the chat as the viewer's phone shows it) + the demo store for the dashboard.
import fs from "node:fs";
import { routeIncoming } from "../../src/webhook.js";
import { memoryStore } from "../../src/store.js";
import { plainDashes } from "../../src/whatsapp.js";
const now = new Date(), store = memoryStore(), out = { at: now.toISOString(), scenes: [] };
const U = { dana: ["972500000011", "דנה"], michal: ["972500000012", "מיכל"], ron: ["972500000013", "רון"] };
const clean = r => r && JSON.parse(JSON.stringify(r, (k, v) => typeof v === "string" ? plainDashes(v) : v));
let scene; const S = (id, caption, phone) => { scene = { id, caption, phone, chat: [], shots: [] }; out.scenes.push(scene); };
const inbox = {}; // notifications per user, for scenes shown from another phone
async function say(who, input, label) {
  const [userId, displayName] = U[who]; const r = clean(await routeIncoming({ userId, displayName, store, now, ...input }));
  for (const n of r.notifications || []) (inbox[n.to] ||= []).push(clean(n.response));
  if (who === scene.phone) { scene.chat.push({ me: true, t: label || input.text || input.actionId }); scene.chat.push({ me: false, r }); scene.shots.push(scene.chat.length); }
  return r;
}
const rowsOf = r => (r.list?.sections || []).flatMap(s => s.rows); const pick = (r, f) => rowsOf(r).find(f) || (r.buttons || []).find(f);
const fromInbox = (who, keep = () => true) => { const [id] = U[who]; const items = (inbox[id] || []).filter(keep); inbox[id] = []; for (const r of items) { scene.chat.push({ me: false, r }); scene.shots.push(scene.chat.length); } return items; };
// Answers whatever the bot still asks after the time (flex, name) until the request is saved.
async function untilSaved(who, r) { for (let i = 0; i < 4 && !/נשמרה|נשמרו/.test(r.text || ""); i++) { const b = pick(r, x => x.id === "name_wa") || pick(r, x => x.id === "flex:60"); if (!b) break; r = await say(who, { actionId: b.id }, b.title); } return r; }
async function register(who, level, pc, when) { const s0 = scene; scene = { phone: null, chat: [], shots: [] }; let r; for (const a of [{ text: "שלום" }, { actionId: "players" }, { actionId: "oneoff" }, { actionId: level }, { actionId: pc }, { text: when }]) r = await say(who, a); r = await untilSaved(who, r); scene = s0; return r; }

// 1. Welcome
S(1, "בוט וואטסאפ למועדון GT PADEL", "dana");
await say("dana", { text: "היי" });
// 2. Court search with live availability -> booking card
S(2, "חיפוש מגרש פנוי - זמינות אמיתית מהמועדון", "dana");
let r = await say("dana", { text: "יש מגרש פנוי מחר בערב?" });
// tap the offered slot closest to the evening that was asked for (the latest start)
const slotRows = (r.list?.sections || []).flatMap(x => x.rows).filter(x => x.id?.startsWith("bk:"));
const slot = slotRows.sort((a, b) => b.title.localeCompare(a.title))[0];
out.bookingRow = slot || null;
if (slot) { r = await say("dana", { actionId: slot.id }, slot.title); out.bookingCard = r; }
// 3. Partner finding: מיכל and רון are already looking; דנה registers and is offered both right away
await register("michal", "level:3", "pc:1:no", "מחר אחרי 19:00");
await register("ron", "level:3", "pc:1:no", "מחר אחרי 20:00");
inbox[U.michal[0]] = []; inbox[U.ron[0]] = [];
S(3, "מציאת שותפים - התאמה מיידית", "dana");
await say("dana", { actionId: "menu" }, "תפריט");
await say("dana", { actionId: "players" }, "מציאת שחקנים");
await say("dana", { actionId: "oneoff" }, "חסרים לי שחקנים");
await say("dana", { actionId: "level:3" }, "3-3.5 · בינוניים+");
await say("dana", { actionId: "pc:3:yes" }, "שלושה · יש מגרש");
r = await untilSaved("dana", await say("dana", { text: "מחר ב-20:00" }));
const matches = rowsOf(r).filter(x => x.id.startsWith("connect:"));
out.matches = matches.map(m => m.title);
S(4, "שליחת בקשה לשתי ההתאמות", "dana");
for (const m of matches) r = await say("dana", { actionId: m.id }, m.title);
S(5, "מיכל מאשרת - הראשונה שמאשרת מתחברת", "michal");
const got = fromInbox("michal", x => /רוצה להתחבר לבקשה שלכם/.test(x.text || "")); const acc = got.flatMap(x => x.buttons || []).find(b => b.id.startsWith("accept:"));
if (acc) await say("michal", { actionId: acc.id }, acc.title);
S(6, "דנה מקבלת את החיבור", "dana"); fromInbox("dana");
S(7, "ולרון - עדכון מנומס", "ron"); fromInbox("ron", x => /כבר לא רלוונטית/.test(x.text || ""));
S(8, "לוח המשחקים הפומבי - בלי מספרי טלפון", "ron");
await say("ron", { actionId: "board" }, "להצטרף למשחק חד-פעמי");
await say("ron", { actionId: "bwhen:2" }, "מחר בערב");
// Weekly game: several days = one request per day
S(9, "משחק קבוע - כל יום נשמר כבקשה נפרדת", "dana");
await say("dana", { actionId: "menu" }, "תפריט");
await say("dana", { actionId: "players" }, "מציאת שחקנים");
await say("dana", { actionId: "recurring" }, "משחק קבוע כל שבוע");
await say("dana", { actionId: "party:1" }, "רק אני");
await say("dana", { text: "שישי ושבת ב6 וחצי בבוקר" });
await say("dana", { actionId: "my_requests" }, "הבקשות שלי");
fs.mkdirSync("/tmp/demo", { recursive: true });
fs.writeFileSync("/tmp/demo/events.json", JSON.stringify(out, null, 1));
fs.writeFileSync("/tmp/demo/store.json", JSON.stringify(await store.list(""), null, 1));
console.log(JSON.stringify({ scenes: out.scenes.map(s => [s.id, s.phone, s.chat.length]), slot: out.bookingRow, matches: out.matches }));
