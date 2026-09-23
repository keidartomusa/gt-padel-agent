// Tom 23.9 16:25: hourly - games close automatically 4 hours after their time window ends (no question to the players).
import { getStore } from "@netlify/blobs";
import { autoClose } from "../../src/matching.js";
import { netlifyStore } from "../../src/store.js";
export default async () => { const closed = await autoClose(netlifyStore(getStore("gt-padel-matching"))); console.log(JSON.stringify({ event: "auto_close", closed: closed.length })); return Response.json({ ok: true, closed: closed.length }); };
export const config = { schedule: "7 * * * *" };
