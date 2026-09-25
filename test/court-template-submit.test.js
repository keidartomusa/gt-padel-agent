import test from "node:test";
import assert from "node:assert/strict";
import {memoryStore} from "../src/store.js";
import {releaseTemplateDefinition} from "../src/court-release.js";
import {submitCourtTemplate} from "../netlify/functions/court-template-submit-background.js";
const response=(data,ok=true,status=200)=>({ok,status,json:async()=>data});
test("submission refuses missing token or unverified WABA hint",async()=>{
 const s=memoryStore();assert.equal((await submitCourtTemplate({store:s,token:""})).error,"not_configured");
 assert.equal((await submitCourtTemplate({store:s,token:"T"})).error,"no_waba_hint");
});
test("check first, submit exact reviewed payload once, never leak token or WABA",async()=>{
 const s=memoryStore();await s.set("meta/waba-id",{id:"123456789"});let existing=[],posts=[];
 const fetchImpl=async(url,opt)=>{if(opt.method==="POST"){posts.push(JSON.parse(opt.body));existing=[{id:"T1",name:"gt_court_release_v1",status:"PENDING",category:"UTILITY",language:"he"}];return response({id:"T1",status:"PENDING",category:"UTILITY"})}return response({data:existing})};
 const first=await submitCourtTemplate({store:s,token:"SECRET",fetchImpl});assert.equal(first.submitted,true);
 assert.deepEqual(posts,[releaseTemplateDefinition()]);assert.doesNotMatch(JSON.stringify(first),/SECRET|123456789/);
 const next=await submitCourtTemplate({store:s,token:"SECRET",fetchImpl});assert.equal(next.existing[0].status,"PENDING");assert.equal(posts.length,1);
});
test("read-only status refresh observes Meta category and approval without resubmitting",async()=>{
 const {refreshCourtTemplate}=await import("../netlify/functions/court-template-submit-background.js");
 const s=memoryStore();await s.set("meta/waba-id",{id:"123456789"});await s.set("meta/court-template",{name:"gt_court_release_v1",status:"PENDING"});
 let calls=[];const fetchImpl=async(url,opt)=>{calls.push({url,method:opt.method||"GET"});return response({data:[{id:"T1",name:"gt_court_release_v1",status:"APPROVED",category:"MARKETING",language:"he"}]})};
 const r=await refreshCourtTemplate({store:s,token:"SECRET",fetchImpl});assert.equal(r.current.status,"APPROVED");assert.equal(r.current.category,"MARKETING");assert.deepEqual(calls.map(x=>x.method),["GET"]);assert.doesNotMatch(JSON.stringify(await s.get("meta/court-template")),/SECRET|123456789/);
 const next=await refreshCourtTemplate({store:s,token:"SECRET",fetchImpl});assert.equal(next.checked,false);assert.equal(calls.length,1);
});
