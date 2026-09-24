// Demo hybrid (Tom 24.9 09:28): Tom records a solo request under another display name, a job moves it to a
// fictitious user, Tom (back as "תום", trio) connects to it, and a second job approves as the fictitious user
// through the real accept flow so Tom's phone gets the real approval message. Cleanup removes only demo records.
import { handleConversation } from "./conversation.js";
export const DEMO_USER="972500000077", DEMO_NAME="דנה", DEMO_WINDOW_MS=60*60*1000;
// The bot asks for the board name only on a user's first request and reuses it after, so the recorded request
// carries Tom's saved name. The job therefore picks the single solo request opened in the last hour by a real
// (non-fictitious) user, and renames it on the move. Zero or several candidates -> nothing is touched.
const vals=async(store,p)=>(await store.list(p)).map(x=>x.value).filter(Boolean);
export async function demoMove(store,{now=new Date(),name=DEMO_NAME,to=DEMO_USER}={}){
 const cands=(await vals(store,"request/")).filter(r=>r.active&&!String(r.userId).startsWith("9725000000")&&now-new Date(r.createdAt)<DEMO_WINDOW_MS&&(r.partySize||1)===1&&!(r.joined||[]).length);
 if(cands.length!==1)return{status:cands.length?"ambiguous":"not_found",count:cands.length};
 const r=cands[0],from=r.userId,moved={...r,userId:to,displayName:name,demo:true};
 await store.set(`request/${r.id}`,moved);await store.set(`profile/${to}`,{userId:to,name,demo:true,lastInboundAt:now.toISOString()});await store.set(`state/${to}`,{});
 const out={status:"moved",requestId:r.id,at:now.toISOString()};await store.set("meta/last-demo",{step:"move",...out});return out;}
export async function demoApprove(store,{now=new Date(),to=DEMO_USER,deliverFn=async()=>({sent:false})}={}){
 const pend=(await vals(store,"connection/")).filter(c=>c.status==="pending"&&c.toUserId===to);
 if(pend.length!==1)return{status:pend.length?"ambiguous":"not_found",count:pend.length};
 const c=pend[0],res=await handleConversation({userId:to,displayName:DEMO_NAME,actionId:`accept:${c.id}`,store,now});
 const sent=[];for(const n of res.notifications||[]){if(n.to===to)continue;const d=await deliverFn(n.to,n.response);sent.push(Boolean(d?.sent));}
 const after=await store.get(`connection/${c.id}`),out={status:after?.status==="accepted"?"accepted":"failed",connectionId:c.id,notified:sent.length,delivered:sent.filter(Boolean).length,at:now.toISOString()};
 await store.set("meta/last-demo",{step:"approve",...out});return out;}
export async function demoCleanup(store,{now=new Date(),to=DEMO_USER}={}){let n=0;
 for(const r of await vals(store,"request/"))if(r.userId===to){await store.delete(`request/${r.id}`);n++;}
 for(const c of await vals(store,"connection/"))if(c.toUserId===to||c.fromUserId===to||(c.members||[]).includes(to)){await store.delete(`connection/${c.id}`);n++;}
 for(const k of[`profile/${to}`,`state/${to}`,`pending/${to}`,`seen/${to}`])if(await store.get(k)){await store.delete(k);n++;}
 const out={status:"cleaned",removed:n,at:now.toISOString()};await store.set("meta/last-demo",{step:"cleanup",...out});return out;}
// Re-stage (Tom 24.9 09:54, re-shoot after the party-size fix): wipe the demo records, then recreate דנה's solo
// request exactly as recorded in step 1 (Sunday 27.9 after 21:00, 3-3.5, solo, no court, fully flexible).
export const DEMO_REQUEST={recurring:false,level:"3–3.5",partySize:1,hasCourt:false,date:"2026-09-27",startMinute:1260,endMinute:1440,durations:[90],flexMinutes:1440};
export async function demoStage(store,{now=new Date(),to=DEMO_USER,name=DEMO_NAME}={}){const c=await demoCleanup(store,{now,to});
 const id=`demo${now.getTime().toString(36)}`,r={...DEMO_REQUEST,displayName:name,id,userId:to,active:true,demo:true,createdAt:now.toISOString()};
 await store.set(`request/${id}`,r);await store.set(`profile/${to}`,{userId:to,name,demo:true,lastInboundAt:now.toISOString()});await store.set(`state/${to}`,{});
 const out={status:"staged",requestId:id,removed:c.removed,at:now.toISOString()};await store.set("meta/last-demo",{step:"stage",...out});return out;}
