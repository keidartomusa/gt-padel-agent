import test from "node:test";import assert from "node:assert/strict";import {replaceTemplate,TEMPLATE_BUTTONS} from "../src/template.js";
// Tom 24.9 21:04: buttons exactly "כן" / "לא, תודה"; delete the pending submission and resubmit.
const res=(body,ok=true,status=200)=>({ok,status,json:async()=>body});
function meta({status="PENDING",buttons=["כן, שלחו פרטים","לא, תודה"],delOk=true}={}){const calls=[];let tpl=[{id:"H1",name:"gt_match_found",status,category:"UTILITY",language:"he",components:[{type:"BODY",text:"x"},{type:"BUTTONS",buttons:buttons.map(text=>({type:"QUICK_REPLY",text}))}]}];
 return{calls,fetch:async(url,opt={})=>{const m=opt.method||"GET";calls.push({m,url,body:opt.body});if(url.includes("/debug_token"))return res({data:{granular_scopes:[{scope:"whatsapp_business_management",target_ids:["9001"]}]}});
  if(m==="DELETE"){if(!delOk)return res({error:{message:"nope"}},false,400);tpl=[];return res({success:true});}
  if(m==="POST"){const b=JSON.parse(opt.body);tpl=[{id:"H2",name:b.name,status:"PENDING",category:"UTILITY",language:"he",components:b.components}];return res({id:"H2",status:"PENDING",category:"UTILITY"});}
  if(url.includes("/message_templates"))return res({data:tpl});return res({},false,404);}};}
test("buttons are exactly כן / לא, תודה",()=>assert.deepEqual(TEMPLATE_BUTTONS,["כן","לא, תודה"]));
test("replace: deletes the PENDING template by id, resubmits with the new buttons",async()=>{const g=meta();const r=await replaceTemplate({token:"T",fetchImpl:g.fetch});
 assert.equal(r.deleted,true);assert.equal(r.submit.submitted,true);assert.deepEqual(r.after[0].buttons,["כן","לא, תודה"]);const del=g.calls.find(c=>c.m==="DELETE");assert.match(del.url,/name=gt_match_found&hsm_id=H1/);
 assert.ok(g.calls.findIndex(c=>c.m==="DELETE")<g.calls.findIndex(c=>c.m==="POST"));assert.doesNotMatch(JSON.stringify(r),/"T"|9001/);});
test("replace: refuses to delete an APPROVED template (30-day name lock)",async()=>{const g=meta({status:"APPROVED"});const r=await replaceTemplate({token:"T",fetchImpl:g.fetch});
 assert.equal(r.error,"refuse_delete_APPROVED");assert.equal(g.calls.filter(c=>c.m!=="GET").length,0);});
test("replace: no-op when live buttons already match; failed delete never resubmits",async()=>{const g=meta({buttons:["כן","לא, תודה"]});const r=await replaceTemplate({token:"T",fetchImpl:g.fetch});
 assert.equal(r.skipped,"buttons_already_match");assert.equal(g.calls.filter(c=>c.m!=="GET").length,0);
 const g2=meta({delOk:false});const r2=await replaceTemplate({token:"T",fetchImpl:g2.fetch});assert.equal(r2.error,"nope");assert.equal(g2.calls.filter(c=>c.m==="POST").length,0);});
