import { addDays, localDateParts, weekdayIndex } from "./time.js";
import { timeLabel } from "./requests.js";
const pad=n=>String(n).padStart(2,"0"), clock=m=>`${pad(Math.floor(m/60)%24)}:${pad(m%60)}`;
export const LEVELS=["1–2","2–2.5","2.5–3","3–3.5","3.5–4","4+"];
export const LEVEL_LABELS={"1–2":"מתחילים","2–2.5":"מתחילים+","2.5–3":"בינוניים","3–3.5":"בינוניים+","3.5–4":"בינוניים-גבוהים","4+":"מתקדמים"};
export const levelTitle=l=>LEVEL_LABELS[l]?`${l} · ${LEVEL_LABELS[l]}`:l;
export const DURATIONS=[60,90,120];
export const welcome=(name)=>({text:(name?`*שלום ${name}, ברוכים הבאים ל־GT PADEL* 🎾`:"*ברוכים הבאים ל־GT PADEL* 🎾")+"\n\nאני כאן כדי לעזור לכם להגיע למגרש ולמשחק שמתאים לכם.\n\n*1. למצוא מגרש פנוי*\nבדיקת זמינות חיה לפי יום, שעה ומשך - וקישור ישיר להזמנה.\n\n*2. למצוא שחקנים למשחק*\nחיפוש משחק נקודתי ליום ושעה מסוימים, או הרשמה עם הזמינות הקבועה שלך - והבוט מחפש לך התאמות באופן שוטף.\n\nמה תרצו לעשות?",buttons:[{id:"availability",title:"מגרש פנוי"},{id:"players",title:"מציאת שחקנים"}]});
export function levelRange(label){const nums=(label.match(/\d(?:\.5)?/g)||[]).map(Number);return nums.length?[Math.min(...nums),Math.max(...nums)]:[1,5];}
export function levelsCompatible(a,b){const i=LEVELS.indexOf(a),j=LEVELS.indexOf(b);if(i>=0&&j>=0)return Math.abs(i-j)<=1;const [al,ah]=levelRange(a),[bl,bh]=levelRange(b);return al<=bh&&bl<=ah;}
export function levelNote(mine,theirs){const i=LEVELS.indexOf(mine),j=LEVELS.indexOf(theirs);if(i<0||j<0||i===j)return"";return j>i?" (רמה אחת מעליכם)":" (רמה אחת מתחתיכם)";}
export const FLEX_ANY=1440;
export function flexMinutesFor(v){if(v==="any")return FLEX_ANY;const n=Number(v);return Number.isFinite(n)&&n>0?n:0;}
function widened(x){const f=Math.max(0,Number(x.flexMinutes)||0);return[Math.max(0,x.startMinute-f),Math.min(1440,x.endMinute+f)];}
export function timesCompatible(a,b){const[as,ae]=widened(a),[bs,be]=widened(b);return as<be&&bs<ae;}
function overlap(a,b){return levelsCompatible(a.level,b.level)&&timesCompatible(a,b)&&a.durations.some(x=>b.durations.includes(x));}
export async function activeRequests(store,now=new Date()){const today=localDateParts(now).iso,rows=await store.list("request/");return rows.map(x=>x.value).filter(x=>x.active&&(x.recurring||!x.date||x.date>=today));}
export const appliesOn=(request,date)=>request.recurring?request.weekdays?.includes(weekdayIndex(date)):request.date===date;
export async function findMatches(store,request,now=new Date()){const rows=await activeRequests(store,now);const out=[];for(const x of rows)if(x.id!==request.id&&x.userId!==request.userId&&appliesOn(x,request.date)&&overlap(x,request)&&!await isMuted(store,x.userId,now))out.push(x);return out;}
export async function publicBoard(store,{date,startMinute=0,endMinute=1440,now=new Date()}={}){return(await activeRequests(store,now)).filter(x=>(!date||appliesOn(x,date))&&x.startMinute<endMinute&&startMinute<x.endMinute).sort((a,b)=>a.startMinute-b.startMinute);}
export function formatPhone(userId){const d=String(userId||"").replace(/\D/g,"");if(/^972\d{8,9}$/.test(d)){const l="0"+d.slice(3);return`${l.slice(0,3)}-${l.slice(3)}`;}return d?`+${d}`:"";}
export const clockLabel=m=>clock(m);
export function formatBoard(rows){if(!rows.length)return"לא מצאתי כרגע בקשות פתוחות בחלון הזה. אפשר לפתוח בקשה חדשה ואחפש התאמות.";return`*בקשות פתוחות*\n${rows.slice(0,9).map((x,i)=>`${i+1}. ${x.displayName} · רמה ${x.level} · ${timeLabel(x)} · ${Number(x.partySize)===1?"שחקן אחד":`${x.partySize} שחקנים`}${x.hasCourt?" · יש מגרש":""}`).join("\n")}\n\nלהתחברות בחרו בקשה מהרשימה.`;}
export async function mute(store,userId,until){const p=await store.get(`profile/${userId}`)||{userId};p.mutedUntil=until;await store.set(`profile/${userId}`,p);return p;}
export async function isMuted(store,userId,now=new Date()){const p=await store.get(`profile/${userId}`);return Boolean(p?.mutedUntil&&new Date(p.mutedUntil)>now);}
export async function dailySweep(store,now=new Date()){const req=await activeRequests(store,now),pairs=[],today=localDateParts(now).iso;for(let day=0;day<14;day++){const date=addDays(today,day),candidates=req.filter(x=>appliesOn(x,date));for(let i=0;i<candidates.length;i++)for(let j=i+1;j<candidates.length;j++)if(candidates[i].userId!==candidates[j].userId&&overlap(candidates[i],candidates[j])&&!await isMuted(store,candidates[i].userId,now)&&!await isMuted(store,candidates[j].userId,now)){const key=[candidates[i].id,candidates[j].id,date].sort().join("~");if(!await store.get(`notification/${key}`)){pairs.push([{...candidates[i],date},{...candidates[j],date}]);await store.set(`notification/${key}`,{sentAt:now.toISOString()});}}}return pairs;}
export function expiryFor(date,endMinute=1440){return new Date(`${addDays(date,1)}T00:00:00+03:00`).toISOString();}
