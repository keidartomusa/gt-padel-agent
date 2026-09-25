// One-off authorized read-only WABA diagnostic. Never returns payment details or credentials.
import {getStore} from "@netlify/blobs";
import {netlifyStore} from "../../src/store.js";
import {internalToken} from "./parser-eval-background.js";
const G="https://graph.facebook.com/v25.0";
async function get(url,token,fetchImpl){const r=await fetchImpl(url,{headers:{Authorization:`Bearer ${token}`}});let data={};try{data=await r.json()}catch{}return{http:r.status,ok:r.ok,data};}
export async function wabaBillingDiagnostic({store,token,fetchImpl=fetch,now=new Date()}){
 const id=(await store.get("meta/waba-id"))?.id;
 if(!token||!/^\d{5,}$/.test(String(id||"")))return{at:now.toISOString(),error:"not_configured"};
 const fields="id,name,account_review_status,currency,business_verification_status,owner_business_info";
 const account=await get(`${G}/${id}?fields=${fields}`,token,fetchImpl);
 const safe={at:now.toISOString(),account:{http:account.http,ok:account.ok,...(account.ok?{id:account.data?.id||null,name:account.data?.name||null,account_review_status:account.data?.account_review_status||null,currency:account.data?.currency||null,business_verification_status:account.data?.business_verification_status||null,owner_business_info:account.data?.owner_business_info||null}:{errorCode:account.data?.error?.code||null})}};
 const payment=await get(`${G}/${id}/payment_configurations?fields=id`,token,fetchImpl);
 safe.paymentConfigurations={http:payment.http,ok:payment.ok,count:payment.ok?payment.data?.data?.length:null,errorCode:payment.ok?null:payment.data?.error?.code||null};
 return safe;
}
export default async req=>{
 if((req.headers.get("authorization")||"")!==`Bearer ${internalToken()}`)return new Response("unauthorized",{status:401});
 const store=netlifyStore(getStore({name:"gt-padel-matching",consistency:"strong"}));const result=await wabaBillingDiagnostic({store,token:process.env.WHATSAPP_ACCESS_TOKEN});
 await store.set("meta/waba-billing-diagnostic",result);console.log(JSON.stringify({event:"waba_billing_diagnostic",accountHttp:result.account?.http||null,paymentHttp:result.paymentConfigurations?.http||null,error:result.error||null}));return Response.json({ok:!result.error});
};
