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
