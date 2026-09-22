import { parseIntent } from "./intent.js";
import { findAvailability, formatHebrew } from "./availability.js";
export async function answer(text, opts={}) { const intent=await parseIntent(text,opts.now,opts.fetchImpl); return formatHebrew(await findAvailability(intent,opts), opts.formatOptions); }

