// Full conversation log per WhatsApp number (Tom 23.9): every inbound and outbound message.
// One blob per message (no read-modify-write, so concurrent webhooks never lose a message).
// Direction and billing kind are encoded in the key, so per-user counts are computed from keys alone.
// Billing kind for outbound: "service" (free-form reply) or "template". Failed sends are logged with sent:false and are not billable.
export const RATE_USD={service:0.0053,template:0.0053}; // Israel, Meta rate card effective Oct 1 2026 (service = utility rate)
let seq=0;
const pad=n=>String(n).padStart(13,"0");
export function describe(response){if(!response)return"";if(typeof response==="string")return response;const parts=[response.text||""];if(response.buttons?.length)parts.push("[כפתורים] "+response.buttons.map(b=>b.title).join(" | "));if(response.list)parts.push("[רשימה] "+response.list.sections.flatMap(s=>s.rows.map(r=>r.title)).join(" | "));if(response.ctaUrl)parts.push("[קישור] "+response.ctaUrl.displayText+" "+response.ctaUrl.url);return parts.filter(Boolean).join("\n");}
export async function logMessage(store,userId,{direction,kind,type,body,sent=true,reason=null,waMessageId=null,at=new Date()}){
 if(!store||!userId)return;
 const ts=at instanceof Date?at:new Date(at),key=`msg/${userId}/${pad(ts.getTime())}-${String(++seq).padStart(6,"0")}-${direction}-${kind}-${sent?"ok":"fail"}`;
 await store.set(key,{userId,direction,kind,type,body,sent,reason,waMessageId,at:ts.toISOString()});
}
export const logInbound=(store,userId,msg,input,at)=>logMessage(store,userId,{direction:"in",kind:"user",type:msg?.type||"text",body:input?.text||input?.actionId||"",waMessageId:msg?.id||null,at});
export const logOutbound=(store,to,response,result,at)=>logMessage(store,to,{direction:"out",kind:"service",type:response?.list?"list":response?.buttons?.length?"buttons":response?.ctaUrl?"cta_url":"text",body:describe(response),sent:Boolean(result?.sent),reason:result?.sent?null:result?.reason||null,waMessageId:result?.data?.messages?.[0]?.id||null,at});
export const logTemplate=(store,to,template,bodyText,result,at)=>logMessage(store,to,{direction:"out",kind:"template",type:"template",body:`[תבנית ${template.name}] ${bodyText}`,sent:Boolean(result?.sent),reason:result?.sent?null:result?.reason||null,waMessageId:result?.data?.messages?.[0]?.id||null,at});
export function parseKey(key){const m=/^msg\/([^/]+)\/(\d{13})-\d+-(in|out)-(\w+)-(ok|fail)$/.exec(key);return m?{userId:m[1],ms:Number(m[2]),direction:m[3],kind:m[4],sent:m[5]==="ok"}:null;}
export function summarizeMessages(keys,profiles={}){
 const users={};
 for(const k of keys){const p=parseKey(k);if(!p)continue;const u=users[p.userId]||={userId:p.userId,name:profiles[p.userId]?.name||null,received:0,sent:0,service:0,template:0,failed:0,lastAt:0};
  if(p.direction==="in")u.received++;else if(!p.sent)u.failed++;else{u.sent++;u[p.kind==="template"?"template":"service"]++;}
  u.lastAt=Math.max(u.lastAt,p.ms);}
 const rows=Object.values(users).map(u=>({...u,lastAt:u.lastAt?new Date(u.lastAt).toISOString():null,estimatedUsd:+(u.service*RATE_USD.service+u.template*RATE_USD.template).toFixed(4)})).sort((a,b)=>b.lastAt.localeCompare(a.lastAt));
 const t=rows.reduce((a,u)=>({received:a.received+u.received,sent:a.sent+u.sent,service:a.service+u.service,template:a.template+u.template,failed:a.failed+u.failed}),{received:0,sent:0,service:0,template:0,failed:0});
 return{users:rows,totals:{...t,estimatedUsd:+(t.service*RATE_USD.service+t.template*RATE_USD.template).toFixed(4)}};
}
export async function conversation(store,userId){return(await store.list(`msg/${userId}/`)).sort((a,b)=>a.key.localeCompare(b.key)).map(x=>x.value);}

// Dashboard chat list preview (Tom 23.9 15:46): last message per user - first line, buttons/links dropped, 80 chars.
export const previewText=body=>{const l=String(body||"").split("\n").map(x=>x.trim()).filter(x=>x&&!/^\[(כפתורים|רשימה|קישור)\]/.test(x));return(l[0]||"").replace(/^\[תבנית [^\]]*\]\s*/,"").replace(/\*/g,"").slice(0,80);};
export async function addPreviews(store,keys,messages){const last={};for(const k of keys){const p=parseKey(k);if(p&&(!last[p.userId]||k>last[p.userId]))last[p.userId]=k;}
 await Promise.all((messages?.users||[]).map(async u=>{const k=last[u.userId];if(!k)return;const v=await store.get(k);u.lastText=previewText(v?.body);u.lastDirection=parseKey(k).direction;}));return messages;}
