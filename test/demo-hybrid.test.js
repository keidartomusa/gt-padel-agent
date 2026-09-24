import test from "node:test";import assert from "node:assert/strict";
import {routeIncoming} from "../src/webhook.js";import {memoryStore} from "../src/store.js";
import {demoMove,demoApprove,demoCleanup,DEMO_USER} from "../src/demo.js";
// Tom 24.9 09:28: one phone records a solo request as "דנה", a job moves it to a fictitious user,
// Tom (trio) connects, a job approves as the fictitious user so Tom's phone gets the real approval.
const now=new Date("2026-09-23T08:00:00+03:00"),later=new Date(now.getTime()+20*60000);
const available=async i=>({kind:"availability",date:i.date,slots:[{courtId:"c3",courtName:"3",start:"19:00",end:"20:30",durationMinutes:i.durationMinutes,price:null}]});
const T="15550000090"; // a non-fictitious-prefix id stands in for a real user (not a real number)
const say=(s,o,at=now)=>routeIncoming({userId:T,displayName:"x",store:s,now:at,availabilityFn:available,...o});
async function register(s,pc,name,at){let r;for(const o of [{actionId:"oneoff"},{actionId:"level:3–3.5"},{actionId:pc},{text:"מחר אחרי 19:00"},{actionId:"duration:90"},{actionId:"flex:0"},{text:name}]){r=await say(s,o,at);if(/נשמרה/.test(r.text||""))break;}assert.match(r.text,/נשמרה/,JSON.stringify(r));return r;}
const reqs=async s=>(await s.list("request/")).map(x=>x.value);
test("demo hybrid: move -> trio connects -> approve sends the real approval to Tom only",async()=>{const s=memoryStore();
 await register(s,"pc:1:no","דנה",now);const m=await demoMove(s,{now:later});assert.equal(m.status,"moved",JSON.stringify(m));
 const moved=(await reqs(s)).find(r=>r.id===m.requestId);assert.equal(moved.userId,DEMO_USER);assert.equal((await s.get(`profile/${DEMO_USER}`)).name,"דנה");
 const r=await register(s,"pc:3:yes","תום",later);const all=[r,...(r.notifications||[]).map(n=>n.response)];
 const btn=all.flatMap(x=>[...(x.buttons||[]),...(x.list?.sections||[]).flatMap(y=>y.rows)]).find(b=>String(b.id).startsWith("connect:"));
 assert(btn,"Tom (trio) is offered the solo request: "+JSON.stringify(r).slice(0,600));
 await say(s,{actionId:btn.id},later);
 const sent=[];const a=await demoApprove(s,{now:later,deliverFn:async(to,resp)=>{sent.push({to,resp});return{sent:true};}});
 assert.equal(a.status,"accepted",JSON.stringify(a));assert.ok(sent.length>=1);assert.ok(sent.every(x=>x.to===T));assert.match(sent[0].resp.text,/אושר/);
 assert.equal((await demoApprove(s,{now:later})).status,"not_found","approve is one-shot");
 const c=await demoCleanup(s,{now:later});assert.ok(c.removed>=3);
 assert.ok(!(await reqs(s)).some(r=>r.userId===DEMO_USER));assert.equal(await s.get(`profile/${DEMO_USER}`),null);});
test("demo move touches nothing when there is no candidate or more than one",async()=>{const s=memoryStore();
 assert.equal((await demoMove(s,{now})).status,"not_found");
 await register(s,"pc:3:yes","יוסי",now);assert.equal((await demoMove(s,{now:later})).status,"not_found","trios are never moved");
 await register(s,"pc:1:no","יוסי",now);const r=(await reqs(s)).find(x=>x.partySize===1);await s.set("request/zz",{...r,id:"zz"});
 assert.equal((await demoMove(s,{now:later})).status,"ambiguous");assert.ok((await reqs(s)).every(r=>r.userId===T));});
test("demo move never touches fictitious seed users and renames the moved request to דנה",async()=>{const s=memoryStore();
 await s.set("request/seed",{id:"seed",userId:"972500000001",partySize:1,active:true,displayName:"תימור",createdAt:now.toISOString()});
 assert.equal((await demoMove(s,{now:later})).status,"not_found");
 await register(s,"pc:1:no","תום",now);const m=await demoMove(s,{now:later});assert.equal(m.status,"moved");
 const r=await s.get(`request/${m.requestId}`);assert.equal(r.displayName,"דנה");assert.equal(r.userId,DEMO_USER);assert.equal((await s.get("request/seed")).userId,"972500000001");});
test("demo move ignores stale requests (older than 1 hour)",async()=>{const s=memoryStore();await register(s,"pc:1:no","דנה",now);
 assert.equal((await demoMove(s,{now:new Date(now.getTime()+61*60000)})).status,"not_found");});
test("deploy-succeeded maps demo tags; health exposes lastDemo",async()=>{const fs=await import("node:fs");
 const d=fs.readFileSync("netlify/functions/deploy-succeeded.js","utf8");for(const t of["move","approve","cleanup"])assert.match(d,new RegExp(`\\["demo-${t}","demo-${t}-background"\\]`));
 assert.match(fs.readFileSync("netlify/functions/health.js","utf8"),/lastDemo/);});
