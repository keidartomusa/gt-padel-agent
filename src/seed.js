// Test seed (Tom 23.9 17:38): two requests with fictitious numbers, entered through the real conversation flow.
// If no court is free for the one-off window, it is stored directly (Tom: publish anyway, the goal is testing matching).
import { handleConversation } from "./conversation.js";
import { findAvailability } from "./availability.js";
import { localDateParts } from "./time.js";
export const SEED=[
 {userId:"972500000001",name:"תימור",steps:[{actionId:"oneoff"},{actionId:"level:3"},{actionId:"pc:1:no"},{text:"היום ב-21:00 ל90 דקות"},{actionId:"flex:0"}],fallback:now=>({recurring:false,level:"3–3.5",date:localDateParts(now).iso,startMinute:1260,endMinute:1440})},
 {userId:"972500000002",name:"אורנה",steps:[{actionId:"recurring"},{actionId:"level:3"},{actionId:"party:1"},{text:"כל רביעי בערב"},{actionId:"duration:90"}]}];
export async function runSeed(store,{now=new Date(),availabilityFn=findAvailability}={}){const out=[];
 for(const s of SEED){await store.set(`profile/${s.userId}`,{userId:s.userId,name:s.name,seeded:true});let last=null;
  for(const st of s.steps){if(/נשמרה/.test(last?.text||""))break;last=await handleConversation({userId:s.userId,displayName:s.name,store,now,availabilityFn,...st});}
  let req=(await store.list("request/")).map(x=>x.value).find(r=>r?.userId===s.userId&&r.active),forced=false;
  if(!req&&s.fallback){req={...s.fallback(now),durations:[90],partySize:1,hasCourt:false,flexMinutes:0,displayName:s.name,userId:s.userId,id:`seed${s.userId.slice(-1)}${now.getTime().toString(36)}`,active:true,createdAt:now.toISOString()};await store.set(`request/${req.id}`,req);forced=true;}
  await store.set(`state/${s.userId}`,{});
  out.push({name:s.name,userId:s.userId,requestId:req?.id||null,level:req?.level||null,recurring:Boolean(req?.recurring),date:req?.date||null,weekdays:req?.weekdays||null,startMinute:req?.startMinute??null,endMinute:req?.endMinute??null,courtSlot:Boolean(req?.courtSlot),forced,lastBotText:String(last?.text||"").slice(0,160)});}
 const marker={at:now.toISOString(),requests:out};await store.set("meta/last-seed",marker);return marker;}
