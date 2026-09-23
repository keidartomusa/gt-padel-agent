// Full production data reset (Tom 23.9 16:58 "נקה את הדיבי"): every key in the store is deleted,
// except that people who asked to be removed stay removed (only userId + optedOutAt are kept),
// then one marker records when it ran and how many keys were removed (no content).
export async function resetStore(store,now=new Date(),commit=null){const keys=await store.keys("");let deleted=0,keptOptOuts=0;
 for(const k of keys){if(k.startsWith("profile/")){const p=await store.get(k);if(p?.optedOutAt){await store.set(k,{userId:p.userId||k.slice(8),optedOutAt:p.optedOutAt});keptOptOuts++;continue;}}await store.delete(k);deleted++;}
 const left=(await store.keys("")).length;const marker={at:now.toISOString(),deleted,keptOptOuts,left,commit};await store.set("meta/last-reset",marker);return marker;}
