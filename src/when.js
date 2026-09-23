// LLM-primary WHEN parser (Tom approved 23.9). Provider-agnostic: each adapter returns the same shape.
// Guard rails: strict JSON schema, validation, Tom's hour rules, local-parser fallback on failure/timeout, parse_source log line.
import { parseIntentLocal } from "./intent.js";
import { localDateParts, addDays, hhmm } from "./time.js";
export const WHEN_TIMEOUT_MS=2500, MAX_DAYS_AHEAD=60;
const HE_DAYS=["ראשון","שני","שלישי","רביעי","חמישי","שישי","שבת"];
export function whenLabel(p){if(!p?.date)return"";const d=new Date(`${p.date}T12:00:00Z`),day=`יום ${HE_DAYS[d.getUTCDay()]} ${d.getUTCDate()}.${d.getUTCMonth()+1}`;if(p.startMinute==null)return day;if(p.endMinute===1440||p.endMinute==null)return `${day}, אחרי ${hhmm(p.startMinute)}`;if(p.startMinute===0)return `${day}, לפני ${hhmm(p.endMinute)}`;return `${day}, ${hhmm(p.startMinute)}–${hhmm(Math.min(p.endMinute,1439))}`;}
export const SCHEMA={name:"when",strict:true,schema:{type:"object",additionalProperties:false,required:["date","startMinute","endMinute","durationMinutes","needs_clarification"],properties:{date:{type:["string","null"],description:"YYYY-MM-DD"},startMinute:{type:["integer","null"]},endMinute:{type:["integer","null"]},durationMinutes:{type:["integer","null"],enum:[60,90,120,null]},needs_clarification:{type:["string","null"],enum:["ampm","which_day","no_time_info",null]}}}};
export function dateTable(today){const out=[];for(let i=0;i<=15;i++){const d=new Date(`${today}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+i);out.push(`${d.toISOString().slice(0,10)} = יום ${HE_DAYS[d.getUTCDay()]}${i===0?" (היום)":i===1?" (מחר)":""}`);}return out.join("\n");}
export function prompt(today){const wd=HE_DAYS[new Date(`${today}T12:00:00Z`).getUTCDay()];return `You parse when a padel player in Israel wants to play, from Hebrew (may include slang, typos, English). Today is ${today} (יום ${wd}), timezone Asia/Jerusalem. Return JSON per the schema.
Rules:
- date: the calendar date meant (never in the past). "מחר"=today+1, "מחרתיים"=today+2, a bare weekday = its next occurrence (today excluded), "סופ\\"ש"=the coming Friday, "מוצ\\"ש"=Saturday from 19:00, "עוד שבועיים"=today+14.
- "שבוע הבא"/"בשבוע הבא" with no specific day: needs_clarification="which_day", date=null.
- Hours with no morning/evening word: 1-7 mean PM (e.g. "ב6","שעה שש" = 18:00); 8, 9 or 10 are ambiguous -> needs_clarification="ampm" (still fill the AM value); 11 and 12 mean midday. Hours 13-23 or zero-padded ("09:00") are as written.
- startMinute/endMinute are minutes from midnight. "אחרי X": start=X, end=1440. "לפני X": start=0, end=X. A single time X: start=X, end=X+180. Morning=360-720, noon=720-1020, afternoon=960-1200, evening=1140-1380, night=1200-1440. No time info: both null.
- durationMinutes: 60/90/120 only if stated ("שעה","שעה וחצי","שעתיים"), else null.
- If nothing in the text is a date or time: needs_clarification="no_time_info".
Calendar (use it, do not compute weekdays yourself):
${dateTable(today)}`;}
export async function openaiAdapter(text,today,{fetchImpl=fetch,signal,onUsage}={}){const res=await fetchImpl("https://api.openai.com/v1/chat/completions",{method:"POST",signal,headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-4o-mini",temperature:0,response_format:{type:"json_schema",json_schema:SCHEMA},messages:[{role:"system",content:prompt(today)},{role:"user",content:text}]})});if(!res.ok)throw Error(`openai ${res.status} ${(await res.text().catch(()=>"")).slice(0,200)}`);const j=await res.json();onUsage?.({input:j.usage?.prompt_tokens||0,output:j.usage?.completion_tokens||0,model:j.model});return JSON.parse(j.choices[0].message.content);}
export function validate(p,today){if(!p||typeof p!=="object")return"not_object";if(p.needs_clarification==="which_day"||p.needs_clarification==="no_time_info")return null;if(typeof p.date!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(p.date))return"bad_date";if(p.date<today)return"past_date";if(p.date>addDays(today,MAX_DAYS_AHEAD))return"too_far";for(const v of[p.startMinute,p.endMinute])if(v!=null&&(!Number.isInteger(v)||v<0||v>1440))return"bad_time";if(p.startMinute!=null&&p.endMinute!=null&&p.endMinute<=p.startMinute)return"bad_range";if(p.durationMinutes!=null&&![60,90,120].includes(p.durationMinutes))return"bad_duration";return null;}
export async function parseWhen(text,now=new Date(),{fetchImpl=fetch,adapter=openaiAdapter,log=true}={}){
 const local=parseIntentLocal(text,now),today=localDateParts(now).iso,t0=Date.now(),out=(r,extra)=>{if(log)console.log(JSON.stringify({event:"parse_source",source:r.source,ms:Date.now()-t0,...extra}));return r;};
 if(!process.env.OPENAI_API_KEY)return out({...local,source:"local_no_key"});
 if(local.ambiguousHour)return out({...local,source:"local_ask_ampm"}); // Tom: 8-10 without a cue -> always ask, never let a model guess.
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),WHEN_TIMEOUT_MS);
 try{const p=await adapter(text,today,{fetchImpl,signal:ctl.signal});const bad=validate(p,today);if(bad)return out({...local,source:"local_rejected"},{reason:bad});
  if(p.needs_clarification==="which_day"||p.needs_clarification==="no_time_info")return out({...local,needsClarification:p.needs_clarification,source:"llm"});
  const r={date:p.date,startMinute:p.startMinute,endMinute:p.endMinute,durationMinutes:p.durationMinutes??local.durationMinutes??90,dateExplicit:true,dates:local.dates,source:"llm"};
  if(p.needs_clarification==="ampm"&&p.startMinute!=null)r.ambiguousHour=Math.floor(p.startMinute/60)%12||12;
  // A deterministic explicit date that disagrees with the model wins; logged so the corpus can grow from it.
  if(local.dateExplicit&&local.date!==r.date)return out({...local,source:"local_disagree"},{llmDate:r.date,localDate:local.date});
  return out(r);
 }catch(e){return out({...local,source:"local_fallback"},{error:String(e?.name==="AbortError"?"timeout":e?.message||e).slice(0,240)});}
 finally{clearTimeout(timer);}
}
