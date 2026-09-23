import { getStore } from "@netlify/blobs";
// lastReset: when the data was last wiped and how many keys were removed (counts only, no content).
export default async () => {let lastReset=null,lastSeed=null;try{const st=getStore({name:"gt-padel-matching",consistency:"strong"});lastReset=await st.get("meta/last-reset",{type:"json"});lastSeed=await st.get("meta/last-seed",{type:"json"});}catch{}
 return new Response(JSON.stringify({ok:true,service:"gt-padel-agent",lastReset,lastSeed}),{headers:{"content-type":"application/json"}});};
