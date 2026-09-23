// Dashboard "חיבורים" tab (Tom 23.9 16:03): every live connection, grouped per game, soonest first.
// Live = accepted, the request was not deleted, and the game is still ahead: a one-off whose date is today or later,
// or a recurring request (shown with its next weekday). Pending and declined connections are not live.
import { localDateParts, addDays, weekdayIndex } from "./time.js";
import { timeLabel, dayLabel } from "./requests.js";
const partyOf = x => Number(x?.partySize) || 1;
export function nextDate(r, today) {
  if (!r.recurring) return r.date || null;
  for (let i = 0; i < 7; i++) { const d = addDays(today, i); if ((r.weekdays || []).includes(weekdayIndex(d))) return d; }
  return null;
}
export function liveConnections({ requests = [], connections = [], profiles = {}, now = new Date() }) {
  const today = localDateParts(now).iso, byId = Object.fromEntries(requests.map(r => [r.id, r])), games = {};
  for (const c of connections) {
    if (c?.status !== "accepted") continue;
    const r = byId[c.requestId]; if (!r || r.deletedAt) continue;
    const next = nextDate(r, today); if (!next || next < today) continue;
        const g = games[r.id] ||= { requestId: r.id, type: r.recurring ? "recurring" : "oneoff", when: `${r.recurring ? "כל " : ""}${dayLabel(r)} · ${timeLabel(r)}`, nextDate: next, nextLabel: dayLabel({ date: next }), startMinute: r.startMinute ?? 0,
      level: r.level || "", durations: r.durations || [], hasCourt: Boolean(r.hasCourt), court: r.courtSlot ? { name: r.courtSlot.courtName || r.courtSlot.courtId || "", start: r.courtSlot.start || "", price: r.courtSlot.price ?? null } : null,
      participants: [{ userId: r.userId, name: profiles[r.userId]?.name || r.displayName || null, party: 0, role: "owner" }], total: 0, full: r.closedReason === "full", firstConnectedAt: c.createdAt, ownerParty: null };
    g.participants.push({ userId: c.fromUserId, name: profiles[c.fromUserId]?.name || c.fromDisplayName || null, party: Number(c.joinParty) || 1, role: "joined", connectedAt: c.createdAt });
    if (c.createdAt < g.firstConnectedAt) g.firstConnectedAt = c.createdAt;
  }
  for (const g of Object.values(games)) {
    const r = byId[g.requestId], joined = g.participants.slice(1).reduce((a, p) => a + p.party, 0), sizes = connections.filter(c => c?.status === "accepted" && c.requestId === g.requestId).map(c => Number(c.groupSize) || 0);
    g.total = Math.max(...sizes, r.closedReason === "full" ? 4 : partyOf(r), joined + 1); g.participants[0].party = Math.max(1, g.total - joined); g.full = g.full || g.total >= 4;
  }
  return Object.values(games).sort((a, b) => a.nextDate.localeCompare(b.nextDate) || a.startMinute - b.startMinute);
}

// Tom 23.9 17:12: the tab also shows open requests (still looking for a match) - active, game still ahead,
// and no accepted connection yet. Same card shape, type "open".
export function openRequests({ requests = [], connections = [], profiles = {}, now = new Date(), isOver = () => false }) {
  const today = localDateParts(now).iso, connected = new Set(connections.filter(c => c?.status === "accepted").map(c => c.requestId)), out = [];
  for (const r of requests) {
    if (!r?.active || r.deletedAt || connected.has(r.id) || isOver(r)) continue;
    const next = nextDate(r, today); if (!next || next < today) continue;
    out.push({ requestId: r.id, kind: "open", type: r.recurring ? "recurring" : "oneoff", when: `${r.recurring ? "כל " : ""}${dayLabel(r)} · ${timeLabel(r)}`, nextDate: next, startMinute: r.startMinute ?? 0, level: r.level || "", durations: r.durations || [], hasCourt: Boolean(r.hasCourt),
      court: r.courtSlot ? { name: r.courtSlot.courtName || r.courtSlot.courtId || "", start: r.courtSlot.start || "", price: r.courtSlot.price ?? null } : null, total: partyOf(r), full: false,
      participants: [{ userId: r.userId, name: profiles[r.userId]?.name || r.displayName || null, party: partyOf(r), role: "owner" }], createdAt: r.createdAt || null });
  }
  return out.sort((a, b) => a.nextDate.localeCompare(b.nextDate) || a.startMinute - b.startMinute);
}
