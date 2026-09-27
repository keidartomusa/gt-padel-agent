// Tom 24.9 07:42: "היי" from a returning number showed only the short menu. Decision 07:47 (option A):
// the full welcome on every greeting; "תפריט" stays short after the first time.
import test from "node:test"; import assert from "node:assert/strict";
import { routeIncoming } from "../src/webhook.js"; import { memoryStore } from "../src/store.js";
const now = new Date("2026-09-24T04:42:00Z");
test("every greeting gets the full welcome, תפריט stays short", async () => {
  const s = memoryStore(), u = "972500000091";
  for (const t of ["היי", "היי", "שלום", "הי"]) { const r = await routeIncoming({ userId: u, text: t, store: s, now }); assert.match(r.text, /\*ברוכים הבאים לפאדל גני תקווה\*/, t); assert.ok(r.buttons.some(b => b.id === "players"), t); }
  const m = await routeIncoming({ userId: u, text: "תפריט", store: s, now }); assert.match(m.text, /^(\S+, )?מה תרצו לעשות\?/); assert.doesNotMatch(m.text, /ברוכים הבאים/);
  const again = await routeIncoming({ userId: u, text: "היי", store: s, now }); assert.match(again.text, /ברוכים הבאים/);
});
test("a greeting mid-flow still re-asks the current step (flow is kept, no welcome)", async () => {
  const s = memoryStore(), u = "972500000092";
  await routeIncoming({ userId: u, text: "היי", store: s, now }); const q = await routeIncoming({ userId: u, actionId: "players", store: s, now });
  const r = await routeIncoming({ userId: u, text: "היי", store: s, now }); assert.doesNotMatch(r.text, /ברוכים הבאים/); assert.equal(r.text, q.text);
});
test('welcome headline uses exactly the selected club identity with no cross-club copy', async () => {
 const {GT_VENUE,SAAR_VENUE,SMASH_VENUE,assertVenueResponse}=await import('../src/venues.js');
 for (const [club,title] of [[GT_VENUE,'פאדל גני תקווה'],[SAAR_VENUE,'פאדלס קיבוץ סער'],[SMASH_VENUE,'סמאש פאדל קלאב (ראשל״צ)']]) {
  for(const name of [undefined,'תום']){
   const r=await routeIncoming({userId:`welcome-${club.key}-${name||'anonymous'}`,displayName:name,text:'היי',store:memoryStore(),now,venue:club});
   assert(r.text.startsWith(`*ברוכים הבאים ל${title}* 🎾`),r.text);
   assertVenueResponse(club,r);
   assert.doesNotMatch(r.text,/שלום תום,/); // WhatsApp display name is not a confirmed player name.
  }
 }
});
