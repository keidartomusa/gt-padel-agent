import {candidateId,pilotCandidates} from './pilot-routing.js';
import {LABELS} from './routing-eval.js';
import {evaluateRouting} from './routing-eval-runner.js';
export const LABEL_STORE_KEY='routing-eval/labels-v1';
export const LABEL_LIMIT=45;
export function labelSecret(env=process.env){return env.ROUTING_EVAL_SECRET||env.ADMIN_DASHBOARD_TOKEN||null;}
export async function loadQueue(stores,labelStore,{secret=labelSecret(),limit=LABEL_LIMIT}={}){
 if(!secret)throw Error('Missing label secret');const mined=await pilotCandidates(stores,{secret});
 const saved=await labelStore.get(LABEL_STORE_KEY)||{},sample=mined.items.slice(0,limit);
 const items=sample.map(x=>({...x,label:LABELS.includes(saved[x.id]?.label)?saved[x.id].label:null,needsContext:saved[x.id]?.needsContext===true}));
 return {eligible:mined.eligible,sourceCounts:mined.sourceCounts,total:items.length,done:items.filter(x=>x.label).length,items};
}
export async function saveLabel(labelStore,{id,label,needsContext=false},queue){
 if(!/^[0-9a-f]{32}$/.test(String(id))||!queue.items.some(x=>x.id===id))throw Error('Unknown example');
 if(label!==null&&!LABELS.includes(label))throw Error('Invalid label');
 const saved=await labelStore.get(LABEL_STORE_KEY)||{};
 if(label===null&&!needsContext)delete saved[id];else saved[id]={label,needsContext:Boolean(needsContext),updatedAt:new Date().toISOString()};
 await labelStore.set(LABEL_STORE_KEY,saved);return {id,label,needsContext:Boolean(needsContext)};
}
export async function evaluateQueue(queue,{availabilityFn}={}){
 const examples=queue.items.filter(x=>x.label&&!x.needsContext).flatMap(x=>x.clubs.map(club=>({club,label:x.label,text:x.text,at:x.at})));
 const result=await evaluateRouting(examples,{availabilityFn});
 // One scored unit per labeled phrase, even if the same phrase appeared in multiple clubs.
 const first=[];const seen=new Set();for(const e of examples){const id=candidateId('pooled',e.text);if(seen.has(id))continue;seen.add(id);first.push(e);}
 const pooled=(await evaluateRouting(first,{availabilityFn})).pooled;
 return {pooled,byClub:result.byClub,labeled:queue.done,scored:pooled.n,eligible:queue.eligible};
}
