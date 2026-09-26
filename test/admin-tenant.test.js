import test from 'node:test';
import assert from 'node:assert/strict';
import admin from '../netlify/functions/admin.js';
import saarAdmin from '../netlify/functions/admin-saar.js';
import smashAdmin from '../netlify/functions/admin-smash.js';
import {dashboardVenue,dashboardSecret,dashboardGate} from '../src/admin-tenant.js';
import {GT_VENUE,SAAR_VENUE,SMASH_VENUE} from '../src/venues.js';
import {memoryStore} from '../src/store.js';

const env={ADMIN_DASHBOARD_TOKEN:'gt-secret',ADMIN_SAAR_TOKEN:'saar-secret',ADMIN_SMASH_TOKEN:'smash-secret'};
test('separate club homes show only that club and use isolated browser sessions and API params',async()=>{
 for(const [route,venue] of [['/admin',GT_VENUE],['/admin/saar',SAAR_VENUE],['/admin/smash',SMASH_VENUE]]){
  const req=new Request('https://gtpadel.netlify.app'+route);
  assert.equal(dashboardVenue(req.url),venue);
  const handler=venue===SAAR_VENUE?saarAdmin:venue===SMASH_VENUE?smashAdmin:admin;const html=await(await handler(req)).text();
  assert.ok(html.includes(venue.dashboardName||venue.name));
  assert.match(html,new RegExp(`var VENUE='${venue.key}'`));
  assert.match(html,/fetch\('\/.netlify\/functions\/admin-data\?venue='\+VENUE/);
  assert.match(html,/q\.slice\(1\)/);
  assert.match(html,/sessionStorage\.getItem\('club-admin-token-'\+VENUE\)/);
  assert.doesNotMatch(html,/saar-secret|smash-secret|gt-secret/);
  if(venue!==GT_VENUE)assert.doesNotMatch(html,/GT PADEL|gt-admin-token|GT Padel/);
  const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];for(const m of scripts)assert.doesNotThrow(()=>new Function(m[1]));
 }
 assert.equal(dashboardVenue('https://gtpadel.netlify.app/admin/other'),null);
 const gtWithContext=await(await admin(new Request('https://gtpadel.netlify.app/.netlify/functions/admin'),{geo:{city:'somewhere'}})).text();
 assert.match(gtWithContext,/<title>גני תקווה - מערכת ניהול<\/title>/);
 assert.match(gtWithContext,/var VENUE='gt'/);
 for(const [handler,key] of [[saarAdmin,'saar'],[smashAdmin,'smash']]){const h=await(await handler(new Request('https://gtpadel.netlify.app/.netlify/functions/admin-'+key))).text();assert.match(h,new RegExp(`var VENUE='${key}'`));}
});
test('wrong club password never unlocks another club, and missing password fails closed',async()=>{
 const store=memoryStore();for(const venue of [GT_VENUE,SAAR_VENUE,SMASH_VENUE]){
  for(const wrong of Object.values(env).filter(x=>x!==dashboardSecret(venue,env))){
   const req=new Request('https://x',{headers:{authorization:`Bearer ${wrong}`,'x-nf-client-connection-ip':'1.1.1.1'}});
   assert.equal((await dashboardGate(req,{},venue,{store,env})).status,401);
  }
  const good=new Request('https://x',{headers:{authorization:`Bearer ${dashboardSecret(venue,env)}`,'x-nf-client-connection-ip':'1.1.1.1'}});
  assert.equal(await dashboardGate(good,{},venue,{store,env}),null);
 }
 const missing=new Request('https://x',{headers:{authorization:'Bearer gt-secret'}});
 assert.equal((await dashboardGate(missing,{},SAAR_VENUE,{store:memoryStore(),env:{ADMIN_DASHBOARD_TOKEN:'gt-secret'}})).status,401);
});
