import test from "node:test"; import assert from "node:assert/strict";
import { reasonOf } from "../src/messagelog.js";
test("failed send keeps Meta's error code and detail for the dashboard", () => {
  assert.equal(reasonOf({ sent: true }), null);
  assert.equal(reasonOf({ sent: false, reason: "api_error_400", detail: JSON.stringify({ error: { code: 131009, message: "(#131009) Parameter value is not valid", error_data: { details: "Row ID length exceeds 200" } } }) }), "api_error_400 #131009: Row ID length exceeds 200");
  assert.equal(reasonOf({ sent: false, reason: "disable_outbound" }), "disable_outbound");
});
