import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import {memoryStore} from '../src/store.js';
import {routingLabelApi} from '../preview-functions/routing-label-api.js';
import {routingLabelPage} from '../preview-functions/routing-label.js';
const names=readdirSync(new URL('../preview-functions/',import.meta.url)).sort();
test('private branch deploy contains only the label page and API, no webhook, admin or background jobs',()=>{
 assert.deepEqual(names,['routing-label-api.js','routing-label.js']);
 const cfg=readFileSync(new URL('../netlify.toml',import.meta.url),'utf8');
 assert.match(cfg,/functions = "preview-functions"/);assert.doesNotMatch(cfg,/api\/webhooks\/whatsapp|deploy-succeeded/);
});
test('private preview rejects non-preview contexts before touching stores',async()=>{
 const oldContext=process.env.CONTEXT,oldBranch=process.env.BRANCH;
 try{for(const [context,branch] of [['production','master'],['deploy-preview','feat/routing-label-private-preview'],['branch-deploy','wrong']]){
  process.env.CONTEXT=context;process.env.BRANCH=branch;
  assert.equal(routingLabelPage().status,404);
  const reply=await routingLabelApi(new Request('https://example.invalid/.netlify/functions/routing-label-api'),null,{sources:{gt:{list(){throw Error('store touched')}}},labels:{get(){throw Error('label touched')}}});assert.equal(reply.status,404);
 }}finally{if(oldContext===undefined)delete process.env.CONTEXT;else process.env.CONTEXT=oldContext;if(oldBranch===undefined)delete process.env.BRANCH;else process.env.BRANCH=oldBranch}
});
test('preview reads only the source list capability; label writes stay in the separate preview store',async()=>{
 const oldContext=process.env.CONTEXT,oldBranch=process.env.BRANCH;process.env.CONTEXT='branch-deploy';process.env.BRANCH='feat/routing-label-private-preview';
 try{const gt=memoryStore(),labels=memoryStore();await gt.set('msg/a/1',{direction:'in',kind:'user',type:'text',body:'יש מגרש מחר בערב?',at:'2026-09-29T18:00:00+03:00'});
  const readonly={list:prefix=>gt.list(prefix)},opts={sources:{gt:readonly,saar:{list:async()=>[]},smash:{list:async()=>[]}},labels,secret:'opaque-test',adminSecret:'pw'};
  assert.equal(routingLabelPage().status,200);
  const request=new Request('https://example.invalid/.netlify/functions/routing-label-api',{headers:{authorization:'Bearer pw'}});
  const reply=await routingLabelApi(request,{ip:'test'},opts);assert.equal(reply.status,200);const body=await reply.json();assert.equal(body.total,1);assert.equal(body.score.pooled.accuracy,null);
  assert.equal((await gt.list('routing-eval/')).length,0);
 }finally{if(oldContext===undefined)delete process.env.CONTEXT;else process.env.CONTEXT=oldContext;if(oldBranch===undefined)delete process.env.BRANCH;else process.env.BRANCH=oldBranch}
});
