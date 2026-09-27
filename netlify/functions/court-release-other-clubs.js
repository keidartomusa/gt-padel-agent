import {getStore} from '@netlify/blobs';
import {netlifyStore} from '../../src/store.js';
import {SAAR_VENUE,SMASH_VENUE,isolatedStoreName} from '../../src/venues.js';
import {scanCourtReleases} from '../../src/court-release.js';
// Independent read-only scans. No outbound sender or send flag is wired here.
export default async()=>{
 const output=[];
 for(const club of [SAAR_VENUE,SMASH_VENUE]){
  try{const store=netlifyStore(getStore({name:isolatedStoreName(club),consistency:'strong'}));const result=await scanCourtReleases(store,{club,scanOnly:true});
   await store.set('meta/court-release-scan',result);output.push({club:club.key,...result});}
  catch(error){console.error(JSON.stringify({event:'court_release_scan_error',club:club.key,message:String(error.message||error)}));output.push({club:club.key,status:'scan_failed'});}
 }
 return Response.json({ok:output.every(x=>x.status!=='scan_failed'),mode:'scan_only',clubs:output},{status:output.some(x=>x.status==='scan_failed')?503:200});
};
export const config={schedule:'*/30 * * * *'};
