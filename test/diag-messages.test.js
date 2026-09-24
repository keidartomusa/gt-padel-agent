import test from "node:test";import assert from "node:assert/strict";
import {memoryStore} from "../src/store.js";import {logMessage} from "../src/messagelog.js";import {diagMessages} from "../src/diag.js";
test("diag lists window entries per inbound number, masks numbers, writes nothing else",async()=>{const s=memoryStore(),U="15550000094";
 await logMessage(s,U,{direction:"in",kind:"user",type:"interactive",body:"availability",at:new Date("2026-09-24T06:24:00Z")});
 await logMessage(s,U,{direction:"out",kind:"service",type:"list",body:"x",sent:false,reason:"http_400",at:new Date("2026-09-24T06:24:01Z")});
 await logMessage(s,U,{direction:"in",kind:"user",type:"text",body:"old",at:new Date("2026-09-20T06:24:00Z")});
 const r=await diagMessages(s,{from:"2026-09-24T05:00:00Z",to:"2026-09-24T07:00:00Z"});
 assert.equal(r.users.length,1);assert.equal(r.users[0].user,"…0094");assert.equal(r.users[0].rows.length,2);assert.equal(r.users[0].rows[1].reason,"http_400");
 assert.doesNotMatch(JSON.stringify(r),new RegExp(U));});
