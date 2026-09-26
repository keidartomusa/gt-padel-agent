import test from 'node:test';
import assert from 'node:assert/strict';
import {memoryStore} from '../src/store.js';
import {selectVenue,PICKER} from '../src/club-selection.js';
import {GT_VENUE,SAAR_VENUE,SMASH_VENUE,isolatedStoreName,assertVenueResponse,bookingTargetAllowed} from '../src/venues.js';
import {routeIncoming} from '../src/webhook.js';
import {bookingUrl} from '../src/availability.js';
import {clubContact,DEFAULT_CONTACT} from '../src/club-contact.js';
import {deliver} from '../src/notify.js';

const stores={selector:memoryStore(),gt:memoryStore(),saar:memoryStore(),smash:memoryStore()};
test('one shared number opens picker only for new users, preserves existing GT users',async()=>{
 const selector=memoryStore(),gt=memoryStore();
 assert.deepEqual((await selectVenue({store:selector,userId:'new',input:{text:'היי'},legacyStore:gt})).response,PICKER);
 await gt.set('seen/old',{at:'2026-09-25'});
 assert.equal((await selectVenue({store:selector,userId:'old',input:{text:'היי'},legacyStore:gt})).venue,GT_VENUE);
 assert.equal((await selectVenue({store:selector,userId:'new',input:{actionId:'venue:saar'},legacyStore:gt})).venue,SAAR_VENUE);
 assert.equal((await selectVenue({store:selector,userId:'new',input:{text:'תפריט'},legacyStore:gt})).venue,SAAR_VENUE);
 assert.deepEqual((await selectVenue({store:selector,userId:'new',input:{text:'החלפת מועדון'},legacyStore:gt})).response,PICKER);
 assert.equal((await selectVenue({store:selector,userId:'new',input:{actionId:'venue:smash'},legacyStore:gt})).venue,SMASH_VENUE);
 assert.equal((await selectVenue({store:selector,userId:'new',input:{actionId:'venue:evil'},legacyStore:gt})).response,PICKER);
 assert.equal(await gt.get('seen/new'),null);
 assert.deepEqual((await selectVenue({store:selector,userId:'new',input:{text:'יש מגרש ב-GT PADEL?'},legacyStore:gt})).response.buttons,PICKER.buttons);
});
test('each club store and booking target isolated, and other club names rejected',()=>{
 assert.equal(new Set([GT_VENUE,SAAR_VENUE,SMASH_VENUE].map(isolatedStoreName)).size,3);
 for(const venue of [GT_VENUE,SAAR_VENUE,SMASH_VENUE]){
  const u=new URL(bookingUrl('2026-09-27',{courtId:'test',start:'17:30',durationMinutes:90,price:300},{venue}));
  assert.equal(u.searchParams.get('venue'),venue.key);
  assert(bookingTargetAllowed(venue,u.searchParams.get('target')));
  for(const other of [GT_VENUE,SAAR_VENUE,SMASH_VENUE].filter(v=>v!==venue)){
   assert.equal(bookingTargetAllowed(other,u.searchParams.get('target')),false);
   assert.throws(()=>assertVenueResponse(other,{text:`המועדון ${venue.name}`}),/Cross-venue/);
  }
 }
});
test('selected club uses club-specific welcome, profile, contact and available slots',async()=>{
 for(const venue of [GT_VENUE,SAAR_VENUE,SMASH_VENUE]){
  const store=memoryStore();const contact=memoryStore();
  assert.equal(await clubContact(venue,contact),`https://wa.me/${DEFAULT_CONTACT}`);
  const hello=await routeIncoming({userId:'972500000001',text:'היי',store,venue});
  assert.ok(hello.text.includes(venue.name));assertVenueResponse(venue,hello);
  const c=await routeIncoming({userId:'972500000001',actionId:'club',store,venue,contactUrl:await clubContact(venue,contact)});
  assert.equal(c.ctaUrl.url,`https://wa.me/${DEFAULT_CONTACT}`);
  const result=await routeIncoming({userId:'972500000001',text:'יש מגרש מחר אחרי 17:00?',store,venue,availabilityFn:async i=>({kind:'availability',date:i.date,slots:[{courtId:'test',courtName:'3',start:'17:30',end:'19:00',durationMinutes:90,price:300}]})});
  assertVenueResponse(venue,result);
  assert.equal((await store.get('profile/972500000001')).lastInboundAt!==undefined,true);
 }
});
test('contact override is per club without a rebuild',async()=>{
 const a=memoryStore(),b=memoryStore();await a.set('config/contact',{number:'972500000001'});
 assert.equal(await clubContact(SAAR_VENUE,a),'https://wa.me/972500000001');
 assert.equal(await clubContact(SMASH_VENUE,b),`https://wa.me/${DEFAULT_CONTACT}`);
});
test('new clubs cannot send GT template out of window',async()=>{
 for(const venue of [SAAR_VENUE,SMASH_VENUE]){
  const store=memoryStore();let sends=0;
  const res=await deliver(store,'972500000001',{text:'התאמה'},{venue,send:async()=>{sends++;return{sent:true}},sendTemplate:async()=>{sends++;return{sent:true}}});
  assert.equal(res.sent,false);assert.equal(sends,0);assert.equal((await store.get('pending/972500000001')).items.length,1);
 }
});

test('selection does not run a stale callback from another club',async()=>{
 const selector=memoryStore(),gt=memoryStore();await selector.set('selection/972500000001',{venueKey:'saar'});
 const choose=await selectVenue({store:selector,userId:'972500000001',input:{actionId:'bk:2026-09-27.old.1730.90.300'},legacyStore:gt});
 assert.equal(choose.venue,SAAR_VENUE);
 assert.equal(await gt.get('seen/972500000001'),null);
});
test('provider booking action for a foreign court fails closed',async()=>{
 const store=memoryStore();
 const out=await routeIncoming({userId:'972500000001',actionId:'bk:2026-09-27.foreign-court.1730.90.300',store,venue:SAAR_VENUE});
 assert.equal(out.ctaUrl,undefined);
 assert.match(out.text,/לא זמין/);
});

test('GT menu keeps its prior welcome and offers a club-change command',async()=>{
 const store=memoryStore();const reply=await routeIncoming({userId:'972500000001',text:'היי',store,venue:GT_VENUE});
 assert.match(reply.text,/GT PADEL/);assert.match(reply.text,/לבחירת מועדון כתבו: בחירת מועדון/);
 assert.deepEqual(reply.buttons.map(x=>x.id),['availability','players','club']);
});
test('selected club state never borrows another club profile or request',async()=>{
 const a=memoryStore(),b=memoryStore(),userId='972500000004';
 await a.set(`profile/${userId}`,{userId,name:'שם מסער'});await a.set('request/test',{id:'test',userId,active:true,date:'2026-09-27',startMinute:1080,endMinute:1140,displayName:'שם מסער'});
 const r=await routeIncoming({userId,text:'תפריט',store:b,venue:SMASH_VENUE});
 assert.doesNotMatch(r.text,/שם מסער|פאדלס/);assert.equal(await b.get('request/test'),null);
});
