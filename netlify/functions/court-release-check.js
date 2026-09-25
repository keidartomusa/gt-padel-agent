import {getStore} from "@netlify/blobs";
import {netlifyStore} from "../../src/store.js";
import {RELEASE_TEMPLATE,releaseVariables,scanCourtReleases} from "../../src/court-release.js";
import {sendParameterizedTemplate} from "../../src/whatsapp.js";

// Scan-only by default: never send WhatsApp until an approved template and explicit send gate exist.
export default async()=>{
 const sending=process.env.COURT_RELEASE_ENABLED==="true",to=process.env.COURT_RELEASE_RECIPIENT,allowed=process.env.COURT_RELEASE_APPROVED_TEMPLATE;
 // Never trust a flag alone: Meta's observed status must also be APPROVED.
 const store=netlifyStore(getStore({name:"gt-padel-matching",consistency:"strong"}));
 if(sending){const observed=await store.get("meta/court-template");if(observed?.current?.status!=="APPROVED"&&observed?.existing?.[0]?.status!=="APPROVED")return Response.json({ok:false,status:"template_not_approved"},{status:503});}
 if(sending&&(!/^\d{8,15}$/.test(to||"")||allowed!==RELEASE_TEMPLATE.name))return Response.json({ok:false,status:"not_configured"},{status:503});
 try{const result=await scanCourtReleases(store,{
  scanOnly:!sending,notify:w=>sendParameterizedTemplate(to,RELEASE_TEMPLATE.name,RELEASE_TEMPLATE.language,releaseVariables(w))
 });await store.set("meta/court-release-scan",result);
 console.log(JSON.stringify({event:"court_release_scan",...result}));return Response.json({ok:true,...result});}
 catch(error){console.error(JSON.stringify({event:"court_release_error",message:String(error.message||error)}));return Response.json({ok:false,status:"scan_failed"},{status:503});}
};
export const config={schedule:"*/30 * * * *"};
