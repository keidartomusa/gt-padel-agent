import {CONFIG} from "./config.js";

// Only GT is active. A new venue requires its own number, account, content and storage.
export const GT_VENUE=Object.freeze({key:"gt",venueId:CONFIG.venueId,venueSlug:CONFIG.venueSlug,name:"GT PADEL",timezone:CONFIG.timezone,storeName:"gt-padel-matching",siteOrigin:CONFIG.siteOrigin,apiBase:CONFIG.apiBase,anonKey:CONFIG.anonKey,staticTtlMs:CONFIG.staticTtlMs,advanceDays:CONFIG.advanceDays,publicSiteUrl:"https://gtpadel.netlify.app"});
export const ACTIVE_VENUES=Object.freeze([GT_VENUE]);
export function venueForPhone(phoneNumberId,env=process.env){const configured=env.WHATSAPP_PHONE_NUMBER_ID;
 if(!/^\d{5,}$/.test(String(configured||""))||String(phoneNumberId||"")!==String(configured))return null;
 return GT_VENUE;
}
export function isolatedStoreName(venue){if(!ACTIVE_VENUES.includes(venue))throw Error("Inactive venue");return venue.storeName;}
export function assertVenueContent(venue,text){if(!ACTIVE_VENUES.includes(venue))throw Error("Inactive venue");
 if(typeof text!=="string")throw Error("Invalid output");
 // Future onboarding must add all other venue names and aliases here and test every output.
 for(const other of ACTIVE_VENUES)if(other!==venue&&text.toLocaleLowerCase("he-IL").includes(other.name.toLocaleLowerCase("he-IL")))throw Error("Cross-venue output blocked");
 return text;
}
export function assertVenueResponse(venue,response){
 const check=x=>{if(typeof x==="string")assertVenueContent(venue,x);else if(Array.isArray(x))x.forEach(check);else if(x&&typeof x==="object")Object.entries(x).forEach(([k,v])=>{if(k==="url"||k==="target"){
  const u=new URL(v,venue.publicSiteUrl);if(u.origin!==venue.publicSiteUrl&&!(u.origin===venue.siteOrigin&&u.pathname.startsWith(`/he/clubs/${venue.venueSlug}/`)))throw Error("Cross-venue URL blocked");
 }else check(v)});};check(response);return response;
}
