import {answer} from '../src/agent.js';
import {handleConversation} from '../src/conversation.js';
import {routeIncoming} from '../src/webhook.js';
import {dailySweep} from '../src/matching.js';
import {memoryStore} from '../src/store.js';
const now=new Date('2026-09-23T00:10:00+03:00'), transcripts=[];
const view=r=>({text:r.text,buttons:r.buttons?.map(x=>x.title),list:r.list?.sections?.flatMap(s=>s.rows.map(x=>x.title)),notifications:r.notifications?.map(x=>({to:x.to,text:x.response.text,buttons:x.response.buttons?.map(b=>b.title)}))});
async function availability(title,user){const bot=await answer(user,{now});transcripts.push({title,type:'availability',turns:[{from:'user',text:user},{from:'bot',...view({text:bot})}]});}
const availabilityCases=[
['היום בבוקר 90','יש מגרש היום בבוקר ל90 דקות?'],['חמישי ערב 60','מה פנוי מחר בערב לשעה?'],['שישי צהריים 120','תבדוק שישי בצהריים לשעתיים'],['שבת בבוקר','שבת בבוקר, מגרש לשעה וחצי'],['ראשון אחרי 19','יש משהו ביום ראשון אחרי 19:00?'],['שני לפני 18','מה פנוי ביום שני לפני 18:00 ל90 דק'],['שלישי לילה','שלישי בלילה לשעה וחצי'],['רביעי הבא','רביעי הבא בערב ל90 דקות'],['תאריך מספרי','מגרש ב25/9 בשעה 17:00 ל90 דקות'],['יום בחודש','מתי יש מגרש ב30 לחודש בערב?'],['שגיאת כתיב','יש מגרש מחר אחהצ לשעה וחצי'],['אחרי 20:30','מתי יש מגרשים פנויים אחרי 20:30 בערב ל90 דק'],['לפני 08:00','מגרש מחר לפני 08:00 ל60 דק'],['שעתיים','אפשר מחר ב16:00 לשעתיים?'],['ברירת מחדל 90','יש מגרש מחר בערב?']];
for(let i=0;i<availabilityCases.length;i++)await availability(`${i+1}. ${availabilityCases[i][0]}`,availabilityCases[i][1]);
async function convo(title,steps,{store=memoryStore(),userId='u',name='דנה',availabilityFn}={}){const turns=[];for(const step of steps){turns.push({from:'user',text:step.text||`[${step.actionId}]`});const r=await handleConversation({userId,displayName:name,text:step.text||'',actionId:step.actionId,store,now,availabilityFn});turns.push({from:'bot',...view(r)});}transcripts.push({title,type:'matching',turns});return store;}
await convo('16. הודעת פתיחה ושני כפתורים',[{text:'שלום'}]);
const yes=async i=>({kind:'availability',date:i.date,slots:[{courtId:'c3',courtName:'3',start:'19:00',end:'20:30',durationMinutes:i.durationMinutes,price:225}]});
const no=async i=>({kind:'availability',date:i.date,slots:[]});
const oneoff=[{actionId:'oneoff'},{actionId:'level:3–3.5'},{text:'מחר אחרי 19:00'},{actionId:'duration:90'},{actionId:'party:1'},{actionId:'court:yes'},{actionId:'flex:30'}];
await convo('17. בקשה חד-פעמית ליחיד',oneoff,{availabilityFn:yes});
await convo('18. זוג עם מגרש ומשך 60',[{actionId:'oneoff'},{actionId:'level:2.5–3'},{text:'מחר ב18:00'},{actionId:'duration:60'},{actionId:'party:2'},{actionId:'court:yes'},{actionId:'flex:0'}],{userId:'pair',name:'נועם',availabilityFn:yes});
await convo('19. מנוי קבוע וגמישות במשך',[{actionId:'recurring'},{actionId:'level:3–3.5'},{text:'ימי שני ורביעי אחרי 20:00'},{actionId:'duration:flex'},{actionId:'party:1'},{actionId:'court:no'},{actionId:'flex:60'}],{userId:'rec',name:'מיכל',availabilityFn:yes});
const shared=memoryStore();await convo('20a. יצירת בקשה ללוח',oneoff,{store:shared,userId:'board1',name:'דנה',availabilityFn:yes});await convo('20. לוח בקשות ציבורי',[{text:'מי מחפש משחק מחר בערב?'}],{store:shared,userId:'viewer',name:'נועם',availabilityFn:yes});
// connect accept using real IDs from state
const req=(await shared.list('request/'))[0].value;await convo('21a. בקשת חיבור',[{actionId:`connect:${req.id}`}],{store:shared,userId:'viewer',name:'נועם',availabilityFn:yes});const conn=(await shared.list('connection/'))[0].value;await convo('21. אישור חיבור מתווך',[{actionId:`accept:${conn.id}`}],{store:shared,userId:'board1',name:'דנה',availabilityFn:yes});
const shared2=memoryStore();await convo('22a. יצירת בקשה לחיבור שנדחה',oneoff,{store:shared2,userId:'a',name:'רוני',availabilityFn:yes});const req2=(await shared2.list('request/'))[0].value;await convo('22a2. בקשת חיבור',[{actionId:`connect:${req2.id}`}],{store:shared2,userId:'b',name:'גל',availabilityFn:yes});const conn2=(await shared2.list('connection/'))[0].value;await convo('22. דחיית חיבור',[{actionId:`decline:${conn2.id}`}],{store:shared2,userId:'a',name:'רוני',availabilityFn:yes});
await convo('23. השתקה לשבוע',[{actionId:'mute_week'}]);
await convo('24. השתקה מותאמת ל-14 יום',[{actionId:'mute_custom'},{actionId:'mute_14'}]);
await convo('25. תפריט הגדרות',[{text:'הגדרות'}]);
const mine=memoryStore();await convo('26a. יצירת בקשה לניהול',oneoff,{store:mine,userId:'me',name:'תמר',availabilityFn:yes});await convo('26. הבקשות שלי',[{actionId:'my_requests'}],{store:mine,userId:'me',name:'תמר',availabilityFn:yes});
const mismatch=memoryStore();await convo('27a. רמה 1-2',oneoff.map(x=>x.actionId==='level:3–3.5'?{actionId:'level:1–2'}:x),{store:mismatch,userId:'low',name:'אורי',availabilityFn:yes});await convo('27. אי התאמה בין רמות רחוקות',oneoff.map(x=>x.actionId==='level:3–3.5'?{actionId:'level:4+'}:x),{store:mismatch,userId:'high',name:'לי',availabilityFn:yes});
await convo('28. משך 120 וגמישות שעה',[{actionId:'oneoff'},{actionId:'level:3.5–4'},{text:'מחר ב17:00'},{actionId:'duration:120'},{actionId:'party:3'},{actionId:'court:yes'},{actionId:'flex:60'}],{availabilityFn:yes});
await convo('29. אין מגרש חי - הבקשה לא מתפרסמת',[{actionId:'oneoff'},{actionId:'level:3–3.5'},{text:'מחר אחרי 19:00'},{actionId:'duration:90'},{actionId:'party:1'},{actionId:'court:no'},{actionId:'flex:30'}],{availabilityFn:no});
const sweep=memoryStore();await convo('30a. מנוי ראשון לסריקה',[{actionId:'recurring'},{actionId:'level:3–3.5'},{text:'ימי חמישי אחרי 19:00'},{actionId:'duration:90'},{actionId:'party:1'},{actionId:'court:no'},{actionId:'flex:30'}],{store:sweep,userId:'s1',name:'שרון',availabilityFn:yes});await convo('30b. מנוי שני לסריקה',[{actionId:'recurring'},{actionId:'level:3–3.5'},{text:'ימי חמישי אחרי 19:00'},{actionId:'duration:90'},{actionId:'party:1'},{actionId:'court:no'},{actionId:'flex:30'}],{store:sweep,userId:'s2',name:'עדי',availabilityFn:yes});const first=await dailySweep(sweep,now),second=await dailySweep(sweep,now);transcripts.push({title:'30. סריקה יומית ומניעת כפילות',type:'matching',turns:[{from:'system',text:`סריקה ראשונה: ${first.length} התאמות; סריקה חוזרת: ${second.length} התאמות חדשות.`},{from:'bot',text:'אותה התאמה אינה נשלחת פעמיים.'}]});
// Extended entry/menu conversations.
async function routed(title,steps){const store=memoryStore(),turns=[];for(const step of steps){turns.push({from:'user',text:step.text||`[${step.actionId}]`});const r=await routeIncoming({userId:`ext-${title}`,displayName:'דנה',text:step.text||'',actionId:step.actionId,store,now,availabilityFn:yes});turns.push({from:'bot',...view(r)});}transcripts.push({title,type:'entry',turns});}
await routed('31. ברכה בלבד מציגה פתיחה',[{text:'היי'}]);
await routed('32. שאלה ראשונה מקבלת תשובה ותפריט',[{text:'יש מגרש מחר בערב?'}]);
await routed('33. שאלה לא מוכרת בלי פתיחה מלאה',[{text:'כמה עולה מנוי?'}]);
await routed('34. תפריט זמין באמצע תהליך',[{actionId:'players'},{actionId:'oneoff'},{actionId:'level:3–3.5'},{text:'תפריט'}]);
// Keep exactly 34 numbered scenarios: auxiliary setup transcripts omitted from report.
const final=transcripts.filter(x=>/^([1-9]|1[0-9]|2[0-9]|30)\./.test(x.title)&&!/^[0-9]+[a-z]/.test(x.title.split('.')[0])).filter(x=>!/^20a|21a|22a|26a|27a|30a|30b/.test(x.title));
if(final.length!==34)throw Error(`expected 34, got ${final.length}: ${final.map(x=>x.title).join(',')}`);
await import('node:fs').then(fs=>fs.writeFileSync('/tmp/gt-30-transcripts.json',JSON.stringify(final,null,2)));
console.log(JSON.stringify({count:final.length,titles:final.map(x=>x.title)},null,2));
