// Triggered by deploy-succeeded when the commit title contains [template-submit] (check + submit if missing) or [template-status] (check only).
import { getStore } from "@netlify/blobs";
import { netlifyStore } from "../../src/store.js";
import { ensureTemplate, replaceTemplate } from "../../src/template.js";
import { internalToken } from "./parser-eval-background.js";
export default async req=>{if((req.headers.get("authorization")||"")!==`Bearer ${internalToken()}`)return new Response("unauthorized",{status:401});
 const submit=new URL(req.url).searchParams.get("check")!=="1";const store=netlifyStore(getStore({name:"gt-padel-matching",consistency:"strong"}));const hint=(await store.get("meta/waba-id"))?.id||null;const replace=new URL(req.url).searchParams.get("replace")==="1";const r=replace?await replaceTemplate({token:process.env.WHATSAPP_ACCESS_TOKEN,wabaHint:hint}):await ensureTemplate({token:process.env.WHATSAPP_ACCESS_TOKEN,submit,wabaHint:hint});
 await store.set("meta/last-template",r);console.log(JSON.stringify({event:"template",submit,error:r.error||null}));return new Response("ok");};
