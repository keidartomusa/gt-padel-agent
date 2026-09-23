// 100 availability / menu / board conversations through the production path, live Matchpointer.
import fs from "node:fs";
import { memoryStore } from "../src/store.js";
import { provider, makeUser, turn, options, rng, pick, view } from "./harness.mjs";
const out = [], rand = rng(20260923);
const TERMINAL = [
  ["cta", t => t.response.ctaUrl?.url?.includes("/go/book?")],
  ["request_saved", t => /הבקשה נשמרה/.test(t.response.text || "")],
  ["not_published", t => /לא פורסמה/.test(t.response.text || "")],
  ["connected", t => /חיברתי ביניכם/.test(t.response.text || "")],
  ["declined", t => /סימנתי שלא מתאים/.test(t.response.text || "")],
  ["connect_sent", t => /שלחתי בקשת חיבור/.test(t.response.text || "")],
  ["muted", t => /הושתקו/.test(t.response.text || "")],
  ["my_requests", t => /אין לך כרגע בקשות|\*הבקשות שלי\*/.test(t.response.text || "")],
  ["board_empty", t => /לא מצאתי כרגע בקשות פתוחות/.test(t.response.text || "")],
  ["day_full", t => /אין מגרש פנוי .* וגם לא בשאר היום/.test(t.response.text || "")]
];
const terminalOf = t => TERMINAL.find(([, f]) => f(t))?.[0] || null;
async function convo(title, type, user, steps) { const turns = []; for (const s of steps) { const s2 = typeof s === "function" ? s(turns.at(-1)) : s; if (!s2) break; turns.push(await turn(user, s2)); } out.push({ title, type, identity: { userId: user.userId, displayName: user.displayName }, turns }); return turns; }
const pickSlot = last => { const rows = options(last.response).filter(o => o.id.startsWith("book:")); if (!rows.length) return null; const r = pick(rand, rows); return { actionId: r.id, title: r.title }; };
const Q = ["יש מגרש היום בערב ל90 דקות?","מה פנוי מחר בערב לשעה?","תבדוק שישי בצהריים לשעתיים","שבת בבוקר, מגרש לשעה וחצי","יש משהו ביום ראשון אחרי 19:00?","מה פנוי ביום שני לפני 18:00 ל90 דק","שלישי בלילה לשעה וחצי","רביעי הבא בערב ל90 דקות","מגרש ב25/9 בשעה 17:00 ל90 דקות","מתי יש מגרש ב30 לחודש בערב?","יש מגרש מחר אחהצ לשעה וחצי","מתי יש מגרשים פנויים אחרי 20:30 בערב ל90 דק","מגרש מחר לפני 08:00 ל60 דק","אפשר מחר ב16:00 לשעתיים?","יש מגרש מחר בערב?","מגרש היום בצהריים ל60 דקות","חמישי בבוקר לשעתיים","שישי בערב ל90 דקות","שבת בצהריים לשעה וחצי","ראשון בבוקר לשעה","שני בערב לשעתיים","שלישי אחר הצהריים לשעה וחצי","רביעי בבוקר ל60 דקות","25/9 בצהריים ל120 דקות","26/9 בשעה 12:00 ל90 דקות","27/9 אחרי 21:00 ל90 דקות","28/9 לפני 09:00 לשעה","29/9 ב16:00 לשעתיים","30/9 אחרי 17:00 לשעה וחצי","מחר ב17:30 ל90 דק","מחר אחרי 18:30 לשעה","מחר לפני 19:00 לשעתיים","שישי ב12:30 ל60 דקות","שבת אחרי 12 ל120 דקות","ראשון ב21:00 ל90 דקות","שני ב06:00 לשעה","שלישי ב16:30 לשעה וחצי","רביעי ב17:00 לשעתיים","יש זמינות מחר בערב?","איזה מגרשים פנויים בשישי בצהריים?","מה פנוי בשבת בצהריים ל90 דקות?","איפה מזמינים מגרש בראשון בערב?","יש מגרשים ביום שני בבוקר?","מגרש ביום שלישי אחהצ ל60 דקות","מגרש היום לפני 06:00 לשעה"];
// 1-45: availability question -> slot list -> random row -> CTA (or a clear full-day statement)
for (let i = 0; i < Q.length; i++) await convo(`${i + 1}. זמינות: ${Q[i]}`, "availability", makeUser(`97250100${String(i + 1).padStart(4, "0")}`, "דנה"), [{ text: Q[i] }, pickSlot]);
// 46-70: main-menu journeys with random picks, odd inputs and mid-flow menu returns, each driven to completion
const odd = ["בננה", "?", "👍", "מה?", "אממ", "תפריט", "סתם", "123"];
const regText = ["מחר אחרי 19:00", "שישי בבוקר", "ימי שני ורביעי אחרי 20:00", "מחר ב18:00"];
async function menuJourney(n) {
  const user = makeUser(`97250200${String(n).padStart(4, "0")}`, `שחקן ${n}`), turns = [];
  const push = async s => { const t = await turn(user, s); turns.push(t); return t; };
  let t = await push({ text: pick(rand, ["שלום", "היי", "hi", "מה קורה", "בוקר טוב"]) });
  const wander = Math.floor(rand() * 4);
  for (let k = 0; k < wander; k++) { const opts = options(t.response).filter(o => !o.id.startsWith("book:")); t = rand() < 0.35 || !opts.length ? await push({ text: pick(rand, odd) }) : await push({ actionId: (o => o.id)(pick(rand, opts)), title: "" }); }
  t = await push({ text: "תפריט" });
  const goal = pick(rand, ["availability", "players"]);
  const first = options(t.response).find(o => o.id === goal); t = await push({ actionId: first.id, title: first.title });
  for (let guard = 0; guard < 14 && !terminalOf(t); guard++) {
    const opts = options(t.response).filter(o => o.id !== "menu");
    if (goal === "availability") { const slot = opts.filter(o => o.id.startsWith("book:")); t = slot.length ? await push((r => ({ actionId: r.id, title: r.title }))(pick(rand, slot))) : await push({ text: pick(rand, ["מחר בערב ל90 דקות", "שישי בצהריים לשעה", "שבת בבוקר לשעתיים", "ראשון אחרי 19:00 ל90 דק"]) }); continue; }
    if (opts.length) { const o = pick(rand, opts); t = await push({ actionId: o.id, title: o.title }); } else t = await push({ text: pick(rand, regText) });
  }
  out.push({ title: `${n}. תפריט ראשי אקראי → ${goal === "availability" ? "מגרש פנוי" : "מציאת שחקנים"} (${wander} צעדי שיטוט)`, type: "menu", identity: { userId: user.userId, displayName: user.displayName }, turns });
}
for (let n = 46; n <= 70; n++) await menuJourney(n);
// 71-90: registrations through the players menu
const levels = ["1–2", "2–2.5", "2.5–3", "3–3.5", "3.5–4", "4+"];
for (let j = 0; j < 20; j++) { const n = 71 + j, recurring = j % 4 === 3, u = makeUser(`97250300${String(n).padStart(4, "0")}`, `שחקן ${n}`); await convo(`${n}. רישום ${recurring ? "זמינות קבועה" : "משחק נקודתי"} ${levels[j % 6]}`, "matching", u, [{ actionId: "players" }, { actionId: recurring ? "recurring" : "oneoff" }, { actionId: `level:${levels[j % 6]}` }, { text: recurring ? "ימי שני ורביעי אחרי 20:00" : `מחר אחרי ${17 + (j % 5)}:00` }, { actionId: j % 7 === 0 ? "duration:flex" : `duration:${[60, 90, 120][j % 3]}` }, { actionId: `party:${[1, 2, 3][(j + 1) % 3]}` }, { actionId: `court:${j % 5 === 0 ? "no" : "yes"}` }, { actionId: `flex:${[0, 30, 60][(j + 2) % 3]}` }]); }
// 91-100: public board, brokered connection, settings
const reg = (u, lvl = "3–3.5", when = "מחר אחרי 19:00") => [{ actionId: "players" }, { actionId: "oneoff" }, { actionId: `level:${lvl}` }, { text: when }, { actionId: "duration:90" }, { actionId: "party:1" }, { actionId: "court:yes" }, { actionId: "flex:30" }];
const board = memoryStore(); const owner = makeUser("972503000901", "דנה", board), viewer = makeUser("972503000902", "נועם", board);
for (const s of reg(owner)) await turn(owner, s);
const req = (await board.list("request/"))[0].value;
await convo("91. לוח ציבורי ובקשת חיבור", "board", viewer, [{ text: "מי מחפש משחק מחר בערב?" }, { actionId: `connect:${req.id}` }]);
const conn = (await board.list("connection/"))[0].value;
await convo("92. אישור חיבור מתווך", "board", owner, [{ actionId: `accept:${conn.id}` }]);
const b2 = memoryStore(), o2 = makeUser("972503000903", "רוני", b2), v2 = makeUser("972503000904", "גל", b2);
for (const s of reg(o2)) await turn(o2, s); const r2 = (await b2.list("request/"))[0].value; await turn(v2, { actionId: `connect:${r2.id}` }); const c2 = (await b2.list("connection/"))[0].value;
await convo("93. דחיית חיבור בלי חשיפת טלפון", "board", o2, [{ actionId: `decline:${c2.id}` }]);
await convo("94. השתקה לשבוע", "settings", makeUser("972503000905", "עדי"), [{ actionId: "mute_week" }]);
await convo("95. השתקה מותאמת", "settings", makeUser("972503000906", "עדי"), [{ actionId: "mute_custom" }, { actionId: "mute_14" }]);
await convo("96. אין בקשות פעילות", "settings", makeUser("972503000907", "עדי"), [{ actionId: "my_requests" }]);
const mine = memoryStore(), me = makeUser("972503000908", "תמר", mine); for (const s of reg(me)) await turn(me, s);
await convo("97. הצגת הבקשות שלי", "settings", me, [{ actionId: "my_requests" }]);
await convo("98. לוח ריק בחלון זמן", "board", makeUser("972503000909", "יואב"), [{ text: "מי מחפש משחק מחר בערב?" }]);
await convo("99. תפריט באמצע רישום ואז בדיקת מגרש מלאה", "menu", makeUser("972503000910", "ליאור"), [{ actionId: "players" }, { actionId: "oneoff" }, { actionId: "level:3–3.5" }, { text: "מחר אחרי 19:00" }, { text: "תפריט" }, { text: "מגרש בשבת בצהריים ל90 דקות" }, pickSlot]);
await convo("100. תפריט בשלב גמישות ואז רישום חדש עד הסוף", "menu", makeUser("972503000911", "מאיה"), [...reg({}, "2.5–3", "מחר ב18:00").slice(0, 7), { text: "תפריט" }, ...reg({}, "2.5–3", "מחר ב18:00")]);
// validation
const problems = [];
if (out.length !== 100) problems.push(`expected 100 got ${out.length}`);
for (const x of out) {
  const last = x.turns.at(-1), term = last && terminalOf(last);
  if (!term) problems.push(`nonterminal: ${x.title}: ${(last?.response.text || "").slice(0, 120)}`);
  x.terminal = term;
  for (const t of x.turns) {
    if (t.reaction !== "👍" || t.typing !== true) problems.push(`transport: ${x.title}`);
    const rows = t.response.list?.sections.flatMap(s => s.rows) || [];
    if (rows.length > 10) problems.push(`>10 rows: ${x.title}`);
    for (const r of rows) if (r.title.length > 24 || (r.id.startsWith("book:") && !/^(\d{1,2}\.\d{1,2} )?\d\d:\d\d–\d\d:\d\d$/.test(r.title))) problems.push(`row title: ${x.title}: ${r.title}`);
    if (/https?:\/\//.test(t.response.text || "")) problems.push(`raw link in text: ${x.title}`);
    if (!t.outbound.length) problems.push(`no outbound payload: ${x.title}`);
  }
  if (/\?\s*$/.test(last?.response.text || "") && term !== "cta") problems.push(`dangling question: ${x.title}`);
}
const snapshot = { capturedAt: provider.startedAt, finishedAt: new Date().toISOString(), source: "https://api.matchpointer.app/rest/v1 (live, recorded during this run)", requests: provider.requests };
fs.writeFileSync("/tmp/gt-live-provider-snapshot.json", JSON.stringify(snapshot));
fs.writeFileSync("/tmp/gt-100-transcripts.json", JSON.stringify(out.map(x => ({ ...x, turns: x.turns.map(t => ({ user: t.input, reaction: t.reaction, typing: t.typing, bot: view(t) })) })), null, 2));
const counts = {}; for (const x of out) counts[x.terminal] = (counts[x.terminal] || 0) + 1;
console.log(JSON.stringify({ count: out.length, problems: problems.length, sample: problems.slice(0, 15), terminals: counts, providerRequests: provider.requests.length, capturedAt: snapshot.capturedAt }, null, 2));
if (problems.length) process.exit(1);
