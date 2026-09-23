// Runs the when-corpus against each provider adapter directly (raw model accuracy, no local fallback) and returns
// accuracy, latency and token cost. Results go to the function log; nothing is shown in the dashboard (Tom 23.9).
import { parseIntentLocal } from "./intent.js";
// USD per 1M tokens. Keep in sync with provider pricing pages; the report prints the rates it used.
export const PRICES={openai:{input:0.15,output:0.60},jev:{input:0.042,output:0}};
const pct=(xs,p)=>{if(!xs.length)return null;const s=[...xs].sort((a,b)=>a-b);return s[Math.min(s.length-1,Math.floor(p*s.length))];};
export async function evalProvider(name,adapter,corpus,{today,concurrency=6,timeoutMs=15000,fetchImpl=fetch}={}){
 const rows=[];let i=0;const usage={input:0,output:0};let model=null;
 async function worker(){while(i<corpus.length){const [text,date,start]=corpus[i++];const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),timeoutMs),t0=Date.now();
  try{const p=await adapter(text,today,{fetchImpl,signal:ctl.signal,onUsage:u=>{usage.input+=u.input;usage.output+=u.output;model=u.model||model;}});rows.push({text,ms:Date.now()-t0,date:p.date,start:p.startMinute,clar:p.needs_clarification,dateOk:p.date===date,startOk:p.startMinute===start});}
  catch(e){rows.push({text,ms:Date.now()-t0,error:String(e?.name==="AbortError"?"timeout":e?.message||e).slice(0,160),dateOk:false,startOk:false});}finally{clearTimeout(t);}}}
 await Promise.all(Array.from({length:concurrency},worker));
 const ms=rows.filter(r=>!r.error).map(r=>r.ms),price=PRICES[name]||{input:0,output:0},cost=(usage.input*price.input+usage.output*price.output)/1e6;
 return{provider:name,model,n:corpus.length,dateCorrect:rows.filter(r=>r.dateOk).length,startCorrect:rows.filter(r=>r.startOk).length,bothCorrect:rows.filter(r=>r.dateOk&&r.startOk).length,errors:rows.filter(r=>r.error).length,
  latencyMs:{p50:pct(ms,0.5),p95:pct(ms,0.95),max:ms.length?Math.max(...ms):null},tokens:usage,priceUsdPerM:price,costUsd:Number(cost.toFixed(6)),costPer1kMessagesUsd:Number((cost/corpus.length*1000).toFixed(4)),
  misses:rows.filter(r=>!(r.dateOk&&r.startOk)).map(r=>{const c=corpus.find(x=>x[0]===r.text);return{text:r.text,want:[c[1],c[2]],got:[r.date??null,r.start??null],clar:r.clar||undefined,error:r.error};})};}
export function evalLocal(corpus,now){const rows=corpus.map(([t,d,s])=>{const p=parseIntentLocal(t,now);return p.date===d&&p.startMinute===s;});return{provider:"local",n:corpus.length,bothCorrect:rows.filter(Boolean).length};}
