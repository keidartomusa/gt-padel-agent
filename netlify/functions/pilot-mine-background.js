import { bearerOk } from "../../src/auth.js";
// Background function: dumps anonymized pilot free-text messages + local parse to the function log for corpus labeling.
// Triggered by deploy-succeeded when the deployed commit title contains [pilot-mine], or with the admin token.
import { getStore } from "@netlify/blobs";
import { netlifyStore } from "../../src/store.js";
import { minePilot } from "../../src/pilot-mine.js";
import { internalToken } from "./parser-eval-background.js";
export default async req=>{const auth=req.headers.get("authorization")||"";
 if(auth!==`Bearer ${internalToken()}`&&!bearerOk(req)){console.log(JSON.stringify({event:"pilot_mine",status:"unauthorized"}));return new Response("unauthorized",{status:401});}
 const r=await minePilot(netlifyStore(getStore("gt-padel-matching")));const{items,...summary}=r;
 console.log(JSON.stringify({event:"pilot_mine",status:"summary",...summary}));
 for(let k=0;k<items.length;k+=8)console.log(JSON.stringify({event:"pilot_mine",status:"items",part:k/8,items:items.slice(k,k+8)}));
 console.log(JSON.stringify({event:"pilot_mine",status:"done"}));return new Response("ok");};
