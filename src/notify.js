// Window-aware delivery (WhatsApp 24h customer-service window).
// Inside the window: normal free-form message. Outside: the approved template "gt_match_found_v2" (renamed 24.9 22:06: Meta kept blocking resubmission under the deleted name)
// (no names, no numbers), and the full notification waits until the user taps "כן, שלחו פרטים" or writes again.
import{logOutbound,logTemplate}from"./messagelog.js";
export const WINDOW_MS=24*60*60*1000;
export const MATCH_TEMPLATE={name:"gt_match_found_v2",language:"he",payloads:["pending_yes","pending_no"],body:"נמצאה לך התאמה למשחק פאדל ב-GT PADEL. רוצה לקבל את הפרטים?"};
export async function recordInbound(store,userId,now=new Date()){const p=await store.get(`profile/${userId}`)||{userId};p.lastInboundAt=now.toISOString();await store.set(`profile/${userId}`,p);}
export function windowOpen(profile,now=new Date()){if(!profile?.lastInboundAt)return false;return now.getTime()-new Date(profile.lastInboundAt).getTime()<WINDOW_MS;}
export async function deliver(store,to,response,{now=new Date(),send,sendTemplate}){
 const profile=await store.get(`profile/${to}`);
 if(windowOpen(profile,now)){const r=await send(to,response);await logOutbound(store,to,response,r,now);return{mode:"freeform",...r};}
 const key=`pending/${to}`,pending=await store.get(key)||{items:[],templateSentAt:null};
 pending.items=[...pending.items,{response,at:now.toISOString()}].slice(-5);
 let result={sent:false,reason:"template_already_sent"};
 const recent=pending.templateSentAt&&now.getTime()-new Date(pending.templateSentAt).getTime()<WINDOW_MS;
 if(!recent){result=await sendTemplate(to,MATCH_TEMPLATE);await logTemplate(store,to,MATCH_TEMPLATE,MATCH_TEMPLATE.body,result,now);if(result.sent)pending.templateSentAt=now.toISOString();}
 await store.set(key,pending);return{mode:"template",...result};
}
export async function takePending(store,userId){const key=`pending/${userId}`,p=await store.get(key);await store.delete(key);return p?.items||[];}
export async function hasPending(store,userId){return Boolean((await store.get(`pending/${userId}`))?.items?.length);}
