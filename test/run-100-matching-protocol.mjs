// 100 matching/registration conversations (50 same-store pairs) through the production path, live clock and live Matchpointer.
import fs from "node:fs";
import { memoryStore } from "../src/store.js";
import { provider, makeUser, turn, view } from "./harness.mjs";
const out = [], problems = [];
const levels = ["1–2", "2–2.5", "2.5–3", "3–3.5", "3.5–4", "4+"];
async function registration(store, n, { recurring, level, when, duration, party, court, flex, expectMatch, expectNote = null }) {
  const user = makeUser(`97250400${String(n).padStart(4, "0")}`, `שחקן ${n}`, store), turns = [];
  for (const s of [{ text: "שלום" }, { actionId: "players" }, { actionId: recurring ? "recurring" : "oneoff" }, { actionId: `level:${level}` }, { text: when }, { actionId: duration === "flex" ? "duration:flex" : `duration:${duration}` }, { actionId: `party:${party}` }, { actionId: `court:${court ? "yes" : "no"}` }, { actionId: `flex:${flex}` }]) turns.push(await turn(user, s));
  const last = turns.at(-1), text = last.response.text || "", found = /מצאתי \d+ התאמ/.test(text), saved = /הבקשה נשמרה/.test(text), notPublished = /לא פורסמה/.test(text);
  if (!saved && !notPublished) problems.push(`nonterminal ${n}: ${text.slice(0, 120)}`);
  if (saved && expectMatch !== found) problems.push(`match expectation ${n}: expected ${expectMatch}, got ${found}`);
  for (const t of turns) { if (t.reaction !== "👍" || t.typing !== true) problems.push(`transport ${n}`); if (!t.outbound.length) problems.push(`no outbound ${n}`); }
  if (found && expectNote !== null && /רמה אחת (מעליכם|מתחתיכם)/.test(text) !== expectNote) problems.push(`level note ${n}: expected ${expectNote}`);
  if (found && !/· רמה /.test(text)) problems.push(`match without level ${n}`);
  if (/\?\s*$/.test(text)) problems.push(`dangling ${n}`);
  out.push({ title: `${n}. ${recurring ? "מנוי קבוע" : "רישום חד-פעמי"} · ${level} · ${notPublished ? "לא פורסם (אין מגרש)" : found ? "יש התאמה" : "אין התאמה"}`, type: "matching-registration", identity: { userId: user.userId, displayName: user.displayName }, expectMatch, found, notifications: last.response.notifications?.length || 0, turns });
}
for (let pair = 0; pair < 50; pair++) {
  const store = memoryStore(), n = pair * 2 + 1, recurring = pair % 2 === 1, level = levels[pair % 6], when = recurring ? "ימי חמישי אחרי 19:00" : "מחר אחרי 19:00", duration = [60, 90, 120][pair % 3], party = [1, 2, 3][pair % 3], court = pair % 4 !== 0, flex = [0, 60, "any"][pair % 3];
  await registration(store, n, { recurring, level, when, duration, party, court, flex, expectMatch: false });
  const matching = pair % 3 !== 0;
  // matching pairs: every other one uses the adjacent level band (Tom: one band above/below matches).
  // non-matching pairs alternate: two bands apart at the same time, or three bands apart at a different time.
  const i = pair % 6, adjacent = matching && pair % 2 === 1, twoApart = !matching && pair % 2 === 0;
  const partnerLevel = matching ? (adjacent ? levels[i === 5 ? 4 : i + 1] : level) : twoApart ? levels[(i + 2) % 6 === i ? 0 : (i + 2 > 5 ? i - 2 : i + 2)] : levels[(pair + 3) % 6];
  const partnerWhen = matching || twoApart ? when : (recurring ? "ימי ראשון אחרי 08:00" : "מחר אחרי 08:00");
  await registration(store, n + 1, { recurring, level: partnerLevel, when: partnerWhen, duration, party, court, flex, expectMatch: matching, expectNote: matching ? adjacent : null });
}
if (out.length !== 100) problems.push(`expected 100 got ${out.length}`);
fs.writeFileSync("/tmp/gt-live-provider-snapshot-matching.json", JSON.stringify({ capturedAt: provider.startedAt, finishedAt: new Date().toISOString(), requests: provider.requests }));
fs.writeFileSync("/tmp/gt-100-matching-transcripts.json", JSON.stringify(out.map(x => ({ ...x, turns: x.turns.map(t => ({ user: t.input, reaction: t.reaction, typing: t.typing, bot: view(t) })) })), null, 2));
console.log(JSON.stringify({ count: out.length, problems: problems.length, sample: problems.slice(0, 12), distinctIdentities: new Set(out.map(x => x.identity.userId)).size, matches: out.filter(x => x.found).length, noMatch: out.filter(x => !x.found && !/לא פורסם/.test(x.title)).length, notPublished: out.filter(x => /לא פורסם/.test(x.title)).length, providerRequests: provider.requests.length, capturedAt: provider.startedAt }, null, 2));
if (problems.length) process.exit(1);
