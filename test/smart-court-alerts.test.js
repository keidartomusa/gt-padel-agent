import test from 'node:test';import assert from 'node:assert/strict';
import {memoryStore} from '../src/store.js';
import {GT_VENUE,SAAR_VENUE,SMASH_VENUE} from '../src/venues.js';
import {routeIncoming} from '../src/webhook.js';
import {handleConversation} from '../src/conversation.js';
import {proposedAlert,changeAlert,saveAlert,recordAlertCandidates,alertMatches} from '../src/court-alerts.js';
import {courtSnapshot,scanCourtReleases} from '../src/court-release.js';
const now=new Date('2026-09-27T07:00:00+03:00'),date='2026-09-28';
const clubs=[GT_VENUE,SAAR_VENUE,SMASH_VENUE];
const none=async i=>({kind:'availability',date:i.date,slots:[]});
const available=async i=>({kind:'availability',date:i.date,slots:[{courtId:'test',courtName:'1',start:'20:00',end:'21:30',durationMinutes:i.durationMinutes||90,price:300}]});
const w=v=>({venueId:v.venueId,venueName:v.name,date,courtId:'test',courtName:'1',startMinute:1170,endMinute:1260});
test('search result offers one opt-in only after search, across all three clubs',async()=>{
 for(const venue of clubs){for(const fetch of [none,available]){
  const store=memoryStore(),userId='972500000001';const r=await routeIncoming({userId,text:'מגרש מחר ב20:00 ל90 דקות',store,venue,now,availabilityFn:fetch});
  const options=[...(r.buttons||[]),...(r.list?.sections||[]).flatMap(s=>s.rows)];assert(options.some(x=>x.id==='court_alert_offer'),JSON.stringify(r));
  assert.equal((await store.list('court-alert/subscription/')).length,0);
  const offer=await routeIncoming({userId,actionId:'court_alert_offer',store,venue,now,availabilityFn:fetch});assert.match(offer.text,new RegExp(venue.name));assert.match(offer.text,/19:00-21:00/);
  const saved=await routeIncoming({userId,actionId:'court_alert_save',store,venue,now,availabilityFn:fetch});assert.match(saved.text,/הפעלתי התראה אחת/);
  const alerts=await store.list('court-alert/subscription/');assert.equal(alerts.length,1);assert.equal(alerts[0].value.venueKey,venue.key);assert.deepEqual(alerts[0].value.durations,[90]);
 }}
});
test('phrasing corpus preserves exact hour, range, minimum and exact duration',()=>{
 const initial=proposedAlert({date,startMinute:1200,durationMinutes:90},GT_VENUE,now);assert.deepEqual(initial.starts,[1140,1170,1200,1230,1260]);
 const cases=[['רק 20:00',[1200],[90]],['בדיוק ב-20:00 וב-21:00',[1200,1260],[90]],['בין 19:00 ל-21:00',[1140,1170,1200,1230,1260],[90]],['לפחות 90 דקות',initial.starts,[90,120]],['מינימום 90 דק',initial.starts,[90,120]],['בדיוק 90 דקות',initial.starts,[90]],['רק שעה וחצי',initial.starts,[90]],['שעתיים',initial.starts,[120]]];
 for(const [text,starts,durations] of cases){const result=changeAlert(initial,text);assert.deepEqual(result?.starts,starts,text);assert.deepEqual(result?.durations,durations,text);}
 assert.equal(changeAlert(initial,'בין 21:00 ל-19:00'),null);
});
test('release candidates are club-isolated, record-only, deduplicated and scoped to consent',async()=>{
 for(const venue of clubs){const store=memoryStore(),alert=await saveAlert(store,'972500000001',proposedAlert({date,startMinute:1200,durationMinutes:90},venue,now),{now,consentText:'כן, להפעיל',id:()=>`alert-${venue.key}`});
  const other=clubs.find(v=>v!==venue);assert.equal((await recordAlertCandidates(store,[w(venue)],other,{now})).length,0);
  assert.equal((await recordAlertCandidates(store,[w(venue)],venue,{now})).length,1);
  assert.equal((await recordAlertCandidates(store,[w(venue)],venue,{now})).length,0);
  await store.set(`court-alert/optout/${alert.userId}`,{at:now.toISOString()});assert.equal((await recordAlertCandidates(store,[{...w(venue),courtId:'two'}],venue,{now})).length,0);
 }
});
test('game request without an available court can be published, with separately chosen alert consent',async()=>{
 for(const venue of clubs)for(const consent of ['yes','no']){
  const store=memoryStore(),userId='972500000002';await store.set(`profile/${userId}`,{userId,name:'דנה'});
  const h=o=>handleConversation({userId,displayName:'דנה',store,venue,now,availabilityFn:none,...o});
  await h({actionId:'oneoff'});await h({actionId:'level:3'});
  let r=await h({text:'מחר אחרי 19:00'});
  for(let i=0;i<6&&!r.buttons?.some(b=>b.id==='no_court_continue')&&!r.buttons?.some(b=>b.id==='court_consent:yes');i++){const choices=[...(r.buttons||[]),...(r.list?.sections||[]).flatMap(s=>s.rows)];const next=choices.find(c=>/^(party:1|pc:1:no|court:no|flex:60)$/.test(c.id));assert.ok(next,JSON.stringify(r));r=await h({actionId:next.id});}if(r.buttons?.some(b=>b.id==='no_court_continue'))r=await h({actionId:'no_court_continue'});
  for(let i=0;i<8&&!r.buttons?.some(b=>b.id==='court_consent:yes');i++){
   const choices=[...(r.buttons||[]),...(r.list?.sections||[]).flatMap(s=>s.rows)];const next=choices.find(c=>/^(party:1|pc:1|flex:60|duration:90|no_court_continue)$/.test(c.id));assert.ok(next,JSON.stringify(r));r=await h({actionId:next.id});
  }
  assert.match(r.text,/התראה אחת/);assert.equal((await store.list('request/')).length,0);
  r=await h({actionId:`court_consent:${consent}`});assert.match(r.text,/הבקשה נשמרה/);
  const request=(await store.list('request/'))[0].value;assert.equal(request.noCourtAvailable,true);assert.equal(request.courtAlertConsent,consent==='yes');
  assert.equal((await recordAlertCandidates(store,[w(venue)],venue,{now})).length,consent==='yes'?1:0);
 }
});
test('provider snapshots for each club reject a mismatched venue ID',async()=>{
 for(const club of clubs){const fetchImpl=async url=>({ok:true,json:async()=>String(url).includes('/venues?')?[{id:club.venueId,name:club.name,opening_hours:[{day:'Monday',isOpen:true,openTime:'07:00',closeTime:'23:00'}]}]:String(url).includes('/courts?')?[{id:'test',name:'1',sport:'padel',is_active:true}]:[]});
  const snapshot=await courtSnapshot({club,now,fetchImpl});assert.equal(snapshot.venueId,club.venueId);assert.equal(snapshot.venueName,club.name);
  await assert.rejects(scanCourtReleases(memoryStore(),{club,now,scanOnly:true,fetchSnapshot:async()=>({...snapshot,venueId:'foreign'})}),/Cross-venue snapshot/);
 }
});
