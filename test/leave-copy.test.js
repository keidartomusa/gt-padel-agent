import test from "node:test";import assert from "node:assert/strict";
import {routeIncoming} from "../src/webhook.js";import {memoryStore} from "../src/store.js";
// Tom 24.9 10:02/10:07: "הסרה מהרשימה" read like leaving the service for good. Locked copy: button "מחיקת כל הבקשות",
// question "למחוק את כל הבקשות שלכם?", confirmation option A, and it must say new requests are welcome.
const now=new Date("2026-09-24T10:00:00+03:00"),U="972500000061";
const say=(s,o)=>routeIncoming({userId:U,displayName:"x",store:s,now,availabilityFn:async i=>({kind:"availability",date:i.date,slots:[]}),...o});
test("settings shows 'מחיקת כל הבקשות', asks the scoped question and confirms with option A",async()=>{const s=memoryStore();
 const set=await say(s,{text:"הגדרות"});assert.ok(set.buttons.some(b=>b.id==="leave"&&b.title==="מחיקת כל הבקשות"));assert.ok(!JSON.stringify(set).includes("הסרה מהרשימה"));
 const ask=await say(s,{actionId:"leave"});assert.equal(ask.text,"למחוק את כל הבקשות שלכם?");assert.deepEqual(ask.buttons.map(b=>b.title).slice(0,2),["כן, למחוק","לא"]);
 const done=await say(s,{actionId:"leave_yes"});assert.equal(done.text,"מחקתי את כל הבקשות שלכם. אפשר לפתוח בקשה חדשה בכל רגע - פשוט כותבים לי.");
 for(const t of [ask.text,done.text])assert.doesNotMatch(t,/הוסרתם|מהרשימה|לא יישלחו/);});
test("after deleting everything a new request can be opened right away",async()=>{const s=memoryStore();await say(s,{actionId:"leave"});await say(s,{actionId:"leave_yes"});
 const r=await say(s,{text:"מציאת שחקנים"});assert.match(r.text,/מה בא לכם/);});
test("'לא' keeps everything and says so",async()=>{const s=memoryStore();await say(s,{actionId:"leave"});const r=await say(s,{actionId:"leave_no"});assert.equal(r.text,"בסדר, לא מחקתי כלום.");});
