import crypto from "node:crypto";
import { answer } from "../../src/agent.js";
import { sendText } from "../../src/whatsapp.js";
export default async req => {
 const url=new URL(req.url);
 if(req.method==="GET") return url.searchParams.get("hub.mode")==="subscribe"&&url.searchParams.get("hub.verify_token")===process.env.WHATSAPP_VERIFY_TOKEN?new Response(url.searchParams.get("hub.challenge")||"",{status:200}):new Response("forbidden",{status:403});
 if(req.method!=="POST") return new Response("method not allowed",{status:405});
 const raw=await req.text(),secret=process.env.WHATSAPP_APP_SECRET||"",sig=req.headers.get("x-hub-signature-256")||"";
 const expected="sha256="+crypto.createHmac("sha256",secret).update(raw).digest("hex");
 if(!secret||sig.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected))) return Response.json({error:"bad_signature"},{status:401});
 let body; try{body=JSON.parse(raw)}catch{return Response.json({error:"bad_json"},{status:400})}
 for(const entry of body.entry||[]) for(const change of entry.changes||[]) for(const msg of change.value?.messages||[]) if(msg.type==="text"&&msg.text?.body){
   const reply=await answer(msg.text.body);
   await sendText(msg.from,reply,change.value?.metadata?.phone_number_id);
 }
 return Response.json({ok:true});
};

