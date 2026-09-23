import test from "node:test"; import assert from "node:assert/strict";
import health from "../netlify/functions/health.js";
test("health reports the deployed build stamp", async () => { const j = await (await health()).json(); assert.equal(j.ok, true); assert.equal(typeof j.build, "string"); });
