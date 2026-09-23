import test from "node:test";import assert from "node:assert/strict";import fs from "node:fs";import {parseIntentLocal} from "../src/intent.js";
// Tom 23.9: coverage is measured, not vibes. Corpus of real Hebrew "when" phrasings; now = Wed 23.9.2026 10:36 IDT.
// Every case outside known-gaps must pass. A known gap that starts passing must be removed from the list (so coverage only goes up).
const now=new Date("2026-09-23T10:36:00+03:00");
const C=JSON.parse(fs.readFileSync(new URL("./fixtures/hebrew-when-corpus.json",import.meta.url)));
const GAPS=new Set(JSON.parse(fs.readFileSync(new URL("./fixtures/hebrew-when-known-gaps.json",import.meta.url))));
const ok=([t,d,st,amb])=>{const p=parseIntentLocal(t,now);return p.date===d&&(st==null||p.startMinute===st)&&Boolean(p.ambiguousHour)===(amb==="ambiguous");};
test("corpus coverage report",()=>{const pass=C.filter(ok).length;console.log(`hebrew-when coverage: ${pass}/${C.length}`);assert(C.length>=80);});
for(const c of C)test(`${GAPS.has(c[0])?"[known gap] ":""}${c[0]} -> ${c[1]} ${c[2]??""}`,()=>{if(GAPS.has(c[0]))assert(!ok(c),`now passes - remove "${c[0]}" from known gaps`);else assert(ok(c),JSON.stringify(parseIntentLocal(c[0],now)));});
