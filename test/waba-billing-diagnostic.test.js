import test from "node:test";import assert from "node:assert/strict";
import {memoryStore} from "../src/store.js";import {wabaBillingDiagnostic} from "../netlify/functions/waba-billing-diagnostic-background.js";
const r=(body,ok=true,status=200)=>({ok,status,json:async()=>body});
test("billing diagnostic is read-only and redacts token and payment details",async()=>{
 const store=memoryStore();await store.set("meta/waba-id",{id:"123456789"});const calls=[];
 const fetchImpl=async(url,opt)=>{calls.push({url,opt});return url.includes("payment_configurations")?r({data:[{id:"pay1",card_number:"1234",brand:"secret"}]}):r({id:"123456789",name:"GT",currency:"ILS",owner_business_info:{id:"B1",name:"Tom"}})};
 const result=await wabaBillingDiagnostic({store,token:"SECRET",fetchImpl});assert.equal(result.account.owner_business_info.name,"Tom");assert.equal(result.paymentConfigurations.count,1);
 assert.doesNotMatch(JSON.stringify(result),/SECRET|pay1|card_number|1234|brand/);assert.deepEqual(calls.map(x=>x.opt.method||"GET"),["GET","GET"]);
});
