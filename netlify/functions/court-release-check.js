import {getStore} from "@netlify/blobs";
import {netlifyStore} from "../../src/store.js";
import {RELEASE_TEMPLATE,releaseVariables,scanCourtReleases} from "../../src/court-release.js";
import {sendParameterizedTemplate} from "../../src/whatsapp.js";

// Explicitly off until the user reviews the text and Meta approves the template.
export default async()=>{
 if(process.env.COURT_RELEASE_ENABLED!=="true")return Response.json({ok:true,status:"disabled"});
 const to=process.env.COURT_RELEASE_RECIPIENT,allowed=process.env.COURT_RELEASE_APPROVED_TEMPLATE;
 if(!/^\d{8,15}$/.test(to||"")||allowed!==RELEASE_TEMPLATE.name)return Response.json({ok:false,status:"not_configured"},{status:503});
 try{const result=await scanCourtReleases(netlifyStore(getStore({name:"gt-padel-matching",consistency:"strong"})),{
  notify:w=>sendParameterizedTemplate(to,RELEASE_TEMPLATE.name,RELEASE_TEMPLATE.language,releaseVariables(w))
 });console.log(JSON.stringify({event:"court_release_scan",...result}));return Response.json({ok:true,...result});}
 catch(error){console.error(JSON.stringify({event:"court_release_error",message:String(error.message||error)}));return Response.json({ok:false,status:"scan_failed"},{status:503});}
};
export const config={schedule:"*/30 * * * *"};
