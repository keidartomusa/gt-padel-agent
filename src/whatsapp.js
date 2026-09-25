const endpoint=id=>`https://graph.facebook.com/v25.0/${id}/messages`;
async function post(to,payload,phoneNumberId,fetchImpl=fetch){
 if((process.env.DISABLE_OUTBOUND??"true").toLowerCase()==="true")return{sent:false,reason:"disable_outbound"};
 const token=process.env.WHATSAPP_ACCESS_TOKEN,id=phoneNumberId||process.env.WHATSAPP_PHONE_NUMBER_ID;if(!token||!id)return{sent:false,reason:"not_configured"};
 const body={messaging_product:"whatsapp",...(to?{to}:{}),...payload};const res=await fetchImpl(endpoint(id),{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify(body)});return res.ok?{sent:true,data:await res.json()}:{sent:false,reason:`api_error_${res.status}`,detail:await res.text()};
}
export const sendReaction=(to,messageId,emoji="👍",phoneNumberId,fetchImpl=fetch)=>post(to,{recipient_type:"individual",type:"reaction",reaction:{message_id:messageId,emoji}},phoneNumberId,fetchImpl);
export const sendTyping=(messageId,phoneNumberId,fetchImpl=fetch)=>post(null,{status:"read",message_id:messageId,typing_indicator:{type:"text"}},phoneNumberId,fetchImpl);
export const sendText=(to,body,phoneNumberId,fetchImpl=fetch)=>post(to,{type:"text",text:{body:bidiRanges(body)}},phoneNumberId,fetchImpl);
// Tom 23.9 14:51: number/time ranges ("3–3.5", "17:30–19:00") render reversed inside Hebrew (RTL) text.
// Wrap every range in invisible LTR isolate marks (LRI U+2066 ... PDI U+2069) on every outbound field.
const RANGE=/(?<![\d.:\-–\u2066])(\d{1,2}(?::\d{2}|\.\d{1,2})?)(\s?[–-]\s?)(\d{1,2}(?::\d{2}|\.\d{1,2})?)(?![\d.:\-–]|\u2069)/g;
// Tom 23.9 15:27: regular hyphen instead of long dashes everywhere users see text. Stored data (level keys) keeps its dashes; only outbound text changes.
export const plainDashes=t=>typeof t==="string"?t.replace(/[–—]/g,"-"):t;
export const bidiRanges=t=>typeof t==="string"?plainDashes(t).replace(RANGE,"\u2066$1$2$3\u2069"):t;
const fit=(t,max)=>{const w=bidiRanges(t);return w.length<=max?w:plainDashes(t).slice(0,max);};
export function bidiResponse(r){if(!r||typeof r!=="object")return r;const o={...r};if(o.text)o.text=bidiRanges(o.text);
 if(o.buttons)o.buttons=o.buttons.map(b=>({...b,title:fit(b.title,20)}));
 if(o.list)o.list={...o.list,sections:o.list.sections.map(sec=>({...sec,rows:sec.rows.map(x=>({...x,title:fit(x.title,24),...(x.description?{description:fit(x.description,72)}:{})}))}))};
 if(o.ctaUrl)o.ctaUrl={...o.ctaUrl,displayText:fit(o.ctaUrl.displayText,20)};return o;}
export async function sendResponse(to,response0,phoneNumberId,fetchImpl=fetch){
 const response=bidiResponse(response0);
 if(response.ctaUrl)return post(to,{type:"interactive",interactive:{type:"cta_url",body:{text:response.text},action:{name:"cta_url",parameters:{display_text:response.ctaUrl.displayText.slice(0,20),url:response.ctaUrl.url}}}},phoneNumberId,fetchImpl);

 if(response.buttons?.length){return post(to,{type:"interactive",interactive:{type:"button",body:{text:response.text},action:{buttons:response.buttons.slice(0,3).map(x=>({type:"reply",reply:{id:x.id,title:x.title.slice(0,20)}}))}}},phoneNumberId,fetchImpl);}
 if(response.list){return post(to,{type:"interactive",interactive:{type:"list",body:{text:response.text},action:{button:response.list.button,sections:response.list.sections.map(s=>({...s,rows:s.rows.map(r=>({id:r.id,title:r.title.slice(0,24),...(r.description?{description:r.description.slice(0,72)}:{})}))}))}}},phoneNumberId,fetchImpl);}
 return sendText(to,response.text||String(response),phoneNumberId,fetchImpl);
}
// Approved template for users outside the 24h customer-service window. Quick-reply payloads route back into the bot.
export const sendTemplate=(to,name,language,payloads=[],phoneNumberId,fetchImpl=fetch)=>post(to,{type:"template",template:{name,language:{code:language},components:payloads.map((payload,i)=>({type:"button",sub_type:"quick_reply",index:String(i),parameters:[{type:"payload",payload}]}))}},phoneNumberId,fetchImpl);
// Body variables only. The template name and language must already be approved by Meta.
export const sendParameterizedTemplate=(to,name,language,values,phoneNumberId,fetchImpl=fetch)=>post(to,{type:"template",template:{name,language:{code:language},components:[{type:"body",parameters:values.map(text=>({type:"text",text:String(text)}))}]}},phoneNumberId,fetchImpl);
