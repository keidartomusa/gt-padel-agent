import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";
import { routeIncoming } from "../../src/webhook.js";
import { netlifyStore } from "../../src/store.js";
import { sendResponse, sendTemplate, sendTyping } from "../../src/whatsapp.js";
import { deliver } from "../../src/notify.js";
import { logInbound, logOutbound } from "../../src/messagelog.js";
export const messageInput=msg=>msg.type==="button"?{actionId:msg.button?.payload||"",text:msg.button?.text||""}:msg.type==="text"?{text:msg.text?.body||""}:msg.type==="interactive"?{actionId:msg.interactive?.button_reply?.id||msg.interactive?.list_reply?.id||"",text:msg.interactive?.button_reply?.title||msg.interactive?.list_reply?.title||""}:null;
// Signed webhooks carry the WABA id in entry[].id; keep it so the template job can find the account (not a secret, never logged).
export async function rememberWaba(store,body){const id=body?.object==="whatsapp_business_account"?String(body.entry?.[0]?.id||""):"";if(!/^\d{5,}$/.test(id))return null;const cur=await store.get("meta/waba-id");if(cur?.id!==id)await store.set("meta/waba-id",{id,at:new Date().toISOString()});return id;}
export default async req=>{
 const url=new URL(req.url);if(req.method==="GET")return url.searchParams.get("hub.mode")==="subscribe"&&url.searchParams.get("hub.verify_token")===process.env.WHATSAPP_VERIFY_TOKEN?new Response(url.searchParams.get("hub.challenge")||"",{status:200}):new Response("forbidden",{status:403});if(req.method!=="POST")return new Response("method not allowed",{status:405});
 const raw=await req.text(),secret=process.env.WHATSAPP_APP_SECRET||"",sig=req.headers.get("x-hub-signature-256")||"",expected="sha256="+crypto.createHmac("sha256",secret).update(raw).digest("hex");if(!secret||sig.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return Response.json({error:"bad_signature"},{status:401});
 let body;try{body=JSON.parse(raw)}catch{return Response.json({error:"bad_json"},{status:400})}const store=netlifyStore(getStore({name:"gt-padel-matching",consistency:"strong"}));await rememberWaba(store,body);
 for(const entry of body.entry||[])for(const change of entry.changes||[])for(const msg of change.value?.messages||[]){const input=messageInput(msg);if(!input)continue;const phoneId=change.value?.metadata?.phone_number_id;const typing=await sendTyping(msg.id,phoneId);console.log(JSON.stringify({event:"whatsapp_inbound",messageId:msg.id,from:msg.from,type:msg.type,phoneIdPresent:Boolean(phoneId)}));await logInbound(store,msg.from,msg,input);const contact=change.value?.contacts?.find(x=>x.wa_id===msg.from),response=await routeIncoming({userId:msg.from,displayName:contact?.profile?.name||"שחקן/ית",...input,store});const sent=await sendResponse(msg.from,response,phoneId);await logOutbound(store,msg.from,response,sent);console.log(JSON.stringify({event:"whatsapp_outbound",messageId:msg.id,typing,sent}));for(const n of response.notifications||[]){const d=await deliver(store,n.to,n.response,{send:(to,r)=>sendResponse(to,r,phoneId),sendTemplate:(to,t)=>sendTemplate(to,t.name,t.language,t.payloads,phoneId)});console.log(JSON.stringify({event:"whatsapp_notification",to:n.to,mode:d.mode,sent:d.sent,reason:d.reason}));}}
 // Delivery statuses: Meta can accept a send and fail it later; log every status with its error so failures are visible.
 for(const entry of body.entry||[])for(const change of entry.changes||[])for(const st of change.value?.statuses||[])console.log(JSON.stringify({event:"whatsapp_status",id:st.id,status:st.status,recipient:st.recipient_id,errors:st.errors||null}));
 return Response.json({ok:true});
};
