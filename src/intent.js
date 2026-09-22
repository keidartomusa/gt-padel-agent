import { addDays, localDateParts, weekdayIndex } from "./time.js";

const WINDOWS = [
  { re: /(?:לפנות\s*בוקר|בוקר|הבוקר)/, range: [360, 720] },
  { re: /(?:צהריים|בצהרים|בצהריים)/, range: [720, 1020] },
  { re: /(?:אחה["״']?צ|אחר\s*הצהריים|אחרהצהריים)/, range: [960, 1200] },
  { re: /(?:ערב|בערב)/, range: [1020, 1380] },
  { re: /(?:לילה|בלילה)/, range: [1200, 1440] },
];
const HEBREW_WEEKDAYS = new Map([["ראשון",0],["א",0],["שני",1],["ב",1],["שלישי",2],["ג",2],["רביעי",3],["ד",3],["חמישי",4],["ה",4],["שישי",5],["ו",5],["שבת",6]]);
const pad = n => String(n).padStart(2,"0");
const validIso = iso => { const d=new Date(`${iso}T12:00:00Z`); return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0,10)===iso; };
function dateFromDayOfMonth(day,today){
  const [y,m]=today.split("-").map(Number);
  for(const offset of [0,1]) { const mm=m+offset, yy=y+Math.floor((mm-1)/12), mon=((mm-1)%12)+1, iso=`${yy}-${pad(mon)}-${pad(day)}`; if(validIso(iso)&&iso>=today) return iso; }
  return null;
}
function nextWeekday(today,target,nextWeek=false){ let delta=(target-weekdayIndex(today)+7)%7; if(delta===0||nextWeek) delta+=7; return addDays(today,delta); }
function parseClock(text){
  const m=text.match(/(?:בשעה|סביב|בערך|מ|אחרי|ב)\s*(\d{1,2})(?::(\d{2}))?/);
  if(!m) return [null,null]; let h=Number(m[1]), minute=Number(m[2]||0);
  if(h>23||minute>59) return [null,null];
  if(h<=6 && /ערב|לילה/.test(text)) h+=12; else if(h<12 && /(?:צהריים|אחה["״']?צ|אחר\s*הצהריים)/.test(text)) h+=12;
  return [h*60+minute,h*60+minute+180];
}
export function parseIntentLocal(raw,now=new Date()){
  const text=String(raw||"").normalize("NFKC").replace(/[־–—]/g,"-").replace(/\s+/g," ").trim();
  const today=localDateParts(now).iso; let date=today, dateExplicit=false;
  if(/מחרתיים/.test(text)){date=addDays(today,2);dateExplicit=true;} else if(/מחר/.test(text)){date=addDays(today,1);dateExplicit=true;} else if(/(?:היום|הערב)/.test(text)){dateExplicit=true;}
  const iso=text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/); const slash=text.match(/\b(\d{1,2})[/.](\d{1,2})(?:[/.](20\d{2}))?\b/);
  const dom=text.match(/(?:ב|ל|בתאריך\s*|יום\s*)?(\d{1,2})\s*(?:ל|ב)?חודש\b|(?:ב|ל)\s*-?\s*(\d{1,2})(?:\s|\?|!|$)/);
  if(iso){const candidate=`${iso[1]}-${pad(iso[2])}-${pad(iso[3])}`;if(validIso(candidate)){date=candidate;dateExplicit=true;}}
  else if(slash){const candidate=`${slash[3]||today.slice(0,4)}-${pad(slash[2])}-${pad(slash[1])}`;if(validIso(candidate)){date=candidate;dateExplicit=true;}}
  else if(dom){const day=Number(dom[1]||dom[2]);if(day>=1&&day<=31){const candidate=dateFromDayOfMonth(day,today);if(candidate){date=candidate;dateExplicit=true;}}}
  if(!dateExplicit){ const w=text.match(/(?:יום\s*)?(ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)(?:\s+(הבא))?/); if(w){date=nextWeekday(today,HEBREW_WEEKDAYS.get(w[1]),Boolean(w[2]));dateExplicit=true;} }
  let [startMinute,endMinute]=parseClock(text);if(startMinute==null)for(const {re,range} of WINDOWS)if(re.test(text)){[startMinute,endMinute]=range;}
  // Relational clock constraints are stronger than broad day-parts. "אחרי 20:30 בערב" starts at 20:30.
  const after=text.match(/אחרי\s*(\d{1,2})(?::(\d{2}))?/);
  const before=text.match(/לפני\s*(\d{1,2})(?::(\d{2}))?/);
  if(after){let h=Number(after[1]),m=Number(after[2]||0);if(h<=6&&/ערב|לילה/.test(text))h+=12;startMinute=h*60+m;endMinute=1440;}
  if(before){let h=Number(before[1]),m=Number(before[2]||0);if(h<=6&&/ערב|לילה/.test(text))h+=12;startMinute=0;endMinute=h*60+m;}
  const durationMinutes=/(?:שעה\s*וחצי|90\s*(?:דק|דקות)?)/.test(text)?90:/(?:שעתיים|120\s*(?:דק|דקות)?)/.test(text)?120:/(?:לשעה(?!\s*וחצי)|60\s*(?:דק|דקות)?)/.test(text)?60:90;
  const recurringWeekday=/ימי\s+(ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)(?:\s+הבאים)?/.exec(text);
  const dates=recurringWeekday?Array.from({length:3},(_,i)=>addDays(nextWeekday(today,HEBREW_WEEKDAYS.get(recurringWeekday[1])),i*7)):undefined;
  return {date,startMinute,endMinute,durationMinutes,source:"local",dateExplicit,dates};
}
function sane(parsed,today){ return parsed&&validIso(parsed.date)&&parsed.date>=today&&[60,90,120].includes(parsed.durationMinutes)&&[parsed.startMinute,parsed.endMinute].every(v=>v==null||(Number.isInteger(v)&&v>=0&&v<=1440)); }
export async function parseIntent(text,now=new Date(),fetchImpl=fetch){
  const local=parseIntentLocal(text,now); if(!process.env.OPENAI_API_KEY) return local;
  const today=localDateParts(now).iso;
  try{
    const res=await fetchImpl("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-4o-mini",temperature:0,response_format:{type:"json_object"},messages:[{role:"system",content:`Extract a GT Padel availability request in Hebrew. Today is ${today}, Asia/Jerusalem. Return only JSON: date (YYYY-MM-DD), startMinute (integer|null), endMinute (integer|null), durationMinutes (60|90|120). Resolve "25 לחודש" to the next calendar date numbered 25, never today. Morning 06:00-12:00, afternoon 12:00-17:00, evening 17:00-23:00. Do not invent a time.`},{role:"user",content:text}]})});
    if(!res.ok) throw Error(`OpenAI ${res.status}`); const parsed=JSON.parse((await res.json()).choices[0].message.content);
    // Explicit deterministic dates win over model drift; LLM helps only with fuzzy language.
    const merged=local.dateExplicit?{...parsed,...local,date:local.date}:{...local,...parsed,dates:local.dates}; return sane(merged,today)?{...merged,source:"llm"}:local;
  }catch{return local;}
}
