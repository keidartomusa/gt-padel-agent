import test from "node:test";
import assert from "node:assert/strict";
import {memoryStore} from "../src/store.js";
import {CONFIG} from "../src/config.js";
import {courtSnapshot,freedWindows,releaseVariables,RELEASE_TEMPLATE,releaseTemplateDefinition,scanCourtReleases} from "../src/court-release.js";
import {sendParameterizedTemplate} from "../src/whatsapp.js";
const now=new Date("2026-09-25T10:00:00Z");
const id="court-A",venue={id:CONFIG.venueId,name:"GT PADEL",opening_hours:[{day:"Friday",isOpen:true,openTime:"07:00",closeTime:"23:00"},{day:"Saturday",isOpen:true,openTime:"07:00",closeTime:"23:00"},{day:"Sunday",isOpen:true,openTime:"07:00",closeTime:"23:00"}]};
const court={id,name:"מגרש 1",sport:"padel",is_active:true};
const reservation={id:"R1",court_id:id,date:"2026-09-25",start_time:"17:00:00",end_time:"18:30:00",status:"confirmed"};
const api=(booked)=>async url=>({ok:true,json:async()=>url.includes("/venues?")?[venue]:url.includes("/courts?")?[court]:url.includes("/reservation_slots?")?booked?[reservation]:[]:[]});
test("live-shaped snapshot compares occupied half-hours within 48 hours",async()=>{
 const before=await courtSnapshot({fetchImpl:api(true),now});const after=await courtSnapshot({fetchImpl:api(false),now});
 const freed=freedWindows(before,after);assert.equal(freed.length,1);assert.deepEqual(freed.map(releaseVariables),[["גני תקווה","25.9.2026","17:00","18:30"]]);
 assert.equal(freed[0].courtName,"מגרש 1");assert.deepEqual(freedWindows(after,before),[]);
});
test("first scan primes, failed notification retries once, accepted notification does not repeat",async()=>{
 const store=memoryStore();let booked=true,attempt=0;const snapshot=({now})=>courtSnapshot({now,fetchImpl:api(booked)});
 const notify=async()=>({sent:++attempt>1});
 assert.equal((await scanCourtReleases(store,{now,fetchSnapshot:snapshot,notify})).status,"primed");assert.equal(attempt,0);
 booked=false;let r=await scanCourtReleases(store,{now,fetchSnapshot:snapshot,notify});assert.equal(r.failed,1);assert.equal(r.windows,1);
 r=await scanCourtReleases(store,{now,fetchSnapshot:snapshot,notify});assert.equal(r.windows,0);assert.equal(r.sent,1);
 r=await scanCourtReleases(store,{now,fetchSnapshot:snapshot,notify});assert.equal(r.sent,0);assert.equal(attempt,2);
});
test("provider error preserves last snapshot and never generates a false cancellation",async()=>{
 const store=memoryStore();await scanCourtReleases(store,{now,fetchSnapshot:()=>courtSnapshot({now,fetchImpl:api(true)})});
 const prev=await store.get(`court-release/snapshot/${CONFIG.venueId}`);
 await assert.rejects(scanCourtReleases(store,{now,fetchSnapshot:()=>courtSnapshot({now,fetchImpl:async()=>({ok:false,status:503})})}));
 assert.deepEqual(await store.get(`court-release/snapshot/${CONFIG.venueId}`),prev);
});
test("scan-only records releases with club, date, times and detection timestamp, never sends",async()=>{
 const store=memoryStore();let booked=true,sends=0;const fetchSnapshot=({now})=>courtSnapshot({now,fetchImpl:api(booked)});
 let r=await scanCourtReleases(store,{now,fetchSnapshot,scanOnly:true,notify:async()=>{sends++;return{sent:true}}});assert.equal(r.status,"primed");assert.equal(r.mode,"scan_only");
 booked=false;r=await scanCourtReleases(store,{now,fetchSnapshot,scanOnly:true,notify:async()=>{sends++;return{sent:true}}});
 assert.equal(r.windows,1);assert.equal(sends,0);const rows=await store.list(`court-release/outbox/${CONFIG.venueId}/`);
 assert.equal(rows.length,1);assert.equal(rows[0].value.status,"recorded");assert.equal(rows[0].value.detectedAt,now.toISOString());
 assert.deepEqual(releaseVariables(rows[0].value.window),["גני תקווה","25.9.2026","17:00","18:30"]);
});
test("template proposal has club, date, start and end variables; send payload matches it",async()=>{
 const d=releaseTemplateDefinition();assert.equal(d.category,"UTILITY");assert.equal(d.components[0].type,"BODY");
 assert.deepEqual((d.components[0].text.match(/{{\d}}/g)||[]),["{{1}}","{{2}}","{{3}}","{{4}}"]);
 const previous={disable:process.env.DISABLE_OUTBOUND,token:process.env.WHATSAPP_ACCESS_TOKEN};process.env.DISABLE_OUTBOUND="false";process.env.WHATSAPP_ACCESS_TOKEN="TEST_TOKEN";
 try{let payload;const r=await sendParameterizedTemplate("972500000131",RELEASE_TEMPLATE.name,"he",["GT PADEL","25.9.2026","17:00","18:30"],"123456789",async(url,opt)=>{payload=JSON.parse(opt.body);return{ok:true,json:async()=>({messages:[{id:"accepted"}]})}});
  assert.equal(r.sent,true);assert.deepEqual(payload.template.components[0].parameters.map(x=>x.text),["GT PADEL","25.9.2026","17:00","18:30"]);
 }finally{for(const [key,value] of [["DISABLE_OUTBOUND",previous.disable],["WHATSAPP_ACCESS_TOKEN",previous.token]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});

test("a released isolated 30-minute cell is not advertised as a bookable court",()=>{
 const before={venueId:"v",cells:[{date:"2026-09-26",courtId:"c",courtName:"Court",minute:600,occupied:true}]};
 const after={venueId:"v",venueName:"Club",cells:[{...before.cells[0],occupied:false}]};
 assert.deepEqual(freedWindows(before,after),[]);
});

test("a failed alert is retired rather than sent after the slot becomes occupied again",async()=>{
 const store=memoryStore();let booked=true,sends=0;const snapshot=({now})=>courtSnapshot({now,fetchImpl:api(booked)});
 await scanCourtReleases(store,{now,fetchSnapshot:snapshot});booked=false;
 await scanCourtReleases(store,{now,fetchSnapshot:snapshot,notify:async()=>({sent:false})});
 booked=true;const r=await scanCourtReleases(store,{now,fetchSnapshot:snapshot,notify:async()=>{sends++;return{sent:true}}});
 assert.equal(r.sent,0);assert.equal(sends,0);
 const items=await store.list(`court-release/outbox/${CONFIG.venueId}/`);assert.equal(items[0].value.status,"stale");
});
