// 226 generated time cases (independent oracle, see gen-when-corpus.mjs). Every case must pass the local rules.
import test from "node:test";import assert from "node:assert/strict";import {readFileSync} from "node:fs";import {parseIntentLocal} from "../src/intent.js";
const now=new Date("2026-09-23T10:36:00+03:00"),c=JSON.parse(readFileSync(new URL("./fixtures/hebrew-when-corpus-generated.json",import.meta.url)));
test("generated corpus size",()=>assert(c.length>=200));
for(const [t,d,s] of c)test(`${t} -> ${d} ${s}`,()=>{const p=parseIntentLocal(t,now);assert.equal(p.date,d);assert.equal(p.startMinute,s);});
