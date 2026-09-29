import {getStore} from '@netlify/blobs';
import {netlifyStore} from '../../src/store.js';
import {ACTIVE_VENUES} from '../../src/venues.js';
import {authGate} from '../../src/auth.js';
import {labelSecret,loadQueue,saveLabel,evaluateQueue} from '../../src/routing-labels.js';
const noCache={'cache-control':'no-store','content-type':'application/json; charset=utf-8','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
const respond=(data,status=200)=>Response.json(data,{status,headers:noCache});
const stores=()=>Object.fromEntries(ACTIVE_VENUES.map(v=>[v.key,netlifyStore(getStore({name:v.storeName,consistency:'strong'}))]));
export async function routingLabelApi(req,context,{sources,labels,secret=labelSecret(),adminSecret=process.env.ADMIN_DASHBOARD_TOKEN}={}){
 if(!['GET','POST'].includes(req.method))return respond({error:'method_not_allowed'},405);
 const labelStore=labels||netlifyStore(getStore({name:'gt-padel-routing-eval',consistency:'strong'}));
 const denied=await authGate(req,labelStore,{context,secret:adminSecret});if(denied)return denied;
 if(!secret)return respond({error:'not_configured'},503);
 try{const queue=await loadQueue(sources||stores(),labelStore,{secret});
  if(req.method==='GET')return respond({...queue,score:await evaluateQueue(queue)});
  let body;try{body=await req.json()}catch{return respond({error:'bad_json'},400)}
  const saved=await saveLabel(labelStore,body,queue);return respond({saved});
 }catch(e){console.error(JSON.stringify({event:'routing_label_error',kind:e?.name||'Error'}));return respond({error:'unavailable'},503)}
}
export default routingLabelApi;
