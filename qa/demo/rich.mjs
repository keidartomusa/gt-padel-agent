// RICH=1 demo filler: fictitious users (9725000000xx), requests, games, booking clicks and chats so the mockups look like a busy club.
// All names, numbers and texts here are invented demo data, not bot copy.
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)];
const NAMES = ["אורי","נועה","יואב","שירה","איתי","מאיה","עומר","טל","גיא","ליאור","אביב","הילה","עידו","רותם","אלון","יעל","דור","ענבל","ניר","קרן","אסף","מור","תומר","שני","אייל","לירון","בן","אדי","ערן","סתיו","רועי","דפנה","אלעד","גלית","עמית","ליה"];
const LEVELS = ["2–2.5","2.5–3","3–3.5","3.5–4","4–4.5"], PRICE = { 60: 200, 90: 300, 120: 400 };
const CHATS = [["יש מגרש פנוי מחר בערב?","מצאתי 4 מגרשים פנויים מחר בין 18:00 ל-22:00"],["מחפש משחק רביעי בשבע","פרסמתי את הבקשה. אעדכן כשיימצא משחק מתאים"],["כן, מצטרף","מעולה! המשחק מלא 🎾"],["מה יש בשישי בבוקר?","יש 6 שעות פנויות בשישי בבוקר"],["תודה","בכיף! נתראה על המגרש"],["לוח המשחקים","יש כרגע 5 משחקים שמחפשים שחקנים"]];
export function enrich({ requests, connections, profiles, names, clicks, conv, at0 }) {
  const iso = ms => new Date(ms).toISOString(), day = d => iso(at0 + d * 864e5).slice(0, 10);
  const ids = NAMES.map((n, i) => { const id = "9725000000" + String(20 + i).padStart(2, "0"); names[id] = n; profiles[id] = { userId: id, name: n }; return id; });
  ids.forEach((id, i) => {
    const d = 1 + (i % 6), st = pick([1020, 1080, 1110, 1140, 1200, 420, 480]), ps = pick([1, 1, 2, 3]);
    const r = { id: "demo-r" + i, userId: id, displayName: names[id], level: pick(LEVELS), partySize: ps, hasCourt: rnd() < .4, date: day(d), startMinute: st, endMinute: st + 180, flexMinutes: 60, recurring: rnd() < .15, active: true, createdAt: iso(at0 - rnd() * 3 * 864e5) };
    if (r.recurring) r.weekdays = [new Date(r.date).getDay()];
    requests.push(r);
    if (i % 3 === 0 && i + 1 < ids.length) {
      const m = [ids[i + 1]]; if (i % 6 === 0 && i + 2 < ids.length) m.push(ids[i + 2]);
      connections.push({ id: "demo-c" + i, fromUserId: ids[i + 1], fromDisplayName: names[ids[i + 1]], toUserId: id, requestId: r.id, members: [id, ...m], status: "accepted", createdAt: iso(at0 - rnd() * 864e5), answeredBy: id, approvals: [id], joinParty: 1, groupSize: Math.min(4, ps + m.length) });
    }
  });
  for (let k = 0; k < 86; k++) {
    const u = pick(ids), dur = pick([90, 90, 90, 60, 120]), when = at0 - rnd() * 14 * 864e5;
    clicks.push({ id: "demo-k" + k, clickedAt: iso(when), source: rnd() < .75 ? "availability" : "matching", date: iso(when + (1 + Math.floor(rnd() * 3)) * 864e5).slice(0, 10), time: pick(["07:00","08:30","17:30","18:00","19:00","19:30","20:30","21:00"]), duration: dur, price: PRICE[dur], status: "clicked", userId: u, userName: names[u] });
  }
  clicks.sort((a, b) => b.clickedAt.localeCompare(a.clickedAt));
  ids.forEach((id, i) => { let t = at0 - (i * 37 + 5) * 60000; conv[id] = []; for (let j = 0; j < 1 + (i % 3); j++) { const [q, a] = pick(CHATS); conv[id].push({ direction: "in", kind: "user", body: q, sent: true, at: iso(t) }, { direction: "out", kind: "service", body: a, sent: true, at: iso(t + 3000) }); t += 90000; } });
}
