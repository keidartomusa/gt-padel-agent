import {routeIncoming} from './webhook.js';
import {memoryStore} from './store.js';
import {summarizeRouting,LABELS} from './routing-eval.js';
import {venueByKey} from './venues.js';
// Private invocation only. Input examples must be manually redacted and labeled; never checked into this public repo.
export async function evaluateRouting(examples,{availabilityFn,now=new Date()}={}){
 const rows=[];
 for(const example of examples){const {club,label,text,state}=example,venue=venueByKey(club);if(!venue||!LABELS.includes(label)||typeof text!=='string'||!text.trim())throw Error('Invalid labeled example');
  const store=memoryStore(),userId='972500000199';if(state)await store.set(`state/${userId}`,state);let predicted='other';
  // Stop at the first actual route decision. This prevents replay from calling a time LLM, live inventory or sending notifications.
  const stop=Symbol('route-chosen');
  try{await routeIncoming({userId,text,store,venue,now:new Date(example.at||now),availabilityFn:availabilityFn||(async()=>({date:new Date(example.at||now).toISOString().slice(0,10),slots:[]})),routeTrace:route=>{predicted=route;throw stop}})}catch(e){if(e!==stop)throw e}
  rows.push({club,label,predicted});
 }
 return summarizeRouting(rows);
}
