export async function sendText(to,body,phoneNumberId,fetchImpl=fetch){
 if((process.env.DISABLE_OUTBOUND??"true").toLowerCase()==="true") return {sent:false,reason:"disable_outbound"};
 const token=process.env.WHATSAPP_ACCESS_TOKEN,id=phoneNumberId||process.env.WHATSAPP_PHONE_NUMBER_ID;
 if(!token||!id) return {sent:false,reason:"not_configured"};
 const res=await fetchImpl(`https://graph.facebook.com/v21.0/${id}/messages`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({messaging_product:"whatsapp",to,type:"text",text:{body}})});
 return res.ok?{sent:true}:{sent:false,reason:`api_error_${res.status}`};
}

