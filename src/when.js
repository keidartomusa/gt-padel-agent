// LLM-primary WHEN parser (Tom approved 23.9). Provider-agnostic: each adapter returns the same shape.
// Guard rails: strict JSON schema, validation, Tom's hour rules, local-parser fallback on failure/timeout, parse_source log line.
import { parseIntentLocal } from "./intent.js";
import { localDateParts, addDays, hhmm } from "./time.js";
export const WHEN_TIMEOUT_MS=2500, MAX_DAYS_AHEAD=60;
const HE_DAYS=["ראשון","שני","שלישי","רביעי","חמישי","שישי","שבת"];
export function whenLabel(p){if(!p?.date)return"";const d=new Date(`${p.date}T12:00:00Z`),day=`יום ${HE_DAYS[d.getUTCDay()]} ${d.getUTCDate()}.${d.getUTCMonth()+1}`;if(p.startMinute==null)return day;if(p.endMinute===1440||p.endMinute==null)return `${day}, אחרי ${hhmm(p.startMinute)}`;if(p.startMinute===0)return `${day}, לפני ${hhmm(p.endMinute)}`;return `${day}, ${hhmm(p.startMinute)}–${hhmm(Math.min(p.endMinute,1439))}`;}
export const SCHEMA={name:"when",strict:true,schema:{type:"object",additionalProperties:false,required:["date","startMinute","endMinute","durationMinutes","needs_clarification"],properties:{date:{type:["string","null"],description:"YYYY-MM-DD"},startMinute:{type:["integer","null"]},endMinute:{type:["integer","null"]},durationMinutes:{type:["integer","null"],enum:[60,90,120,null]},needs_clarification:{type:["string","null"],enum:["ampm","which_day","no_time_info",null]}}}};
import { dateTable as trDates, rulesText, hourRuleViolation, WINDOWS as TR_WINDOWS } from "./timeres.js";
export function dateTable(today){return trDates(today).map(d=>`${d.iso} = ${d.he}${d.tag?` (${d.tag})`:""}`).join("\n");}
export function prompt(today){const wd=HE_DAYS[new Date(`${today}T12:00:00Z`).getUTCDay()];return `You parse when a padel player in Israel wants to play, from Hebrew (may include slang, typos, English). Today is ${today} (יום ${wd}), timezone Asia/Jerusalem. Return JSON per the schema.
Rules:
- date: the calendar date meant (never in the past). "מחר"=today+1, "מחרתיים"=today+2, a bare weekday = its next occurrence (today excluded), "סופ\\"ש"=the coming Friday, "מוצ\\"ש"=Saturday from 19:00, "עוד שבועיים"=today+14.
- "שבוע הבא"/"בשבוע הבא" with no specific day: needs_clarification="which_day", date=null.
${rulesText()}
- startMinute/endMinute are minutes from midnight. "אחרי X": start=X, end=1440. "לפני X": start=0, end=X. A single time X: start=X, end=X+180. No time info: both null.
- durationMinutes: 60/90/120 only if stated ("שעה","שעה וחצי","שעתיים"), else null.
- If nothing in the text is a date or time: needs_clarification="no_time_info".
Calendar (use it, do not compute weekdays yourself):
${dateTable(today)}`;}
export async function openaiAdapter(text,today,{fetchImpl=fetch,signal,onUsage}={}){const res=await fetchImpl("https://api.openai.com/v1/chat/completions",{method:"POST",signal,headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-4o-mini",temperature:0,response_format:{type:"json_schema",json_schema:SCHEMA},messages:[{role:"system",content:prompt(today)},{role:"user",content:text}]})});if(!res.ok)throw Error(`openai ${res.status} ${(await res.text().catch(()=>"")).slice(0,200)}`);const j=await res.json();onUsage?.({input:j.usage?.prompt_tokens||0,output:j.usage?.completion_tokens||0,model:j.model});return JSON.parse(j.choices[0].message.content);}
export function validate(p,today){if(!p||typeof p!=="object")return"not_object";if(p.needs_clarification==="which_day"||p.needs_clarification==="no_time_info")return null;if(typeof p.date!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(p.date))return"bad_date";if(p.date<today)return"past_date";if(p.date>addDays(today,MAX_DAYS_AHEAD))return"too_far";for(const v of[p.startMinute,p.endMinute])if(v!=null&&(!Number.isInteger(v)||v<0||v>1440))return"bad_time";if(p.startMinute!=null&&p.endMinute!=null&&p.endMinute<=p.startMinute)return"bad_range";if(p.durationMinutes!=null&&![60,90,120].includes(p.durationMinutes))return"bad_duration";return null;}
export const JEV_MIN_CONFIDENCE=0.8; // Tom 23.9 11:35: agreement + Jev confidence >= 0.8
// Local rules answer when they fully parsed the message: an explicit date, and a time whenever the text mentions one.
export function localConfident(local,text){if(!local.dateExplicit)return false;const t=String(text),timeCue=/\d|בוקר|ערב|צהר|לילה|אחה|שעה|אחרי|לפני|מוצ|am\b|pm\b/i.test(t)||/(?:^|[\s\-])(?:[בלמ]|ב-)?(?:אחת|שתיים|שתים|שלוש|ארבע|חמש|שש|שבע|שמונה|תשע|עשר)(?=$|[\s,.?!])/.test(t);return !timeCue||local.startMinute!=null;}
const CLARIFY=new Set(["which_day","no_time_info"]);
async function timed(ad,text,today,fetchImpl){const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),WHEN_TIMEOUT_MS);try{return await ad(text,today,{fetchImpl,signal:ctl.signal});}finally{clearTimeout(t);}}
// Hybrid parser (Tom approved 23.9 11:35): local rules first; only what they cannot parse goes to gpt + Jev in parallel.
// Agreement on date+start with Jev confidence >= 0.8 and no hour-rule violation answers; anything else asks the user.
export async function parseWhen(text,now=new Date(),{fetchImpl=fetch,adapter=openaiAdapter,verifier,log=true}={}){
 const local=parseIntentLocal(text,now),today=localDateParts(now).iso,t0=Date.now(),out=(r,extra)=>{if(log)console.log(JSON.stringify({event:"parse_source",source:r.source,ms:Date.now()-t0,...extra}));return r;};
 if(local.ambiguousHour)return out({...local,source:"local_ask_ampm"}); // Tom: 8-10 without a cue -> always ask, never let a model guess.
 if(localConfident(local,text))return out({...local,source:"local"});
 if(!process.env.OPENAI_API_KEY)return out({...local,source:"local_no_key"});
 if(!verifier&&process.env.TYPESAFE_API_KEY)verifier=(await import("./jev.js")).jevAdapter;
 if(!verifier){ // gpt only (no Jev key): previous behaviour, with the hour-rule validator
  try{const p=await timed(adapter,text,today,fetchImpl);const bad=validate(p,today);if(bad)return out({...local,source:"local_rejected"},{reason:bad});
   if(CLARIFY.has(p.needs_clarification))return out({...local,needsClarification:p.needs_clarification,source:"llm"});
   const hr=hourRuleViolation(text,p.startMinute);if(hr)return out({...local,source:"local_rejected"},{reason:hr});
   if(local.dateExplicit&&local.date!==p.date)return out({...local,source:"local_disagree"},{llmDate:p.date,localDate:local.date});
   return out({date:p.date,startMinute:p.startMinute,endMinute:p.endMinute,durationMinutes:p.durationMinutes??local.durationMinutes??90,dateExplicit:true,dates:local.dates,source:"llm"});
  }catch(e){return out({...local,source:"local_fallback"},{error:String(e?.name==="AbortError"?"timeout":e?.message||e).slice(0,240)});}}
 const [g,j]=await Promise.allSettled([timed(adapter,text,today,fetchImpl),timed(verifier,text,today,fetchImpl)]);
 const err=r=>r.status==="rejected"?String(r.reason?.name==="AbortError"?"timeout":r.reason?.message||r.reason).slice(0,160):null;
 if(g.status==="rejected"&&j.status==="rejected")return out({...local,source:"local_fallback"},{error:err(g),verifierError:err(j)});
 const gp=g.value,jp=j.value,ask=reason=>out({...local,needsClarification:"unclear",source:"combo_ask"},{reason,gpt:gp&&[gp.date,gp.startMinute],jev:jp&&[jp.date,jp.startMinute],conf:jp?.confidence,gptError:err(g),jevError:err(j)});
 if(gp?.needs_clarification==="which_day"||jp?.needs_clarification==="which_day")return out({...local,needsClarification:"which_day",source:"combo"});
 if(!gp||!jp)return ask("one_provider_failed");
 if(validate(gp,today)||validate(jp,today))return ask("invalid");
 if(CLARIFY.has(gp.needs_clarification)&&CLARIFY.has(jp.needs_clarification))return out({...local,source:"combo_no_time"});
 if(gp.date!==jp.date||gp.startMinute!==jp.startMinute)return ask("disagree");
 if((jp.confidence??0)<JEV_MIN_CONFIDENCE)return ask("low_confidence");
 const hr=hourRuleViolation(text,gp.startMinute);if(hr==="ampm_needed")return out({...local,ambiguousHour:Math.floor(gp.startMinute/60),source:"combo_ask_ampm"});if(hr)return ask(hr);
 return out({date:gp.date,startMinute:gp.startMinute,endMinute:gp.endMinute,durationMinutes:gp.durationMinutes??jp.durationMinutes??local.durationMinutes??90,dateExplicit:true,dates:local.dates,source:"combo"},{conf:jp.confidence});
}
