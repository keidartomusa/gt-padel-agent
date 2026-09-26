import {isolatedStoreName} from './venues.js';
import {CLUB_URL} from './conversation.js';
import {getStore} from '@netlify/blobs';
import {netlifyStore} from './store.js';

// GT's current contact is the fallback until Tom assigns a different one per club.
// Overrides live in the club's own store, so changing a number needs no build.
export const DEFAULT_CONTACT=new URL(CLUB_URL).pathname.slice(1);
export function validContact(number){return /^972\d{8,9}$/.test(String(number||''));}
export async function clubContact(venue,store=netlifyStore(getStore({name:isolatedStoreName(venue),consistency:'strong'}))){
 const override=await store.get('config/contact');
 const number=validContact(override?.number)?override.number:DEFAULT_CONTACT;
 return `https://wa.me/${number}`;
}
