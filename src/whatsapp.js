const endpoint=id=>`https://graph.facebook.com/v21.0/${id}/messages`;
async function post(to,payload,phoneNumberId,fetchImpl=fetch){
 if((process.env.DISABLE_OUTBOUND??"true").toLowerCase()==="true")return{sent:false,reason:"disable_outbound"};
 const token=process.env.WHATSAPP_ACCESS_TOKEN,id=phoneNumberId||process.env.WHATSAPP_PHONE_NUMBER_ID;if(!token||!id)return{sent:false,reason:"not_configured"};
 const res=await fetchImpl(endpoint(id),{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({messaging_product:"whatsapp",to,...payload})});return res.ok?{sent:true,data:await res.json()}:{sent:false,reason:`api_error_${res.status}`,detail:await res.text()};
}
export const sendText=(to,body,phoneNumberId,fetchImpl=fetch)=>post(to,{type:"text",text:{body}},phoneNumberId,fetchImpl);
export async function sendResponse(to,response,phoneNumberId,fetchImpl=fetch){
 if(response.buttons?.length){return post(to,{type:"interactive",interactive:{type:"button",body:{text:response.text},action:{buttons:response.buttons.slice(0,3).map(x=>({type:"reply",reply:{id:x.id,title:x.title.slice(0,20)}}))}}},phoneNumberId,fetchImpl);}
 if(response.list){return post(to,{type:"interactive",interactive:{type:"list",body:{text:response.text},action:{button:response.list.button,sections:response.list.sections.map(s=>({...s,rows:s.rows.map(r=>({id:r.id,title:r.title.slice(0,24),...(r.description?{description:r.description.slice(0,72)}:{})}))}))}}},phoneNumberId,fetchImpl);}
 return sendText(to,response.text||String(response),phoneNumberId,fetchImpl);
}
