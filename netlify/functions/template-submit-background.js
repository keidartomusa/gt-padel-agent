// Triggered by deploy-succeeded when the commit title contains [template-submit] (check + submit if missing) or [template-status] (check only).
import { getStore } from "@netlify/blobs";
import { netlifyStore } from "../../src/store.js";
import { ensureTemplate } from "../../src/template.js";
import { internalToken } from "./parser-eval-background.js";
export default async req=>{if((req.headers.get("authorization")||"")!==`Bearer ${internalToken()}`)return new Response("unauthorized",{status:401});
 const submit=new URL(req.url).searchParams.get("check")!=="1";const r=await ensureTemplate({token:process.env.WHATSAPP_ACCESS_TOKEN,submit});
 await netlifyStore(getStore({name:"gt-padel-matching",consistency:"strong"})).set("meta/last-template",r);console.log(JSON.stringify({event:"template",submit,error:r.error||null}));return new Response("ok");};
