import test from "node:test";import assert from "node:assert/strict";import {MATCH_TEMPLATE} from "../src/notify.js";import {templateDefinition,TEMPLATE_BUTTONS} from "../src/template.js";
// Tom 24.9 22:06: Meta kept blocking resubmission under the deleted name - use gt_match_found_v2, same body, buttons and category.
test("template is gt_match_found_v2 with the unchanged body, כן / לא, תודה, UTILITY, he",()=>{assert.equal(MATCH_TEMPLATE.name,"gt_match_found_v2");const d=templateDefinition();
 assert.equal(d.name,"gt_match_found_v2");assert.equal(d.components[0].text,"נמצאה לך התאמה למשחק פאדל ב-GT PADEL. רוצה לקבל את הפרטים?");assert.deepEqual(TEMPLATE_BUTTONS,["כן","לא, תודה"]);assert.equal(d.category,"UTILITY");assert.equal(d.language,"he");});
