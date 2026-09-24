import test from "node:test";import assert from "node:assert/strict";import {replaceTemplate,TEMPLATE_BUTTONS} from "../src/template.js";
// Tom 24.9 21:04: buttons exactly "כן" / "לא, תודה"; delete the pending submission and resubmit.
const res=(body,ok=true,status=200)=>({ok,status,json:async()=>body});
function meta({status="PENDING",buttons=["כן, שלחו פרטים","לא, תודה"],delOk=true}={}){const calls=[];let tpl=[{id:"H1",name:"gt_match_found_v2",status,category:"UTILITY",language:"he",components:[{type:"BODY",text:"x"},{type:"BUTTONS",buttons:buttons.map(text=>({type:"QUICK_REPLY",text}))}]}];
 return{calls,fetch:async(url,opt={})=>{const m=opt.method||"GET";calls.push({m,url,body:opt.body});if(url.includes("/debug_token"))return res({data:{granular_scopes:[{scope:"whatsapp_business_management",target_ids:["9001"]}]}});
  if(m==="DELETE"){if(!delOk)return res({error:{message:"nope"}},false,400);tpl=[];return res({success:true});}
  if(m==="POST"){const b=JSON.parse(opt.body);tpl=[{id:"H2",name:b.name,status:"PENDING",category:"UTILITY",language:"he",components:b.components}];return res({id:"H2",status:"PENDING",category:"UTILITY"});}
  if(url.includes("/message_templates"))return res({data:tpl});return res({},false,404);}};}
test("buttons are exactly כן / לא, תודה",()=>assert.deepEqual(TEMPLATE_BUTTONS,["כן","לא, תודה"]));
test("replace: deletes the PENDING template by id, resubmits with the new buttons",async()=>{const g=meta();const r=await replaceTemplate({token:"T",fetchImpl:g.fetch});
 assert.equal(r.deleted,true);assert.equal(r.submit.submitted,true);assert.deepEqual(r.after[0].buttons,["כן","לא, תודה"]);const del=g.calls.find(c=>c.m==="DELETE");assert.match(del.url,/name=gt_match_found_v2&hsm_id=H1/);
 assert.ok(g.calls.findIndex(c=>c.m==="DELETE")<g.calls.findIndex(c=>c.m==="POST"));assert.doesNotMatch(JSON.stringify(r),/"T"|9001/);});
test("replace: refuses to delete an APPROVED template (30-day name lock)",async()=>{const g=meta({status:"APPROVED"});const r=await replaceTemplate({token:"T",fetchImpl:g.fetch});
 assert.equal(r.error,"refuse_delete_APPROVED");assert.equal(g.calls.filter(c=>c.m!=="GET").length,0);});
test("replace: no-op when live buttons already match; failed delete never resubmits",async()=>{const g=meta({buttons:["כן","לא, תודה"]});const r=await replaceTemplate({token:"T",fetchImpl:g.fetch});
 assert.equal(r.skipped,"buttons_already_match");assert.equal(g.calls.filter(c=>c.m!=="GET").length,0);
 const g2=meta({delOk:false});const r2=await replaceTemplate({token:"T",fetchImpl:g2.fetch});assert.equal(r2.error,"nope");assert.equal(g2.calls.filter(c=>c.m==="POST").length,0);});
import {memoryStore} from "../src/store.js";import {retryTemplateIfNeeded} from "../src/template.js";
test("after a replace blocked by 'being deleted', the retry job resubmits once the template is gone",async()=>{const s=memoryStore();const g=meta();
 await s.set("meta/waba-id",{id:"9001"});await s.set("meta/last-template",{op:"replace",deleted:true,error:"You can't change the category for this message template while the existing Hebrew content is being deleted. Try again in less than 1 minute",after:[]});
 const gone={calls:[],fetch:async(url,opt={})=>{if((opt.method||"GET")==="GET"&&url.includes("/message_templates")&&!gone.posted)return res({data:[]});if(opt.method==="POST")gone.posted=true;return g.fetch(url,opt);}};
 const r=await retryTemplateIfNeeded(s,{token:"T",fetchImpl:gone.fetch});assert.equal(r.retried,true);assert.equal(r.result.submit.submitted,true);
 assert.equal((await retryTemplateIfNeeded(s,{token:"T",fetchImpl:gone.fetch})).retried,false);});
test("a failed submit surfaces as top-level error so the retry job keeps trying, capped at 36 attempts",async()=>{const s=memoryStore();await s.set("meta/waba-id",{id:"9001"});
 const blocked=async(url,opt={})=>{if(url.includes("/debug_token"))return res({data:{granular_scopes:[{scope:"whatsapp_business_management",target_ids:["9001"]}]}});if(opt.method==="POST")return res({error:{message:"content is being deleted. Try again"}},false,400);return res({data:[]});};
 await s.set("meta/last-template",{error:"x is being deleted",after:[]});let n=0;for(let i=0;i<40;i++){const r=await retryTemplateIfNeeded(s,{token:"T",fetchImpl:blocked});if(r.retried)n++;}
 assert.equal(n,36);assert.match((await s.get("meta/last-template")).error,/being deleted/);});
