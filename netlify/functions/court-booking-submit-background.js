// One deploy-triggered submission only; never sends a WhatsApp message.
import {getStore} from '@netlify/blobs';
import {internalToken} from './parser-eval-background.js';
import {RELEASE_BOOKING_TEMPLATE,releaseBookingTemplateDefinition} from '../../src/court-release.js';
const G='https://graph.facebook.com/v25.0';
export async function submitReleaseBookingTemplate({store,token,fetchImpl=fetch,now=new Date()}={}){
 const out={at:now.toISOString(),name:RELEASE_BOOKING_TEMPLATE.name};
 if(!token)return{...out,error:'not_configured'};
 const hint=(await store.get('meta/waba-id',{type:'json'}))?.id;
 if(!/^\d{5,}$/.test(String(hint||'')))return{...out,error:'no_waba_hint'};
 const base=`${G}/${hint}/message_templates`,headers={Authorization:`Bearer ${token}`};
 const found=await fetchImpl(`${base}?name=${RELEASE_BOOKING_TEMPLATE.name}&fields=id,name,status,category,language,rejected_reason`,{headers});
 if(!found.ok)return{...out,error:`list_http_${found.status}`};
 const rows=(await found.json()).data||[];
 const existing=rows.find(r=>r.name===RELEASE_BOOKING_TEMPLATE.name&&r.language==='he');
 if(existing)return{...out,existing:{id:existing.id,status:existing.status,category:existing.category,language:existing.language}};
 const response=await fetchImpl(base,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(releaseBookingTemplateDefinition())});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)return{...out,error:`submit_http_${response.status}`,code:data.error?.code||null};
 return{...out,submitted:true,id:data.id||null,status:data.status||null,category:data.category||null};
}
export default async req=>{
 if((req.headers.get('authorization')||'')!==`Bearer ${internalToken()}`)return new Response('unauthorized',{status:401});
 const store=getStore({name:'gt-padel-matching',consistency:'strong'});
 const result=await submitReleaseBookingTemplate({store,token:process.env.WHATSAPP_ACCESS_TOKEN});
 await store.setJSON('meta/court-booking-template',result);
 console.log(JSON.stringify({event:'court_booking_template_submission',name:result.name,status:result.status||result.existing?.status||null,error:result.error||null}));
 return Response.json({ok:!result.error,submitted:!!result.submitted,status:result.status||result.existing?.status||null,error:result.error||null});
};
