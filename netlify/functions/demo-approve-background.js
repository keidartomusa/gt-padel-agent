// One-shot demo job (approve). Triggered by deploy-succeeded only when the deployed commit title contains [demo-approve].
import { getStore } from "@netlify/blobs";
import { netlifyStore } from "../../src/store.js";
import { demoApprove } from "../../src/demo.js";
import { deliver } from "../../src/notify.js";
import { sendResponse, sendTemplate } from "../../src/whatsapp.js";
import { internalToken } from "./parser-eval-background.js";
export default async req=>{if((req.headers.get("authorization")||"")!==`Bearer ${internalToken()}`){console.log(JSON.stringify({event:"demo_approve",status:"unauthorized"}));return new Response("unauthorized",{status:401});}
 const store=netlifyStore(getStore({name:"gt-padel-matching",consistency:"strong"}));const phoneId=process.env.WHATSAPP_PHONE_NUMBER_ID;
 const deliverFn=(to,response)=>deliver(store,to,response,{send:(t,r)=>sendResponse(t,r,phoneId),sendTemplate:(t,x)=>sendTemplate(t,x.name,x.language,x.payloads,phoneId)});
 const r=await demoApprove(store,{deliverFn});console.log(JSON.stringify({event:"demo_approve",...r}));return new Response("ok");};
