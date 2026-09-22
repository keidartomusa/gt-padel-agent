import crypto from "node:crypto";
import { parseIntentLocal } from "./intent.js";
import { activeRequests, DURATIONS, findMatches, formatBoard, LEVELS, mute, publicBoard, welcome } from "./matching.js";
const btn=(text,buttons)=>({text,buttons:buttons.map(x=>typeof x==="string"?{id:x,title:x}:x)}), list=(text,items)=>({text,list:{button:"לבחירה",sections:[{title:"אפשרויות",rows:items}]}});
const id=()=>crypto.randomUUID();
export async function handleConversation({userId,displayName="שחקן/ית",text="",actionId,store,now=new Date()}){
 const input=(actionId||text).trim(),state=await store.get(`state/${userId}`)||{}; const set=async s=>store.set(`state/${userId}`,s);
 if(/^(היי|הי|שלום|תפריט|menu|start)$/i.test(input)||input==="menu")return welcome();
 if(input==="availability"||/מגרש פנוי|זמינות|איזה מגרשים|איפה מזמינים/.test(input))return{mode:"availability",query:text||input};
 if(input==="players"||/מציאת שחקנים/.test(input)){await set({flow:"players",step:"mode"});return btn("איך תרצו למצוא משחק?",[{id:"oneoff",title:"משחק נקודתי"},{id:"recurring",title:"זמינות קבועה"},{id:"board",title:"בקשות פתוחות"}]);}
 if(input==="settings"||/הגדרות|הבקשות שלי/.test(input))return btn("*ניהול הבקשות וההתראות*",[{id:"my_requests",title:"הבקשות שלי"},{id:"mute_week",title:"השתקה לשבוע"},{id:"mute_custom",title:"השתקה אחרת"}]);
 if(input==="mute_week"){const until=new Date(now);until.setDate(until.getDate()+7);await mute(store,userId,until.toISOString());return btn("ההתראות הושתקו לשבוע. אפשר לשנות זאת בכל רגע דרך תפריט ההגדרות.",[{id:"menu",title:"לתפריט"}]);}
 if(input==="mute_custom"){await set({...state,flow:"settings",step:"mute_days"});return list("לכמה זמן להשתיק התראות?",[1,3,7,14,30].map(d=>({id:`mute_${d}`,title:`${d} ימים`})));}
 if(/^mute_\d+$/.test(input)){const days=Number(input.slice(5)),until=new Date(now);until.setDate(until.getDate()+days);await mute(store,userId,until.toISOString());return{ text:`ההתראות הושתקו ל־${days} ימים.`};}
 if(input==="my_requests"){const rows=(await activeRequests(store,now)).filter(x=>x.userId===userId);return{text:rows.length?`*הבקשות שלי*\n${rows.map(x=>`• ${x.recurring?"קבועה":"חד־פעמית"} · ${x.date||x.weekdays.join(", ")} · רמה ${x.level}`).join("\n")}`:"אין לך כרגע בקשות פעילות."};}
 if(input==="board"||/מי מחפש|שחקן פנוי|בקשות פתוחות/.test(input)){const p=parseIntentLocal(text||input,now);return{text:formatBoard(await publicBoard(store,{date:p.date,startMinute:p.startMinute??0,endMinute:p.endMinute??1440,now}))};}
 if(input==="oneoff"||input==="recurring"){await set({flow:"players",step:"level",draft:{recurring:input==="recurring",displayName}});return list("מה הרמה שלכם?",LEVELS.map(x=>({id:`level:${x}`,title:x})));}
 if(state.flow==="players"&&state.step==="level"&&input.startsWith("level:")){const draft={...state.draft,level:input.slice(6)};await set({...state,step:draft.recurring?"schedule":"when",draft});return draft.recurring?{text:"באילו ימים ושעות אתם זמינים בדרך כלל? למשל: שני ורביעי אחרי 20:00"}:{text:"מתי תרצו לשחק? אפשר לכתוב למשל: מחר אחרי 19:00"};}
 if(state.flow==="players"&&(state.step==="when"||state.step==="schedule")){
   const p=parseIntentLocal(text,now),draft={...state.draft,date:p.date,startMinute:p.startMinute??1020,endMinute:p.endMinute??1380,weekdays:state.draft.recurring?[text]:undefined};await set({...state,step:"duration",draft});return list("כמה זמן תרצו לשחק?",DURATIONS.map(d=>({id:`duration:${d}`,title:`${d} דקות`})).concat({id:"duration:flex",title:"גמיש"}));
 }
 if(state.flow==="players"&&state.step==="duration"&&input.startsWith("duration:")){const v=input.slice(9),draft={...state.draft,durations:v==="flex"?[60,90,120]:[Number(v)]};await set({...state,step:"party",draft});return list("כמה שחקנים כבר יש בבקשה?",[1,2,3].map(n=>({id:`party:${n}`,title:`${n}`})));}
 if(state.flow==="players"&&state.step==="party"&&input.startsWith("party:")){const draft={...state.draft,partySize:Number(input.slice(6))};await set({...state,step:"court",draft});return btn("כבר יש לכם מגרש?",[{id:"court:yes",title:"כן"},{id:"court:no",title:"לא"}]);}
 if(state.flow==="players"&&state.step==="court"&&input.startsWith("court:")){const draft={...state.draft,hasCourt:input.endsWith("yes")};await set({...state,step:"flex",draft});return list("עד כמה אתם גמישים בשעה?",[{id:"flex:0",title:"שעה מדויקת"},{id:"flex:30",title:"חצי שעה"},{id:"flex:60",title:"שעה"}]);}
 if(state.flow==="players"&&state.step==="flex"&&input.startsWith("flex:")){const d=state.draft,request={...d,id:id(),userId,flexMinutes:Number(input.slice(5)),active:true,createdAt:now.toISOString()};await store.set(`request/${request.id}`,request);await set({});const matches=await findMatches(store,request,now);return btn(`הבקשה נשמרה ותופיע בלוח הציבורי בשם ${request.displayName}. מספרי טלפון לא יוצגו.${matches.length?`\n\nמצאתי ${matches.length} התאמות אפשריות ואפשר להתחיל לחבר ביניכם.`:"\n\nאעדכן כשאמצא התאמה."}`,[{id:"mute_week",title:"השתקה לשבוע"},{id:"mute_custom",title:"השתקה אחרת"}]);}
 return welcome();
}
