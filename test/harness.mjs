// Production-path QA harness: every user turn goes through the same steps as
// netlify/functions/whatsapp.js (reaction -> typing -> routeIncoming -> sendResponse),
// with Meta calls captured instead of sent, and Matchpointer called live and recorded.
import { routeIncoming } from "../src/webhook.js";
import { memoryStore } from "../src/store.js";
import { sendReaction, sendTyping, sendResponse } from "../src/whatsapp.js";
process.env.DISABLE_OUTBOUND = "false";
process.env.WHATSAPP_ACCESS_TOKEN = "qa-capture-only";
process.env.WHATSAPP_PHONE_NUMBER_ID = "qa-phone";
export const provider = { startedAt: new Date().toISOString(), requests: [] };
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const res = await realFetch(url, init);
  if (String(url).includes("api.matchpointer.app")) {
    const clone = res.clone(); let body; try { body = await clone.json(); } catch { body = null; }
    provider.requests.push({ at: new Date().toISOString(), path: String(url).replace("https://api.matchpointer.app/rest/v1/", ""), status: res.status, rows: Array.isArray(body) ? body.length : null, body });
  }
  return res;
};
let seq = 0;
export function makeUser(userId, displayName, store = memoryStore()) { return { userId, displayName, store }; }
export async function turn(user, step, { now = new Date() } = {}) {
  const msgId = `wamid.QA_${Date.now()}_${++seq}`, calls = [];
  const capture = async (url, init) => { calls.push(JSON.parse(init.body)); return { ok: true, json: async () => ({ messages: [{ id: `wamid.OUT_${seq}_${calls.length}` }] }), text: async () => "" }; };
  const input = step.actionId ? { actionId: step.actionId, text: step.title || "" } : { text: step.text || "" };
  const reaction = await sendReaction(user.userId, msgId, "👍", undefined, capture);
  const typing = await sendTyping(msgId, undefined, capture);
  const response = await routeIncoming({ userId: user.userId, displayName: user.displayName, ...input, store: user.store, now });
  await sendResponse(user.userId, response, undefined, capture);
  for (const n of response.notifications || []) await sendResponse(n.to, n.response, undefined, capture);
  return { msgId, input: step.actionId ? { actionId: step.actionId, title: step.title } : { text: step.text }, reaction: reaction.sent && calls[0]?.type === "reaction" ? calls[0].reaction.emoji : null, typing: typing.sent && calls[1]?.typing_indicator?.type === "text", response, outbound: calls.slice(2) };
}
export const options = r => [...(r.buttons || []).map(b => ({ id: b.id, title: b.title })), ...(r.list?.sections || []).flatMap(s => s.rows.map(x => ({ id: x.id, title: x.title, description: x.description })))];
export function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }
export const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];
export function view(t) { const r = t.response; return { text: r.text, buttons: r.buttons?.map(b => b.title), list: r.list ? { button: r.list.button, rows: r.list.sections.flatMap(s => s.rows.map(x => ({ title: x.title, description: x.description || "" }))) } : undefined, cta: r.ctaUrl ? { label: r.ctaUrl.displayText, url: r.ctaUrl.url } : undefined, notifications: r.notifications?.map(n => ({ to: n.to, text: n.response.text })) }; }
const NAMES = ["יוסי", "דנה", "אבי כהן", "מיכל", "רון", "נועה לוי", "איתי", "שירה", "עומר", "טל", "גיל", "ליאור", "מאיה", "אלון", "רותם", "Tom", "עדי", "נדב", "יעל", "אורי"];
export const realName = u => u.realName || (/\d/.test(u.displayName || "") || !u.displayName ? NAMES[[...String(u.userId)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % NAMES.length] : u.displayName);
// A real user answers the one-time name question with their name; both turns are recorded.
export async function turnAll(user, step, opts) { const t = await turn(user, step, opts); if (/^מה השם שלך\?/.test(t.response.text || "")) return [t, await turn(user, { text: realName(user) }, opts)]; return [t]; }
