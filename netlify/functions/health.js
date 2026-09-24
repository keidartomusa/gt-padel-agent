import { getStore } from "@netlify/blobs";
import { BUILD } from "../../src/build-info.js";
// lastReset: when the data was last wiped and how many keys were removed (counts only, no content).
export default async () => {let lastReset=null,lastSeed=null,lastDemo=null;try{const st=getStore({name:"gt-padel-matching",consistency:"strong"});lastReset=await st.get("meta/last-reset",{type:"json"});lastSeed=await st.get("meta/last-seed",{type:"json"});lastDemo=await st.get("meta/last-demo",{type:"json"});}catch{}
 return new Response(JSON.stringify({ok:true,service:"gt-padel-agent",build:BUILD,lastReset,lastSeed,lastDemo}),{headers:{"content-type":"application/json"}});};
