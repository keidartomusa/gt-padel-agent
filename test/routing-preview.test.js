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
test('preview functions fail closed by default, and the build stamp is context-specific',async()=>{
 assert.equal(routingLabelPage().status,404);
 const reply=await routingLabelApi(new Request('https://example.invalid/.netlify/functions/routing-label-api'),null,{sources:{gt:{list(){throw Error('store touched')}}},labels:{get(){throw Error('label touched')}}});assert.equal(reply.status,404);
 const {previewBranch}=await import('../scripts/stamp-preview.js');
 for(const [context,branch,expected] of [['production','master',false],['deploy-preview','feat/routing-label-private-preview',false],['branch-deploy','wrong',false],['branch-deploy','feat/routing-label-private-preview',true]])assert.equal(previewBranch(context,branch),expected);
 assert.match(readFileSync(new URL('../netlify.toml',import.meta.url),'utf8'),/command = "node scripts\/stamp-preview\.js"/);
 assert.match(readFileSync(new URL('../src/preview-build.js',import.meta.url),'utf8'),/PREVIEW_BUILD = false/);
});
test('preview-only runtime code exposes a source list capability and a deploy-scoped label store',()=>{
 const code=readFileSync(new URL('../preview-functions/routing-label-api.js',import.meta.url),'utf8');
 assert.match(code,/getDeployStore\(/);assert.match(code,/Object\.freeze\(\{list:prefix=>source\.list\(prefix\)\}\)/);
 assert.doesNotMatch(code,/source\.set\(|source\.delete\(/);
});
