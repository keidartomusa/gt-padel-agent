import { parseIntent } from "./intent.js";
import { findAvailabilitySeries, formatHebrewSeries, availabilityMessages } from "./availability.js";
export async function answer(text,opts={}){const intent=await parseIntent(text,opts.now,opts.fetchImpl);const results=await findAvailabilitySeries(intent,opts);return formatHebrewSeries(results,opts.formatOptions);}

export async function answerResponse(text,opts={}){const intent=await parseIntent(text,opts.now,opts.fetchImpl),results=await findAvailabilitySeries(intent,opts);return{text:formatHebrewSeries(results,opts.formatOptions),messages:availabilityMessages(results,opts.formatOptions)};}
