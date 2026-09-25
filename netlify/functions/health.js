import { getStore } from "@netlify/blobs";
import { BUILD } from "../../src/build-info.js";
// lastReset: when the data was last wiped and how many keys were removed (counts only, no content).
export default async () => {let lastReset=null,lastSeed=null,lastDemo=null,lastDiag=null,lastCourtTemplate=null,lastCourtScan=null,lastCourtReleases=[];try{const st=getStore({name:"gt-padel-matching",consistency:"strong"});lastReset=await st.get("meta/last-reset",{type:"json"});lastSeed=await st.get("meta/last-seed",{type:"json"});lastDemo=await st.get("meta/last-demo",{type:"json"});lastDiag=await st.get("meta/last-diag",{type:"json"});lastCourtTemplate=await st.get("meta/court-template",{type:"json"});
  lastCourtScan=await st.get("meta/court-release-scan",{type:"json"});
  const listed=await st.list({prefix:"court-release/outbox/"});
  for(const item of listed.blobs.slice(0,250)){const row=await st.get(item.key,{type:"json"});if(row?.detectedAt)lastCourtReleases.push({venue:row.window?.venueName,date:row.window?.date,court:row.window?.courtName,startMinute:row.window?.startMinute,endMinute:row.window?.endMinute,detectedAt:row.detectedAt,status:row.status});}
  lastCourtReleases.sort((a,b)=>b.detectedAt.localeCompare(a.detectedAt));lastCourtReleases=lastCourtReleases.slice(0,50);}catch{}
 return new Response(JSON.stringify({ok:true,service:"gt-padel-agent",build:BUILD,lastReset,lastSeed,lastDemo,lastDiag,lastCourtTemplate,lastCourtScan,lastCourtReleases}),{headers:{"content-type":"application/json"}});};
