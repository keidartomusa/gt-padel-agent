import test from "node:test";import assert from "node:assert/strict";
import {memoryStore} from "../src/store.js";import {ensureTemplate,templateDefinition,TEMPLATE_BUTTONS} from "../src/template.js";import {reengageTest} from "../src/reengage.js";import {MATCH_TEMPLATE} from "../src/notify.js";
const res=(body,ok=true,status=200)=>({ok,status,json:async()=>body});
function graph({existing=[],manage=true}={}){const calls=[];let tpl=[...existing];return{calls,fetch:async(url,opt={})=>{calls.push({url,method:opt.method||"GET",body:opt.body});
 if(url.includes("/debug_token"))return res({data:{granular_scopes:manage?[{scope:"whatsapp_business_management",target_ids:["WABA1"]},{scope:"whatsapp_business_messaging",target_ids:["WABA1"]}]:[{scope:"whatsapp_business_messaging",target_ids:["WABA1"]}]}});
 if(url.includes("/message_templates")&&opt.method==="POST"){tpl=[{name:"gt_match_found_v2",status:"PENDING",category:"UTILITY",language:"he"}];return res({id:"T1",status:"PENDING",category:"UTILITY"});}
 if(url.includes("/message_templates"))return res({data:tpl});return res({},false,404);}};}
test("template definition: body matches the code, UTILITY, two quick replies in payload order, regular hyphens only",()=>{const d=templateDefinition();
 assert.equal(d.name,"gt_match_found_v2");assert.equal(d.category,"UTILITY");assert.equal(d.language,"he");assert.equal(d.components[0].text,MATCH_TEMPLATE.body);
 assert.deepEqual(d.components[1].buttons.map(b=>b.text),TEMPLATE_BUTTONS);assert.equal(TEMPLATE_BUTTONS.length,MATCH_TEMPLATE.payloads.length);assert.doesNotMatch(JSON.stringify(d),/[–—]/);});
test("ensureTemplate submits only when missing and never leaks the token",async()=>{const g=graph();const r=await ensureTemplate({token:"SECRET",fetchImpl:g.fetch});
 assert.equal(r.submit.submitted,true);assert.equal(r.after[0].status,"PENDING");assert.equal(g.calls.filter(c=>c.method==="POST").length,1);assert.doesNotMatch(JSON.stringify(r),/SECRET|WABA1/);});
test("ensureTemplate does not re-submit an existing template; check-only never posts",async()=>{const g=graph({existing:[{name:"gt_match_found_v2",status:"APPROVED",category:"UTILITY",language:"he"}]});
 const r=await ensureTemplate({token:"T",fetchImpl:g.fetch});assert.equal(r.submit,undefined);assert.equal(r.before[0].status,"APPROVED");assert.equal(g.calls.filter(c=>c.method==="POST").length,0);
 const g2=graph();const r2=await ensureTemplate({token:"T",submit:false,fetchImpl:g2.fetch});assert.equal(g2.calls.filter(c=>c.method==="POST").length,0);assert.deepEqual(r2.before,[]);});
test("ensureTemplate without token reports not_configured",async()=>{assert.equal((await ensureTemplate({token:""})).error,"not_configured");});
const U="972500000131",sends=[];const okSend=async(to,t)=>{sends.push({to,t:t.name});return{sent:true};};
async function setup(last){const s=memoryStore();await s.set(`profile/${U}`,{userId:U,lastInboundAt:last});return s;}
test("reengage: waits until 24h after the last message, then sends the fixed template exactly once",async()=>{sends.length=0;const s=await setup("2026-09-24T07:52:49Z");
 let r=await reengageTest(s,{suffix:"0131",now:new Date("2026-09-25T07:52:00Z"),sendTemplate:okSend});assert.equal(r.status,"waiting");assert.equal(r.dueAt,"2026-09-25T07:52:49.000Z");assert.equal(sends.length,0);
 r=await reengageTest(s,{suffix:"0131",now:new Date("2026-09-25T08:37:00Z"),sendTemplate:okSend});assert.equal(r.status,"sent");assert.deepEqual(sends,[{to:U,t:"gt_match_found_v2"}]);
 r=await reengageTest(s,{suffix:"0131",now:new Date("2026-09-25T09:37:00Z"),sendTemplate:okSend});assert.equal(r.status,"done");assert.equal(sends.length,1);
 const log=(await s.keys("msg/")).length;assert.equal(log,1);assert.doesNotMatch(JSON.stringify(await s.get("meta/last-reengage")),new RegExp(U));});
test("reengage: a newer message pushes the due time; failed sends retry up to the cap and never mark done",async()=>{const s=await setup("2026-09-24T07:00:00Z");
 await s.set(`profile/${U}`,{userId:U,lastInboundAt:"2026-09-24T20:00:00Z"});let r=await reengageTest(s,{suffix:"0131",now:new Date("2026-09-25T08:00:00Z"),sendTemplate:okSend});assert.equal(r.status,"waiting");
 const fail=async()=>({sent:false,reason:"api_132001"});for(let i=0;i<3;i++)r=await reengageTest(s,{suffix:"0131",maxAttempts:2,now:new Date("2026-09-25T21:00:00Z"),sendTemplate:fail});
 assert.equal(r.status,"gave_up");assert.equal(r.lastReason,"api_132001");});
test("reengage: refuses unless exactly one user matches the suffix",async()=>{const s=memoryStore();await s.set("profile/972500000131",{lastInboundAt:"2026-09-20T00:00:00Z"});await s.set("profile/972500009131",{lastInboundAt:"2026-09-20T00:00:00Z"});
 const r=await reengageTest(s,{suffix:"131",now:new Date(),sendTemplate:okSend});assert.equal(r.status,"no_unique_target");assert.equal(r.matches,2);
 assert.equal((await reengageTest(memoryStore(),{suffix:"0131",now:new Date(),sendTemplate:okSend})).status,"no_unique_target");});
