// One-shot production data reset. Triggered by deploy-succeeded only when the deployed commit title contains [db-reset].
import { getStore } from "@netlify/blobs";
import { netlifyStore } from "../../src/store.js";
import { resetStore } from "../../src/reset.js";
import { internalToken } from "./parser-eval-background.js";
export default async req=>{const auth=req.headers.get("authorization")||"";
 if(auth!==`Bearer ${internalToken()}`){console.log(JSON.stringify({event:"db_reset",status:"unauthorized"}));return new Response("unauthorized",{status:401});}
 const r=await resetStore(netlifyStore(getStore({name:"gt-padel-matching",consistency:"strong"})),new Date(),process.env.COMMIT_REF||null);
 console.log(JSON.stringify({event:"db_reset",status:"done",...r}));return new Response("ok");};
