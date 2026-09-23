import test from "node:test"; import assert from "node:assert/strict"; import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../netlify/functions/admin.js", import.meta.url), "utf8");
test("Tom 17:13-17:15: overview cards open their tab; clicks tab is named הזמנות", () => {
  for (const [label, v] of [["'משתמשים'", "chats"], ["'בקשות פעילות'", "live"], ["'חיבורים שאושרו'", "live"], ["'לחיצות על \"להזמנה\"'", "clicks"]]) assert.match(src, new RegExp(`\\[${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")},[^\\]]*,'${v}'\\]`), label);
  assert.match(src, /data-v="'\+x\[3\]/); assert.match(src, /<button data-v="clicks">הזמנות<\/button>/); assert.doesNotMatch(src, />לחיצות<\/button>/);
});
