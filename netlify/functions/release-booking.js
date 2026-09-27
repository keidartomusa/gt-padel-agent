import {getStore} from '@netlify/blobs';
import {netlifyStore} from '../../src/store.js';
import {resolveReleaseBooking} from '../../src/release-booking.js';
export default async req=>{
 try{
  const token=new URL(req.url).searchParams.get('token');
  if(!/^[0-9a-f-]{36}$/.test(token||''))return new Response('קישור לא תקין',{status:404,headers:{'content-type':'text/plain; charset=utf-8'}});
  const result=await resolveReleaseBooking(netlifyStore(getStore({name:'gt-padel-matching',consistency:'strong'})),token);
  if(result.status===302)return Response.redirect(result.location,302);
  if(result.status===404)return new Response('קישור לא תקין',{status:404,headers:{'content-type':'text/plain; charset=utf-8'}});
  return new Response('החלון הזה כבר לא זמין. אפשר לבדוק זמינות חדשה במועדון.',{status:410,headers:{'content-type':'text/plain; charset=utf-8'}});
 }catch(error){console.error(JSON.stringify({event:'release_booking_error',message:String(error.message||error)}));return new Response('לא ניתן לבדוק זמינות כרגע. נסו שוב מאוחר יותר.',{status:503,headers:{'content-type':'text/plain; charset=utf-8'}});}
};
