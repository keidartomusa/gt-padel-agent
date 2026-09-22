import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const corpus=JSON.parse(await readFile(new URL("./fixtures/group-history-corpus.json",import.meta.url)));
test("anonymized group-history corpus preserves real partner and availability language",()=>{
  assert.equal(corpus.partnerMatching.length,32);
  assert.equal(corpus.courtAvailability.length,12);
  assert(corpus.partnerMatching.some(x=>x.text.includes("להצטרפלמשחק")));
  assert(corpus.partnerMatching.some(x=>x.text.includes("יש לי מגרש")));
  assert(corpus.partnerMatching.some(x=>x.text.includes("פעם בשבוע")));
  assert(corpus.courtAvailability.some(x=>x.includes("אחרי 20:30")));
  const serialized=JSON.stringify(corpus);
  assert.doesNotMatch(serialized,/(?:\+972|05\d[- ‑]?\d{3}[- ‑]?\d{4})/);
});
