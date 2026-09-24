// Tom 24.9 17:31 ("בוא נגיש לאישור"): submit the gt_match_found template to Meta for approval - this template only.
// Read/submit through the Graph API with the existing WhatsApp token. No token or number is ever stored or logged.
import{MATCH_TEMPLATE}from"./notify.js";
const G="https://graph.facebook.com/v25.0";
// Quick-reply labels. Order matches MATCH_TEMPLATE.payloads (pending_yes, pending_no); "כן, שלחו פרטים" is already recognised as typed text by the webhook.
export const TEMPLATE_BUTTONS=["כן, שלחו פרטים","לא, תודה"];
export const templateDefinition=()=>({name:MATCH_TEMPLATE.name,language:MATCH_TEMPLATE.language,category:"UTILITY",components:[{type:"BODY",text:MATCH_TEMPLATE.body},{type:"BUTTONS",buttons:TEMPLATE_BUTTONS.map(text=>({type:"QUICK_REPLY",text}))}]});
async function j(res){let b=null;try{b=await res.json();}catch{}return{ok:res.ok,status:res.status,body:b};}
// WABA lookup, in order: token debug scopes -> businesses the token can see -> the WABA id recorded from signed webhooks (entry.id).
// System-user tokens with all-asset access return no target_ids, so the fallbacks matter (24.9: first run returned no_waba).
export async function findWaba(token,fetchImpl=fetch,{hint=null}={}){const r=await j(await fetchImpl(`${G}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`));
 const scopes=r.body?.data?.granular_scopes||[];const ids=[...new Set(scopes.filter(s=>/^whatsapp_business_(management|messaging)$/.test(s.scope)).flatMap(s=>s.target_ids||[]))];
 const canManage=scopes.some(s=>s.scope==="whatsapp_business_management");const diag={tokenType:r.body?.data?.type||null,scopes:scopes.map(s=>s.scope)};
 if(ids.length)return{wabaId:ids[0],wabaCount:ids.length,canManage,source:"debug_token",diag,error:null};
 const b=await j(await fetchImpl(`${G}/me/businesses?fields=owned_whatsapp_business_accounts{id},client_whatsapp_business_accounts{id}`,{headers:{Authorization:`Bearer ${token}`}}));
 const bids=[...new Set((b.body?.data||[]).flatMap(x=>[...(x.owned_whatsapp_business_accounts?.data||[]),...(x.client_whatsapp_business_accounts?.data||[])]).map(w=>w.id).filter(Boolean))];
 if(bids.length===1)return{wabaId:bids[0],wabaCount:1,canManage,source:"businesses",diag,error:null};
 if(hint)return{wabaId:hint,wabaCount:1,canManage,source:"webhook",diag,error:null};
 return{wabaId:null,wabaCount:bids.length,canManage,source:null,diag,error:bids.length>1?"multiple_waba":(r.ok?null:(r.body?.error?.message||`http_${r.status}`)),businessesError:b.ok?null:(b.body?.error?.message||`http_${b.status}`)};}
export async function templateStatus(wabaId,token,fetchImpl=fetch){const r=await j(await fetchImpl(`${G}/${wabaId}/message_templates?name=${MATCH_TEMPLATE.name}&fields=name,status,category,language,rejected_reason`,{headers:{Authorization:`Bearer ${token}`}}));
 if(!r.ok)return{error:r.body?.error?.message||`http_${r.status}`};return{templates:(r.body?.data||[]).filter(t=>t.name===MATCH_TEMPLATE.name).map(t=>({name:t.name,status:t.status,category:t.category,language:t.language,rejected_reason:t.rejected_reason||null}))};}
export async function submitTemplate(wabaId,token,fetchImpl=fetch){const r=await j(await fetchImpl(`${G}/${wabaId}/message_templates`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify(templateDefinition())}));
 return r.ok?{submitted:true,id:r.body?.id||null,status:r.body?.status||null,category:r.body?.category||null}:{submitted:false,error:r.body?.error?.error_user_msg||r.body?.error?.message||`http_${r.status}`};}
// Check first; submit only when the template does not exist yet (never re-submits an existing one).
export async function ensureTemplate({token,submit=true,fetchImpl=fetch,now=new Date(),wabaHint=null}){const out={at:now.toISOString(),name:MATCH_TEMPLATE.name};
 if(!token)return{...out,error:"not_configured"};const w=await findWaba(token,fetchImpl,{hint:wabaHint});out.canManage=w.canManage;out.wabaCount=w.wabaCount;out.wabaSource=w.source;out.diag=w.diag;if(!w.wabaId)return{...out,error:w.error||"no_waba",businessesError:w.businessesError||null};
 const before=await templateStatus(w.wabaId,token,fetchImpl);if(before.error)return{...out,error:before.error};out.before=before.templates;
 if(before.templates.length||!submit)return out;out.submit=await submitTemplate(w.wabaId,token,fetchImpl);
 const after=await templateStatus(w.wabaId,token,fetchImpl);out.after=after.templates||null;return out;}
// After a no_waba run, retry once as soon as a signed webhook has recorded the WABA id (so nobody has to redeploy).
export const templateCurrent=last=>(last?.current||last?.after||last?.before||[])[0]?.status||null;
export async function retryTemplateIfNeeded(store,{token,fetchImpl=fetch,now=new Date()}){const last=await store.get("meta/last-template");const hint=(await store.get("meta/waba-id"))?.id||null;
 // While Meta is reviewing, refresh the status read-only (never posts) so /health shows APPROVED/REJECTED without a redeploy.
 if(last&&!last.error&&hint&&["PENDING","IN_APPEAL"].includes(templateCurrent(last))){const r=await ensureTemplate({token,fetchImpl,now,wabaHint:hint,submit:false});
  if(r.error)return{retried:false,checked:true,error:r.error};const next={...last,current:r.before,checkedAt:r.at};await store.set("meta/last-template",next);return{retried:false,checked:true,status:templateCurrent(next)};}
 if(!last||last.error!=="no_waba"||!hint)return{retried:false};const r=await ensureTemplate({token,fetchImpl,now,wabaHint:hint});await store.set("meta/last-template",r);return{retried:true,result:r};}
