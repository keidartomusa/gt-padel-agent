import test from "node:test";import assert from "node:assert/strict";
import {routeIncoming} from "../src/webhook.js";import {memoryStore} from "../src/store.js";
// Tom 24.9 10:29: the join request says how many are coming and the total.
const now=new Date("2026-09-24T10:20:00+03:00"),P="15550000095",O="972500000079";
async function ask(pc,owner={partySize:1}){const s=memoryStore();await s.set(`profile/${P}`,{userId:P,name:"תום"});
 await s.set("request/d",{recurring:false,displayName:"דנה",level:"3–3.5",hasCourt:false,date:"2026-09-27",startMinute:1260,endMinute:1440,durations:[90],flexMinutes:1440,id:"d",userId:O,active:true,createdAt:now.toISOString(),...owner});
 const say=o=>routeIncoming({userId:P,displayName:"תום",store:s,now,availabilityFn:async i=>({kind:"availability",date:i.date,slots:[]}),...o});
 for(const o of [{text:"היי"},{text:"מציאת שחקנים"},{actionId:"oneoff"},{actionId:"level:3"},{actionId:pc},{text:"ביום ראשון בערב"},{actionId:"flex:0"},{actionId:"duration:90"}]){const r=await say(o);if(/נשמרה/.test(r.text||""))break;}
 const r=await say({actionId:"connect:d"});return r.notifications.find(n=>n.to===O).response.text;}
test("trio -> solo: 'תום ועוד 2 רוצים להצטרף ... יחד תהיו 4'",async()=>assert.equal(await ask("pc:3:yes"),"תום ועוד 2 רוצים להצטרף לבקשה שלכם: ראשון 27.9 · אחרי 21:00 · רמה 3–3.5. יחד תהיו 4. לחבר ביניכם?"));
test("pair -> solo: 'תום ועוד אחד רוצים ... יחד תהיו 3'",async()=>assert.match(await ask("pc:2:yes"),/^תום ועוד אחד רוצים להצטרף לבקשה שלכם: .* יחד תהיו 3\. לחבר ביניכם\?$/));
test("solo -> solo keeps 'רוצה להתחבר' and adds 'יחד תהיו 2'",async()=>assert.match(await ask("pc:1:yes"),/^תום רוצה להתחבר לבקשה שלכם: .* יחד תהיו 2\. לחבר ביניכם\?$/));
test("pair -> solo+joined group: plural and total in the group ask",async()=>assert.match(await ask("pc:2:yes",{partySize:2,joined:["972500000080"],joinedNames:["רון"]}),/^תום ועוד אחד רוצים להצטרף אליכם \(.*\): .* יחד תהיו 4\. לחבר\? מספיק שאחד מכם יאשר\.$/));
