import test from "node:test";
import assert from "node:assert/strict";
import {GT_VENUE,venueForPhone,isolatedStoreName,assertVenueResponse} from "../src/venues.js";
import {readFileSync} from "node:fs";
test("only the configured GT number can route; unknown number fails closed",()=>{
 const env={WHATSAPP_PHONE_NUMBER_ID:"123456789"};assert.equal(venueForPhone("123456789",env),GT_VENUE);
 assert.equal(venueForPhone("987654321",env),null);assert.equal(venueForPhone(null,env),null);
 assert.equal(venueForPhone("123456789",{}),null);assert.equal(isolatedStoreName(GT_VENUE),"gt-padel-matching");
});
test("output guard blocks another venue URL and unknown tenant even in fallback",()=>{
 const other={name:"OTHER CLUB",venueSlug:"other",publicSiteUrl:"https://other.example"};
 assert.throws(()=>assertVenueResponse(other,{text:"hello"}),/Inactive venue/);
 assert.throws(()=>assertVenueResponse(GT_VENUE,{text:"slot",ctaUrl:{url:"https://matchpointer.app/he/clubs/other/book"}}),/Cross-venue URL/);
 assert.doesNotThrow(()=>assertVenueResponse(GT_VENUE,{text:"שלום GT PADEL",ctaUrl:{url:"https://matchpointer.app/he/clubs/gt-padel/book?date=2026-09-26"}}));
});
test("signed webhook requires destination check before any outbound response",()=>{
 const source=readFileSync(new URL("../netlify/functions/whatsapp.js",import.meta.url),"utf8");
 assert.ok(source.indexOf('routes.some(route=>!route.venue)')<source.indexOf('sendTyping(msg.id'),"unknown destination must fail before outbound");
 assert.ok(source.indexOf('assertVenueResponse(venue,response)')<source.indexOf('sendResponse(msg.from,response,phoneId)'));
});
test("venue booking target guard rejects lookalike paths and other clubs",async()=>{
 const {bookingTargetAllowed}=await import("../src/venues.js");
 assert.equal(bookingTargetAllowed(GT_VENUE,"https://matchpointer.app/he/clubs/gt-padel/book?date=2026-09-26"),true);
 for(const url of ["https://matchpointer.app/he/clubs/other/book?date=2026-09-26","https://matchpointer.app/he/clubs/gt-padel/book-evil?date=2026-09-26","https://evil.example/he/clubs/gt-padel/book","https://matchpointer.app.evil.example/he/clubs/gt-padel/book"])
  assert.equal(bookingTargetAllowed(GT_VENUE,url),false,url);
});
test("parameterized API supports four courts and late closing hours without changing GT",async()=>{
 const {findAvailability}=await import("../src/availability.js");const {clearCache}=await import("../src/matchpointer.js");
 const venue={...GT_VENUE,venueId:"saar-test",venueSlug:"saar-test",name:"Saar",staticTtlMs:0};
 const v={id:venue.venueId,name:"Saar",opening_hours:[{day:"Saturday",isOpen:true,openTime:"07:00",closeTime:"27:00"}],advance_booking_days:25,allow_unbookable_time:true};
 const courts=[1,2,3,4].map(i=>({id:`s${i}`,name:`Court ${i}`,sport:"padel",is_active:true}));
 const rules=[{court_id:null,day_of_week:6,start_time:"20:00:00",end_time:"28:00:00",price:200,price_90:300}];
 const fetchImpl=async url=>({ok:true,json:async()=>url.includes("/venues?")?[v]:url.includes("/courts?")?courts:url.includes("pricing_rules?")?rules:[]});clearCache();
 const r=await findAvailability({date:"2026-09-26",startMinute:24*60,endMinute:27*60,durationMinutes:90},{today:"2026-09-26",fetchImpl,venue});
 assert.equal(r.slots.length,16);assert.equal(r.slots[0].start,"00:00");assert.equal(r.slots[0].price,300);
 assert.equal(r.slots[0].courtName,"Court 1");assert.equal(r.slots[0].end,"01:30");clearCache();
});
