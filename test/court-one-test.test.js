import test from 'node:test';
import assert from 'node:assert/strict';
import {sendOneCourtTest} from '../netlify/functions/court-template-one-test-background.js';
function store(status='APPROVED'){
 const entries=new Map([['meta/court-template',{current:{status,name:'gt_court_release_v1'}}]]);
 return{get:async key=>entries.get(key),setJSON:async(key,value,opt)=>{if(opt?.onlyIfNew&&entries.has(key))return{modified:false};entries.set(key,value);return{modified:true}},entries};
}
test('approved test sends exact one template with fixed recipient and four approved fields',async()=>{
 process.env.COURT_TEMPLATE_TEST_RECIPIENT='972500000131';
 const db=store(),calls=[];const send=async(...args)=>(calls.push(args),{sent:true,data:{messages:[{id:'wamid-test',message_status:'accepted'}]}});
 const first=await sendOneCourtTest({store:db,send});
 assert.equal(first.ok,true);assert.equal(first.providerMessageId,'wamid-test');
 assert.deepEqual(calls,[['972500000131','gt_court_release_v1','he',['גני תקווה','27.9.2026','20:00','21:30']]]);
 assert.equal((await sendOneCourtTest({store:db,send})).reason,'already_claimed');assert.equal(calls.length,1);
});
test('unapproved template or provider failure never retries',async()=>{
 process.env.COURT_TEMPLATE_TEST_RECIPIENT='972500000131';
 const denied=store('PENDING');let sends=0;assert.equal((await sendOneCourtTest({store:denied,send:async()=>{sends++}})).reason,'template_not_approved');assert.equal(sends,0);
 const db=store();assert.equal((await sendOneCourtTest({store:db,send:async()=>{sends++;return{sent:false,reason:'api_error_400'}}})).ok,false);
 assert.equal((await sendOneCourtTest({store:db,send:async()=>{sends++}})).reason,'already_claimed');assert.equal(sends,1);
});
