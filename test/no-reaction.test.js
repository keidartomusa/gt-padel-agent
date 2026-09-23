import test from "node:test";import assert from "node:assert/strict";import fs from "node:fs";
// Tom 23.9: no 👍 reaction on inbound messages (may be charged per message from Oct 1); typing indicator starts immediately instead.
const src=fs.readFileSync(new URL("../netlify/functions/whatsapp.js",import.meta.url),"utf8");
test("webhook never sends a reaction",()=>{assert.doesNotMatch(src,/sendReaction|type:"reaction"/);});
test("typing indicator is the first outbound call, right after parsing, before routing",()=>{const t=src.indexOf("sendTyping(msg.id"),r=src.indexOf("routeIncoming({"),p=src.indexOf("messageInput(msg)");assert(p>0&&t>p&&t<r,"order: parse -> typing -> route");});
