// Extract candidate text only inside the private environment. No raw pilot text is committed or logged.
import {redact} from './pilot-mine.js';
export const safeCandidate=body=>{
 const t=String(body||'').trim();if(!t||t.length>300||/https?:\/\/|www\.|@|(?:\b(?:id|token|password)|סיסמ|קוד)/i.test(t))return null;
 const masked=redact(t).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[מייל]').replace(/(?:\+?972|0)[\d\s().-]{7,}/g,'[מספר]');
 if(masked.includes('[מספר]')||masked.includes('[מייל]')||/(?:^|\s)0(?:5\d|[23489])[-\d\s]{6,}/.test(t))return null; // Manual review still required for names and sensitive context.
 return masked;
};
export async function pilotCandidates(store){const rows=(await store.list('msg/')).map(x=>x.value).filter(v=>v?.direction==='in'&&v.kind==='user'&&v.type==='text');const seen=new Set(),items=[];for(const row of rows){const text=safeCandidate(row.body);if(!text)continue;const key=text.normalize('NFKC');if(seen.has(key)){const entry=items.find(x=>x.text.normalize('NFKC')===key);entry.frequency++;continue;}seen.add(key);items.push({text,at:row.at,frequency:1});}return {eligible:items.length,items};}
