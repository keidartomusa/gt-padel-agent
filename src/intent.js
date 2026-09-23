import { addDays, localDateParts, weekdayIndex } from "./time.js";

const WINDOWS = [
  { re: /(?:לפנות\s*בוקר|בוקר|הבוקר)/, range: [360, 720] },
  { re: /(?:צהריים|בצהרים|בצהריים)/, range: [720, 1020] },
  { re: /(?:אחה["״']?צ|אחרי?\s*הצהריים|אחרהצהריים)/, range: [960, 1200] },
  { re: /(?:ערב|בערב)/, range: [1140, 1380] },
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
// Tom 23.9 hour rules (no cue in the message): 1-7 -> evening; 8, 9, 10 -> ambiguous, ask; 11, 12 -> midday; 0 and 13-23 as written.
// A zero-padded hour ("09:00") counts as written. Cues: בוקר keeps AM; ערב/לילה/צהריים/אחה"צ move 1-11 to PM (11/12 at noon stay).
export function resolveHour(h,text,padded=false){if(h>23)return{h:null};if(/בוקר/.test(text)||padded||h===0||h>=12)return{h};if(/ערב|לילה/.test(text))return{h:h+12};if(/צהריים|אחה["״']?צ|אחרי?\s*הצהריים/.test(text))return{h:h===11?11:h+12};if(h<=7)return{h:h+12};if(h<=10)return{h,ambiguous:true};return{h};}
function parseClock(text){
  const m=text.match(/ב?שעה\s*(\d{1,2})(?::(\d{2}))?/)||text.match(/(?:סביב|בערך|בין|מ|אחרי|ב)(?:\s*ב)?\s*-?\s*(\d{1,2})(?::(\d{2}))?(?![\d/.])/)||text.match(/(?:^|\s)(\d{1,2}):(\d{2})(?![\d])/);
  if(!m) return [null,null]; const minute=Number(m[2]||0);if(minute>59)return[null,null];
  const r=resolveHour(Number(m[1]),text,m[1].length===2&&m[1][0]==="0");if(r.h==null)return[null,null];
  return [r.h*60+minute,r.h*60+minute+180,r.ambiguous?Number(m[1]):null];
}
// Tom 23.9 10:36: "ביום חמישי הבא בשעה שש" - hours written as words. Words 1-11 default to the evening (padel context) unless a morning cue is present.
const HOUR_WORDS=[["שתים עשרה",12],["שתיים עשרה",12],["אחת עשרה",11],["אחת",1],["שתיים",2],["שתים",2],["שלוש",3],["ארבע",4],["חמש",5],["שש",6],["שבע",7],["שמונה",8],["תשע",9],["עשר",10]];
export function spelledHours(text){const t=String(text||""),W=HOUR_WORDS.map(x=>x[0]).join("|"),hv=w=>HOUR_WORDS.find(x=>x[0]===w)[1];return t.replace(new RegExp(`ב?רבע\\s*ל-?\\s*(${W}|\\d{1,2})(?=\\s|$|[.,!?])`,"g"),(m,w)=>{const h=(/\d/.test(w)?Number(w):hv(w))-1;return ` בשעה ${h===0?12:h}:45`;}).replace(new RegExp(`(בשעה|אחרי|לפני|מ-?|ב-?)\\s*(${W})\\s+ו(חצי|רבע)(?=\\s|$|[.,!?])`,"g"),(m,pre,w,f)=>`${pre} ${hv(w)}:${f==="חצי"?"30":"15"}`).replace(new RegExp(`(ב?שעה|אחרי|לפני|מ-?|ב-?)\\s*(${W})(?=\\s|$|[.,!?])`,"g"),(m,pre,w)=>`${pre} ${hv(w)}:00`);}
// Tom 23.9: measured corpus (test/fixtures/hebrew-when-corpus.json). Canonicalize slang, typos and English before parsing.
const B="(^|[\\s,.?!])",E="(?=$|[\\s,.?!])";
const CANON=[[/(^|[\s,.?!])(ב|ל|ו)?(?:מאחר|מחרר|מחאר)(?=$|[\s,.?!])/g,"$1$2מחר"],[/מחרתים/g,"מחרתיים"],[/ערבב+/g,"ערב"],[/שישיי+/g,"שישי"],[/שבתת+/g,"שבת"],[/(^|[\s,.?!])(ב|ל|ו)?חמשי(?=$|[\s,.?!])/g,"$1$2חמישי"],[/(^|[\s,.?!])(ב|ל|ו)?רבעי(?=$|[\s,.?!])/g,"$1$2רביעי"],
 [/\btomorrow\b/gi,"מחר"],[/\btoday\b/gi,"היום"],[/\bevening\b/gi,"בערב"],[/\bmorning\b/gi,"בבוקר"],[/(\d{1,2})(?::(\d{2}))?\s*pm\b/gi,(m,h,mm)=>` ${Number(h)%12+12}:${mm||"00"}`],[/(\d{1,2})(?::(\d{2}))?\s*am\b/gi,(m,h,mm)=>` ${String(Number(h)%12).padStart(2,"0")}:${mm||"00"}`],
 [/(?:ב)?מוצאי\s*שבת|(?:ב)?מוצ["״']?ש(?=$|[\s,.?!])/g,"שבת אחרי 19:00"],[/(?:ב)?סוף\s*(?:ה)?שבוע|(?:ב)?סופ["״']?ש(?=$|[\s,.?!])|(?:ב)?סוףש/g,"שישי"],
 [/יום\s*([אבגדהו])['׳]?(?=$|[\s,.?!])/g,(m,l)=>`יום ${["ראשון","שני","שלישי","רביעי","חמישי","שישי"]["אבגדהו".indexOf(l)]}`]];
export function canon(t){let x=String(t||"");for(const[re,to]of CANON)x=x.replace(re,to);return x;}
const MONTHS=["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
const NUMW={"יום":1,"יומיים":2,"שבוע":7,"שבועיים":14};
export function parseIntentLocal(raw,now=new Date()){raw=spelledHours(canon(raw));
  const text=String(raw||"").normalize("NFKC").replace(/[־–—]/g,"-").replace(/\s+/g," ").trim();
  const today=localDateParts(now).iso; let date=today, dateExplicit=false;
  if(/מחרתיים/.test(text)){date=addDays(today,2);dateExplicit=true;} else if(/מחר/.test(text)){date=addDays(today,1);dateExplicit=true;} else if(/(?:היום|הערב)/.test(text)){dateExplicit=true;}
  const rel=text.match(/(?:ב)?עוד\s+(?:(\d{1,2})\s*(ימים|שבועות)|(יומיים|שבועיים|שבוע|יום))/);if(rel){const n=rel[1]?Number(rel[1])*(rel[2]==="שבועות"?7:1):NUMW[rel[3]];date=addDays(today,n);dateExplicit=true;}
  const mon=text.match(new RegExp(`(\\d{1,2})\\s*(?:ב|ל)-?\\s*(${MONTHS.join("|")})`));if(!dateExplicit&&mon){const mm=MONTHS.indexOf(mon[2])+1,y=Number(today.slice(0,4));let c=`${y}-${pad(mm)}-${pad(mon[1])}`;if(c<today)c=`${y+1}-${pad(mm)}-${pad(mon[1])}`;if(validIso(c)){date=c;dateExplicit=true;}}
  const iso=text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/); const slash=text.match(/\b(\d{1,2})[/.](\d{1,2})(?:[/.](20\d{2}))?\b/);
  const timeCue=/מחר|היום|הערב|ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת|בוקר|צהריים|ערב|לילה|אחה|סביב|בערך|בשעה|:/.test(text);const dom=text.match(/(?:ב|ל|בתאריך\s*|יום\s*)?(\d{1,2})\s*(?:ל|ב)?חודש\b/)||(!timeCue&&!/אחרי|לפני|בין|עד/.test(text)?text.match(/(?:^|\s)(?:ב|ל)\s*-?\s*()(\d{1,2})(?:\s|\?|!|$)/):null);
  if(rel||dateExplicit&&mon){}else if(iso){const candidate=`${iso[1]}-${pad(iso[2])}-${pad(iso[3])}`;if(validIso(candidate)){date=candidate;dateExplicit=true;}}
  else if(slash){const candidate=`${slash[3]||today.slice(0,4)}-${pad(slash[2])}-${pad(slash[1])}`;if(validIso(candidate)){date=candidate;dateExplicit=true;}}
  else if(dom){const day=Number(dom[1]||dom[2]);if(day>=1&&day<=31){const candidate=dateFromDayOfMonth(day,today);if(candidate){date=candidate;dateExplicit=true;}}}
  if(!dateExplicit){ const w=text.match(/(?:יום\s*)?(ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)(?:\s+(הבא))?/); if(w){date=nextWeekday(today,HEBREW_WEEKDAYS.get(w[1]),Boolean(w[2]));dateExplicit=true;} }
  const clockText=text.replace(/\b\d{1,2}[/.]\d{1,2}(?:[/.](20\d{2}))?\b/g," ").replace(/(?:ב)?עוד\s+\d{1,2}\s*(?:ימים|שבועות)/g," ").replace(/\d{1,2}\s*(?:ל|ב)?חודש/g," ");let [startMinute,endMinute,ambiguousHour]=parseClock(clockText);if(startMinute==null)for(const {re,range} of WINDOWS)if(re.test(text)){[startMinute,endMinute]=range;}
  // Relational clock constraints are stronger than broad day-parts. "אחרי 20:30 בערב" starts at 20:30.
  const after=text.match(/אחרי\s*(\d{1,2})(?::(\d{2}))?/);
  const before=text.match(/לפני\s*(\d{1,2})(?::(\d{2}))?/);
  if(after){const r=resolveHour(Number(after[1]),text,after[1].length===2&&after[1][0]==="0"),m=Number(after[2]||0);if(r.h!=null){startMinute=r.h*60+m;endMinute=1440;ambiguousHour=r.ambiguous?Number(after[1]):null;}}
  if(before){const r=resolveHour(Number(before[1]),text,before[1].length===2&&before[1][0]==="0"),m=Number(before[2]||0);if(r.h!=null){startMinute=0;endMinute=r.h*60+m;ambiguousHour=r.ambiguous?Number(before[1]):null;}}
  const durationMinutes=/(?:שעה\s*וחצי|90\s*(?:דק|דקות)?)/.test(text)?90:/(?:שעתיים|120\s*(?:דק|דקות)?)/.test(text)?120:/(?:לשעה(?!\s*וחצי)|60\s*(?:דק|דקות)?)/.test(text)?60:90;
  const recurringWeekday=/ימי\s+(ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)(?:\s+הבאים)?/.exec(text);
  const dates=recurringWeekday?Array.from({length:3},(_,i)=>addDays(nextWeekday(today,HEBREW_WEEKDAYS.get(recurringWeekday[1])),i*7)):undefined;
  return {date,startMinute,endMinute,durationMinutes,source:"local",dateExplicit,dates,...(ambiguousHour?{ambiguousHour}:{})};
}
function sane(parsed,today){ return parsed&&validIso(parsed.date)&&parsed.date>=today&&[60,90,120].includes(parsed.durationMinutes)&&[parsed.startMinute,parsed.endMinute].every(v=>v==null||(Number.isInteger(v)&&v>=0&&v<=1440)); }
export async function parseIntent(text,now=new Date(),fetchImpl=fetch){const {parseWhen}=await import("./when.js");return parseWhen(text,now,{fetchImpl});}
