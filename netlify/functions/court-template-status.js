// Read-only Meta status refresh while the submitted template remains pending.
import {getStore} from "@netlify/blobs";
import {netlifyStore} from "../../src/store.js";
import {refreshCourtTemplate} from "./court-template-submit-background.js";
export default async()=>{
 try{const result=await refreshCourtTemplate({store:netlifyStore(getStore({name:"gt-padel-matching",consistency:"strong"})),token:process.env.WHATSAPP_ACCESS_TOKEN});
  if(result.error)console.log(JSON.stringify({event:"court_template_status",error:result.error}));
  return Response.json({ok:!result.error,checked:result.checked,status:result.current?.status||null,error:result.error||null});}
 catch(error){console.error(JSON.stringify({event:"court_template_status",error:String(error.message||error)}));return Response.json({ok:false,error:"status_failed"},{status:503});}
};
export const config={schedule:"7 * * * *"};
