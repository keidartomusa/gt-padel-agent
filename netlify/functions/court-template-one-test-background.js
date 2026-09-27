// One authorized test only. The atomic claim blocks duplicate deploy hooks and retries.
import {getStore} from '@netlify/blobs';
import {internalToken} from './parser-eval-background.js';
import {sendParameterizedTemplate} from '../../src/whatsapp.js';
import {RELEASE_TEMPLATE} from '../../src/court-release.js';
const key='meta/one-court-template-test-20260927';
const values=['גני תקווה','27.9.2026','20:00','21:30'];

export async function sendOneCourtTest({store,send=sendParameterizedTemplate,now=new Date()}={}){
 const approved=await store.get('meta/court-template',{type:'json'});
 if(approved?.current?.status!=='APPROVED'||approved.current.name!==RELEASE_TEMPLATE.name)return{ok:false,reason:'template_not_approved'};
 const recipient=process.env.COURT_TEMPLATE_TEST_RECIPIENT;
 if(!/^972\d{9}$/.test(recipient||''))return{ok:false,reason:'recipient_not_configured'};
 const claim=await store.setJSON(key,{status:'claimed',at:now.toISOString()}, {onlyIfNew:true});
 if(!claim.modified)return{ok:false,reason:'already_claimed'};
 let response;
 try{response=await send(recipient,RELEASE_TEMPLATE.name,'he',values);}catch(error){response={sent:false,reason:'exception',detail:String(error.message||error)}}
 const outcome={status:response.sent?'accepted':'failed',at:now.toISOString(),template:RELEASE_TEMPLATE.name,values,providerMessageId:response.data?.messages?.[0]?.id||null,providerStatus:response.data?.messages?.[0]?.message_status||null,reason:response.reason||null,detail:response.detail||null};
 await store.setJSON(key,outcome);
 return{ok:response.sent,...outcome};
}
export default async req=>{
 if((req.headers.get('authorization')||'')!==`Bearer ${internalToken()}`)return new Response('unauthorized',{status:401});
 const store=getStore({name:'gt-padel-matching',consistency:'strong'});
 const result=await sendOneCourtTest({store});
 console.log(JSON.stringify({event:'court_template_one_test',status:result.status||result.reason,providerMessageId:result.providerMessageId||null,providerStatus:result.providerStatus||null}));
 return Response.json({ok:result.ok,status:result.status||result.reason,providerMessageId:result.providerMessageId||null,providerStatus:result.providerStatus||null},{status:result.ok?200:result.reason==='already_claimed'?409:503});
};
