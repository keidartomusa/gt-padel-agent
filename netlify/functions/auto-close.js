// Tom 23.9 16:25: hourly - games close automatically 4 hours after their time window ends (no question to the players).
import {ACTIVE_VENUES,isolatedStoreName} from "../../src/venues.js";
import { getStore } from "@netlify/blobs";
import { autoClose } from "../../src/matching.js";
import { netlifyStore } from "../../src/store.js";
export default async () => { let closed=0; for(const venue of ACTIVE_VENUES)closed+=(await autoClose(netlifyStore(getStore(isolatedStoreName(venue))))).length; console.log(JSON.stringify({event:"auto_close",closed}));return Response.json({ok:true,closed}); };
export const config = { schedule: "7 * * * *" };
