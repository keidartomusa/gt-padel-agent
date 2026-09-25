import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {resolve} from "node:path";
import {MATCH_TEMPLATE} from "../src/notify.js";
import {sendTemplate} from "../src/whatsapp.js";

const root=resolve(fileURLToPath(new URL("..",import.meta.url)));
const sourceFiles=["src","netlify/functions"].flatMap(dir=>readdirSync(resolve(root,dir)).filter(name=>name.endsWith(".js")).map(name=>`${dir}/${name}`));
test("one-off reengagement target and scheduled test cannot return to production",()=>{
 for(const file of sourceFiles){const content=readFileSync(resolve(root,file),"utf8");
  assert.doesNotMatch(content,/4031|reengage[-_]?test|last[-_]?reengage|reengage[-_]?check|template[-_]?retry|(?<!court-)template[-_]?submit[-_]?background|template[-_]?replace/ ,file);
 }
 assert.ok(!sourceFiles.includes("netlify/functions/reengage-check.js"));
 assert.ok(!sourceFiles.includes("netlify/functions/template-retry.js"));
});
test("production match template still uses the approved name and quick-reply payloads",async()=>{
 assert.equal(MATCH_TEMPLATE.name,"gt_match_found_v2");
 assert.deepEqual(MATCH_TEMPLATE.payloads,["pending_yes","pending_no"]);
 const calls=[];const prior=process.env.DISABLE_OUTBOUND,priorToken=process.env.WHATSAPP_ACCESS_TOKEN;
 try{process.env.DISABLE_OUTBOUND="false";process.env.WHATSAPP_ACCESS_TOKEN="TEST_TOKEN";
  const r=await sendTemplate("972500000131",MATCH_TEMPLATE.name,MATCH_TEMPLATE.language,MATCH_TEMPLATE.payloads,"123456789",async(url,opt)=>{calls.push({url,body:JSON.parse(opt.body)});return{ok:true,json:async()=>({messages:[{id:"test"}]})}});
  assert.equal(r.sent,true);assert.equal(calls.length,1);
  assert.deepEqual(calls[0].body.template.components.map(x=>x.parameters[0].payload),MATCH_TEMPLATE.payloads);
  assert.equal(calls[0].body.template.name,MATCH_TEMPLATE.name);
 }finally{if(prior===undefined)delete process.env.DISABLE_OUTBOUND;else process.env.DISABLE_OUTBOUND=prior;if(priorToken===undefined)delete process.env.WHATSAPP_ACCESS_TOKEN;else process.env.WHATSAPP_ACCESS_TOKEN=priorToken;}
});
