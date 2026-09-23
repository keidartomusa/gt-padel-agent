import { addDays, localDateParts, weekdayIndex, zonedMs } from "./time.js";
import { timeLabel, dayLabel } from "./requests.js";
const pad=n=>String(n).padStart(2,"0"), clock=m=>`${pad(Math.floor(m/60)%24)}:${pad(m%60)}`;
export const LEVELS=["1–2","2–2.5","2.5–3","3–3.5","3.5–4","4+"];
export const LEVEL_LABELS={"1–2":"מתחילים","2–2.5":"מתחילים+","2.5–3":"בינוניים","3–3.5":"בינוניים+","3.5–4":"בינוניים-גבוהים","4+":"מתקדמים"};
export const levelTitle=l=>LEVEL_LABELS[l]?`${l} · ${LEVEL_LABELS[l]}`:l;
export const DURATIONS=[60,90,120];
export const welcome=(name)=>({text:(name?`*שלום ${name}, ברוכים הבאים ל־GT PADEL* 🎾`:"*ברוכים הבאים ל־GT PADEL* 🎾")+"\n\nאני כאן כדי לעזור לכם להגיע למגרש ולמשחק שמתאים לכם.\n\n*1. למצוא מגרש פנוי*\nבדיקת זמינות חיה לפי יום, שעה ומשך - וקישור ישיר להזמנה.\n\n*2. למצוא שחקנים למשחק*\nחיפוש משחק נקודתי ליום ושעה מסוימים, או הרשמה עם הזמינות הקבועה שלכם - והבוט מחפש לכם התאמות באופן שוטף.\n\nמה תרצו לעשות?",buttons:[{id:"availability",title:"מגרש פנוי"},{id:"players",title:"מציאת שחקנים"}]});
export function levelRange(label){const nums=(label.match(/\d(?:\.5)?/g)||[]).map(Number);return nums.length?[Math.min(...nums),Math.max(...nums)]:[1,5];}
export function levelsCompatible(a,b){const i=LEVELS.indexOf(a),j=LEVELS.indexOf(b);if(i>=0&&j>=0)return Math.abs(i-j)<=1;const [al,ah]=levelRange(a),[bl,bh]=levelRange(b);return al<=bh&&bl<=ah;}
export function levelNote(mine,theirs){const i=LEVELS.indexOf(mine),j=LEVELS.indexOf(theirs);if(i<0||j<0||i===j)return"";return j>i?" (רמה אחת מעליכם)":" (רמה אחת מתחתיכם)";}
export const FLEX_ANY=1440;
export function flexMinutesFor(v){if(v==="any")return FLEX_ANY;const n=Number(v);return Number.isFinite(n)&&n>0?n:0;}
function widened(x){const f=Math.max(0,Number(x.flexMinutes)||0);return[Math.max(0,x.startMinute-f),Math.min(1440,x.endMinute+f)];}
export function timesCompatible(a,b){const[as,ae]=widened(a),[bs,be]=widened(b);return as<be&&bs<ae;}
export const partyOf=x=>Number(x?.partySize)||1;
// Critique 23.9 item 6: two sides only match when together they are at most 4.
function overlap(a,b){return levelsCompatible(a.level,b.level)&&timesCompatible(a,b)&&a.durations.some(x=>b.durations.includes(x))&&partyOf(a)+partyOf(b)<=4;}
// Item 8: "לא הפעם" on an alert hides that one pairing (either direction), nothing else.
export const skipKey=(userId,requestId)=>`skip/${userId}/${requestId}`;
const skipped=async(store,a,b)=>Boolean(await store.get(skipKey(a.userId,b.id))||await store.get(skipKey(b.userId,a.id)));
const durText=r=>r.durations?.length>1?"משך גמיש":r.durations?.length?`${r.durations[0]} דק׳`:"";
// Item 5: the alert shows who, when, level, party, court, duration and the combined count. One builder for instant and daily alerts.
export function matchAlert(viewer,r){const sum=partyOf(viewer)+partyOf(r),when=`${dayLabel(r.recurring&&r.date?{date:r.date}:r)} · ${timeLabel(r)}`;const g=groupNames(r).length>1;return{text:`מצאתי התאמה אפשרית: ${g?`${groupLabel(r)} (כבר מחוברים ביניהם)`:r.displayName} · ${when} · רמה ${r.level}${levelNote(viewer.level,r.level)}\n${[partyOf(r)===1?"שחקן אחד":`${partyOf(r)} שחקנים`,r.hasCourt?"יש מגרש":"בלי מגרש",durText(r)].filter(Boolean).join(" · ")}\nיחד: ${sum} מתוך 4\n\nתרצו להתחבר?`,buttons:[{id:`connect:${r.id}`,title:"רוצה להתחבר"},{id:`notnow:${r.id}`,title:"לא הפעם"}]};}
// Tom 23.9 16:25: a game closes automatically 4 hours after its time window ends - no question asked.
// End = the booked court slot's end when there is one, otherwise the request window's end (open-ended = midnight).
export const CLOSE_AFTER_MS=4*3600000;
const mins=t=>{const[h,m]=String(t).split(":").map(Number);return h*60+(m||0);};
export function gameEndMs(r,date=r.date){const end=r.courtSlot?.end?mins(r.courtSlot.end):Math.min(r.endMinute??1440,1440);return zonedMs(date,end);}
export const gameOver=(r,now=new Date(),date=r.date)=>Boolean(date)&&now.getTime()>=gameEndMs(r,date)+CLOSE_AFTER_MS;
export async function activeRequests(store,now=new Date()){const today=localDateParts(now).iso,yesterday=addDays(today,-1),rows=await store.list("request/");return rows.map(x=>x.value).filter(x=>x.active&&(x.recurring||!x.date||(x.date>=yesterday&&!gameOver(x,now))));}
// Hourly: persist the automatic closing (requests leave the board; their connections are done).
export async function autoClose(store,now=new Date()){const closed=[];for(const{value:r}of await store.list("request/")){if(!r||r.recurring||!r.date||r.closedReason==="time_passed"||r.deletedAt||!gameOver(r,now))continue;await store.set(`request/${r.id}`,{...r,active:false,closedAt:r.closedAt||now.toISOString(),closedReason:r.active?"time_passed":r.closedReason,gameOverAt:now.toISOString()});closed.push(r.id);}
 const ids=new Set(closed);for(const{value:c}of await store.list("connection/"))if(c&&ids.has(c.requestId)&&(c.status==="accepted"||c.status==="pending"))await store.set(`connection/${c.id}`,{...c,status:c.status==="accepted"?"done":"expired",doneAt:now.toISOString()});return closed;}
// Tom 23.9 16:27: a connected group is one match - one message with all the names, never one per member.
export function groupNames(r){return[r.displayName,...(r.joinedNames||[])].filter(Boolean);}
// Tom 23.9 17:04: the viewer's own name is marked "(אתה)" on the board.
export function isMine(r,viewerId){return Boolean(viewerId)&&(r.userId===viewerId||(r.joined||[]).includes(viewerId));}
function namesFor(r,viewerId){const ids=[r.userId,...(r.joined||[])];return[r.displayName,...(r.joinedNames||[])].map((n,i)=>n&&viewerId&&ids[i]===viewerId?`${n} (אתה)`:n).filter(Boolean);}
export function groupLabel(r,viewerId){const n=namesFor(r,viewerId);return n.length<2?(n[0]||""):`${n.slice(0,-1).join(", ")} ו${n.at(-1)}`;}
export const groupShort=r=>{const n=groupNames(r);return n.length<2?(n[0]||""):`${n[0]} ועוד ${n.length-1}`;};
export const appliesOn=(request,date)=>request.recurring?request.weekdays?.includes(weekdayIndex(date)):request.date===date;
export async function findMatches(store,request,now=new Date()){const rows=await activeRequests(store,now);const out=[];for(const x of rows)if(x.id!==request.id&&x.userId!==request.userId&&appliesOn(x,request.date)&&overlap(x,request)&&!await isMuted(store,x.userId,now)&&!await skipped(store,x,request))out.push(x);return out;}
export async function publicBoard(store,{date,startMinute=0,endMinute=1440,now=new Date()}={}){return(await activeRequests(store,now)).filter(x=>(!date||appliesOn(x,date))&&x.startMinute<endMinute&&startMinute<x.endMinute).sort((a,b)=>a.startMinute-b.startMinute);}
export function formatPhone(userId){const d=String(userId||"").replace(/\D/g,"");if(/^972\d{8,9}$/.test(d)){const l="0"+d.slice(3);return`${l.slice(0,3)}-${l.slice(3)}`;}return d?`+${d}`:"";}
export const clockLabel=m=>clock(m);
export function formatBoard(rows,viewerId){if(!rows.length)return"לא מצאתי כרגע בקשות פתוחות בחלון הזה. אפשר לפתוח בקשה חדשה ואחפש התאמות.";return`*בקשות פתוחות*\n${rows.slice(0,9).map((x,i)=>`${i+1}. ${groupLabel(x,viewerId)} · רמה ${x.level} · ${timeLabel(x)} · ${Number(x.partySize)===1?"שחקן אחד":`${x.partySize} שחקנים`}${x.hasCourt?" · יש מגרש":""}${x.full?" · מלא":""}`).join("\n")}${rows.slice(0,9).some(x=>!isMine(x,viewerId))?"\n\nלהתחברות בחרו בקשה מהרשימה.":""}`;}
export async function mute(store,userId,until){const p=await store.get(`profile/${userId}`)||{userId};p.mutedUntil=until;await store.set(`profile/${userId}`,p);return p;}
export async function isMuted(store,userId,now=new Date()){const p=await store.get(`profile/${userId}`);return Boolean(p?.mutedUntil&&new Date(p.mutedUntil)>now);}
export async function dailySweep(store,now=new Date()){const req=await activeRequests(store,now),pairs=[],today=localDateParts(now).iso;for(let day=0;day<14;day++){const date=addDays(today,day),candidates=req.filter(x=>appliesOn(x,date));for(let i=0;i<candidates.length;i++)for(let j=i+1;j<candidates.length;j++)if(candidates[i].userId!==candidates[j].userId&&overlap(candidates[i],candidates[j])&&!await isMuted(store,candidates[i].userId,now)&&!await isMuted(store,candidates[j].userId,now)&&!await skipped(store,candidates[i],candidates[j])){const key=pairKey(candidates[i],candidates[j]);if(!await store.get(key)){pairs.push([{...candidates[i],date},{...candidates[j],date}]);await store.set(key,{sentAt:now.toISOString()});}}}return pairs;}
export function expiryFor(date,endMinute=1440){return new Date(`${addDays(date,1)}T00:00:00+03:00`).toISOString();}

// Tom 23.9 15:36 - offer limits. One alert per pair of requests, ever (instant or daily, one-off or recurring),
// and at most ALERTS_PER_DAY match alerts per person per day. The rest still see the board.
export const ALERTS_PER_DAY=3;
export const pairKey=(a,b)=>`notification/${[a.id,b.id].sort().join("~")}`;
export async function allowAlert(store,userId,now=new Date()){const key=`alertcap/${userId}/${localDateParts(now).iso}`,n=(await store.get(key))?.n||0;if(n>=ALERTS_PER_DAY)return false;await store.set(key,{n:n+1});return true;}
