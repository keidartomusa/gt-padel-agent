import { UNCLEAR_WHEN } from "./timeres.js";
import { MAX_ACTIVE_REQUESTS, reqTitle, reqDesc, userActiveRequests, lastRequest, dayLabel, timeLabel } from "./requests.js";
import crypto from "node:crypto";
import { addDays } from "./time.js";
import { parseIntentLocal } from "./intent.js";
import { parseWhen, whenLabel as whenEcho } from "./when.js";
import { findAvailability } from "./availability.js";

import { activeRequests, DURATIONS, findMatches, formatBoard, LEVELS, levelTitle, levelNote, flexMinutesFor, publicBoard, welcome, formatPhone, clockLabel, appliesOn, timesCompatible, skipKey, matchAlert, partyOf, pairKey, allowAlert, groupNames, groupLabel, groupShort, isMine } from "./matching.js";
import { slotActionId } from "./availability.js";
// Row/button ids stay ASCII (index-based); Hebrew labels live only in titles. Tom 23.9: list taps went undelivered.
const WHEN_OPTIONS=["היום בערב","מחר בבוקר","מחר בערב","שישי בבוקר","שבת בבוקר"];
const whenLabel=v=>/^\d+$/.test(v)?WHEN_OPTIONS[Number(v)]||"":v;
const levelValue=v=>/^\d+$/.test(v)?LEVELS[Number(v)]:v;
const btn=(text,buttons)=>({text,buttons:buttons.map(x=>typeof x==="string"?{id:x,title:x}:x)}), list=(text,items)=>({text,list:{button:"לבחירה",sections:[{title:"אפשרויות",rows:items}]}});
const id=()=>crypto.randomUUID();
// QA 23.9: notifications show the weekday/date and window, not an ISO date.
const whenOf=r=>`${dayLabel(r.recurring&&r.date?{date:r.date}:r)} · ${timeLabel(r)}`;
// Tom 23.9 14:13: no mute at all. A user who wants no more messages removes themselves from the list (confirm first).
const LEAVE={id:"leave",title:"הסרה מהרשימה"};
export const LEAVE_ASK="להסיר אתכם מהרשימה? כל הבקשות שלכם יימחקו ולא יישלחו אליכם יותר הודעות על התאמות.";
export const LEAVE_DONE="הוסרתם מהרשימה. הבקשות שלכם נמחקו ולא יישלחו אליכם יותר הודעות על התאמות.\n\nאפשר לחזור בכל רגע - פשוט כותבים לי.";
const LEAVE_TEXT=/^(?:הסר(?:ה)?(?: אותי)?(?: מהרשימה)?|תסיר(?:ו)? אותי(?: מהרשימה)?|להסיר אותי(?: מהרשימה)?|(?:אני )?(?:רוצה )?להפסיק לקבל (?:הודעות|התראות)|stop|unsubscribe)[.!]?$/i;
const MY_REQ={id:"my_requests",title:"הבקשות שלי"},MENU={id:"menu",title:"לתפריט"};
const LEVEL_ROWS=()=>LEVELS.map((x,i)=>({id:`level:${i}`,title:levelTitle(x)}));
const DURATION_ROWS=()=>DURATIONS.map(d=>({id:`duration:${d}`,title:`${d} דקות`})).concat({id:"duration:flex",title:"גמיש"});
const PARTY_ROWS=()=>[{id:"party:1",title:"רק אני"},{id:"party:2",title:"אני ועוד אחד"},{id:"party:3",title:"שלושה, מחפשים רביעי"}];
// Critique round 23.9 (Tom: "תתקן הכל"). Item 9: party size and court in one question.
// Tom's party labels (רק אני / אני ועוד אחד / שלושה, מחפשים רביעי) kept; "שלושה" shortened in the title to fit 24 chars, "מחפשים רביעי" moves to the description.
const PC_ROWS=()=>[[1,"רק אני"],[2,"אני ועוד אחד"],[3,"שלושה"]].flatMap(([n,l])=>[["yes","יש מגרש"],["no","בלי מגרש"]].map(([c,t])=>({id:`pc:${n}:${c}`,title:`${l} · ${t}`,...(n===3?{description:"מחפשים רביעי"}:{})})));
const PC_ASK="כמה אתם, והאם כבר יש לכם מגרש?";
// Tom 23.9 16:31: the reused level/duration can be fixed with one tap, in the same message.
const PREFILL_ROWS=d=>[{id:"pc_level",title:"עדכן רמה",description:`כרגע: ${d.level}`}];
// "אני רוצה לשנות רמה" / "לעדכן משך" during registration -> that question again.
export function fieldEditIntent(text){const t=String(text||"");if(!/(?:^|\s)(?:לשנות|לעדכן|לתקן|להחליף|שנה|תשנה|עדכן|תעדכן|תקן|תתקן|שינוי|עדכון|אחרת|אחר)(?=\s|$)/.test(t))return null;const lv=/רמה|רמת/.test(t),du=/משך|זמן|דקות|אורך|שעה|שעתיים/.test(t);if(lv&&du)return"both";if(lv)return"level";if(/משך|זמן|דקות|אורך|שעה|שעתיים/.test(t))return"duration";return null;}
// Item 16: a short hint under the level question. Item 17: one form of address (plural) everywhere.
const LEVEL_ASK="מה הרמה שלכם?\nלא בטוחים? בחרו את הקרובה ביותר, אפשר לשנות אחר כך.";
const WHEN_ASK="מתי תרצו לשחק? אפשר לכתוב למשל: מחר אחרי 19:00";
// Tom 23.9 17:09: with a court already booked the time is fixed - ask "באיזה שעה?".
const COURT_WHEN_ASK="באיזה שעה? אפשר לכתוב למשל: מחר ב-19:00";
const whenAsk=d=>d?.hasCourt?COURT_WHEN_ASK:WHEN_ASK;
const SCHEDULE_ASK="באילו ימים ושעות אתם זמינים בדרך כלל? למשל: שני ורביעי אחרי 20:00";
// Tom 23.9 18:37: with a court already, just "כמה זמן?".
const durAsk=d=>d?.hasCourt?"כמה זמן?":DURATION_ASK;
const DURATION_ASK="כמה זמן תרצו לשחק?", FLEX_ASK="עד כמה אתם גמישים בשעה?";
const AVAIL_ASK="מתי תרצו לשחק? בחרו מהרשימה או כתבו יום, שעה ומשך, למשל: מחר אחרי 19:00 ל90 דקות", BOARD_ASK="מתי תרצו לשחק? בחרו מהרשימה או כתבו יום ושעה, למשל: מחר אחרי 19:00";
const PLAYERS_BTNS=[{id:"oneoff",title:"חסרים לי שחקנים"},{id:"board",title:"להצטרף למשחק חד-פעמי"},{id:"recurring",title:"משחק קבוע כל שבוע"}];
const CANCEL_ROW={id:"cancel_req",title:"ביטול"};
// Tom 23.9 15:16: "תשים את המספר שלי בנתיים, ושזה גם יהיה בתפריט תמיד" - club contact is Tom's WhatsApp for now, and always in the menu.
export const CLUB_URL="https://wa.me/972544819860";
// No raw links in message text (links only behind buttons). The club button is the third menu button; when that slot holds "הבקשות שלי", the menu names the typed phrase instead.
const CLUB_BTN={id:"club",title:"דבר עם המועדון"}, CLUB_HINT="\n\nלשאלות על המועדון כתבו: דבר עם המועדון";
const clubCard=()=>({text:"אפשר לכתוב למועדון ישירות בוואטסאפ.",ctaUrl:{displayText:"דבר עם המועדון",url:CLUB_URL}});
// Item 20: "לשנות את השם מתום לאבי?" - Hebrew names take the prefix directly, others with a hyphen.
const heName=n=>/^[\u0590-\u05FF]/.test(n), fromName=n=>heName(n)?`מ${n}`:`מ-${n}`, toName=n=>heName(n)?`ל${n}`:`ל-${n}`;
const partyText=n=>Number(n)===1?"שחקן אחד":`${n} שחקנים`;
// Tom 23.9 15:01: after approval, a "שלח הודעה" button (wa.me) instead of the number in the text.
export const waLink=userId=>`https://wa.me/${String(userId||"").replace(/\D/g,"")}`;
const DAY_WORD=/היום|מחר|מחרתיים|ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת|\d{1,2}[/.]\d{1,2}/;
// Item 9: a duration written with the time ("ל-90 דקות", "שעתיים") skips the duration question.
export const durationFromText=t=>{const m=String(t||"").match(/(\d{2,3})\s*(?:דקות|דק׳|דק'|דק)/);if(m&&DURATIONS.includes(Number(m[1])))return[Number(m[1])];if(/שעתיים/.test(t))return[120];if(/שעה וחצי/.test(t))return[90];return null;};
const recurringEcho=d=>`כל ${dayLabel(d).replace(/, ([^,]*)$/," ו$1")}, ${timeLabel(d)}`;
const FLEX_ROWS=()=>[{id:"flex:0",title:"שעה מדויקת"},{id:"flex:60",title:"שעה"},{id:"flex:any",title:"גמיש"}];
const CAP_TEXT=`יש לכם כבר ${MAX_ACTIVE_REQUESTS} בקשות פעילות. אפשר למחוק אחת דרך 'הבקשות שלי'.`;
const matchLines=(request,matches)=>matches.length?`\n\n${matches.length===1?"מצאתי התאמה אפשרית ושלחתי הצעה:":`מצאתי ${matches.length} התאמות אפשריות ושלחתי הצעה:`}\n${matches.slice(0,3).map(m=>`• ${m.displayName} · רמה ${m.level}${levelNote(request.level,m.level)}`).join("\n")}`:"";
// Items 5 and 8: the alert shows party, court, duration and the combined count; "לא הפעם" skips only this match.
// Tom 23.9 15:36: each pair is offered once; a person gets at most ALERTS_PER_DAY alerts a day.
const matchNotifications=async(store,request,matches,now)=>{const out=[];for(const m of matches.slice(0,3)){const k=pairKey(m,request);if(await store.get(k))continue;await store.set(k,{sentAt:now.toISOString()});if(await allowAlert(store,m.userId,now))out.push({to:m.userId,response:matchAlert(m,request)});}return out;};
// Tom-approved copy 23.9 10:28 (+emoji per option).
export const PLAYERS_MENU="מה בא לכם?\n\n👥 חסרים לי שחקנים - מחפשים שחקנים להשלמת רביעייה, עם מגרש או בלי.\n\n⚡ להצטרף למשחק חד-פעמי - רוצים לראות משחקים פתוחים ולהצטרף.\n\n🔁 משחק קבוע כל שבוע - רושמים פעם אחת את הזמנים שנוחים, וכל שבוע המערכת תנסה לשדך לכם שחקנים. בלי התחייבות - כל שבוע תקבלו הצעה ותצטרכו לאשר אותה מחדש.";
export const NAME_ASK="באיזה שם להציג אתכם בלוח המשחקים?";
// Tom 23.9 14:58: when the name was asked, the answer wins over menu words ("שלום" is a real name). Commands are never names.
export function cleanName(raw,{asked=false}={}){if(asked&&/^\s*שלום\s*[.!]?\s*$/.test(String(raw||"")))return "שלום";let t=String(raw||"").replace(/^(אני\s+)?(קוראים לי|שמי|השם שלי(?:\s+הוא)?|תקרא(?:ו)? לי|תקראי לי)\s*/,"").replace(/[.!?,"'״׳:;()]/g," ").replace(/\s+/g," ").trim();if(!t||t.length>30||/\d|@/.test(t)||t.split(" ").length>3)return null;if(/^(לא|כן|תפריט|שלום|היי|הי|אוקי|בסדר|menu|hi|hello|start|stop|עזרה|הגדרות|ביטול|הבקשות שלי|הסר|הסר אותי|די|מספיק|עצור|תודה|תודה רבה|סבבה|אחלה|רגע|נו|מה|למה|טוב|יאללה|חזור|חזרה|אין|אף אחד|ok|okay|thanks|end|cancel)$/i.test(t))return null;if(t.split(" ").some(w=>/^(מה|איך|מתי|כמה|איפה|למה|מי|יש|אין|רוצה|רוצים|מגרש|מגרשים|משחק|שחקן|שחקנים|פנוי|מחר|היום|בערב|בבוקר|תודה|אפשר|צריך|בוקר|ערב|טוב|קורה|שלום)$/.test(w)))return null;return t;}
export function nameChangeIntent(text){const t=String(text||"").trim();if(!t)return null;let m=t.match(/^(?:אני\s+)?(?:קוראים לי|שמי)\s+(.+)$/);if(m)return{name:cleanName(m[1])};if(/השם שלי(?:\s+הוא)?\s+לא(?:\s|$)/.test(t))return{name:null};m=t.match(/(?:לשנות|לעדכן|להחליף|תשנה|תעדכן|תחליף|שנה|תחליפו|תשנו)\s+(?:לי\s+)?(?:את\s+)?(?:ה)?שם(?:\s+שלי)?(?:\s+ל[-־]?\s*(\S.*))?$/);if(m)return{name:m[1]?cleanName(m[1]):null};m=t.match(/^(?:אבל\s+)?השם שלי(?:\s+הוא)?\s+(?!לא(?:\s|$))(.+)$/);if(m)return{name:cleanName(m[1])};if(/השם שלי(?:\s+הוא)?\s+לא(?:\s|$)/.test(t)||/(?:לשנות|לעדכן|שינוי|עדכון|להחליף)\s+(?:את\s+)?(?:ה)?שם/.test(t)||/השם\s+(?:שלי\s+)?לא\s+נכון/.test(t))return{name:null};return null;}
const NEXT_WEEK=/(?:ב|ל)?שבוע ה(?:בא|קרוב)/;
const HE_DAYS=["ראשון","שני","שלישי","רביעי","חמישי","שישי","שבת"];
export function nextWeekDays(now){const t=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jerusalem"}).format(now),base=new Date(`${t}T12:00:00Z`),dow=base.getUTCDay(),out=[];for(let i=0;i<7;i++){const d=new Date(base.getTime()+((7-dow)+i)*86400000);out.push({date:d.toISOString().slice(0,10),ddmm:`${d.getUTCDate()}.${d.getUTCMonth()+1}`,label:`${HE_DAYS[d.getUTCDay()]} ${d.getUTCDate()}.${d.getUTCMonth()+1}`});}return out;}
const WD=new Map([["ראשון",0],["שני",1],["שלישי",2],["רביעי",3],["חמישי",4],["שישי",5],["שבת",6]]);
const recurringDays=text=>[...WD].filter(([name])=>text.includes(name)).map(([,n])=>n);
export async function handleConversation({userId,displayName="שחקן/ית",text="",actionId,store,now=new Date(),availabilityFn=findAvailability}){
 const input=(actionId||text).trim(),state=await store.get(`state/${userId}`)||{}; const set=async s=>store.set(`state/${userId}`,s);
 const withMyRequests=async r=>(await userActiveRequests(store,userId,now)).length?{...r,text:r.buttons?.some(b=>b.id==="club")?r.text+CLUB_HINT:r.text,buttons:[...(r.buttons||[]).slice(0,2),MY_REQ]}:r;
 const allApproved=async r=>(await store.list("connection/")).map(x=>x.value).filter(c=>c?.status==="accepted"&&c.requestId===r.id).every(c=>(c.members||[r.userId]).every(m=>(c.approvals||[c.answeredBy]).includes(m)));
 const ownReq=async rid=>{const r=await store.get(`request/${rid}`);return r&&r.active&&r.userId===userId?r:null;};
 const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jerusalem"}).format(now);
 const seenKey=`seen/${userId}`,seen=await store.get(seenKey);if(!seen)await store.set(seenKey,{at:now.toISOString()});
 const profileKey=`profile/${userId}`,profile=await store.get(profileKey)||{userId},name=profile.name||null;
 const profileName=!name&&displayName&&displayName!=="שחקן/ית"?cleanName(displayName):null;
 if(name)displayName=name;
 const saveName=async n=>{const p=await store.get(profileKey)||{userId};p.name=n;await store.set(profileKey,p);for(const r of await store.list("request/"))if(r.value.userId===userId&&r.value.active){await store.set(`request/${r.value.id}`,{...r.value,displayName:n});}};
 if(state.step==="name_confirm"&&(input==="name_yes"||input==="name_no")){await set({});if(input==="name_no")return btn(`בסדר, השם נשאר ${state.oldName}.`,[{id:"menu",title:"לתפריט"}]);await saveName(state.newName);return btn(`השם עודכן ${toName(state.newName)}.`,[{id:"menu",title:"לתפריט"}]);}
 const askConfirm=async n=>{await set({step:"name_confirm",oldName:name,newName:n});return btn(`לשנות את השם ${fromName(name)} ${toName(n)}?`,[{id:"name_yes",title:"כן, לשנות"},{id:"name_no",title:"לא"}]);};
 // Item 19: offer the WhatsApp profile name first (one tap instead of typing).
 const askName=async(s,prefix="")=>{if(profileName){await set({...s,step:"name",waName:profileName});return btn(`${prefix}להופיע בלוח המשחקים בתור ${profileName}?`,[{id:"name_wa",title:"כן"},{id:"name_other",title:"שם אחר"}]);}await set({...s,step:"name"});return{text:prefix+NAME_ASK};};
 const nameGiven=async n=>{if(state.change&&name){if(n===name){await set({});return{text:`השם כבר ${name}.`};}return askConfirm(n);}await saveName(n);await set(state.resume||{});const pending=state.pending;if(pending)return handleConversation({userId,displayName:n,actionId:pending,store,now,availabilityFn});return btn(`נעים להכיר, ${n}!`,[{id:"availability",title:"מגרש פנוי"},{id:"players",title:"מציאת שחקנים"}]);};
 if(state.step==="name"&&input==="name_wa"&&state.waName)return nameGiven(state.waName);
 if(state.step==="name"&&input==="name_other"){await set({...state,waName:undefined});return{text:NAME_ASK};}
 if(state.step==="name"&&text&&!actionId&&/^ביטול$/.test(text.trim())){await set({});return btn(state.change?"בסדר, השם לא השתנה.":"בסדר, לא שמרתי את הבקשה.",[MENU]);}
 if(state.step==="name"&&text&&!actionId&&!/^(תפריט|menu)$/i.test(text.trim())){const n=cleanName(text,{asked:true});if(!n)return{text:"לא הצלחתי לקלוט שם. באיזה שם להציג אתכם? (למשל: יוסי)"};return nameGiven(n);}
 if(text&&!actionId){const c=nameChangeIntent(text);if(c){if(c.name&&name){if(c.name===name)return{text:`השם כבר ${name}.`};return askConfirm(c.name);}if(c.name&&!name){await saveName(c.name);await set({});return btn(`נעים להכיר, ${c.name}!`,[{id:"availability",title:"מגרש פנוי"},{id:"players",title:"מציאת שחקנים"}]);}await set({step:"name",change:true});return{text:name?`השם הנוכחי: ${name}. באיזה שם להציג אתכם?`:NAME_ASK};}}
 // Tom 23.9: flow questions first; the name is asked only where it is needed (publishing a request / connecting).
 if(!name&&input.startsWith("connect:"))return askName({pending:input});
 // Item 18: the full greeting once; later a short menu.
 // Tom 24.9 07:47 (option A): a greeting (היי/הי/שלום) always gets the full welcome; "תפריט" stays short after the first time.
 const menuFor=async(full=false)=>{const p=await store.get(profileKey)||{userId},w=welcome(name),buttons=[...w.buttons,CLUB_BTN];if(p.welcomedAt&&!full)return{text:name?`${name}, מה תרצו לעשות?`:"מה תרצו לעשות?",buttons};await store.set(profileKey,{...p,welcomedAt:now.toISOString()});return{...w,buttons};};
 const timeAsk=async(date,resume)=>{if(resume!==null)await set({step:"time_ask",tResume:resume,tDate:date});return btn(`${dayLabel({date})} - מאיזו שעה?`,[17,18,19].map(h=>({id:`tm:${h}`,title:`${h}:00`})));};
 const reask=async s=>{switch(s.step){case"avail_when":return list(AVAIL_ASK,WHEN_OPTIONS.map((x,i)=>({id:`when:${i}`,title:x})));case"board_when":return list(BOARD_ASK,WHEN_OPTIONS.map((x,i)=>({id:`bwhen:${i}`,title:x})));case"when":case"edit_when":{const er=s.step==="edit_when"?await ownReq(s.editId):null;return{text:er?.recurring?SCHEDULE_ASK:whenAsk(er||s.draft)};};case"schedule":return{text:SCHEDULE_ASK};
   case"level":case"edit_level":return list(LEVEL_ASK,LEVEL_ROWS().concat(s.autoOpen?[CANCEL_ROW]:[]));case"pc":return list(PC_ASK,PC_ROWS().concat(s.autoOpen?[CANCEL_ROW]:[]));case"duration":case"edit_duration":return list(durAsk(s.draft),DURATION_ROWS());case"flex":case"edit_flex":return list(FLEX_ASK,FLEX_ROWS());case"edit_party":return list("כמה שחקנים אתם?",PARTY_ROWS());case"court":case"edit_court":return btn("כבר יש לכם מגרש?",[{id:"court:yes",title:"כן"},{id:"court:no",title:"לא"}]);
   case"mode":return btn(PLAYERS_MENU,PLAYERS_BTNS);case"time_ask":return timeAsk(s.tDate,null);case"nw_day":return s.nwDays?list("באיזה יום בשבוע הבא?",s.nwDays.map((d,i)=>({id:`nw:${i}`,title:d.label}))):null;case"leave_confirm":return btn(LEAVE_ASK,[{id:"leave_yes",title:"כן, להסיר"},{id:"leave_no",title:"לא"}]);case"name_confirm":return btn(`לשנות את השם ${fromName(s.oldName)} ${toName(s.newName)}?`,[{id:"name_yes",title:"כן, לשנות"},{id:"name_no",title:"לא"}]);default:return null;}};
 // Items 3 and 9: one routine decides the next missing field, so known answers are never asked again.
 const finish=async(st,d,prefix="")=>{if(!name)return askName({pending:"pfinish",resume:{...st,flow:"players",step:"ready",draft:d}},prefix);const request={...d,displayName,id:id(),userId,flexMinutes:d.flexMinutes??0,active:true,createdAt:now.toISOString()};
   if(!request.recurring&&!request.hasCourt){const availability=await availabilityFn({date:request.date,startMinute:request.startMinute,endMinute:request.endMinute,durationMinutes:request.durations?.[0]||60},{today:today()});if(!availability.slots?.length){await set({flow:"players",step:"when",draft:{...d,date:undefined,startMinute:undefined,endMinute:undefined}});return{text:"לא מצאתי מגרש פנוי שמתאים לחלון ולמשך שביקשתם. הבקשה לא פורסמה כדי שלא נחפש שחקנים למשחק שלא ניתן להזמין.",buttons:[{id:"retry_when",title:"לנסות זמן אחר"},{id:"availability",title:"בדיקת זמינות"}]};}request.courtSlot=availability.slots[0];}
   // Live 23.9 18:45: several weekdays = one request per day, each matched, approved and closed on its own.
   const days=request.recurring&&request.weekdays?.length>1?[...new Set(request.weekdays)].sort((a,b)=>a-b):null,saves=days?days.map((w,i)=>{const t=today(),tw=new Date(`${t}T12:00:00Z`).getUTCDay();return{...request,id:i?id():request.id,weekdays:[w],date:request.date?addDays(t,((w-tw+7)%7)||7):request.date};}):[request];
   if(days){const have=(await userActiveRequests(store,userId,now)).length,room=Math.max(0,MAX_ACTIVE_REQUESTS-have);if(saves.length>room){await set({flow:"players",step:"schedule",draft:{...d,weekdays:undefined}});return{text:`כל יום נשמר כבקשה נפרדת, ואפשר עד ${MAX_ACTIVE_REQUESTS} בקשות פעילות. יש לכם כבר ${have}, אז אפשר להוסיף עוד ${room} ימים. כתבו שוב ימים ושעות, למשל: שישי ושבת ב-06:30`};}}
   for(const r of saves)await store.set(`request/${r.id}`,r);await set({});const per=[];for(const r of saves)per.push([r,await findMatches(store,r,now)]);const seenM=new Set(),matches=per.flatMap(([,ms])=>ms).filter(m=>!seenM.has(m.id)&&seenM.add(m.id)),saved=days?`${prefix}נשמרו ${saves.length} בקשות נפרדות, אחת לכל יום (${saves.map(r=>dayLabel(r)).join(", ")}), והן יופיעו בלוח המשחקים.`:`${prefix}הבקשה נשמרה ותופיע בלוח המשחקים.`;
   if(!matches.length)return btn(`${saved}\n\nאעדכן כשאמצא התאמה.`,[MY_REQ,{id:"players",title:"בקשה נוספת"},MENU]);
   // Item 4: the matches as a list, each one connectable right away.
   const asked=await pendingTo(),top=matches.filter(m=>!asked.has(m.id)).slice(0,3);if(!top.length)return btn(`${saved}\n\nאעדכן כשאמצא התאמה.`,[MY_REQ,{id:"players",title:"בקשה נוספת"},MENU]);const response={text:`${saved}\n\n${top.length===1?"מצאתי התאמה אפשרית ושלחתי הצעה. אפשר גם להתחבר כבר עכשיו:":`מצאתי ${top.length} התאמות אפשריות ושלחתי הצעה. אפשר גם להתחבר כבר עכשיו:`}`,list:{button:"להתאמות",sections:[{title:"התאמות",rows:top.map(m=>({id:`connect:${m.id}`,title:`${groupShort(m)} · ${m.level}`.slice(0,24),description:`${groupNames(m).length>1?groupLabel(m)+" · ":""}${partyText(m.partySize)}${m.hasCourt?" · יש מגרש":""}${levelNote(request.level,m.level)}`.slice(0,72)})).concat(MY_REQ,MENU)}]}};
   response.notifications=[];for(const[r,ms]of per){const mine=top.filter(m=>ms.some(x=>x.id===m.id));if(mine.length)response.notifications.push(...await matchNotifications(store,r,mine,now));}return response;};
 // Board rows the user can still pick: not their own, not already asked (pending), not the one just picked.
 const pendingTo=async()=>new Set((await store.list("connection/")).map(x=>x.value).filter(c=>c?.status==="pending"&&c.fromUserId===userId).map(c=>c.requestId));
 const pickRow=x=>({id:`connect:${x.id}`,title:`${groupShort(x)} · ${x.level}`.slice(0,24),description:`${groupNames(x).length>1?groupLabel(x)+" · ":""}${timeLabel(x)} · ${partyText(x.partySize)}${x.hasCourt?" · יש מגרש":""}`.slice(0,72)});
 const morePicks=async(win,skipId)=>{if(!win?.date)return[];const asked=await pendingTo();return(await publicBoard(store,{date:win.date,startMinute:win.startMinute??0,endMinute:win.endMinute??1440,now})).filter(x=>x.id!==skipId&&!isMine(x,userId)&&!asked.has(x.id)&&!x.full).slice(0,8).map(pickRow);};
 const nextStep=async(st,d,prefix="")=>{const cancel=st.autoOpen?[CANCEL_ROW]:[],base={...st,flow:"players",draft:d};
   if(!d.level){await set({...base,step:"level"});return list(prefix+LEVEL_ASK,LEVEL_ROWS().concat(cancel));}
   // Live 23.9 16:32: "לשנות רמה ומשך" asks both, in a row - duration right after the level.
   // Tom 23.9 16:35: a weekly game never asks about a court.
   if(d.recurring&&d.partySize==null){await set({...base,step:"party"});return list(prefix+"כמה שחקנים אתם?",PARTY_ROWS().concat(st.prefilled?PREFILL_ROWS(d):[],cancel));}
   if(d.recurring&&d.hasCourt==null){d.hasCourt=false;d.flexMinutes??=0;}
   if(d.partySize==null){await set({...base,step:"pc"});return list(prefix+PC_ASK,PC_ROWS().concat(st.prefilled?PREFILL_ROWS(d):[],cancel));}
   if(d.hasCourt==null){await set({...base,step:"court"});return btn(prefix+"כבר יש לכם מגרש?",[{id:"court:yes",title:"כן"},{id:"court:no",title:"לא"}]);}
   if(d.recurring?!d.weekdays?.length:!d.date){await set({...base,step:d.recurring?"schedule":"when"});return{text:prefix+(d.recurring?SCHEDULE_ASK:whenAsk(d))};}
   // Tom 23.9 18:51: no duration question in partner finding; the time window says it. Court search keeps its duration.
   // Tom 23.9 13:14: with a court the time is fixed - no flex question.
   if(d.flexMinutes==null){if(d.hasCourt)d={...d,flexMinutes:0};else{await set({...base,draft:d,step:"flex"});return list(prefix+FLEX_ASK,FLEX_ROWS());}}
   return finish(st,d,prefix);};
 // Tom 23.9 14:58: while a question is waiting, a greeting is not a reason to drop it - ask the same question again. "תפריט" still exits.
 if(!actionId&&state.step&&/^(היי|הי|שלום|start)[.!]?$/i.test(input)){const r=await reask(state);if(r)return r;}
 if(/^(היי|הי|שלום|תפריט|menu|start)$/i.test(input)||input==="menu"){if(state.step)await set({});return withMyRequests(await menuFor(/^(היי|הי|שלום|start)$/i.test(input)));}
 // Item 10: the day was understood but not the hour - ask only the hour.
 if(state.step==="time_ask"&&/^tm:\d{1,2}$/.test(input)&&state.tDate){const[,m,dd]=state.tDate.split("-");await set(state.tResume||{});return handleConversation({userId,displayName,text:`${Number(dd)}.${Number(m)} אחרי ${input.slice(3)}:00`,store,now,availabilityFn});}
 // Tom 23.9 hour rule: 8, 9, 10 with no morning/evening cue -> ask, never guess.
 if(state.step==="ampm"&&(input==="ampm:am"||input==="ampm:pm")){await set(state.apResume||{});return handleConversation({userId,displayName,text:`${state.apText} ${input==="ampm:am"?"בבוקר":"בערב"}`,store,now,availabilityFn});}
 // Request management (Tom 23.9 13:18): view / edit one field / delete. Editing never notifies an already-connected player.
 // Tom 23.9 19:13: any member of a connected group can remove a player (e.g. someone cancelled); the seat opens again for matching.
 const memberReq=async rid=>{const r=await store.get(`request/${rid}`);return r&&r.active&&isMine(r,userId)?r:null;};
 const members=r=>[{id:r.userId,name:r.displayName},...(r.joined||[]).map((u,i)=>({id:u,name:(r.joinedNames||[])[i]||""}))];
 if(input.startsWith("req:")){const r=await memberReq(input.slice(4));if(!r)return btn("הבקשה כבר לא פעילה.",[MY_REQ,MENU]);const card=`*${reqTitle(r)}*\n${reqDesc(r)}${r.joined?.length?`\nבקבוצה: ${members(r).map(m=>m.name).join(", ")}${r.full?" (מלא)":""}`:""}`,own=r.userId===userId,rm=members(r).length>1?[{id:`rm:${r.id}`,title:"הסרת שחקן"}]:[];
   if(own&&!rm.length)return btn(card,[{id:`edit:${r.id}`,title:"עריכה"},{id:`del:${r.id}`,title:"מחיקה"},{id:"my_requests",title:"חזרה"}]);
   if(!own)return btn(card,[...rm,{id:"my_requests",title:"חזרה"}]);
   return{text:card,list:{button:"אפשרויות",sections:[{title:"הבקשה",rows:[{id:`edit:${r.id}`,title:"עריכה"},{id:`del:${r.id}`,title:"מחיקה"},...rm,{id:"my_requests",title:"חזרה"}]}]}};}
 // Tom 19:36: any member can remove any member - a joiner, the opener, or themselves. Removing the opener hands the game to the next member in the group; the removed player's own request goes back to the board.
 if(input.startsWith("rm:")){const r=await memberReq(input.slice(3));if(!r)return btn("הבקשה כבר לא פעילה.",[MY_REQ,MENU]);const who=members(r);if(who.length<2)return btn("אין בקבוצה שחקן שאפשר להסיר.",[MY_REQ,MENU]);return list("את מי להסיר מהמשחק?",who.map(m=>({id:`rmu:${r.id}:${m.id}`,title:(m.id===userId?`${m.name||"שחקן"} (אני)`:(m.name||"שחקן")).slice(0,24)})).concat({id:`req:${r.id}`,title:"חזרה"}));}
 if(input.startsWith("rmu:")){const[,rid,uid]=input.split(":"),r=await memberReq(rid),m=r&&members(r).length>1&&members(r).find(x=>x.id===uid);if(!m)return btn("הבקשה כבר לא פעילה.",[MY_REQ,MENU]);if(uid===userId)return btn(`לצאת מהמשחק (${whenOf(r)})?`,[{id:`rmok:${rid}:${uid}`,title:"כן, לצאת"},{id:`req:${rid}`,title:"לא"}]);return btn(`להסיר את ${m.name} מהמשחק (${whenOf(r)})?`,[{id:`rmok:${rid}:${uid}`,title:"כן, להסיר"},{id:`req:${rid}`,title:"לא"}]);}
 if(input.startsWith("rmok:")){const[,rid,uid]=input.split(":"),r=await memberReq(rid);if(!r||members(r).length<2||!members(r).some(x=>x.id===uid))return btn("הבקשה כבר לא פעילה.",[MY_REQ,MENU]);
   const at=now.toISOString(),conns=(await store.list("connection/")).map(x=>x.value).filter(c=>c?.requestId===rid&&c.status==="accepted"),connOf=u=>conns.find(c=>c.fromUserId===u),joinedParty=u=>Number(connOf(u)?.joinParty)||1;
   const self=uid===userId,opener=uid===r.userId;let R2,name,party,back=null;
   if(!opener){const idx=(r.joined||[]).indexOf(uid);name=(r.joinedNames||[])[idx]||"";party=joinedParty(uid);R2={...r,joined:r.joined.filter((_,i)=>i!==idx),joinedNames:(r.joinedNames||[]).filter((_,i)=>i!==idx),partySize:Math.max(1,partyOf(r)-party),full:false};
     const conn=connOf(uid);if(conn)await store.set(`connection/${conn.id}`,{...conn,status:"removed",removedBy:userId,removedAt:at});
     back=(await store.list("request/")).map(x=>x.value).find(x=>x?.userId===uid&&x.mergedInto===rid&&x.closedReason==="merged")||null;if(back){back={...back,active:true,closedAt:null,closedReason:null,mergedInto:null,reopenedAt:at};await store.set(`request/${back.id}`,back);}}
   else{name=r.displayName||"";const others=(r.joined||[]).reduce((a,u)=>a+joinedParty(u),0);party=Math.max(1,Number(r.ownerParty)||partyOf(r)-others);const next=r.joined[0],nextName=(r.joinedNames||[])[0]||"";
     R2={...r,userId:next,displayName:nextName,ownerParty:joinedParty(next),joined:r.joined.slice(1),joinedNames:(r.joinedNames||[]).slice(1),partySize:Math.max(1,partyOf(r)-party),full:false,ownerChangedAt:at,previousOwners:[...(r.previousOwners||[]),r.userId]};
     back={...r,id:id(),userId:uid,displayName:r.displayName,partySize:party,joined:[],joinedNames:[],full:false,active:true,ownerParty:undefined,previousOwners:undefined,createdAt:at,reopenedFrom:rid,reopenedAt:at};await store.set(`request/${back.id}`,back);}
   await store.set(`request/${rid}`,R2);
   const backLine=back?" הבקשה שלכם חזרה ללוח ואמשיך לחפש לכם התאמות.":"";
   const notes=(self?[]:[{to:uid,response:btn(`עדכון למשחק ${whenOf(r)}: הקבוצה עדכנה שאתם כבר לא חלק מהמשחק.${backLine}`,[MY_REQ,MENU])}]).concat(members(R2).filter(x=>x.id!==userId).map(x=>({to:x.id,response:btn(`עדכון למשחק ${whenOf(r)}: ${name} כבר לא בקבוצה. התפנה מקום, ואציע את המשחק לשחקנים מתאימים.${opener&&x.id===R2.userId?" המשחק רשום עכשיו עליכם.":""}`,[MY_REQ,MENU])})));
   if(self)return{...btn(`יצאתם מהמשחק (${whenOf(r)}).${backLine}`,[MY_REQ,MENU]),notifications:notes};
   return{...btn(`הסרתי את ${name}. יש עכשיו ${partyOf(R2)} מתוך 4, והמשחק פתוח שוב להתאמות.${opener&&R2.userId===userId?" המשחק רשום עכשיו עליכם.":""}`,[MY_REQ,MENU]),notifications:notes};}

 if(input.startsWith("del:")){const r=await ownReq(input.slice(4));if(!r)return btn("הבקשה כבר לא פעילה.",[MY_REQ,MENU]);return btn(`למחוק את הבקשה ל${reqTitle(r)}?`,[{id:`delok:${r.id}`,title:"כן, למחוק"},{id:"my_requests",title:"לא"}]);}
 if(input.startsWith("delok:")){const r=await ownReq(input.slice(6));if(!r)return btn("הבקשה כבר לא פעילה.",[MY_REQ,MENU]);await store.set(`request/${r.id}`,{...r,active:false,deletedAt:now.toISOString()});await set({});return btn("מחקתי את הבקשה.",[MY_REQ,MENU]);}
 if(input.startsWith("edit:")){const r=await ownReq(input.slice(5));if(!r)return btn("הבקשה כבר לא פעילה.",[MY_REQ,MENU]);const f=[["when","יום ושעה"],["level","רמה"],["party","מספר שחקנים"],["court","מגרש"]].filter(([k])=>!(r.recurring&&k==="court")).concat(r.hasCourt?[]:[["flex","גמישות"]]);return list(`מה לשנות ב${reqTitle(r)}?`,f.map(([k,t])=>({id:`ef:${r.id}:${k}`,title:t})).concat({id:"my_requests",title:"חזרה"}));}
 if(input.startsWith("ef:")){const [,rid,field]=input.split(":"),r=await ownReq(rid);if(!r)return btn("הבקשה כבר לא פעילה.",[MY_REQ,MENU]);await set({flow:"edit",step:`edit_${field}`,editId:r.id});
   if(field==="when")return{text:r.recurring?SCHEDULE_ASK:whenAsk(r)};
   if(field==="level")return list(LEVEL_ASK,LEVEL_ROWS());if(field==="duration")return list("כמה זמן תרצו לשחק?",DURATION_ROWS());if(field==="party")return list("כמה שחקנים אתם?",PARTY_ROWS());
   if(field==="court")return btn("כבר יש לכם מגרש?",[{id:"court:yes",title:"כן"},{id:"court:no",title:"לא"}]);if(field==="flex")return list("עד כמה אתם גמישים בשעה?",FLEX_ROWS());await set({});return btn("לא הבנתי. אפשר לבחור מה לעשות:",[MY_REQ,MENU]);}
 if(state.flow==="edit"&&state.editId){const r=await ownReq(state.editId);if(!r){await set({});return btn("הבקשה כבר לא פעילה.",[MY_REQ,MENU]);}let patch=null;
   if(state.step==="edit_level"&&input.startsWith("level:"))patch={level:levelValue(input.slice(6))};
   else if(state.step==="edit_duration"&&input.startsWith("duration:")){const v=input.slice(9);patch={durations:v==="flex"?[60,90,120]:[Number(v)]};}
   else if(state.step==="edit_party"&&input.startsWith("party:"))patch={partySize:Number(input.slice(6))};
   else if(state.step==="edit_court"&&input.startsWith("court:")){const has=input.endsWith("yes");patch=has?{hasCourt:true,flexMinutes:0}:{hasCourt:false};}
   else if(state.step==="edit_flex"&&input.startsWith("flex:"))patch={flexMinutes:flexMinutesFor(input.slice(5))};
   else if(state.step==="edit_when"&&text&&!actionId){if(r.recurring&&!recurringDays(text).length)return{text:"בזמינות קבועה צריך לציין ימים בשבוע, למשל: שני ורביעי אחרי 20:00."};const p=await parseWhen(text,now);if(p.needsClarification==="unclear"&&!r.recurring)return{text:UNCLEAR_WHEN};if(p.ambiguousHour&&!r.recurring){await set({step:"ampm",apResume:state,apText:text});return btn(`התכוונתם ל-${p.ambiguousHour} בבוקר או ל-${p.ambiguousHour} בערב?`,[{id:"ampm:am",title:`${p.ambiguousHour} בבוקר`},{id:"ampm:pm",title:`${p.ambiguousHour} בערב`}]);}patch={date:p.date,startMinute:p.startMinute??1140,endMinute:p.endMinute??1380,...(r.recurring?{weekdays:recurringDays(text)}:{})};}
   if(patch){const updated={...r,...patch,updatedAt:now.toISOString()};
     if(!updated.recurring&&!updated.hasCourt&&(patch.date||patch.durations||patch.hasCourt===false)){const a=await availabilityFn({date:updated.date,startMinute:updated.startMinute,endMinute:updated.endMinute,durationMinutes:updated.durations?.[0]||60},{today:today()});if(!a.slots?.length){await set({});return btn("לא מצאתי מגרש פנוי שמתאים לשינוי, אז הבקשה נשארה כמו שהייתה.",[MY_REQ,MENU]);}updated.courtSlot=a.slots[0];}
     await store.set(`request/${r.id}`,updated);await set({});const matches=await findMatches(store,updated,now);// Item 15: after an edit, the request card again with "עריכה נוספת".
     const resp=btn(`עדכנתי.\n\n*${reqTitle(updated)}*\n${reqDesc(updated)} · ${partyText(updated.partySize)} · ${updated.hasCourt?"יש מגרש":"בלי מגרש"}${matchLines(updated,matches)}`,[{id:`edit:${r.id}`,title:"עריכה נוספת"},{id:"menu",title:"סיום"}]);if(matches.length)resp.notifications=await matchNotifications(store,updated,matches,now);return resp;}
 }
 if(text&&!actionId&&(state.step?["avail_when","board_when","when"].includes(state.step):true)){const p=parseIntentLocal(text,now),h=p.ambiguousHour;if(h&&(state.step||p.dateExplicit)){await set({step:"ampm",apResume:state,apText:text});return btn(`התכוונתם ל-${h} בבוקר או ל-${h} בערב?`,[{id:"ampm:am",title:`${h} בבוקר`},{id:"ampm:pm",title:`${h} בערב`}]);}}
 // Tom 23.9 10:36: "בשבוע הבא אחרי 18:00" got "לא הבנתי". "Next week" is a week, not a day: ask which day (dates listed), keep the time part, then continue the same step.
 if(text&&!actionId&&NEXT_WEEK.test(text)&&!recurringDays(text.replace(NEXT_WEEK,"")).length&&(!state.step||["avail_when","board_when","when"].includes(state.step)||(state.flow==="players"&&["level","pc","court","duration","flex"].includes(state.step)))){const days=nextWeekDays(now);await set({step:"nw_day",nwResume:state,nwRest:text.replace(NEXT_WEEK,"").replace(/\s+/g," ").trim(),nwDays:days});return list("באיזה יום בשבוע הבא?",days.map((d,i)=>({id:`nw:${i}`,title:d.label})));}
 if(state.step==="nw_day"&&input.startsWith("nw:")){const d=state.nwDays?.[Number(input.slice(3))];if(d){await set(state.nwResume||{});return handleConversation({userId,displayName,text:`${d.ddmm} ${state.nwRest}`.trim(),store,now,availabilityFn});}}
 if(input==="availability"){await set({flow:"availability",step:"avail_when"});return list(AVAIL_ASK,WHEN_OPTIONS.map((x,i)=>({id:`when:${i}`,title:x})));}
 if(input.startsWith("when:")){await set({});return{mode:"availability",query:whenLabel(input.slice(5))};}
 if(state.step==="avail_when"&&text&&!actionId){if(DAY_WORD.test(text)){const p=await parseWhen(text,now);if(p.needsClarification==="unclear"&&p.dateExplicit&&p.startMinute==null)return timeAsk(p.date,{flow:"availability",step:"avail_when"});}await set({});return{mode:"availability",query:text};}
 if(input==="availability"||(!(!actionId&&(["when","schedule","board_when"].includes(state.step)||(state.flow==="players"&&["level","pc","court","duration","flex"].includes(state.step))))&&!/מי מחפש|שחקן פנוי|בקשות פתוחות/.test(input)&&/מגרש(?:ים)?(?:\s+פנוי)?|זמינות|איזה מגרשים|איפה מזמינים|מה פנוי|תבדוק|(?:היום|מחר|מחרתיים|ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת|\d{1,2}[/.]\d{1,2}|\d{1,2}\s*לחודש).*(?:בוקר|צהריים|אחה"?צ|ערב|לילה|שעה|שעתיים|דקות|דק|\d{1,2}:\d{2}|אחרי\s*\d|לפני\s*\d|ב-?\d{1,2}\b)|^\s*\d{1,2}[/.]\d{1,2}\b/.test(input)))return{mode:"availability",query:text||input};
 if(input==="players"||/מציאת שחקנים/.test(input)){await set({flow:"players",step:"mode"});return btn(PLAYERS_MENU,PLAYERS_BTNS);}
 // QA 23.9: "לנסות זמן אחר" keeps level/party/court and asks only for a new time.
 if(input==="retry_when"&&state.flow==="players"&&state.step==="when")return btn(WHEN_ASK,[MENU]);
 if(input==="club"||(!actionId&&/^(?:ל)?דבר(?:ו)? עם המועדון$/.test(text.trim())))return clubCard();
 if(input==="settings"||/הגדרות/.test(input))return btn("*ניהול הבקשות*",[{id:"my_requests",title:"הבקשות שלי"},LEAVE]);
 if(input==="leave"||(!actionId&&LEAVE_TEXT.test(text.trim()))){await set({step:"leave_confirm"});return btn(LEAVE_ASK,[{id:"leave_yes",title:"כן, להסיר"},{id:"leave_no",title:"לא"}]);}
 if(input==="leave_no"){await set({});return btn("בסדר, נשארתם ברשימה.",[MENU]);}
 if(input==="leave_yes"){await set({});for(const r of await userActiveRequests(store,userId,now)){await store.set(`request/${r.id}`,{...r,active:false,removedAt:now.toISOString(),removedReason:"opt_out"});}
  const p=await store.get(`profile/${userId}`)||{userId};await store.set(`profile/${userId}`,{...p,optedOutAt:now.toISOString(),mutedUntil:null});await store.delete?.(`pending/${userId}`);return{text:LEAVE_DONE};}
 // Old mute buttons still sitting in chats (removed 23.9 14:13) lead to the leave option instead.
 if(/^mute_(?:week|custom|\d+)$/.test(input)||input==="unmute")return btn("השתקה כבר לא קיימת. אם לא רוצים לקבל יותר הודעות, אפשר להסיר את עצמכם מהרשימה.",[LEAVE,MENU]);
 if(input==="cancel_req"){await set({});return btn("בסדר, לא פתחתי בקשה.",[MENU]);}
 if(input==="my_requests"||/^הבקשות שלי$/.test(input)){await set({});const rows=[...await userActiveRequests(store,userId,now),...(await activeRequests(store,now)).filter(x=>x.userId!==userId&&(x.joined||[]).includes(userId))];if(!rows.length)return btn("אין לכם כרגע בקשות פעילות.",[{id:"players",title:"בקשה חדשה"},MENU]);// Live 23.9 18:41: the requests are listed in the message body too, not only behind the list button.
return{text:`*הבקשות שלי* (${rows.length})\n\n${rows.map((r,i)=>`${i+1}. ${reqTitle(r)}\n${reqDesc(r)}`).join("\n\n")}\n\nלעריכה או מחיקה לחצו על 'לבקשות' ובחרו בקשה.`,list:{button:"לבקשות",sections:[{title:"בקשות פעילות",rows:rows.map(r=>({id:`req:${r.id}`,title:reqTitle(r).slice(0,24),description:reqDesc(r).slice(0,72)})).concat(rows.length<MAX_ACTIVE_REQUESTS?[{id:"players",title:"➕ בקשה חדשה"}]:[],LEAVE,{id:"menu",title:"לתפריט"})}]}};}
 if(input==="board"){await set({flow:"board",step:"board_when"});return list(BOARD_ASK,WHEN_OPTIONS.map((x,i)=>({id:`bwhen:${i}`,title:x})));}
 if(input.startsWith("bwhen:")||(state.step==="board_when"&&text&&!actionId)||/מי מחפש|שחקן פנוי|בקשות פתוחות/.test(input)){const q=input.startsWith("bwhen:")?whenLabel(input.slice(6)):text||input;if(state.step==="board_when")await set({});const p=await parseWhen(q,now);if(p.needsClarification==="unclear"){if(p.dateExplicit&&p.startMinute==null)return timeAsk(p.date,{flow:"board",step:"board_when"});await set({step:"board_when"});return{text:UNCLEAR_WHEN};}const rows=await publicBoard(store,{date:p.date,startMinute:p.startMinute??0,endMinute:p.endMinute??1440,now});const head=`חיפשתי: ${whenEcho(p)}.\n\n`;if(!rows.length){// Tom 23.9: nothing open in the window -> open the request for the user, reusing level and duration from the last request.
   if((await userActiveRequests(store,userId,now)).length>=MAX_ACTIVE_REQUESTS)return btn(`אין כרגע משחקים פתוחים ב${whenEcho(p).replace(", "," ")}.\n\n${CAP_TEXT}`,[MY_REQ,MENU]);
   const last=await lastRequest(store,userId),draft={recurring:false,displayName,date:p.date,startMinute:p.startMinute??1140,endMinute:p.endMinute??1380},open=`אין כרגע משחקים פתוחים ב${whenEcho(p).replace(", "," ")}, אז אני פותח לכם בקשה ואחפש לכם שחקנים.`;
   if(last){draft.level=last.level;return nextStep({autoOpen:true,prefilled:true},draft,`${open}\nלקחתי מהבקשה הקודמת: רמה ${last.level}.\n\n`);}
   return nextStep({autoOpen:true},draft,`${open}\n\n`);}await set({boardWin:{date:p.date,startMinute:p.startMinute??0,endMinute:p.endMinute??1440}});const pick=rows.slice(0,9).filter(x=>!isMine(x,userId)&&!x.full);if(!pick.length)return btn(head+formatBoard(rows,userId),[MY_REQ,MENU]);return{text:head+formatBoard(rows,userId),list:{button:"לבקשות",sections:[{title:"בקשות פתוחות",rows:pick.map(x=>({id:`connect:${x.id}`,title:`${groupShort(x)} · ${x.level}`.slice(0,24),description:`${groupNames(x).length>1?groupLabel(x)+" · ":""}${timeLabel(x)} · ${partyText(x.partySize)}${x.hasCourt?" · יש מגרש":""}`.slice(0,72)}))}]}};}

 if(input.startsWith("connect:")){const request=await store.get(`request/${input.slice(8)}`);if(!request||!request.active)return{text:"הבקשה כבר לא פעילה."};if(request.userId===userId)return{text:"זו הבקשה שלכם."};
   // Tom 23.9 15:36: no connecting into a group that would pass 4, and no second pending request to the same game.
   // Tom 24.9 09:46: with several compatible requests the party that connects is the newest one (the request just opened), not the oldest; it is pinned on the connection.
   const mine=request.date?(await userActiveRequests(store,userId,now)).filter(x=>appliesOn(x,request.date)&&timesCompatible(x,request)).pop()||null:null;
   if(partyOf(request)+(mine?partyOf(mine):1)>4)return btn(`במשחק של ${request.displayName} כבר אין מספיק מקום בשבילכם. אמשיך לחפש לכם התאמות.`,[MENU]);
   if((await store.list("connection/")).some(c=>c.value?.status==="pending"&&c.value.fromUserId===userId&&c.value.requestId===request.id))return btn(`כבר שלחתי בקשת חיבור ל${request.displayName}. אעדכן כשתגיע תשובה.`,[MENU]);
   const connectionId=id();await store.set(`connection/${connectionId}`,{id:connectionId,fromUserId:userId,fromDisplayName:displayName,toUserId:request.userId,requestId:request.id,fromRequestId:mine?.id||null,members:[request.userId,...(request.joined||[])],status:"pending",createdAt:now.toISOString()});// Tom 23.9 16:28: a connected group gets the join request together - any one of them can answer.
   const members=[request.userId,...(request.joined||[])],isGroup=members.length>1,ask=btn(isGroup?`${displayName} רוצה להצטרף אליכם (${groupLabel(request)}): ${whenOf(request)} · רמה ${request.level}. לחבר? מספיק שאחד מכם יאשר.`:`${displayName} רוצה להתחבר לבקשה שלכם: ${whenOf(request)} · רמה ${request.level}. לחבר ביניכם?`,[{id:`accept:${connectionId}`,title:"כן, לחבר"},{id:`decline:${connectionId}`,title:"לא מתאים"}]);
   const sentText=isGroup?`שלחתי בקשת הצטרפות לקבוצה של ${groupLabel(request)}. אעדכן כשתגיע תשובה.`:`שלחתי בקשת חיבור ל${request.displayName}. אעדכן כשתגיע תשובה.`,notes=members.map(to=>({to,response:ask}));
   // Live 23.9 18:25: picking someone also registers the picker as an open seeker (until a connection is approved or the window closes).
   // No request of their own for this game yet -> open one now: board window (else the picked game's window) + last level/duration; party and court are asked.
   if(!mine&&request.date){const win=state.boardWin&&state.boardWin.date===request.date?state.boardWin:{startMinute:request.startMinute,endMinute:request.endMinute},last=await lastRequest(store,userId);
    const draft={recurring:false,displayName,date:request.date,startMinute:win.startMinute,endMinute:win.endMinute};if(last){draft.level=last.level;}
    const r=await nextStep({prefilled:Boolean(last),boardWin:state.boardWin},draft,`${sentText}\n\nכדי שגם אחרים ימצאו אתכם, אני פותח גם לכם בקשה בלוח.\n\n`);return{...r,notifications:[...(r.notifications||[]),...notes]};}
   // Tom 18:25: more than one pick - the rest of the board is offered again.
   const more=await morePicks(state.boardWin||{date:request.date,startMinute:request.startMinute,endMinute:request.endMinute},request.id);
   if(more.length)return{text:`${sentText}\n\nאפשר לשלוח בקשה גם למשחק נוסף:`,list:{button:"לבקשות",sections:[{title:"בקשות פתוחות",rows:more.concat(MENU)}]},notifications:notes};
   return{text:sentText,notifications:notes};}
 // Item 8: "לא הפעם" skips only this match; nothing is muted.
 if(input.startsWith("notnow:")){await store.set(skipKey(userId,input.slice(7)),{at:now.toISOString()});return btn("בסדר, לא אציע לכם את ההתאמה הזאת שוב.",[MENU]);}
 // Tom 23.9 15:36 closing flow: "עוד לא" keeps the request on the board.
 if(input.startsWith("notyet:"))return btn("בסדר, הבקשה נשארת בלוח ואמשיך לחפש.",[MY_REQ,MENU]);
 // Item 7: "סגרתם משחק?" -> the request leaves the board.
 if(input.startsWith("closed:")){const r=await ownReq(input.slice(7));if(!r)return btn("הבקשה כבר לא פעילה.",[MY_REQ,MENU]);await store.set(`request/${r.id}`,{...r,active:false,closedAt:now.toISOString(),closedReason:"played"});return btn("מעולה, הורדתי את הבקשה מהלוח. משחק מוצלח! 🎾",[MENU]);}
 if(input.startsWith("accept:")||input.startsWith("decline:")){const connection=await store.get(`connection/${input.split(":")[1]}`);const CR=connection&&await store.get(`request/${connection.requestId}`);if(!connection||!(connection.toUserId===userId||(CR?.joined||[]).includes(userId)))return{text:"הבקשה אינה זמינה."};
   // Tom 23.9 16:29: one approval connects; the group's listing leaves the board only when everyone approved (or 4h after the game).
   if(connection.status==="accepted"&&input.startsWith("accept:")){if(!(connection.approvals||[]).includes(userId)){connection.approvals=[...(connection.approvals||[]),userId];await store.set(`connection/${connection.id}`,connection);}
     // Tom 23.9 19:13: a full foursome stays on the board (marked מלא, nobody is offered to it) until the usual auto-close 4h after the game.
     return btn(`רשמתי שגם אתם מאשרים את ${connection.fromDisplayName}.`,[MENU]);}
   if(connection.status!=="pending")return btn(connection.status==="accepted"?"מישהו מהקבוצה כבר אישר את הבקשה הזאת.":connection.status==="declined"?"מישהו מהקבוצה כבר ענה על הבקשה הזאת.":"הבקשה הזאת כבר סגורה, אז לא חיברתי.",[MENU]);
   connection.status=input.startsWith("accept:")?"accepted":"declined";connection.answeredBy=userId;if(connection.status==="accepted")connection.approvals=[userId];await store.set(`connection/${connection.id}`,connection);if(connection.status==="declined")return{text:"סימנתי שלא מתאים.",notifications:[{to:connection.fromUserId,response:{text:"בקשת החיבור לא התאימה הפעם. אמשיך לחפש התאמות אחרות."}}]};
   // Item 6: the two sides become one group. At 4 both requests close; below 4 the owner's request stays open with the new count.
   const R=await store.get(`request/${connection.requestId}`);let group="",openReq=null;const fullNotes=[];
   // Tom 23.9 15:36: the game already filled (or was closed) -> no connection; the other side hears it kindly.
   if(connection.status==="accepted"&&(!R||!R.active)){connection.status="closed";await store.set(`connection/${connection.id}`,connection);return{text:"הבקשה הזאת כבר סגורה, אז לא חיברתי.",notifications:[{to:connection.fromUserId,response:{text:"המשחק שביקשתם להצטרף אליו כבר התמלא. אמשיך לחפש לכם התאמות."}}]};}
   if(R&&R.active){const FRs=(await userActiveRequests(store,connection.fromUserId,now)).filter(x=>R.date&&appliesOn(x,R.date)&&timesCompatible(x,R)),FR=FRs.find(x=>x.id===connection.fromRequestId)||FRs.pop()||null,sum=partyOf(R)+(FR?partyOf(FR):1),at=now.toISOString();
     if(sum>4){connection.status="closed";await store.set(`connection/${connection.id}`,connection);return{text:`אין מספיק מקום: יחד הייתם ${sum}. לא חיברתי.`,notifications:[{to:connection.fromUserId,response:{text:`במשחק של ${R.displayName} כבר אין מספיק מקום בשבילכם. אמשיך לחפש לכם התאמות.`}}]};}
     connection.joinParty=FR?partyOf(FR):1;connection.groupSize=sum;await store.set(`connection/${connection.id}`,connection);// for the dashboard "חיבורים" tab
     if(FR)await store.set(`request/${FR.id}`,{...FR,active:false,closedAt:at,closedReason:"merged",mergedInto:R.id});
     if(sum>=4){const FULL={...R,partySize:sum,full:true,joined:[...(R.joined||[]),connection.fromUserId],joinedNames:[...(R.joinedNames||[]),connection.fromDisplayName]};await store.set(`request/${R.id}`,FULL);
       group="\n\nיחד אתם 4 - רביעייה מלאה! המשחק נשאר בלוח כמלא, ולא אציע אותו לאחרים. אם מישהו מבטל, אפשר להסיר אותו דרך 'הבקשות שלי' ולפנות מקום.";
              for(const c of(await store.list("connection/")).map(x=>x.value))if(c?.status==="pending"&&c.requestId===R.id&&c.id!==connection.id){c.status="closed";await store.set(`connection/${c.id}`,c);fullNotes.push({to:c.fromUserId,response:{text:`המשחק של ${R.displayName} כבר התמלא. אמשיך לחפש לכם התאמות.`}});}}
     else{openReq={...R,partySize:sum,joined:[...(R.joined||[]),connection.fromUserId],joinedNames:[...(R.joinedNames||[]),connection.fromDisplayName]};await store.set(`request/${R.id}`,openReq);group=`\n\nיחד אתם ${sum} מתוך 4. הבקשה נשארת בלוח (חסר ${4-sum}) ואמשיך לחפש.`;}
     // Tom 23.9 18:51: requests sent to several matches - the first approval wins; the requester's other pending requests that no longer fit (over 4) are cancelled, with a kind notice to that side.
     for(const c of(await store.list("connection/")).map(x=>x.value)){if(c?.status!=="pending"||c.fromUserId!==connection.fromUserId||c.id===connection.id)continue;const T=await store.get(`request/${c.requestId}`);if(T&&T.active&&partyOf(T)+sum<=4&&T.id!==R.id)continue;c.status="closed";c.closedReason="requester_filled";await store.set(`connection/${c.id}`,c);if(T)for(const to of(c.members||[c.toUserId]))fullNotes.push({to,response:{text:`הבקשה של ${connection.fromDisplayName} להתחבר אליכם כבר לא רלוונטית - נמצאו שחקנים למשחק שלהם. אמשיך לחפש לכם התאמות.`}});}}
   // Item 7: no court yet -> a booking button (opens the booking card), never a raw link.
   const bookBtn=R&&!R.hasCourt&&R.courtSlot&&R.date?{id:slotActionId(R.date,R.courtSlot),title:"להזמנת מגרש"}:null;
   // Tom 23.9 15:01: a "שלח הודעה" button (wa.me link) instead of the phone number in the text.
   const notes=[{to:connection.fromUserId,response:{text:`החיבור עם ${displayName} אושר! אפשר לשלוח הודעה בלחיצה.${group}`,ctaUrl:{displayText:"שלח הודעה",url:waLink(userId)}}}];
   // Tom 23.9 16:25: no "סגרתם משחק?" - the request closes by itself 4 hours after the game window.
   // Other group members hear who joined, with a message button to the new player.
   for(const m of[R?.userId,...(R?.joined||[])])if(m&&m!==userId&&m!==connection.fromUserId)notes.push({to:m,response:{text:`עדכון: ${connection.fromDisplayName} הצטרף/ה למשחק (${whenOf(R)}).${group}`,ctaUrl:{displayText:"שלח הודעה",url:waLink(connection.fromUserId)}}});
   if(bookBtn)notes.push({to:userId,response:btn("עוד אין לכם מגרש?",[bookBtn,MENU])});
   return{text:`חיברתי ביניכם! אפשר לשלוח הודעה ${toName(connection.fromDisplayName)} בלחיצה.${group}`,ctaUrl:{displayText:"שלח הודעה",url:waLink(connection.fromUserId)},notifications:notes.concat(fullNotes)};}
 if(input==="oneoff"||input==="recurring"){if((await userActiveRequests(store,userId,now)).length>=MAX_ACTIVE_REQUESTS)return btn(CAP_TEXT,[MY_REQ,MENU]);const last=await lastRequest(store,userId),draft={recurring:input==="recurring",displayName};if(!last)return nextStep({},draft);draft.level=last.level;return nextStep({prefilled:true},draft,`לקחתי מהבקשה הקודמת: רמה ${last.level}.\n\n`);}
 if(input==="pfinish"&&state.flow==="players"&&state.draft)return finish(state,state.draft);
 if(state.flow==="players"&&["pc","party"].includes(state.step)&&input==="pc_reset")return nextStep({...state,redoDuration:true},{...state.draft,level:undefined,durations:undefined,flexMinutes:undefined});
 {const REG=["level","pc","party","court","when","schedule","duration","flex"],fe=state.flow==="players"&&state.draft&&REG.includes(state.step)?(input==="pc_level"?"level":input==="pc_dur"?"duration":!actionId?fieldEditIntent(text):null):null;
  if(fe==="level")return nextStep(state,{...state.draft,level:undefined});
  if(fe==="both")return nextStep(state,{...state.draft,level:undefined});
  }
 // Any answer to a registration field is kept, whichever question is showing (buttons from earlier messages included); then the next missing field is asked.
 const REG_STEPS=["level","pc","party","court","when","schedule","duration","flex"];
 if(state.flow==="players"&&state.draft&&actionId&&REG_STEPS.includes(state.step)){let f=null;
   if(input.startsWith("level:"))f={level:levelValue(input.slice(6))};
   else if(/^pc:[123]:(?:yes|no)$/.test(input)){const[,n,c]=input.split(":");f={partySize:Number(n),hasCourt:c==="yes"};}
   else if(/^party:[123]$/.test(input))f={partySize:Number(input.slice(6))};
   else if(/^court:(?:yes|no)$/.test(input))f={hasCourt:input.endsWith("yes")};
   else if(input.startsWith("duration:")){const v=input.slice(9);f={durations:v==="flex"?[60,90,120]:[Number(v)]};}
   else if(input.startsWith("flex:"))f={flexMinutes:flexMinutesFor(input.slice(5))};
   if(f)return nextStep(state,{...state.draft,...f});}
 const whenLike=t=>DAY_WORD.test(t)||/\d/.test(t);
 if(state.flow==="players"&&state.draft&&text&&!actionId&&(state.step==="when"||state.step==="schedule"||(["level","pc","court","duration","flex"].includes(state.step)&&whenLike(text)))){
   if(state.draft.recurring&&!recurringDays(text).length)return{text:"בזמינות קבועה צריך לציין ימים בשבוע, למשל: שני ורביעי אחרי 20:00. לחיפוש משחק ליום מסוים חזרו לתפריט ובחרו \"חסרים לי שחקנים\"."};
   const rec=state.draft.recurring,p=await parseWhen(text,now);
   if(p.needsClarification==="unclear"&&!rec){if(p.dateExplicit&&p.startMinute==null)return timeAsk(p.date,state);return{text:UNCLEAR_WHEN};}
   if(p.ambiguousHour&&!rec){await set({step:"ampm",apResume:state,apText:text});return btn(`התכוונתם ל-${p.ambiguousHour} בבוקר או ל-${p.ambiguousHour} בערב?`,[{id:"ampm:am",title:`${p.ambiguousHour} בבוקר`},{id:"ampm:pm",title:`${p.ambiguousHour} בערב`}]);}
   const draft={...state.draft,date:p.date,startMinute:p.startMinute??1140,endMinute:p.endMinute??1380,weekdays:rec?recurringDays(text):undefined},dt=durationFromText(text);
   // Item 14: recurring availability is echoed too.
   const echo=`רשמתי: ${rec?recurringEcho(draft):whenEcho(draft)}.\n\n`;
   // Item 3: no court -> check availability right away, before any more questions.
   if(!rec&&draft.hasCourt===false){const a=await availabilityFn({date:draft.date,startMinute:draft.startMinute,endMinute:draft.endMinute,durationMinutes:draft.durations?.[0]||60},{today:today()});if(!a.slots?.length)return{text:`${echo}לא מצאתי מגרש פנוי בחלון הזה, ולכן לא אחפש שחקנים למשחק שלא ניתן להזמין. אפשר לנסות זמן אחר או לבדוק מה פנוי.`,buttons:[{id:"retry_when",title:"לנסות זמן אחר"},{id:"availability",title:"בדיקת זמינות"}]};}
   return nextStep(state,draft,echo);}

 // Item 10 applies inside flows only: Tom 23.9 ~12:58 kept "לא הבנתי" for a no-step "מחר אחרי העבודה".
 // Item 11: a question the bot cannot answer gets the two things it can do (club contact needs a number from Tom).
 if(text.includes("?"))return btn("את זה אני עוד לא יודע לענות. אפשר לבדוק מגרש פנוי, למצוא שחקנים או לכתוב למועדון.",[{id:"availability",title:"מגרש פנוי"},{id:"players",title:"מציאת שחקנים"},CLUB_BTN]);
 if(seen)return btn("לא הבנתי. אפשר לבחור מה לעשות:",[{id:"availability",title:"מגרש פנוי"},{id:"players",title:"מציאת שחקנים"}]);
 return withMyRequests(await menuFor());
}
