// Production-path QA harness: every user turn goes through the same steps as
// netlify/functions/whatsapp.js (typing -> routeIncoming -> sendResponse; no reaction, Tom 23.9),
// with Meta calls captured instead of sent, and Matchpointer called live and recorded.
import { deliver } from "../src/notify.js";
import { routeIncoming } from "../src/webhook.js";
import { logInbound, logOutbound } from "../src/messagelog.js";
import { memoryStore } from "../src/store.js";
import { sendTyping, sendResponse, sendTemplate } from "../src/whatsapp.js";
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
  const typing = await sendTyping(msgId, undefined, capture);
  await logInbound(user.store, user.userId, { id: msgId, type: step.actionId ? "interactive" : "text" }, input, now);
  const response = await routeIncoming({ userId: user.userId, displayName: user.displayName, ...input, store: user.store, now });
  const sentMain = await sendResponse(user.userId, response, undefined, capture);
  await logOutbound(user.store, user.userId, response, sentMain, now);
  for (const n of response.notifications || []) await deliver(user.store, n.to, n.response, { now, send: (to, r) => sendResponse(to, r, undefined, capture), sendTemplate: (to, t) => sendTemplate(to, t.name, t.language, t.payloads, undefined, capture) });
  return { msgId, input: step.actionId ? { actionId: step.actionId, title: step.title } : { text: step.text }, reaction: calls.some(c => c.type === "reaction") ? "sent" : null, typing: typing.sent && calls[0]?.typing_indicator?.type === "text", response, outbound: calls.slice(1) };
}
export const options = r => [...(r.buttons || []).map(b => ({ id: b.id, title: b.title })), ...(r.list?.sections || []).flatMap(s => s.rows.map(x => ({ id: x.id, title: x.title, description: x.description })))];
export function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }
export const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];
export function view(t) { const r = t.response; return { text: r.text, buttons: r.buttons?.map(b => b.title), list: r.list ? { button: r.list.button, rows: r.list.sections.flatMap(s => s.rows.map(x => ({ title: x.title, description: x.description || "" }))) } : undefined, cta: r.ctaUrl ? { label: r.ctaUrl.displayText, url: r.ctaUrl.url } : undefined, notifications: r.notifications?.map(n => ({ to: n.to, text: n.response.text })) }; }
const NAMES = ["יוסי", "דנה", "אבי כהן", "מיכל", "רון", "נועה לוי", "איתי", "שירה", "עומר", "טל", "גיל", "ליאור", "מאיה", "אלון", "רותם", "Tom", "עדי", "נדב", "יעל", "אורי"];
export const realName = u => u.realName || (/\d/.test(u.displayName || "") || !u.displayName ? NAMES[[...String(u.userId)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % NAMES.length] : u.displayName);
// A real user answers the one-time name question with their name; both turns are recorded.
export async function turnAll(user, step, opts) { const t = await turn(user, step, opts); // The name question is either typed (NAME_ASK) or the WhatsApp-profile offer (critique item 19); a user who types their name answers both.
  if (/^(באיזה שם להציג אתכם|להופיע בלוח המשחקים בתור)/m.test(t.response.text || "")) return [t, await turn(user, { text: realName(user) }, opts)]; return [t]; }
