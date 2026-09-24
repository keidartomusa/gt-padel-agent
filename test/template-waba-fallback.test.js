import test from "node:test";import assert from "node:assert/strict";
import {memoryStore} from "../src/store.js";import {ensureTemplate,retryTemplateIfNeeded} from "../src/template.js";import {rememberWaba} from "../netlify/functions/whatsapp.js";
// 24.9 regression: first live run returned no_waba - the system-user token's debug scopes carried no target_ids.
const res=(body,ok=true,status=200)=>({ok,status,json:async()=>body});
function graph({businesses=[]}={}){const calls=[];return{calls,fetch:async(url,opt={})=>{calls.push({url,method:opt.method||"GET"});
 if(url.includes("/debug_token"))return res({data:{type:"SYSTEM_USER",granular_scopes:[{scope:"whatsapp_business_management"},{scope:"whatsapp_business_messaging"}]}});
 if(url.includes("/me/businesses"))return res({data:businesses});
 if(url.includes("/message_templates")&&opt.method==="POST")return res({id:"T1",status:"PENDING",category:"UTILITY"});
 if(url.includes("/message_templates"))return res({data:[]});return res({},false,404);}};}
test("no target_ids: falls back to the single WABA visible through businesses",async()=>{const g=graph({businesses:[{owned_whatsapp_business_accounts:{data:[{id:"111222333"}]}}]});
 const r=await ensureTemplate({token:"SECRET",fetchImpl:g.fetch});assert.equal(r.wabaSource,"businesses");assert.equal(r.submit.submitted,true);
 assert.ok(g.calls.some(c=>c.method==="POST"&&c.url.includes("/111222333/message_templates")));assert.doesNotMatch(JSON.stringify(r),/SECRET|111222333/);assert.equal(r.diag.tokenType,"SYSTEM_USER");});
test("no target_ids and no businesses: uses the WABA id recorded from webhooks; without it reports no_waba and posts nothing",async()=>{
 const g=graph();const r=await ensureTemplate({token:"T",fetchImpl:g.fetch,wabaHint:"444555666"});assert.equal(r.wabaSource,"webhook");assert.ok(g.calls.some(c=>c.method==="POST"&&c.url.includes("/444555666/")));
 const g2=graph();const r2=await ensureTemplate({token:"T",fetchImpl:g2.fetch});assert.equal(r2.error,"no_waba");assert.equal(g2.calls.filter(c=>c.method==="POST").length,0);assert.deepEqual(r2.diag.scopes,["whatsapp_business_management","whatsapp_business_messaging"]);});
test("two WABAs through businesses and no hint: refuses (multiple_waba) instead of guessing",async()=>{const g=graph({businesses:[{owned_whatsapp_business_accounts:{data:[{id:"1111111"},{id:"2222222"}]}}]});
 const r=await ensureTemplate({token:"T",fetchImpl:g.fetch});assert.equal(r.error,"multiple_waba");assert.equal(g.calls.filter(c=>c.method==="POST").length,0);});
test("rememberWaba stores entry.id from WhatsApp webhooks only, and only numeric ids",async()=>{const s=memoryStore();
 assert.equal(await rememberWaba(s,{object:"page",entry:[{id:"999999"}]}),null);assert.equal(await rememberWaba(s,{object:"whatsapp_business_account",entry:[{id:"abc"}]}),null);assert.equal(await s.get("meta/waba-id"),null);
 assert.equal(await rememberWaba(s,{object:"whatsapp_business_account",entry:[{id:"123456789"}]}),"123456789");assert.equal((await s.get("meta/waba-id")).id,"123456789");});
test("retryTemplateIfNeeded: only after no_waba and only once a webhook recorded the WABA id",async()=>{const s=memoryStore();const g=graph();
 assert.equal((await retryTemplateIfNeeded(s,{token:"T",fetchImpl:g.fetch})).retried,false);
 await s.set("meta/last-template",{error:"no_waba"});assert.equal((await retryTemplateIfNeeded(s,{token:"T",fetchImpl:g.fetch})).retried,false);
 await s.set("meta/waba-id",{id:"777888999"});const r=await retryTemplateIfNeeded(s,{token:"T",fetchImpl:g.fetch});assert.equal(r.retried,true);assert.equal(r.result.submit.submitted,true);
 assert.equal((await retryTemplateIfNeeded(s,{token:"T",fetchImpl:g.fetch})).retried,false);assert.equal(g.calls.filter(c=>c.method==="POST").length,1);});
test("while PENDING the retry job only refreshes status (GET), never posts; stops once APPROVED",async()=>{const s=memoryStore();let status="PENDING";const calls=[];
 const f=async(url,opt={})=>{calls.push(opt.method||"GET");if(url.includes("/debug_token"))return res({data:{granular_scopes:[{scope:"whatsapp_business_management"}]}});if(url.includes("/me/businesses"))return res({data:[]});if(url.includes("/message_templates"))return res({data:[{name:"gt_match_found_v2",status,category:"UTILITY",language:"he"}]});return res({},false,404);};
 await s.set("meta/waba-id",{id:"777888999"});await s.set("meta/last-template",{error:null,submit:{submitted:true,id:"T1"},after:[{name:"gt_match_found_v2",status:"PENDING"}]});
 let r=await retryTemplateIfNeeded(s,{token:"T",fetchImpl:f});assert.equal(r.status,"PENDING");status="APPROVED";r=await retryTemplateIfNeeded(s,{token:"T",fetchImpl:f});assert.equal(r.status,"APPROVED");
 const last=await s.get("meta/last-template");assert.equal(last.submit.id,"T1");assert.equal(last.current[0].status,"APPROVED");
 const n=calls.length;r=await retryTemplateIfNeeded(s,{token:"T",fetchImpl:f});assert.equal(r.checked,undefined);assert.equal(calls.length,n);assert.ok(!calls.includes("POST"));});
