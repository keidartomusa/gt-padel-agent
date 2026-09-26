import {GT_VENUE,venueByKey,isolatedStoreName} from './venues.js';
import {getStore} from '@netlify/blobs';
import {netlifyStore} from './store.js';
import {authGate} from './auth.js';

// The selected tenant comes from the dashboard route/API parameter, never from a browser-stored token.
export function dashboardVenue(url){
 const path=new URL(url).pathname;
 const key=path==='/admin'||path==='/.netlify/functions/admin'?'gt':/^\/admin\/(saar|smash)\/?$/.exec(path)?.[1];
 return venueByKey(key);
}
export function dashboardSecret(venue,env=process.env){
 if(venue===GT_VENUE)return env.ADMIN_DASHBOARD_TOKEN;
 if(venue?.key==='saar')return env.ADMIN_SAAR_TOKEN;
 if(venue?.key==='smash')return env.ADMIN_SMASH_TOKEN;
 return undefined;
}
export const dashboardStore=venue=>netlifyStore(getStore({name:isolatedStoreName(venue),consistency:'strong'}));
export async function dashboardGate(req,context,venue,options={}){
 const store=options.store||dashboardStore(venue);
 return authGate(req,store,{context,secret:dashboardSecret(venue,options.env)??null});
}
export function requestedVenue(req){return venueByKey(new URL(req.url).searchParams.get('venue')||'gt');}
