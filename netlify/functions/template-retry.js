// Every 10 minutes: if the last template run ended in no_waba and a webhook has since recorded the WABA id, submit (check-first, never re-submits).
import { getStore } from "@netlify/blobs";
import { netlifyStore } from "../../src/store.js";
import { retryTemplateIfNeeded } from "../../src/template.js";
export default async()=>{const r=await retryTemplateIfNeeded(netlifyStore(getStore({name:"gt-padel-matching",consistency:"strong"})),{token:process.env.WHATSAPP_ACCESS_TOKEN});if(r.retried)console.log(JSON.stringify({event:"template_retry",error:r.result.error||null}));return Response.json({ok:true,retried:r.retried});};
export const config={schedule:"*/10 * * * *"};
