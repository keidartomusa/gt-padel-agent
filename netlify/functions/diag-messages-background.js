// One-shot read-only diagnostic. Triggered by deploy-succeeded only when the deployed commit title contains [diag-messages].
import { getStore } from "@netlify/blobs";
import { netlifyStore } from "../../src/store.js";
import { diagMessages } from "../../src/diag.js";
import { internalToken } from "./parser-eval-background.js";
export default async req=>{if((req.headers.get("authorization")||"")!==`Bearer ${internalToken()}`)return new Response("unauthorized",{status:401});
 const r=await diagMessages(netlifyStore(getStore({name:"gt-padel-matching",consistency:"strong"})),{from:"2026-09-24T05:15:00Z",to:"2026-09-24T07:15:00Z"});console.log(JSON.stringify({event:"diag_messages",users:r.users.length}));return new Response("ok");};
