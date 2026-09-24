import test from "node:test";import assert from "node:assert/strict";
import {routeIncoming} from "../src/webhook.js";import {memoryStore} from "../src/store.js";
// Tom 24.9 09:46: a trio ("שלושה · יש מגרש") connected to a solo player and the approval said "יחד אתם 2 מתוך 4".
// Cause: the requester already had an older compatible solo request, and the oldest one was taken as their party.
const now=new Date("2026-09-24T09:40:00+03:00"),T="15550000090",D="972500000077";
const av=async i=>({kind:"availability",date:i.date,slots:[]});
async function setup(){const s=memoryStore();
 await s.set(`profile/${T}`,{userId:T,name:"תום",lastInboundAt:now.toISOString()});
 await s.set("request/old",{recurring:false,displayName:"תום",level:"3–3.5",partySize:1,hasCourt:false,date:"2026-09-27",startMinute:1140,endMinute:1440,durations:[90],flexMinutes:0,id:"old",userId:T,active:true,createdAt:"2026-09-23T10:00:00Z"});
 await s.set("request/d",{recurring:false,displayName:"דנה",level:"3–3.5",partySize:1,hasCourt:false,date:"2026-09-27",startMinute:1260,endMinute:1440,durations:[90],flexMinutes:1440,id:"d",userId:D,active:true,createdAt:now.toISOString()});
 const say=(u,o)=>routeIncoming({userId:u,displayName:u===T?"תום":"דנה",store:s,now,availabilityFn:av,...o});
 for(const o of [{text:"היי"},{text:"מציאת שחקנים"},{actionId:"oneoff"},{actionId:"level:3"},{actionId:"pc:3:yes"},{text:"ראשון הקרוב בערב"}])await say(T,o);
 const trio=(await s.list("request/")).map(x=>x.value).find(r=>r.userId===T&&r.partySize===3);assert(trio);return{s,say,trio};}
test("trio + solo = full foursome even when the trio also has an older compatible solo request",async()=>{const{s,say,trio}=await setup();
 await say(T,{actionId:"connect:d"});const c=(await s.list("connection/")).map(x=>x.value)[0];assert.equal(c.fromRequestId,trio.id);
 const r=await say(D,{actionId:"accept:"+c.id});const toT=r.notifications.find(n=>n.to===T).response.text;
 assert.match(toT,/יחד אתם 4 - רביעייה מלאה/);assert.doesNotMatch(toT,/מתוך 4/);assert.match(r.text,/יחד אתם 4/);
 const d=await s.get("request/d");assert.equal(d.partySize,4);assert.equal(d.full,true);
 assert.equal((await s.get(`request/${trio.id}`)).closedReason,"merged","the trio is the request merged in");
 assert.equal((await s.get("request/old")).active,true,"the unrelated older request is left alone");});
test("the party pinned at connect time wins even if the requester opens another request before the approval",async()=>{const{s,say,trio}=await setup();
 await say(T,{actionId:"connect:d"});const c=(await s.list("connection/")).map(x=>x.value)[0];
 await s.set("request/newer",{recurring:false,displayName:"תום",level:"3–3.5",partySize:1,hasCourt:false,date:"2026-09-27",startMinute:1260,endMinute:1440,durations:[90],flexMinutes:0,id:"newer",userId:T,active:true,createdAt:"2026-09-24T06:45:00Z"});
 const r=await say(D,{actionId:"accept:"+c.id});assert.match(r.notifications.find(n=>n.to===T).response.text,/רביעייה מלאה/);
 assert.equal((await s.get("request/newer")).active,true);assert.equal((await s.get(`request/${trio.id}`)).active,false);});
test("connect-time room check uses the newest compatible request: a trio cannot connect into a pair",async()=>{const{s,say}=await setup();
 await s.set("request/d",{...(await s.get("request/d")),partySize:2});const r=await say(T,{actionId:"connect:d"});assert.match(r.text,/אין מספיק מקום/);});
