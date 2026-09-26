import {ACTIVE_VENUES,GT_VENUE,venueByKey,isolatedStoreName,assertVenueResponse} from './venues.js';
import {netlifyStore} from './store.js';
import {getStore} from '@netlify/blobs';

export const PICKER={text:'באיזה מועדון תרצו לשחק?',buttons:ACTIVE_VENUES.map(v=>({id:`venue:${v.key}`,title:v.label}))};
export const SELECTOR_STORE='gt-padel-club-selection';
export const selectorStore=()=>netlifyStore(getStore({name:SELECTOR_STORE,consistency:'strong'}));
export const selectionKey=userId=>`selection/${userId}`;
export const mentionedVenue=text=>ACTIVE_VENUES.find(v=>[v.name,v.label,...v.aliases].some(alias=>String(text||'').toLocaleLowerCase('he-IL').includes(alias.toLocaleLowerCase('he-IL'))))||null;
export const isPickerRequest=({actionId,text=''})=>actionId==='select_venue'||(!actionId&&/^(?:(?:עבור|לעבור|עברו|מעבר|החלף|להחליף|שינוי|החלפת|בחירת)\s+(?:ל)?מועדון)(?:[.!])?$/i.test(text.trim()));
export async function selectVenue({store,userId,input,legacyStore}){
 const key=selectionKey(userId),saved=await store.get(key),current=venueByKey(saved?.venueKey);
 const mentioned=!input.actionId&&mentionedVenue(input.text);
 if(mentioned&&mentioned!==current)return{response:{...PICKER,text:'כדי לעבור למועדון אחר, בחרו אותו מהרשימה. הבקשה תמשיך רק אחרי הבחירה.'}};
 if(isPickerRequest(input))return{response:PICKER};
 if(input.actionId?.startsWith('venue:')){
  const target=venueByKey(input.actionId.slice(6));
  if(!target)return{response:PICKER};
  await store.set(key,{venueKey:target.key,selectedAt:new Date().toISOString()});
  return{venue:target,response:assertVenueResponse(target,{text:`בחרתם ${target.name}. מה תרצו לעשות?`,buttons:[{id:'availability',title:'מגרש פנוי'},{id:'players',title:'מציאת שחקנים'},{id:'select_venue',title:'עבור מועדון'}]})};
 }
 if(current)return{venue:current};
 // Existing GT users stay in GT, rather than silently losing their active requests on rollout.
 // A new contact sees the picker before any club data or workflow is opened.
 const gt=legacyStore||netlifyStore(getStore({name:isolatedStoreName(GT_VENUE),consistency:'strong'}));
 if(await gt.get(`seen/${userId}`)){
  await store.set(key,{venueKey:GT_VENUE.key,migrated:true,selectedAt:new Date().toISOString()});
  return{venue:GT_VENUE};
 }
 return{response:PICKER};
}
