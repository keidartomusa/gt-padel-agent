// Hourly live test of the 24h re-engagement send (Tom 24.9 17:27). Sends at most once, then only reports "done".
import { getStore } from "@netlify/blobs";
import { netlifyStore } from "../../src/store.js";
import { sendTemplate } from "../../src/whatsapp.js";
import { reengageTest } from "../../src/reengage.js";
export default async()=>{const r=await reengageTest(netlifyStore(getStore({name:"gt-padel-matching",consistency:"strong"})),{sendTemplate:(to,t)=>sendTemplate(to,t.name,t.language,t.payloads)});console.log(JSON.stringify({event:"reengage_test",status:r.status,reason:r.reason||null}));return Response.json({ok:true,status:r.status});};
export const config={schedule:"37 * * * *"};
