// Background function (15 min limit): corpus eval of the when-parser providers inside the deployed env.
// Triggered by deploy-succeeded for commits tagged [parser-eval], or manually with the admin token. Output: function log only.
import { createHash } from "node:crypto";
import corpus from "../../test/fixtures/hebrew-when-corpus.json" with { type: "json" };
import { openaiAdapter } from "../../src/when.js";
import { jevAdapter } from "../../src/jev.js";
import { evalProvider, evalLocal, evalCombo } from "../../src/parser-eval.js";
export const internalToken=()=>createHash("sha256").update(`parser-eval:${process.env.OPENAI_API_KEY||""}:${process.env.TYPESAFE_API_KEY||""}`).digest("hex");
// Corpus expectations are anchored to this moment; evaluating against it keeps results comparable on any day.
export const CORPUS_NOW=new Date("2026-09-23T10:36:00+03:00"),CORPUS_TODAY="2026-09-23";
export default async req=>{const auth=req.headers.get("authorization")||"";
 if(auth!==`Bearer ${internalToken()}`&&!(process.env.ADMIN_DASHBOARD_TOKEN&&auth===`Bearer ${process.env.ADMIN_DASHBOARD_TOKEN}`)){console.log(JSON.stringify({event:"parser_eval",status:"unauthorized"}));return new Response("unauthorized",{status:401});}
 console.log(JSON.stringify({event:"parser_eval",status:"start",n:corpus.length,openai:!!process.env.OPENAI_API_KEY,jev:!!process.env.TYPESAFE_API_KEY}));
 const out=[evalLocal(corpus,CORPUS_NOW)];
 if(process.env.OPENAI_API_KEY)out.push(await evalProvider("openai",openaiAdapter,corpus,{today:CORPUS_TODAY}));
 if(process.env.TYPESAFE_API_KEY)out.push(await evalProvider("jev",jevAdapter,corpus,{today:CORPUS_TODAY}));
 if(process.env.OPENAI_API_KEY&&process.env.TYPESAFE_API_KEY)out.push(await evalCombo(openaiAdapter,jevAdapter,corpus,{today:CORPUS_TODAY}));
 for(const r of out){const{misses,...summary}=r;console.log(JSON.stringify({event:"parser_eval",status:"summary",...summary}));if(r.provider==="combo")for(const b of r.byThreshold)console.log(JSON.stringify({event:"parser_eval",status:"combo_threshold",...b}));if(misses?.length)for(let k=0;k<misses.length;k+=10)console.log(JSON.stringify({event:"parser_eval",status:"misses",provider:r.provider,part:k/10,misses:misses.slice(k,k+10)}));}
 console.log(JSON.stringify({event:"parser_eval",status:"done"}));return new Response("ok");};
