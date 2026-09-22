import { addDays, localDateParts } from "./time.js";
const windows = { "בבוקר":[360,720], "בצהריים":[720,1020], "אחהצ":[960,1200], "אחר הצהריים":[960,1200], "בערב":[1020,1380], "בלילה":[1200,1440] };
function localParse(text, now) {
  const today=localDateParts(now).iso;
  let date = /מחרתיים/.test(text) ? addDays(today,2) : /מחר/.test(text) ? addDays(today,1) : today;
  const explicit=text.match(/(20\d{2})-(\d{2})-(\d{2})|\b(\d{1,2})[/.](\d{1,2})(?:[/.](20\d{2}))?/);
  if (explicit) date=explicit[1]?`${explicit[1]}-${explicit[2]}-${explicit[3]}`:`${explicit[6]||today.slice(0,4)}-${String(explicit[5]).padStart(2,"0")}-${String(explicit[4]).padStart(2,"0")}`;
  let start=null,end=null;
  const clock=text.match(/(?:ב|מ|אחרי\s*)(\d{1,2})(?::(\d{2}))?/);
  if (clock) { start=Number(clock[1])*60+Number(clock[2]||0); if(start<360) start+=720; end=start+180; }
  for(const [word,w] of Object.entries(windows)) if(text.includes(word)) [start,end]=w;
  const duration=/שעה וחצי|90/.test(text)?90:/שעתיים|120/.test(text)?120:60;
  return {date,startMinute:start,endMinute:end,durationMinutes:duration,source:"local"};
}
export async function parseIntent(text, now=new Date(), fetchImpl=fetch) {
  if (!process.env.OPENAI_API_KEY) return localParse(text,now);
  const today=localDateParts(now).iso;
  try {
    const res=await fetchImpl("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-4o-mini",temperature:0,response_format:{type:"json_object"},messages:[{role:"system",content:`Parse a Hebrew padel availability question. Today is ${today}, timezone Asia/Jerusalem. Return JSON: date YYYY-MM-DD, startMinute integer|null, endMinute integer|null, durationMinutes 60|90|120. Evening means 17:00-23:00.`},{role:"user",content:text}]})});
    if(!res.ok) throw new Error(`OpenAI ${res.status}`);
    const parsed=JSON.parse((await res.json()).choices[0].message.content);
    return {...parsed,source:"llm"};
  } catch { return localParse(text,now); }
}
