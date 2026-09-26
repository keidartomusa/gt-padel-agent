import {getStore} from '@netlify/blobs';
import {authGate} from '../../src/auth.js';
import {netlifyStore} from '../../src/store.js';
import {GT_VENUE,venueByKey,isolatedStoreName} from '../../src/venues.js';
import {clubContact,validContact} from '../../src/club-contact.js';
export default async(req,context)=>{
 const guardStore=netlifyStore(getStore({name:isolatedStoreName(GT_VENUE),consistency:'strong'}));
 const denied=await authGate(req,guardStore,{context});if(denied)return denied;
 const venue=venueByKey(new URL(req.url).searchParams.get('venue'));
 if(!venue)return Response.json({error:'invalid_venue'},{status:400});
 const store=netlifyStore(getStore({name:isolatedStoreName(venue),consistency:'strong'}));
 if(req.method==='GET')return Response.json({venue:venue.key,url:await clubContact(venue,store)});
 if(req.method!=='PUT')return new Response('method not allowed',{status:405});
 const body=await req.json().catch(()=>null);
 if(!validContact(body?.number))return Response.json({error:'invalid_number'},{status:400});
 await store.set('config/contact',{number:body.number,changedAt:new Date().toISOString()});
 return Response.json({venue:venue.key,url:await clubContact(venue,store)});
};
