// Netlify deploy event. Runs the parser eval only when the deployed commit title contains [parser-eval].
// Eval trigger: the deployed commit title must contain [parser-eval] (squash subject, not PR title).
import { internalToken } from "./parser-eval-background.js";
export default async req=>{let body={};try{body=await req.json();}catch{}const d=body.payload||{};const title=`${d.title||""} ${d.commit_message||""}`;
 const jobs=[["parser-eval","parser-eval-background"],["pilot-mine","pilot-mine-background"],["db-reset","db-reset-background"],["db-reset-all","db-reset-background?all=1"],["db-seed","db-seed-background"],["demo-move","demo-move-background"],["demo-approve","demo-approve-background"],["demo-cleanup","demo-cleanup-background"],["demo-stage","demo-stage-background"],["demo-inspect","demo-inspect-background"],["demo-restore","demo-restore-background"],["diag-messages","diag-messages-background"],["court-template-submit","court-template-submit-background"],["demo-invite","demo-invite-background"]].filter(([tag])=>title.includes(`[${tag}]`));
 if(!jobs.length)return new Response("skip");
 const base=process.env.URL||d.ssl_url||d.url;
 for(const [tag,fn] of jobs){const r=await fetch(`${base}/.netlify/functions/${fn}`,{method:"POST",headers:{authorization:`Bearer ${internalToken()}`}});console.log(JSON.stringify({event:tag.replace("-","_"),status:"triggered",http:r.status,commit:d.commit_ref}));}
 return new Response("ok");};
