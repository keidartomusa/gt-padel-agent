import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";
import {venueForPhone,isolatedStoreName,assertVenueResponse} from "../../src/venues.js";
import { routeIncoming } from "../../src/webhook.js";
import {selectorStore,selectVenue,selectionKey} from "../../src/club-selection.js";
import {clubContact} from "../../src/club-contact.js";
import { netlifyStore } from "../../src/store.js";
import { sendResponse, sendTemplate, sendTyping } from "../../src/whatsapp.js";
import { deliver } from "../../src/notify.js";
import { logInbound, logOutbound } from "../../src/messagelog.js";
export const messageInput=msg=>msg.type==="button"?{actionId:msg.button?.payload||"",text:msg.button?.text||""}:msg.type==="text"?{text:msg.text?.body||""}:msg.type==="interactive"?{actionId:msg.interactive?.button_reply?.id||msg.interactive?.list_reply?.id||"",text:msg.interactive?.button_reply?.title||msg.interactive?.list_reply?.title||""}:null;
export default async req=>{
 const url=new URL(req.url);if(req.method==="GET")return url.searchParams.get("hub.mode")==="subscribe"&&url.searchParams.get("hub.verify_token")===process.env.WHATSAPP_VERIFY_TOKEN?new Response(url.searchParams.get("hub.challenge")||"",{status:200}):new Response("forbidden",{status:403});if(req.method!=="POST")return new Response("method not allowed",{status:405});
 const raw=await req.text(),secret=process.env.WHATSAPP_APP_SECRET||"",sig=req.headers.get("x-hub-signature-256")||"",expected="sha256="+crypto.createHmac("sha256",secret).update(raw).digest("hex");if(!secret||sig.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return Response.json({error:"bad_signature"},{status:401});
 let body;try{body=JSON.parse(raw)}catch{return Response.json({error:"bad_json"},{status:400})}const parsed=body.entry||[];
 // A webhook batch may include more than one account. Do not process any part if one is unknown.
 const routes=parsed.flatMap(entry=>(entry.changes||[]).filter(change=>(change.value?.messages||[]).length||(change.value?.statuses||[]).length).map(change=>({entry,change,venue:venueForPhone(change.value?.metadata?.phone_number_id)})));
 if(routes.some(route=>!route.venue))return Response.json({error:"unknown_destination"},{status:403});
 const storeFor=venue=>netlifyStore(getStore({name:isolatedStoreName(venue),consistency:"strong"}));
 for(const {entry,change,venue:destination} of routes)for(const msg of change.value?.messages||[]){const input=messageInput(msg);if(!input)continue;const choice=await selectVenue({store:selectorStore(),userId:msg.from,input,legacyStore:storeFor(destination)});const venue=choice.venue||destination,store=storeFor(venue);const phoneId=change.value?.metadata?.phone_number_id;const typing=await sendTyping(msg.id,phoneId);console.log(JSON.stringify({event:"whatsapp_inbound",messageId:msg.id,from:msg.from,type:msg.type,phoneIdPresent:Boolean(phoneId)}));await logInbound(choice.response?selectorStore():store,msg.from,msg,input);if(choice.response){const sent=await sendResponse(msg.from,choice.response,phoneId);await logOutbound(selectorStore(),msg.from,choice.response,sent);continue;}const contact=change.value?.contacts?.find(x=>x.wa_id===msg.from),response=await routeIncoming({userId:msg.from,displayName:contact?.profile?.name||"שחקן/ית",...input,store,venue,contactUrl:await clubContact(venue,store)});assertVenueResponse(venue,response);const sent=await sendResponse(msg.from,response,phoneId);await logOutbound(store,msg.from,response,sent);console.log(JSON.stringify({event:"whatsapp_outbound",messageId:msg.id,typing,sent}));for(const n of response.notifications||[]){const picked=await selectorStore().get(selectionKey(n.to));if(picked?.venueKey&&picked.venueKey!==venue.key)continue;assertVenueResponse(venue,n.response);const d=await deliver(store,n.to,n.response,{send:(to,r)=>sendResponse(to,r,phoneId),sendTemplate:(to,t)=>sendTemplate(to,t.name,t.language,t.payloads,phoneId),venue});console.log(JSON.stringify({event:"whatsapp_notification",to:n.to,mode:d.mode,sent:d.sent,reason:d.reason}));}}
 // Delivery statuses: Meta can accept a send and fail it later; log every status with its error so failures are visible.
 for(const {entry,change} of routes)for(const st of change.value?.statuses||[])console.log(JSON.stringify({event:"whatsapp_status",id:st.id,status:st.status,recipient:st.recipient_id,errors:st.errors||null}));
 return Response.json({ok:true});
};
