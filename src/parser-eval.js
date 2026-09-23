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
// Tom 23.9: Jev verifies gpt. Both run in parallel per message; agreement on date+start = answer,
// disagreement (or Jev confidence under the threshold) = ask the user. Wrong answers are the number that matters.
export async function evalCombo(gpt,jev,corpus,{today,concurrency=6,timeoutMs=15000,thresholds=[0,0.5,0.7,0.9]}={}){
 const rows=[];let i=0;const tok={openai:{input:0,output:0},jev:{input:0,output:0}};
 const call=async(name,ad,text)=>{const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),timeoutMs),t0=Date.now();try{const p=await ad(text,today,{signal:ctl.signal,onUsage:u=>{tok[name].input+=u.input;tok[name].output+=u.output;}});return{p,ms:Date.now()-t0};}catch(e){return{err:String(e?.message||e),ms:Date.now()-t0};}finally{clearTimeout(t);}};
 async function worker(){while(i<corpus.length){const [text,date,start]=corpus[i++],t0=Date.now();const [g,j]=await Promise.all([call("openai",gpt,text),call("jev",jev,text)]);
  const agree=!g.err&&!j.err&&g.p.date!=null&&g.p.date===j.p.date&&g.p.startMinute===j.p.startMinute;
  rows.push({text,ms:Date.now()-t0,agree,correct:agree&&g.p.date===date&&g.p.startMinute===start,conf:j.p?.confidence??0,g:g.p&&[g.p.date,g.p.startMinute],j:j.p&&[j.p.date,j.p.startMinute],want:[date,start]});}}
 await Promise.all(Array.from({length:concurrency},worker));
 const ms=rows.map(r=>r.ms),cost=(tok.openai.input*PRICES.openai.input+tok.openai.output*PRICES.openai.output+tok.jev.input*PRICES.jev.input+tok.jev.output*PRICES.jev.output)/1e6;
 const byThreshold=thresholds.map(th=>{const ans=rows.filter(r=>r.agree&&r.conf>=th);return{jevConfidenceMin:th,answered:ans.length,answeredCorrect:ans.filter(r=>r.correct).length,wrongAnswers:ans.filter(r=>!r.correct).length,askedUser:rows.length-ans.length};});
 return{provider:"combo",n:rows.length,agree:rows.filter(r=>r.agree).length,byThreshold,latencyMs:{p50:pct(ms,0.5),p95:pct(ms,0.95),max:Math.max(...ms)},tokens:tok,costUsd:Number(cost.toFixed(6)),costPer1kMessagesUsd:Number((cost/rows.length*1000).toFixed(4)),
  misses:rows.filter(r=>r.agree&&!r.correct).map(r=>({text:r.text,want:r.want,got:r.g,conf:r.conf,wrongAgree:true})).concat(rows.filter(r=>!r.agree).map(r=>({text:r.text,want:r.want,gpt:r.g,jev:r.j})))};}
// The production pipeline itself (local first, combo fallback, 0.8 gate). Wrong answers are what users would see.
export async function evalHybrid(parse,corpus,now,{concurrency=6}={}){const rows=[];let i=0;
 async function worker(){while(i<corpus.length){const [text,date,start]=corpus[i++],t0=Date.now();const p=await parse(text,now,{log:false});const asked=!!(p.needsClarification||p.ambiguousHour);rows.push({text,ms:Date.now()-t0,source:p.source,asked,correct:!asked&&p.date===date&&p.startMinute===start,got:[p.date,p.startMinute],want:[date,start]});}}
 await Promise.all(Array.from({length:concurrency},worker));const ms=rows.map(r=>r.ms),src={};for(const r of rows)src[r.source]=(src[r.source]||0)+1;
 return{provider:"hybrid",n:rows.length,answered:rows.filter(r=>!r.asked).length,answeredCorrect:rows.filter(r=>r.correct).length,wrongAnswers:rows.filter(r=>!r.asked&&!r.correct).length,askedUser:rows.filter(r=>r.asked).length,sources:src,latencyMs:{p50:pct(ms,0.5),p95:pct(ms,0.95),max:Math.max(...ms)},
  misses:rows.filter(r=>!r.correct).map(r=>({text:r.text,want:r.want,got:r.got,source:r.source,asked:r.asked||undefined}))};}
