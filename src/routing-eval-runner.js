import {routeIncoming} from './webhook.js';
import {memoryStore} from './store.js';
import {scoreRoutes,LABELS} from './routing-eval.js';
import {venueByKey} from './venues.js';
// Private invocation only. Input examples must be manually redacted and labeled; never checked into this public repo.
export async function evaluateRouting(examples,{availabilityFn,now=new Date()}={}){
 const byClub={};for(const key of ['gt','saar','smash'])byClub[key]=[];
 for(const example of examples){const {club,label,text,state}=example,venue=venueByKey(club);if(!venue||!LABELS.includes(label)||typeof text!=='string'||!text.trim())throw Error('Invalid labeled example');
  const store=memoryStore(),userId='972500000199';if(state)await store.set(`state/${userId}`,state);let predicted='other';
  await routeIncoming({userId,text,store,venue,now:new Date(example.at||now),availabilityFn:availabilityFn||(async()=>({slots:[]})),routeTrace:route=>{predicted=route}});
  byClub[club].push({label,predicted});
 }
 return Object.fromEntries(Object.entries(byClub).map(([club,rows])=>[club,scoreRoutes(rows)]));
}
