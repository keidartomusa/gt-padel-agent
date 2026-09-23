// One-shot test seed. Triggered by deploy-succeeded only when the deployed commit title contains [db-seed].
import { getStore } from "@netlify/blobs";
import { netlifyStore } from "../../src/store.js";
import { runSeed } from "../../src/seed.js";
import { internalToken } from "./parser-eval-background.js";
export default async req=>{if((req.headers.get("authorization")||"")!==`Bearer ${internalToken()}`){console.log(JSON.stringify({event:"db_seed",status:"unauthorized"}));return new Response("unauthorized",{status:401});}
 const r=await runSeed(netlifyStore(getStore({name:"gt-padel-matching",consistency:"strong"})));console.log(JSON.stringify({event:"db_seed",status:"done",...r}));return new Response("ok");};
