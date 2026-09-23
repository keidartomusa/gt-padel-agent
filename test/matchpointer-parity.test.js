// Regression (found 2026-09-23 while filming the demo): the bot offered 16:30 on courts 2/3 for ₪240, but the real
// Matchpointer booking page hides 16:30 (it would strand a lone 30-minute cell) and prices 16:00-17:30 at ₪260
// (60 min at the day rate + 30 min at the evening rate). The deep link for a hidden time lands on a different
// preselected time, so the user could book the wrong slot. These tests pin parity with the site's own rules.
import test from "node:test";import assert from "node:assert/strict";
import { priceFor, leavesOrphan, findAvailability } from "../src/availability.js";
import { clearCache } from "../src/matchpointer.js";
const C2="court-2",C3="court-3",C1="court-1";
const rule=(court,s,e,price,extra={})=>({court_id:court,day_of_week:4,start_time:s,end_time:e,price,price_90:null,price_120:null,...extra});
const data={overrides:[],pricing:[rule(C2,"06:00:00","17:00:00",160),rule(C2,"17:00:00","23:00:00",200),rule(C3,"06:00:00","17:00:00",160,{price_90:220}),rule(C3,"17:00:00","23:00:00",200)]};
const D="2026-09-24";// Thursday
test("price spanning two rules is pro rata per segment, like the booking page",()=>{
  assert.equal(priceFor(data,C2,D,16*60,90),260);
  assert.equal(priceFor(data,C2,D,16*60+30,90),280);
  assert.equal(priceFor(data,C2,D,17*60,90),300);
  assert.equal(priceFor(data,C2,D,16*60,60),160);
});
test("a 90-minute package price applies only when the game fits inside its rule",()=>{
  assert.equal(priceFor(data,C3,D,10*60,90),220);
  assert.equal(priceFor(data,C3,D,16*60,90),260);
});
test("a date override beats the weekly rule, and a missing segment means no price",()=>{
  const d={...data,overrides:[{court_id:C2,override_date:D,start_time:"06:00:00",end_time:"23:00:00",price:100,price_90:null,price_120:null}]};
  assert.equal(priceFor(d,C2,D,16*60,90),150);
  assert.equal(priceFor(data,C1,D,16*60,60),null);
});
const venue={allow_unbookable_time:false},range={openTime:"06:00",closeTime:"23:00"};
const busy=[{court_id:C2,date:D,start_time:"13:00:00",end_time:"16:00:00"},{court_id:C2,date:D,start_time:"18:00:00",end_time:"19:00:00"}];
test("a start that strands 30 free minutes before or after the game is not offered",()=>{
  assert.equal(leavesOrphan(venue,busy,C2,D,16*60+30,18*60,range),true,"16:30 leaves 16:00-16:30 alone");
  assert.equal(leavesOrphan(venue,busy,C2,D,16*60,17*60+30,range),true,"ends 17:30 leaves 17:30-18:00 alone");
  assert.equal(leavesOrphan(venue,busy,C2,D,16*60,17*60,range),false);
  assert.equal(leavesOrphan(venue,[],C2,D,6*60+30,7*60+30,range),true,"06:30 leaves 06:00-06:30 alone");
  assert.equal(leavesOrphan(venue,[],C2,D,22*60,22*60+30,range),true,"ends 22:30 leaves 22:30-23:00 alone");
  assert.equal(leavesOrphan({allow_unbookable_time:true},busy,C2,D,16*60+30,18*60,range),false,"venue that allows gaps");
});
test("an orphan cell already in the past today does not hide the slot",()=>{
  assert.equal(leavesOrphan(venue,[],C2,D,6*60+30,7*60+30,range,{nowMinute:5*60+50}),true);
  assert.equal(leavesOrphan(venue,[],C2,D,6*60+30,7*60+30,range,{nowMinute:6*60+10}),false);
});
test("findAvailability applies both rules end to end",async()=>{
  clearCache();
  const venueRow={id:"v",name:"GT",timezone:"Asia/Jerusalem",advance_booking_days:14,allow_unbookable_time:false,opening_hours:["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map(day=>({day,isOpen:true,openTime:"06:00",closeTime:"23:00",timeRanges:[{openTime:"06:00",closeTime:"14:00"},{openTime:"16:00",closeTime:"23:00"}]}))};
  const courts=[C1,C2,C3].map((id,i)=>({id,name:String(i+1),sport:"padel",is_active:true}));
  const slots=[...busy,{court_id:C3,date:D,start_time:"16:00:00",end_time:"23:00:00"},{court_id:C1,date:D,start_time:"16:00:00",end_time:"23:00:00"}];
  const fetchImpl=async url=>({ok:true,json:async()=>url.includes("/venues")?[venueRow]:url.includes("/courts")?courts:url.includes("pricing_rules")?data.pricing:url.includes("overrides")?[]:slots});
  const r=await findAvailability({date:D,startMinute:16*60,endMinute:18*60,durationMinutes:90},{fetchImpl,today:"2026-09-23"});
  clearCache();
  assert.deepEqual(r.slots.map(s=>`${s.courtName}@${s.start}=${s.price}`),[]);
  const r60=await findAvailability({date:D,startMinute:16*60,endMinute:18*60,durationMinutes:60},{fetchImpl,today:"2026-09-23"});
  clearCache();
  assert.deepEqual(r60.slots.map(s=>`${s.courtName}@${s.start}=${s.price}`),["2@16:00=160","2@17:00=200"]);
});
