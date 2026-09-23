import { getStore } from "@netlify/blobs";
// lastReset: when the data was last wiped and how many keys were removed (counts only, no content).
export default async () => {let lastReset=null;try{lastReset=await getStore({name:"gt-padel-matching",consistency:"strong"}).get("meta/last-reset",{type:"json"});}catch{}
 return new Response(JSON.stringify({ok:true,service:"gt-padel-agent",lastReset}),{headers:{"content-type":"application/json"}});};
