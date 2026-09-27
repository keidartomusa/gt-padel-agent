import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('public health exposes only minimal read-only status for each separate club scan',()=>{
 const source=readFileSync('netlify/functions/health.js','utf8');
 assert.match(source,/otherCourtScans/);assert.match(source,/SAAR_VENUE,SMASH_VENUE/);
 assert.match(source,/mode:row.mode/);assert.match(source,/sent:row.sent/);
 assert.doesNotMatch(source,/otherCourtScans\[club.key\]=row[;,]/);
});
