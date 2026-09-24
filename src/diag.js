// Read-only diagnostic (Tom 24.9 10:06, after tapping "מגרש פנוי" nothing happened): message-log entries around a time window for every
// number that has an inbound message in it. Numbers are masked to the last 4 digits; nothing is written except meta/last-diag.
import { parseKey } from "./messagelog.js";
export async function diagMessages(store,{from,to,now=new Date()}){const f=new Date(from).getTime(),t=new Date(to).getTime();
 const keys=(await store.keys("msg/")).map(k=>({k,p:parseKey(k)})).filter(x=>x.p&&x.p.ms>=f&&x.p.ms<=t);
 const users=[...new Set(keys.filter(x=>x.p.direction==="in").map(x=>x.p.userId))];const out={at:now.toISOString(),from,to,users:[]};
 for(const u of users){const rows=[];for(const {k,p} of keys.filter(x=>x.p.userId===u).sort((a,b)=>a.k.localeCompare(b.k))){const v=await store.get(k);rows.push({at:new Date(p.ms).toISOString(),dir:p.direction,type:v?.type||null,sent:p.sent,reason:v?.reason||null,body:String(v?.body||"").slice(0,90)});}
  const st=await store.get(`state/${u}`);out.users.push({user:"…"+u.slice(-4),state:st?{flow:st.flow||null,step:st.step||null}:null,rows});}
 await store.set("meta/last-diag",out);return out;}
