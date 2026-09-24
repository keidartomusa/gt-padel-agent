// Tom 24.9 17:27: live test - send one test user the fixed template once 24 hours have passed since their last message.
// The target is picked by the last 4 digits only (no full number in this public repo) and must match exactly one user.
import{MATCH_TEMPLATE,WINDOW_MS}from"./notify.js";import{logTemplate}from"./messagelog.js";
export const REENGAGE_TEST={suffix:"4031",maxAttempts:30};
export async function reengageTest(store,{suffix=REENGAGE_TEST.suffix,maxAttempts=REENGAGE_TEST.maxAttempts,now=new Date(),sendTemplate}){
 const ids=(await store.keys("profile/")).map(k=>k.slice(8)).filter(u=>u.endsWith(suffix));const mask="…"+suffix;
 const rec=async r=>{const o={at:now.toISOString(),user:mask,...r};await store.set("meta/last-reengage",o);return o;};
 if(ids.length!==1)return rec({status:"no_unique_target",matches:ids.length});
 const u=ids[0],st=await store.get("reengage-test/state")||{attempts:0,sentAt:null};
 if(st.sentAt)return rec({status:"done",sentAt:st.sentAt});
 const p=await store.get(`profile/${u}`),last=p?.lastInboundAt?new Date(p.lastInboundAt):null;
 if(!last)return rec({status:"no_last_message"});
 const due=new Date(last.getTime()+WINDOW_MS);if(now<due)return rec({status:"waiting",lastInboundAt:last.toISOString(),dueAt:due.toISOString()});
 if(st.attempts>=maxAttempts)return rec({status:"gave_up",attempts:st.attempts,lastReason:st.lastReason||null});
 const r=await sendTemplate(u,MATCH_TEMPLATE);await logTemplate(store,u,MATCH_TEMPLATE,MATCH_TEMPLATE.body,r,now);
 st.attempts++;if(r.sent)st.sentAt=now.toISOString();else st.lastReason=r.reason||null;await store.set("reengage-test/state",st);
 return rec({status:r.sent?"sent":"send_failed",reason:r.reason||null,lastInboundAt:last.toISOString(),dueAt:due.toISOString(),attempts:st.attempts});}
