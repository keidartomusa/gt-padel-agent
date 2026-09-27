import test from 'node:test';import assert from 'node:assert/strict';
import {memoryStore} from '../src/store.js';
import {submitReleaseBookingTemplate} from '../netlify/functions/court-booking-submit-background.js';
test('Meta booking template submission is one-time by name and sends no customer message',async()=>{
 const store=memoryStore();await store.set('meta/waba-id',{id:'123456789'});const calls=[];
 const f=async(url,options)=>{calls.push({url,method:options.method||'GET',body:options.body?JSON.parse(options.body):null});return{ok:true,status:200,json:async()=>options.method==='POST'?{id:'template-id',status:'PENDING',category:'UTILITY'}:{data:[]}}};
 const first=await submitReleaseBookingTemplate({store,token:'test',fetchImpl:f});assert.equal(first.submitted,true);assert.equal(first.status,'PENDING');
 assert.equal(calls.length,2);assert.equal(calls[1].body.name,'gt_court_release_book_v1');assert.deepEqual(calls[1].body.components[1].buttons.map(x=>x.type),['URL']);
 assert(calls.every(x=>x.url.includes('message_templates')&&!x.url.includes('/messages')));
 const existing=await submitReleaseBookingTemplate({store,token:'test',fetchImpl:async()=>({ok:true,json:async()=>({data:[{id:'template-id',name:'gt_court_release_book_v1',language:'he',status:'PENDING'}]})})});assert.equal(existing.submitted,undefined);assert.equal(existing.existing.status,'PENDING');
});
