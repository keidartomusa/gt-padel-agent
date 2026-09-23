// Production data reset (Tom 23.9 17:21: "לנקות את השיחות, משתמשים, בקשות והתאמות"): every key is deleted
// except booking clicks (not in his list) and opt-outs,
// except that people who asked to be removed stay removed (only userId + optedOutAt are kept),
// then one marker records when it ran and how many keys were removed (no content).
// {clicks:true} (Tom 17:25 "לנקות גם את הלחיצות להזמנה") deletes booking clicks too.
export async function resetStore(store,now=new Date(),commit=null,{clicks=false}={}){const keys=await store.keys("");let deleted=0,keptOptOuts=0,keptClicks=0;
 for(const k of keys){if(!clicks&&k.startsWith("booking-click/")){keptClicks++;continue;}if(k.startsWith("profile/")){const p=await store.get(k);if(p?.optedOutAt){await store.set(k,{userId:p.userId||k.slice(8),optedOutAt:p.optedOutAt});keptOptOuts++;continue;}}await store.delete(k);deleted++;}
 const left=(await store.keys("")).length;const marker={at:now.toISOString(),deleted,keptOptOuts,keptClicks,left,commit};await store.set("meta/last-reset",marker);return marker;}
