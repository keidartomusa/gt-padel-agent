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
 for(const r of await vals(store,"request/"))if(r.userId===to||r.userId==="972500000078"||r.demo){await store.delete(`request/${r.id}`);n++;}
 for(const c of await vals(store,"connection/"))if([to,"972500000078"].some(u=>c.toUserId===u||c.fromUserId===u||(c.members||[]).includes(u))){await store.delete(`connection/${c.id}`);n++;}
 for(const k of[`profile/${to}`,`state/${to}`,`pending/${to}`,`seen/${to}`,"profile/972500000078","state/972500000078","pending/972500000078","seen/972500000078"])if(await store.get(k)){await store.delete(k);n++;}
 const out={status:"cleaned",removed:n,at:now.toISOString()};await store.set("meta/last-demo",{step:"cleanup",...out});return out;}
// Re-stage (Tom 24.9 09:54, re-shoot after the party-size fix): wipe the demo records, then recreate דנה's solo
// request exactly as recorded in step 1 (Sunday 27.9 after 21:00, 3-3.5, solo, no court, fully flexible).
export const DEMO_REQUEST={recurring:false,level:"3–3.5",partySize:1,hasCourt:false,date:"2026-09-27",startMinute:1260,endMinute:1440,durations:[90],flexMinutes:1440};
export async function demoStage(store,{now=new Date(),to=DEMO_USER,name=DEMO_NAME,hours=6}={}){const c=await demoCleanup(store,{now,to});
 // Tom 24.9 10:07: his "delete everything" was intentional; the opt-out mark it left serves no purpose for an active user, so clear it (recent, single, non-fictitious only).
 const marked=(await vals(store,"profile/")).filter(p=>p.optedOutAt&&now-new Date(p.optedOutAt)<hours*3600000&&!String(p.userId).startsWith("9725000000"));let unmarked=0;
 if(marked.length===1){const {optedOutAt,...p}=marked[0];await store.set(`profile/${p.userId}`,p);unmarked=1;}
 const id=`demo${now.getTime().toString(36)}`,r={...DEMO_REQUEST,displayName:name,id,userId:to,active:true,demo:true,createdAt:now.toISOString()};
 await store.set(`request/${id}`,r);await store.set(`profile/${to}`,{userId:to,name,demo:true,lastInboundAt:now.toISOString()});await store.set(`state/${to}`,{});
 const out={status:"staged",requestId:id,removed:c.removed,unmarked,at:now.toISOString()};await store.set("meta/last-demo",{step:"stage",...out});return out;}
// Read-only state check (Tom 24.9 10:02): which requests the user who just used "הסרה מהרשימה" has, without phone numbers.
import { reqTitle } from "./requests.js";
export async function demoInspect(store,{now=new Date(),hours=3}={}){const since=now-hours*3600000;
 let users=(await vals(store,"profile/")).filter(p=>p.optedOutAt&&new Date(p.optedOutAt)>=since&&!String(p.userId).startsWith("9725000000"));
 // No recent opt-out: fall back to the requester of the accepted demo connections (Tom's number), as the invite job does.
 if(!users.length)users=[...new Set((await vals(store,"connection/")).filter(c=>c.status==="accepted"&&c.toUserId===DEMO_USER&&!String(c.fromUserId).startsWith("9725000000")).map(c=>c.fromUserId))].map(userId=>({userId}));
 if(users.length!==1){const out={status:users.length?"ambiguous":"not_found",count:users.length,at:now.toISOString()};await store.set("meta/last-demo",{step:"inspect",...out});return out;}
 const u=users[0],rows=(await vals(store,"request/")).filter(r=>r.userId===u.userId||(r.joined||[]).includes(u.userId)).sort((a,b)=>(a.createdAt||"").localeCompare(b.createdAt||""))
  .map(r=>({id:String(r.id).slice(0,8),title:reqTitle(r),party:r.partySize||1,court:Boolean(r.hasCourt),level:r.level||null,active:Boolean(r.active),own:r.userId===u.userId,removedReason:r.removedReason||null,removedAt:r.removedAt||null,closedReason:r.closedReason||null,createdAt:r.createdAt||null}));
 const out={status:"inspected",optedOutAt:u.optedOutAt,requests:rows,at:now.toISOString()};await store.set("meta/last-demo",{step:"inspect",...out});return out;}
// Restore (pending Tom's OK): reactivate the opted-out user's requests removed by "הסרה מהרשימה" in the last hours and the
// one the party-size bug merged into the demo request; the demo trio (one-off, party 3, 27.9) stays deleted. Clears the opt-out mark.
export async function demoRestore(store,{now=new Date(),hours=6,keepDeleted=r=>!r.recurring&&r.date==="2026-09-27"}={}){const since=now-hours*3600000;
 const users=(await vals(store,"profile/")).filter(p=>p.optedOutAt&&new Date(p.optedOutAt)>=since&&!String(p.userId).startsWith("9725000000"));
 if(users.length!==1){const out={status:users.length?"ambiguous":"not_found",count:users.length,at:now.toISOString()};await store.set("meta/last-demo",{step:"restore",...out});return out;}
 const u=users[0],restored=[];
 for(const r of await vals(store,"request/")){if(r.userId!==u.userId||r.active||keepDeleted(r))continue;
  const optOut=r.removedReason==="opt_out"&&r.removedAt===u.optedOutAt,merged=r.closedReason==="merged"&&new Date(r.closedAt)>=since;if(!optOut&&!merged)continue;
  const {removedAt,removedReason,closedAt,closedReason,mergedInto,...rest}=r;await store.set(`request/${r.id}`,{...rest,active:true,restoredAt:now.toISOString()});restored.push(reqTitle(r));}
 const {optedOutAt,...p}=u;await store.set(`profile/${u.userId}`,p);
 const out={status:"restored",restored,at:now.toISOString()};await store.set("meta/last-demo",{step:"restore",...out});return out;}
// Invite (proposed 24.9 for דנה's side of the story; runs only with Tom's OK): roles swap on Tom's own phone. His number gets a solo request shown as
// "דנה"; a fictitious trio named "תום" connects to it through the real flow, so Tom's phone receives the real request message
// and he taps "כן, לחבר" live. Tom's number is found as the requester of the latest accepted connection to the demo user.
export const DEMO_TRIO="972500000078";
export async function demoInvite(store,{now=new Date(),deliverFn=async()=>({sent:false})}={}){
 const acc=(await vals(store,"connection/")).filter(c=>c.status==="accepted"&&c.toUserId===DEMO_USER&&!String(c.fromUserId).startsWith("9725000000")).sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));
 const owners=[...new Set(acc.map(c=>c.fromUserId))];
 if(owners.length!==1){const out={status:owners.length?"ambiguous":"not_found",count:owners.length,at:now.toISOString()};await store.set("meta/last-demo",{step:"invite",...out});return out;}
 const tom=owners[0],t36=now.getTime().toString(36);
 for(const r of await vals(store,"request/"))if(r.userId===DEMO_TRIO||(r.userId===tom&&r.demo)){await store.delete(`request/${r.id}`);}
 const solo={...DEMO_REQUEST,displayName:DEMO_NAME,id:`demoinv${t36}`,userId:tom,active:true,demo:true,createdAt:now.toISOString()};
 const trio={recurring:false,level:"3–3.5",partySize:3,hasCourt:true,date:"2026-09-27",startMinute:1140,endMinute:1380,flexMinutes:0,displayName:"תום",id:`demotrio${t36}`,userId:DEMO_TRIO,active:true,demo:true,createdAt:now.toISOString()};
 await store.set(`request/${solo.id}`,solo);await store.set(`request/${trio.id}`,trio);await store.set(`profile/${DEMO_TRIO}`,{userId:DEMO_TRIO,name:"תום",demo:true,lastInboundAt:now.toISOString()});await store.set(`state/${DEMO_TRIO}`,{});
 const res=await handleConversation({userId:DEMO_TRIO,displayName:"תום",actionId:`connect:${solo.id}`,store,now});
 const sent=[];for(const n of res.notifications||[]){if(n.to!==tom)continue;const d=await deliverFn(n.to,n.response);sent.push(Boolean(d?.sent));}
 const out={status:sent.length?"invited":"no_notification",requestId:solo.id,notified:sent.length,delivered:sent.filter(Boolean).length,at:now.toISOString()};await store.set("meta/last-demo",{step:"invite",...out});return out;}
