// Netlify deploy event. Runs the parser eval only when the deployed commit title contains [parser-eval].
import { internalToken } from "./parser-eval-background.js";
export default async req=>{let body={};try{body=await req.json();}catch{}const d=body.payload||{};const title=`${d.title||""} ${d.commit_message||""}`;
 if(!/\[parser-eval\]/.test(title))return new Response("skip");
 const base=process.env.URL||d.ssl_url||d.url;const r=await fetch(`${base}/.netlify/functions/parser-eval-background`,{method:"POST",headers:{authorization:`Bearer ${internalToken()}`}});
 console.log(JSON.stringify({event:"parser_eval",status:"triggered",http:r.status,commit:d.commit_ref}));return new Response("ok");};
