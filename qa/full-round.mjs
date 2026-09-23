// Full QA round (Tom 23.9 13:42): every flow and every message, multi-user matching and coordination.
// Production path via test/harness.mjs (routeIncoming + real sendResponse payloads captured, live Matchpointer).
import fs from "node:fs";
import { turn, makeUser, options, provider } from "../test/harness.mjs";
import { memoryStore } from "../src/store.js";
const now = new Date();
const payloadView = p => {
  if (p.type === "text") return { text: p.text.body };
  if (p.type === "template") return { text: `[תבנית ${p.template.name}]`, template: true, params: JSON.stringify(p.template.components || []) };
  const i = p.interactive; if (!i) return { text: JSON.stringify(p) };
  const v = { text: i.body?.text || "" };
  if (i.type === "button") v.buttons = i.action.buttons.map(b => ({ id: b.reply.id, title: b.reply.title }));
  if (i.type === "list") { v.listButton = i.action.button; v.rows = i.action.sections.flatMap(s => s.rows.map(r => ({ id: r.id, title: r.title, description: r.description || "" }))); }
  if (i.type === "cta_url") v.cta = { label: i.action.parameters.display_text, url: i.action.parameters.url };
  return v;
};
const problems = [];
function check(conv, who, v) {
  const where = `${conv}: ${who}: ${(v.text || "").slice(0, 50)}`;
  if (/undefined|NaN|\[object|null\b/.test(JSON.stringify(v))) problems.push(`bad token: ${where}`);
  if (/לא הייתי בטוח/.test(v.text)) problems.push(`rejected copy: ${where}`);
  if ((v.text || "").length > 1024 && (v.buttons || v.rows || v.cta)) problems.push(`body > 1024: ${where}`);
  for (const b of v.buttons || []) { if (b.title.length > 20) problems.push(`button title > 20: ${b.title}`); if (b.id.length > 256 || !/^[\x20-\x7e]+$/.test(b.id)) problems.push(`button id: ${b.id}`); }
  for (const r of v.rows || []) { if (r.title.length > 24) problems.push(`row title > 24: ${r.title}`); if (r.description.length > 72) problems.push(`row desc > 72: ${r.description}`); if (r.id.length > 200 || !/^[\x20-\x7e]+$/.test(r.id)) problems.push(`row id: ${r.id.slice(0, 60)}`); }
  if ((v.rows || []).length > 10) problems.push(`> 10 rows: ${where}`);
  if (/הבקשה נשמרה/.test(v.text) && (v.buttons || []).some(b => /^mute/.test(b.id))) problems.push(`mute on saved: ${where}`);
}
async function scenario(title, group, actors, steps, expect = {}) {
  const store = memoryStore(), users = {}, last = {}, log = [];
  for (const [k, [id, name]] of Object.entries(actors)) users[k] = makeUser(id, name, store);
  const byPhone = Object.fromEntries(Object.entries(users).map(([k, u]) => [u.userId, k]));
  for (const step of steps) {
    const [k, s] = step, u = users[k];
    if (s.ifAsked && !s.ifAsked.test(last[k]?.text || "")) continue;
    let st = s.text === "@name" ? { text: u.displayName } : s;
    if (s.tap) { const opts = [...(last[k]?.buttons || []), ...(last[k]?.rows || [])]; const o = opts.find(x => s.tap.test(x.title)); if (!o) { problems.push(`${title}: ${k} can't tap ${s.tap} (options: ${opts.map(x => x.title).join(" | ")})`); break; } st = { actionId: o.id, title: o.title }; }
    const t = await turn(u, st, { now });
    const entry = { who: k, name: u.displayName, input: st.actionId ? { tap: st.title || st.actionId } : { text: st.text }, out: [] };
    for (const p of t.outbound) { const v = payloadView(p); const to = byPhone[p.to] || p.to; check(title, to, v); entry.out.push({ to, toName: users[to]?.displayName || p.to, ...v }); last[to] = v; }
    if (!t.outbound.length) problems.push(`${title}: no reply to ${k} for ${JSON.stringify(entry.input)}`);
    if (expect.noUnclear !== false && entry.out[0] && /^לא הבנתי\. אפשר לבחור/.test(entry.out[0].text) && !s.expectFallback) problems.push(`${title}: fallback for ${JSON.stringify(entry.input)}`);
    log.push(entry);
  }
  const requests = (await store.list("request/")).map(x => x.value), connections = (await store.list("connection/")).map(x => x.value);
  return { title, group, actors: Object.fromEntries(Object.entries(users).map(([k, u]) => [k, { phone: u.userId, name: u.displayName }])), log, requests: requests.length, activeRequests: requests.filter(r => r.active).length, connections: connections.map(c => c.status) };
}
const S = [];
const A = (id, n) => [id, n];
// ---------- 1. entry & identity ----------
S.push(await scenario("1. פתיחה: ברכה, תפריט, טקסט לא מובן, שאלה", "כניסה", { a: A("972501110001", "דנה") }, [
  ["a", { text: "היי" }], ["a", { text: "בא לי משהו", expectFallback: true }], ["a", { text: "כמה עולה מנוי?" }], ["a", { text: "תפריט" }], ["a", { text: "מחר אחרי העבודה", expectFallback: true }]]));
S.push(await scenario("2. שם: שאלה חד-פעמית ושינוי שם עם אישור", "כניסה", { a: A("972501110002", "Tom K") }, [
  ["a", { text: "שלום" }], ["a", { tap: /מציאת שחקנים/ }], ["a", { tap: /חסרים לי שחקנים/ }], ["a", { tap: /^3/ }], ["a", { text: "מחר אחרי 19:00" }], ["a", { tap: /90/ }], ["a", { tap: /רק אני/ }], ["a", { tap: /^כן$/ }], ["a", { text: "תום" }],
  ["a", { text: "קוראים לי אבי" }], ["a", { tap: /כן, לשנות/ }], ["a", { text: "אני רוצה לשנות את השם" }], ["a", { text: "יוסי" }], ["a", { tap: /^לא$/ }]]));
// ---------- 2. availability ----------
S.push(await scenario("3. מגרש פנוי: בחירה מהרשימה ← שעה ← קישור", "מגרש פנוי", { a: A("972501110003", "רון") }, [
  ["a", { text: "שלום" }], ["a", { tap: /מגרש פנוי/ }], ["a", { tap: /מחר בערב/ }], ["a", { tap: /:/ }]]));
S.push(await scenario("4. מגרש פנוי: הקלדה חופשית, שעה דו-משמעית, שבוע הבא, לא ברור", "מגרש פנוי", { a: A("972501110004", "מיכל") }, [
  ["a", { text: "שלום" }], ["a", { tap: /מגרש פנוי/ }], ["a", { text: "מחר ב-9" }], ["a", { tap: /בערב/ }],
  ["a", { text: "תפריט" }], ["a", { tap: /מגרש פנוי/ }], ["a", { text: "בשבוע הבא אחרי 18:00" }], ["a", { tap: /שני/ }],
  ["a", { text: "תפריט" }], ["a", { tap: /מגרש פנוי/ }], ["a", { text: "מחר אחרי העבודה" }],
  ["a", { text: "יש מגרש שישי בצהריים לשעתיים?" }], ["a", { text: "ביום חמישי הבא בשעה שש" }]]));
// ---------- 3. players: one-off / recurring ----------
S.push(await scenario("5. חסרים לי שחקנים: בלי מגרש (שאלת גמישות) ועם מגרש (בלי גמישות)", "מציאת שחקנים", { a: A("972501110005", "איתי"), b: A("972501110006", "שירה") }, [
  ["a", { text: "שלום" }], ["a", { tap: /מציאת שחקנים/ }], ["a", { tap: /חסרים לי שחקנים/ }], ["a", { tap: /^3–3\.5|^3/ }], ["a", { text: "מחר אחרי 19:00" }], ["a", { tap: /90/ }], ["a", { tap: /אני ועוד אחד/ }], ["a", { tap: /^לא$/ }], ["a", { tap: /^שעה$/ }],
  ["b", { text: "שלום" }], ["b", { tap: /מציאת שחקנים/ }], ["b", { tap: /חסרים לי שחקנים/ }], ["b", { tap: /^1|^2/ }], ["b", { text: "שבת בבוקר" }], ["b", { tap: /60/ }], ["b", { tap: /שלושה/ }], ["b", { tap: /^כן$/ }]]));
S.push(await scenario("6. משחק קבוע כל שבוע", "מציאת שחקנים", { a: A("972501110007", "עומר") }, [
  ["a", { text: "שלום" }], ["a", { tap: /מציאת שחקנים/ }], ["a", { tap: /משחק קבוע/ }], ["a", { tap: /^3/ }], ["a", { text: "מחר בערב" }], ["a", { text: "שני ורביעי אחרי 20:00" }], ["a", { tap: /גמיש|90/ }], ["a", { tap: /רק אני/ }], ["a", { tap: /^כן$/ }]]));
// ---------- 4. multi-user matching & coordination ----------
let NAMES = {};
const reg = (k, lvl, when, party, court = /^כן$/) => [[k, { text: "שלום" }], [k, { tap: /מציאת שחקנים/ }], [k, { tap: /חסרים לי שחקנים/ }], [k, { tap: lvl }], [k, { text: when }], [k, { tap: /90/ }], [k, { tap: party }], [k, { tap: court }], [k, { text: "@name", ifAsked: /מה השם/ }]];
S.push(await scenario("7. התאמה לשלושה אנשים: הודעות תיאום לכל אחד, חיבור, אישור כפול", "התאמות ותיאום", { a: A("972501110011", "יוסי"), b: A("972501110012", "דנה"), c: A("972501110013", "אבי"), d: A("972501110014", "נועה") }, [
  ...reg("a", /^3–3\.5/, "מחר אחרי 19:00", /רק אני/), ...reg("b", /^3–3\.5/, "מחר אחרי 19:00", /רק אני/), ...reg("c", /^3\.5–4/, "מחר אחרי 19:00", /רק אני/),
  ...reg("d", /^3–3\.5/, "מחר אחרי 19:00", /אני ועוד אחד/),
  ["a", { tap: /רוצה להתחבר/ }], ["d", { tap: /כן, לחבר/ }],
  ["b", { tap: /רוצה להתחבר/ }], ["d", { tap: /לא מתאים/ }],
  ["c", { tap: /רוצה להתחבר/ }], ["d", { tap: /כן, לחבר/ }]]));
S.push(await scenario("8. לוח משחקים: הצטרפות לבקשה פתוחה ← אישור ← החלפת מספרים", "התאמות ותיאום", { a: A("972501110021", "טל"), b: A("972501110022", "גיל") }, [
  ...reg("a", /^2\.5–3/, "מחר אחרי 19:00", /רק אני/),
  ["b", { text: "שלום" }], ["b", { tap: /מציאת שחקנים/ }], ["b", { tap: /להצטרף למשחק/ }], ["b", { tap: /מחר בערב/ }], ["b", { tap: /טל/ }], ["b", { text: "@name", ifAsked: /מה השם/ }], ["a", { tap: /כן, לחבר/ }]]));
S.push(await scenario("9. לוח ריק: פתיחת בקשה אוטומטית (פעם ראשונה, ואז עם רמה ומשך מהבקשה הקודמת), וביטול", "התאמות ותיאום", { a: A("972501110031", "ליאור"), b: A("972501110032", "מאיה") }, [
  ["a", { text: "שלום" }], ["a", { tap: /מציאת שחקנים/ }], ["a", { tap: /להצטרף למשחק/ }], ["a", { text: "מחר אחרי 18:00" }], ["a", { tap: /^3/ }], ["a", { tap: /90/ }], ["a", { tap: /רק אני/ }], ["a", { tap: /^כן$/ }], ["a", { text: "@name", ifAsked: /מה השם/ }],
  ["a", { tap: /לתפריט/ }], ["a", { tap: /מציאת שחקנים/ }], ["a", { tap: /להצטרף למשחק/ }], ["a", { text: "שבת בבוקר" }], ["a", { tap: /אני ועוד אחד/ }], ["a", { tap: /^כן$/ }],
  ["b", { text: "שלום" }], ["b", { tap: /מציאת שחקנים/ }], ["b", { tap: /להצטרף למשחק/ }], ["b", { text: "שישי בבוקר" }], ["b", { tap: /ביטול/ }]]));
// ---------- 5. request management ----------
S.push(await scenario("10. הבקשות שלי: רשימה, עריכת כל שדה, מחיקה", "ניהול בקשות", { a: A("972501110041", "אלון") }, [
  ...reg("a", /^3/, "ראשון בערב", /רק אני/, /^לא$/), ["a", { tap: /^שעה$/ }], ["a", { text: "@name", ifAsked: /מה השם/ }],
  ["a", { tap: /בקשה נוספת/ }], ["a", { tap: /חסרים לי שחקנים/ }], ["a", { tap: /^3/ }], ["a", { text: "שישי בבוקר" }], ["a", { tap: /60/ }], ["a", { tap: /רק אני/ }], ["a", { tap: /^כן$/ }],
  ["a", { tap: /הבקשות שלי/ }], ["a", { tap: /חמישי|שישי/ }], ["a", { tap: /עריכה/ }], ["a", { tap: /רמה/ }], ["a", { tap: /^4/ }],
  ["a", { tap: /הבקשות שלי/ }], ["a", { tap: /חמישי|שישי/ }], ["a", { tap: /עריכה/ }], ["a", { tap: /יום ושעה/ }], ["a", { text: "שבת ב-9" }], ["a", { tap: /בבוקר/ }],
  ["a", { tap: /הבקשות שלי/ }], ["a", { tap: /שבת|חמישי|שישי/ }], ["a", { tap: /עריכה/ }], ["a", { tap: /משך/ }], ["a", { tap: /120/ }],
  ["a", { tap: /הבקשות שלי/ }], ["a", { tap: /שבת|חמישי|שישי/ }], ["a", { tap: /עריכה/ }], ["a", { tap: /מספר שחקנים/ }], ["a", { tap: /שלושה/ }],
  ["a", { tap: /הבקשות שלי/ }], ["a", { tap: /שבת|חמישי|שישי/ }], ["a", { tap: /עריכה/ }], ["a", { tap: /מגרש/ }], ["a", { tap: /^כן$/ }],
  ["a", { tap: /הבקשות שלי/ }], ["a", { tap: /שבת|חמישי|שישי/ }], ["a", { tap: /מחיקה/ }], ["a", { tap: /^לא$/ }], ["a", { tap: /שבת|חמישי|שישי/ }], ["a", { tap: /מחיקה/ }], ["a", { tap: /כן, למחוק/ }],
  ["a", { text: "תפריט" }], ["a", { tap: /הבקשות שלי/ }]]));
S.push(await scenario("11. מגבלת 5 בקשות", "ניהול בקשות", { a: A("972501110051", "רותם") }, [
  ...reg("a", /^3/, "מחר אחרי 19:00", /רק אני/), ...["שישי בבוקר", "שבת בבוקר", "ראשון בערב", "שני בערב"].flatMap(w => [["a", { tap: /בקשה נוספת/ }], ["a", { tap: /חסרים לי שחקנים/ }], ["a", { tap: /^3/ }], ["a", { text: w }], ["a", { tap: /90/ }], ["a", { tap: /רק אני/ }], ["a", { tap: /^כן$/ }], ["a", { text: "@name", ifAsked: /מה השם/ }]]),
  ["a", { tap: /הבקשות שלי/ }], ["a", { text: "תפריט" }], ["a", { tap: /מציאת שחקנים/ }], ["a", { tap: /חסרים לי שחקנים/ }]]));
S.push(await scenario("13. בלי מגרש, ואין מגרש פנוי בחלון: הבקשה לא מתפרסמת, ניסיון זמן אחר", "מציאת שחקנים", { a: A("972501110071", "הילה") }, [
  ...reg("a", /^3/, "מחר בערב", /רק אני/, /^לא$/), ["a", { tap: /^שעה$/ }], ["a", { text: "@name", ifAsked: /מה השם/ }], ["a", { tap: /זמן אחר/, ifAsked: /לא פורסמה/ }], ["a", { text: "ראשון בערב", ifAsked: /מתי/ }], ["a", { tap: /^שעה$/, ifAsked: /גמישים/ }]]));
// ---------- 6. settings ----------
S.push(await scenario("12. השתקה מתוך התראה, השתקה למשך זמן, ביטול השתקה, ומשתמש מושתק לא מקבל התראות", "הגדרות", { a: A("972501110061", "עדי"), b: A("972501110062", "נדב"), c: A("972501110063", "שני") }, [
  ...reg("a", /^3/, "מחר אחרי 19:00", /רק אני/), ...reg("b", /^3/, "מחר אחרי 19:00", /רק אני/),
  ["a", { tap: /השתקה לשבוע/ }], ["b", { text: "הגדרות" }], ["b", { tap: /השתקה למשך זמן/ }], ["b", { tap: /^3 ימים/ }], ["b", { text: "הגדרות" }], ["b", { tap: /ביטול השתקה/ }], ["b", { text: "הגדרות" }], ["b", { tap: /הבקשות שלי/ }],
  ...reg("c", /^3/, "מחר אחרי 19:00", /רק אני/)]));
fs.writeFileSync("/tmp/full-round.json", JSON.stringify({ at: now.toISOString(), scenarios: S, problems, providerRequests: provider.requests.length }, null, 1));
console.log(JSON.stringify({ scenarios: S.length, turns: S.reduce((a, s) => a + s.log.length, 0), messages: S.reduce((a, s) => a + s.log.reduce((b, e) => b + e.out.length, 0), 0), problems }, null, 1));
