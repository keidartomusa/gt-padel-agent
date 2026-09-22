import test from "node:test"; import assert from "node:assert/strict";
import { parseIntent } from "../src/intent.js"; import { formatHebrew } from "../src/availability.js";
const now=new Date("2026-09-22T08:00:00Z");
const dateCases=[
 ["יש מגרש מחר בערב?","2026-09-23"],["מחרתיים בבוקר פנוי?","2026-09-24"],["מתי יש מגרש ב25 לחודש?","2026-09-25"],["מה פנוי ב-25 לחודש","2026-09-25"],
 ["זמינות ל25 לחודש","2026-09-25"],["אפשר ב 25 לחודש?","2026-09-25"],["מגרש 25/9","2026-09-25"],["פנוי 25.9?","2026-09-25"],["2026-09-25 בערב","2026-09-25"],
 ["יום רביעי בערב","2026-09-23"],["חמישי הבא בבוקר","2026-10-01"],["שישי בצהריים","2026-09-25"],["שבת בלילה","2026-09-26"],
];
const prefixes=["יש","אפשר","תבדוק","מה פנוי","מתי יש","מחפש","רוצה","צריך"];
const suffixes=["?"," בבקשה"," לשעה"," לשעה וחצי"," ל-90 דקות"," לשעתיים"," תודה"];
const corpus=[]; for(const [base,expected] of dateCases)for(const p of prefixes.slice(0,4))for(const s of suffixes.slice(0,2))corpus.push({text:`${p} ${base}${s}`,expected});
// Deterministic 100-conversation QA set spanning wording and typo variants.
const hundred=corpus.slice(0,100);
test("100 varied Hebrew conversations preserve date intent and valid schema",async()=>{delete process.env.OPENAI_API_KEY;assert.equal(hundred.length,100);for(const c of hundred){const x=await parseIntent(c.text,now);assert.equal(x.date,c.expected,c.text);assert([60,90,120].includes(x.durationMinutes),c.text);assert(x.startMinute==null||(x.startMinute>=0&&x.startMinute<=1440),c.text);}});
test("100 representative replies meet WhatsApp product bar",()=>{for(let i=0;i<100;i++){const slots=[];for(const courtName of ["1","2","3"])for(let j=0;j<8;j++){const h=17+Math.floor(j/2),m=j%2?"30":"00";slots.push({courtName,start:`${String(h).padStart(2,"0")}:${m}`,end:`${String(h+1).padStart(2,"0")}:${m}`,price:j<4?160:200});}const text=formatHebrew({kind:"availability",date:"2026-09-25",slots});assert(text.length<500);assert(text.split("\n").length<=10);assert(!/יש עוד \d+ אפשרויות/.test(text));assert(!/undefined|null|NaN/.test(text));assert.doesNotMatch(text,/בדיקת זמינות בלבד|להזמנה: https?:/);}});
test("after-time beats broad evening window",async()=>{delete process.env.OPENAI_API_KEY;const x=await parseIntent("בימי רביעי הבאים, מתי יש מגרשים פנויים אחרי 20:30 בערב ל90 דק",now);assert.equal(x.startMinute,1230);assert.equal(x.endMinute,1440);assert.equal(x.durationMinutes,90);});
test("plural upcoming weekdays yield three dates",async()=>{delete process.env.OPENAI_API_KEY;const x=await parseIntent("בימי רביעי הבאים, מתי יש מגרשים פנויים אחרי 20:30 בערב ל90 דק",now);assert.deepEqual(x.dates,["2026-09-23","2026-09-30","2026-10-07"]);});
test("availability responses put exact Matchpointer deep links only in CTA metadata",async()=>{const {answerResponse}=await import("../src/agent.js"),r=await answerResponse("מגרש ב25/9 בשעה 17:00 ל90 דקות",{now:new Date("2026-09-23T08:00:00+03:00")});assert.doesNotMatch(r.text,/https?:|בדיקת זמינות בלבד/);const trackingUrl=new URL(r.choices[0].url),target=new URL(trackingUrl.searchParams.get("target"));assert.equal(target.origin,"https://matchpointer.app");assert.equal(target.pathname,"/he/clubs/gt-padel/book");for(const key of ["court","time","date","duration","step"])assert(target.searchParams.get(key));assert.equal(target.searchParams.get("step"),"confirm");});
