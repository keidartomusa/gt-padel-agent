import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";
import { answer } from "../../src/agent.js";
import { handleConversation } from "../../src/conversation.js";
import { netlifyStore } from "../../src/store.js";
import { sendResponse } from "../../src/whatsapp.js";
const messageInput=msg=>msg.type==="text"?{text:msg.text?.body||""}:msg.type==="interactive"?{actionId:msg.interactive?.button_reply?.id||msg.interactive?.list_reply?.id||"",text:msg.interactive?.button_reply?.title||msg.interactive?.list_reply?.title||""}:null;
export default async req=>{
 const url=new URL(req.url);if(req.method==="GET")return url.searchParams.get("hub.mode")==="subscribe"&&url.searchParams.get("hub.verify_token")===process.env.WHATSAPP_VERIFY_TOKEN?new Response(url.searchParams.get("hub.challenge")||"",{status:200}):new Response("forbidden",{status:403});if(req.method!=="POST")return new Response("method not allowed",{status:405});
 const raw=await req.text(),secret=process.env.WHATSAPP_APP_SECRET||"",sig=req.headers.get("x-hub-signature-256")||"",expected="sha256="+crypto.createHmac("sha256",secret).update(raw).digest("hex");if(!secret||sig.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return Response.json({error:"bad_signature"},{status:401});
 let body;try{body=JSON.parse(raw)}catch{return Response.json({error:"bad_json"},{status:400})}const store=netlifyStore(getStore("gt-padel-matching"));
 for(const entry of body.entry||[])for(const change of entry.changes||[])for(const msg of change.value?.messages||[]){const input=messageInput(msg);if(!input)continue;const contact=change.value?.contacts?.find(x=>x.wa_id===msg.from),result=await handleConversation({userId:msg.from,displayName:contact?.profile?.name||"שחקן/ית",...input,store});const response=result.mode==="availability"?{text:await answer(result.query)}:result;await sendResponse(msg.from,response,change.value?.metadata?.phone_number_id);for(const n of response.notifications||[])await sendResponse(n.to,n.response,change.value?.metadata?.phone_number_id);}
 return Response.json({ok:true});
};
