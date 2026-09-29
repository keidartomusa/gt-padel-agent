// Conservative candidate extraction. Output is for the authenticated owner only, not logs or public fixtures.
import {createHmac} from 'node:crypto';
const SAFE_WORDS=new Set(`יש אין כן לא מגרש מגרשים מגרש? פנוי פנויים פנויות זמינות מחר היום מחרתיים בערב בבוקר בצהריים לילה בצהריים? חמישי שישי שבת ראשון שני שלישי רביעי אחרי לפני בשעה שעה שעות שעתיים דקות דקה משחק משחקים שחקן שחקנים מישהו מישהי מחפש מחפשים מחפשת רוצה רוצים יכול אפשר לבדוק בדוק תבדוק תבדקו לי לנו בא מי מה כמה מתי איפה יום ימים השבוע הבא הקרוב קבוצה אנשים שותף שותפים למצוא לחפש מציאת חיפוש שחקן? שחקנים? מגרש? פנוי? משחק? בערב? בבוקר? מחר? היום? מקום מקום? הערב הערב? מחרר שישיי לתאם לקבוע פאדל רמה מחיר עולה עולה? עולים מנוי מנוי? להזמין הזמנה פתוחות פתוחים בקשות בקשה תפריט שלום היי הי תודה סבבה עכשיו לשחק רוצה לשחק לשחק? משהו יש? עוד בטווח סביב בערך בין עד דק שעה וחצי בדקתי`.split(/\s+/));
const SENSITIVE=/(?:https?:\/\/|www\.|@|סיסמ|קוד|כתובת|טלפון|מספר|תעודת|אשראי|תשלום|IBAN|token|password|otp|pin)/i;
export function safeCandidate(body){
 const t=String(body||'').trim();if(!t||t.length>300||SENSITIVE.test(t)||/(?:\+?972|0)[\d\s().-]{7,}/.test(t)||/\d{6,}/.test(t))return null;
 let hidden=0;const text=t.replace(/[\p{L}\p{N}״׳'.:-]+/gu,word=>{
  const basic=word.replace(/^[בלמוהשכ]+(?=[\u0590-\u05ff]{3,})/u,'');
  if(SAFE_WORDS.has(word)||SAFE_WORDS.has(basic)||/^\d{1,2}(?:(?:[:./-]\d{1,4}){0,2})$/.test(word)||/^(?:am|pm|today|tomorrow)$/i.test(word))return word;
  hidden++;return '[פרט]';
 }).replace(/\[פרט\](?:\s*\[פרט\])+/g,'[פרט]');
 if(hidden>1||text.length>300||text.includes('[פרט]'))return null;
 return text;
}
export function candidateId(secret,text){if(typeof secret!=='string'||!secret)return null;return createHmac('sha256',secret).update(text.normalize('NFKC')).digest('hex').slice(0,32);}
export async function pilotCandidates(stores,{secret}={}){
 const map=new Map(),counts={gt:0,saar:0,smash:0};for(const club of ['gt','saar','smash']){
  const store=stores[club];if(!store)continue;
  const rows=(await store.list('msg/')).map(x=>x.value).filter(v=>v?.direction==='in'&&v.kind==='user'&&v.type==='text');
  for(const row of rows){const text=safeCandidate(row.body);if(!text)continue;counts[club]++;const id=candidateId(secret,text);if(!id)continue;
   if(!map.has(id))map.set(id,{id,text,clubs:[club],frequency:1,at:row.at});else{const item=map.get(id);item.frequency++;if(!item.clubs.includes(club))item.clubs.push(club);}
  }
 }
 return {eligible:map.size,sourceCounts:counts,items:[...map.values()].sort((a,b)=>String(a.at).localeCompare(String(b.at)))};
}
