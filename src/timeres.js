// One source of truth for how GT Padel reads times (Tom 23.9). Local rules, the gpt prompt, Jev's options and the
// model-answer validator all read these constants, so the three parsers cannot drift apart. Anchor: Asia/Jerusalem.
import { addDays, localDateParts } from "./time.js";
export const TZ="Asia/Jerusalem";
export const HE_DAYS=["ראשון","שני","שלישי","רביעי","חמישי","שישי","שבת"];
// Parts of day. Tom 23.9 11:06: ערב starts at 19:00.
export const WINDOWS=[
 {key:"morning",he:"בוקר",re:/(?:לפנות\s*בוקר|בוקר|הבוקר)/,range:[360,720]},
 {key:"noon",he:"צהריים",re:/(?:צהריים|בצהרים|בצהריים)/,range:[720,1020]},
 {key:"afternoon",he:"אחה\"צ",re:/(?:אחה["״']?צ|אחרי?\s*הצהריים|אחרהצהריים)/,range:[960,1200]},
 {key:"evening",he:"ערב",re:/(?:ערב|בערב)/,range:[1140,1380]},
 {key:"night",he:"לילה",re:/(?:לילה|בלילה)/,range:[1200,1440]},
];
export const MORNING_CUE=/בוקר|\bam\b|a\.m/i, PM_CUE=/ערב|לילה|צהריים|אחה["״']?צ|אחרי?\s*הצהריים|\bpm\b|p\.m/i;
// Tom 23.9 10:46 hour rules (no cue in the message): 1-7 -> evening; 8, 9, 10 -> ambiguous, ask; 11, 12 -> midday; 0 and 13-23 as written.
// A zero-padded hour ("09:00") counts as written. Cues: בוקר keeps AM; ערב/לילה/צהריים/אחה"צ move 1-11 to PM (11/12 at noon stay).
export function resolveHour(h,text,padded=false){if(h>23)return{h:null};if(/בוקר/.test(text)||padded||h===0||h>=12)return{h};if(/ערב|לילה/.test(text))return{h:h+12};if(/צהריים|אחה["״']?צ|אחרי?\s*הצהריים/.test(text))return{h:h===11?11:h+12};if(h<=7)return{h:h+12};if(h<=10)return{h,ambiguous:true};return{h};}
export const todayIso=now=>localDateParts(now).iso;
export function dateTable(today,days=15){const out=[];for(let i=0;i<=days;i++){const d=addDays(today,i),w=new Date(`${d}T12:00:00Z`).getUTCDay();out.push({iso:d,he:`יום ${HE_DAYS[w]}`,tag:i===0?"היום":i===1?"מחר":i===2?"מחרתיים":""});}return out;}
export const hhmm=m=>`${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`;
// Text for the gpt prompt, generated from the constants above.
export function rulesText(){return `- Hours with no morning/evening word: 1-7 mean PM (e.g. "ב6","שעה שש" = 18:00); 8, 9 or 10 are ambiguous -> needs_clarification="ampm" (still fill the AM value); 11 and 12 mean midday. Hours 13-23 or zero-padded ("09:00") are as written.
- Parts of day (startMinute-endMinute): ${WINDOWS.map(w=>`${w.he}=${w.range[0]}-${w.range[1]}`).join(", ")}.`;}
// Validator for any model answer before it can reach a user. Returns null when fine, else a reason.
export function hourRuleViolation(text,startMinute){if(startMinute==null)return null;const t=String(text||""),h=Math.floor(startMinute/60);
 if(h>=1&&h<=7&&!MORNING_CUE.test(t))return"pm_rule"; // Tom: 1-7 without בוקר is evening
 if(h>=8&&h<=10&&!MORNING_CUE.test(t)&&!/\b0\d:\d\d/.test(t))return"ampm_needed"; // 8-10 AM with no cue must be asked, not guessed
 if(PM_CUE.test(t)&&!MORNING_CUE.test(t)&&h<12&&h!==0)return"pm_cue_ignored";
 return null;}
// Clarification when the models disagree or are unsure (copy pending Tom review).
export const UNCLEAR_WHEN="לא הייתי בטוח שהבנתי מתי. אפשר לכתוב יום ושעה, למשל: מחר ב-19:00 או חמישי בערב.";
