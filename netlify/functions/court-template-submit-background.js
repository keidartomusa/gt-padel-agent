// One-time deploy-triggered submission, using the existing server-side WhatsApp token.
// No credentials or recipient phone numbers are stored, returned or logged.
import {getStore} from "@netlify/blobs";
import {netlifyStore} from "../../src/store.js";
import {internalToken} from "./parser-eval-background.js";
import {RELEASE_TEMPLATE,releaseTemplateDefinition} from "../../src/court-release.js";
const G="https://graph.facebook.com/v25.0";
async function json(response){let data={};try{data=await response.json()}catch{}return{ok:response.ok,status:response.status,data};}
export async function submitCourtTemplate({store,token,fetchImpl=fetch,now=new Date()}){
 const out={at:now.toISOString(),name:RELEASE_TEMPLATE.name};
 if(!token)return{...out,error:"not_configured"};
 const hint=(await store.get("meta/waba-id"))?.id;
 // The signed webhook recorded this WABA id in the earlier authorized template submission;
 // if unavailable, we cannot safely choose among business accounts.
 if(!/^\d{5,}$/.test(String(hint||"")))return{...out,error:"no_waba_hint"};
 const headers={Authorization:`Bearer ${token}`};
 const path=`${G}/${hint}/message_templates`;
 const existing=await json(await fetchImpl(`${path}?name=${RELEASE_TEMPLATE.name}&fields=id,name,status,category,language,rejected_reason`,{headers}));
 if(!existing.ok)return{...out,error:`list_http_${existing.status}`};
 const found=(existing.data?.data||[]).filter(t=>t.name===RELEASE_TEMPLATE.name);
 if(found.length)return{...out,existing:found.map(({id,name,status,category,language,rejected_reason})=>({id,name,status,category,language,rejected_reason}))};
 const submission=await json(await fetchImpl(path,{method:"POST",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify(releaseTemplateDefinition())}));
 if(!submission.ok)return{...out,error:`submit_http_${submission.status}`,code:submission.data?.error?.code||null};
 return{...out,submitted:true,id:submission.data?.id||null,status:submission.data?.status||null,category:submission.data?.category||null};
}
export async function refreshCourtTemplate({store,token,fetchImpl=fetch,now=new Date()}){
 const last=await store.get("meta/court-template");
 if(!last||!["PENDING","IN_APPEAL"].includes(last.current?.status||last.status||last.existing?.[0]?.status))return{checked:false};
 const hint=(await store.get("meta/waba-id"))?.id;
 if(!token||!/^\d{5,}$/.test(String(hint||"")))return{checked:false,error:"not_configured"};
 const result=await json(await fetchImpl(`${G}/${hint}/message_templates?name=${RELEASE_TEMPLATE.name}&fields=id,name,status,category,language,rejected_reason`,{headers:{Authorization:`Bearer ${token}`}}));
 if(!result.ok)return{checked:false,error:`list_http_${result.status}`};
 const current=(result.data?.data||[]).find(t=>t.name===RELEASE_TEMPLATE.name);
 if(!current)return{checked:false,error:"template_missing"};
 const safe={id:current.id,name:current.name,status:current.status,category:current.category,language:current.language,rejected_reason:current.rejected_reason||null};
 await store.set("meta/court-template",{...last,current:safe,checkedAt:now.toISOString()});
 return{checked:true,current:safe};
}
export default async req=>{
 if((req.headers.get("authorization")||"")!==`Bearer ${internalToken()}`)return new Response("unauthorized",{status:401});
 const store=netlifyStore(getStore({name:"gt-padel-matching",consistency:"strong"}));
 const result=await submitCourtTemplate({store,token:process.env.WHATSAPP_ACCESS_TOKEN});
 await store.set("meta/court-template",result);
 console.log(JSON.stringify({event:"court_template_submission",name:result.name,status:result.status||null,error:result.error||null}));
 return Response.json({ok:!result.error,submitted:!!result.submitted,status:result.status||result.existing?.[0]?.status||null,error:result.error||null});
};
