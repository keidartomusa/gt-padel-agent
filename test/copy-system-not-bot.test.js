import test from "node:test";import assert from "node:assert/strict";import {readFileSync,readdirSync} from "node:fs";
// Tom 24.9: the system refers to itself as "מערכת" (feminine), never "בוט", in every message users receive.
test("no user-facing bot copy in src/ says בוט",()=>{for(const f of readdirSync("src").filter(f=>f.endsWith(".js"))){const s=readFileSync(`src/${f}`,"utf8").split("\n").filter(l=>!/^\s*\/\//.test(l)).join("\n");
 const strings=s.match(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g)||[];for(const x of strings)assert.doesNotMatch(x,/בוט/,`${f}: ${x.slice(0,80)}`);}});
test("welcome uses feminine agreement with מערכת",()=>{const s=readFileSync("src/matching.js","utf8");assert.match(s,/והמערכת מחפשת לכם התאמות באופן שוטף/);assert.doesNotMatch(s,/המערכת מחפש /);});
