import { parseIntent } from "./intent.js";
import { findAvailabilitySeries, formatHebrewSeries } from "./availability.js";
export async function answer(text,opts={}){const intent=await parseIntent(text,opts.now,opts.fetchImpl);const results=await findAvailabilitySeries(intent,opts);return formatHebrewSeries(results,opts.formatOptions);}
