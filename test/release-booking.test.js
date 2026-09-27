import test from 'node:test';import assert from 'node:assert/strict';
import {memoryStore} from '../src/store.js';
import {GT_VENUE,SAAR_VENUE,SMASH_VENUE} from '../src/venues.js';
import {createReleaseBookingToken,resolveReleaseBooking} from '../src/release-booking.js';
import {RELEASE_BOOKING_TEMPLATE,releaseBookingTemplateDefinition,RELEASE_TEMPLATE} from '../src/court-release.js';
const uuid='00000000-0000-4000-8000-000000000001';
const window={venueId:GT_VENUE.venueId,date:'2026-09-27',courtId:'court-1',startMinute:1080,endMinute:1200};
const now=new Date('2026-09-27T08:00:00+03:00');
test('new template has URL CTA and leaves approved v1 unchanged',()=>{const t=releaseBookingTemplateDefinition();assert.equal(t.name,'gt_court_release_book_v1');assert.equal(RELEASE_TEMPLATE.name,'gt_court_release_v1');assert.equal(t.components[1].buttons[0].text,'להזמנת מגרש');assert.match(t.components[1].buttons[0].url,/\/go\/release\?token=\{\{1\}\}/);assert.match(RELEASE_BOOKING_TEMPLATE.body,/הזמינות עשויה להשתנות/);});
test('release URL binds a single court/date/time and redirects only while bookable',async()=>{
 const store=memoryStore();await createReleaseBookingToken(store,window,{random:()=>uuid,now});
 const providerStatic=async()=>({venue:{id:GT_VENUE.venueId},courts:[{id:'court-1'}]}),providerOccupied=async()=>[];
 const opts={now,providerStatic,providerOccupied};
 const check=async(intent)=>({slots:[{courtId:'court-1',start:'18:00',end:'20:00',durationMinutes:120,price:400}]});
 const r=await resolveReleaseBooking(store,uuid,{...opts,availability:check});assert.equal(r.status,302);
 const inner=new URL(r.location);
 assert.equal(inner.origin,'https://matchpointer.app');assert.equal(inner.pathname,'/he/clubs/gt-padel/book');assert.deepEqual([...inner.searchParams.entries()],[['court','court-1'],['time','18:00'],['date','2026-09-27'],['duration','120'],['step','confirm']]);
 assert.equal((await resolveReleaseBooking(store,uuid,{...opts,availability:async()=>({slots:[]})})).status,410);
 assert.equal((await resolveReleaseBooking(store,uuid,{...opts,availability:async()=>({slots:[{courtId:'court-2',start:'18:00',durationMinutes:120}]})})).status,410);
 assert.equal((await resolveReleaseBooking(store,uuid,{...opts,now:new Date(now.getTime()+49*3600000),availability:check})).status,410);
 assert.equal((await resolveReleaseBooking(store,uuid,{...opts,providerOccupied:async()=>[{court_id:'court-1',date:'2026-09-27',start_time:'18:30',end_time:'19:30'}],availability:check})).status,410);
 assert.equal((await resolveReleaseBooking(store,'bad',{...opts,availability:check})).status,404);
});
test('production redirect handler uses the same resolver and fails closed on unknown token',async()=>{
 const {default:handler}=await import('../netlify/functions/release-booking.js');
 const r=await handler(new Request('https://gtpadel.netlify.app/.netlify/functions/release-booking?token=bad'));
 assert.equal(r.status,404);
});

// Each club's provider venue, court and exact slot must match the selected club.
test('release tokens route exact verified slots to their own club, never GT or another club',async()=>{
 for(const [index,venue] of [GT_VENUE,SAAR_VENUE,SMASH_VENUE].entries()){
  const store=memoryStore(),token=`00000000-0000-4000-8000-${String(index+10).padStart(12,'0')}`;
  await createReleaseBookingToken(store,{...window,venueId:venue.venueId},{random:()=>token,now});
  assert.equal((await store.get(`court-release/book/${token}`)).venueKey,venue.key);
  const calls=[];
  const opts={now,providerStatic:async(_,__,v)=>{calls.push(['static',v.key]);return{venue:{id:v.venueId},courts:[{id:'court-1'}]};},providerOccupied:async(_,__,___,____,v)=>{calls.push(['occupied',v.key]);return[];},availability:async(_,options)=>{calls.push(['availability',options.venue.key]);return{slots:[{courtId:'court-1',start:'18:00',durationMinutes:120,price:400}]};}};
  const result=await resolveReleaseBooking(store,token,opts);
  assert.equal(result.status,302);const destination=new URL(result.location);
  assert.equal(destination.pathname,`/he/clubs/${venue.venueSlug}/book`);
  assert.deepEqual([...destination.searchParams.entries()],[['court','court-1'],['time','18:00'],['date','2026-09-27'],['duration','120'],['step','confirm']]);
  assert.deepEqual(calls,[['static',venue.key],['occupied',venue.key],['availability',venue.key]]);
  assert.equal((await resolveReleaseBooking(store,token,{...opts,providerStatic:async()=>({venue:{id:GT_VENUE.venueId===venue.venueId?SAAR_VENUE.venueId:GT_VENUE.venueId},courts:[{id:'court-1'}]})})).status,410);
  assert.equal((await resolveReleaseBooking(store,token,{...opts,providerStatic:async()=>({venue:{id:venue.venueId},courts:[{id:'foreign-court'}]})})).status,410);
  assert.equal((await resolveReleaseBooking(store,token,{...opts,providerOccupied:async()=>[{court_id:'court-1',date:window.date,start_time:'18:30',end_time:'19:00'}]})).status,410);
 }
});
test('unknown venue cannot mint or resolve release tokens',async()=>{
 const store=memoryStore();await assert.rejects(createReleaseBookingToken(store,{...window,venueId:'foreign'},{random:()=>uuid,now}),/Invalid release window/);
 await store.set(`court-release/book/${uuid}`,{venueKey:'foreign',createdAt:now.toISOString()});
 assert.equal((await resolveReleaseBooking(store,uuid,{now})).status,404);
});

test('production handler forwards each verified club destination and refuses stale or foreign provider data',async()=>{
 const {handleReleaseBooking}=await import('../netlify/functions/release-booking.js');
 for(const [i,venue] of [GT_VENUE,SAAR_VENUE,SMASH_VENUE].entries()){
  const store=memoryStore(),token=`00000000-0000-4000-8000-${String(i+20).padStart(12,'0')}`;
  await createReleaseBookingToken(store,{...window,venueId:venue.venueId},{random:()=>token,now});
  const req=new Request(`https://gtpadel.netlify.app/.netlify/functions/release-booking?token=${token}`);
  const resolveOptions={now,providerStatic:async()=>({venue:{id:venue.venueId},courts:[{id:'court-1'}]}),providerOccupied:async()=>[],availability:async()=>({slots:[{courtId:'court-1',start:'18:00',durationMinutes:120,price:400}]})};
  const result=await handleReleaseBooking(req,{store,resolveOptions});assert.equal(result.status,302);
  const u=new URL(result.headers.get('location'));assert.equal(u.pathname,`/he/clubs/${venue.venueSlug}/book`);
  assert.equal(u.searchParams.get('court'),'court-1');assert.equal(u.searchParams.get('time'),'18:00');
  const stale=await handleReleaseBooking(req,{store,resolveOptions:{...resolveOptions,providerStatic:async()=>({venue:{id:venue.venueId},courts:[{id:'foreign'}]})}});assert.equal(stale.status,410);
 }
});
