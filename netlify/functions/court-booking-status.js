// Read-only Meta status refresh for the new booking-button template.
import {getStore} from '@netlify/blobs';
import {RELEASE_BOOKING_TEMPLATE} from '../../src/court-release.js';
const G='https://graph.facebook.com/v25.0';
export async function refreshReleaseBookingTemplate({store,token,fetchImpl=fetch,now=new Date()}={}){
 const last=await store.get('meta/court-booking-template',{type:'json'});
 if(!last||!['PENDING','IN_APPEAL'].includes(last.current?.status||last.status||last.existing?.status))return{checked:false};
 const hint=(await store.get('meta/waba-id',{type:'json'}))?.id;
 if(!token||!/^\d{5,}$/.test(String(hint||'')))return{checked:false,error:'not_configured'};
 const response=await fetchImpl(`${G}/${hint}/message_templates?name=${RELEASE_BOOKING_TEMPLATE.name}&fields=id,name,status,category,language,rejected_reason`,{headers:{Authorization:`Bearer ${token}`}});
 if(!response.ok)return{checked:false,error:`list_http_${response.status}`};
 const current=((await response.json()).data||[]).find(t=>t.name===RELEASE_BOOKING_TEMPLATE.name&&t.language==='he');
 if(!current)return{checked:false,error:'template_missing'};
 const safe={id:current.id,name:current.name,status:current.status,category:current.category,language:current.language,rejected_reason:current.rejected_reason||null};
 await store.setJSON('meta/court-booking-template',{...last,current:safe,checkedAt:now.toISOString()});
 return{checked:true,current:safe};
}
export default async()=>{
 try{const store=getStore({name:'gt-padel-matching',consistency:'strong'});const r=await refreshReleaseBookingTemplate({store,token:process.env.WHATSAPP_ACCESS_TOKEN});return Response.json({ok:!r.error,checked:r.checked,status:r.current?.status||null,error:r.error||null});}
 catch(error){console.error(JSON.stringify({event:'court_booking_template_status',error:String(error.message||error)}));return Response.json({ok:false,error:'status_failed'},{status:503});}
};
export const config={schedule:'13 * * * *'};
