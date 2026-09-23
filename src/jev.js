// TypeSafe Jev adapter for the when-parser. Jev answers only closed questions (choice/score/noul), so the
// date and start time are asked as choices over concrete options and mapped back to the same schema as openaiAdapter.
// Evaluation only: production stays on openaiAdapter until Tom decides.
import { prompt } from "./when.js";
const HE_DAYS=["ראשון","שני","שלישי","רביעי","חמישי","שישי","שבת"];
const addDays=(iso,n)=>{const d=new Date(`${iso}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const hhmm=m=>`${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`;
export function jevQuestions(today){
 const date={which_day:"next week or some day, but no specific day is named",none:"no date or day is mentioned"};
 for(let i=0;i<=15;i++){const d=addDays(today,i),w=new Date(`${d}T12:00:00Z`);date[d]=`יום ${HE_DAYS[w.getUTCDay()]} ${w.getUTCDate()}.${w.getUTCMonth()+1}${i===0?" (היום)":i===1?" (מחר)":i===2?" (מחרתיים)":""}`;}
 const PART={360:" - also בוקר (morning) with no hour",720:" - also צהריים (noon) with no hour",960:" - also אחה\"צ / אחרי הצהריים (afternoon) with no hour",1200:" - also לילה (night) with no hour",1140:" - also ערב / בערב (evening) or מוצ\"ש with no hour"};
 const start={none:"no time of day is mentioned"};for(let m=0;m<1440;m+=30)start[hhmm(m)]=`starts at ${hhmm(m)}${PART[m]||""}`;
 return{
  date:{type:"choice",instructions:`${prompt(today)}\nWhich calendar date does the player mean?`,criteria:date},
  start:{type:"choice",instructions:`${prompt(today)}\nWhat is the earliest start time the player means (startMinute)? For a part of day use its window start.`,criteria:start},
  ampm:{type:"noul",instructions:"Is the stated hour 8, 9 or 10 with no morning/evening word, so it is unclear whether AM or PM is meant?"},
  duration:{type:"choice",instructions:"How long do they want to play, only if stated?",criteria:{"60":"one hour (שעה)","90":"an hour and a half (שעה וחצי)","120":"two hours (שעתיים)",none:"not stated"}}};
}
export function fromJev(a){const d=a?.date?.choice,s=a?.start?.choice,du=a?.duration?.choice;
 const clar=d==="which_day"?"which_day":(d==="none"&&s==="none")?"no_time_info":(a?.ampm?.noul>0.5&&s!=="none")?"ampm":null;
 const startMinute=s&&s!=="none"?Number(s.slice(0,2))*60+Number(s.slice(3)):null;
 const r={date:d&&/^\d{4}-/.test(d)?d:null,startMinute,endMinute:null,durationMinutes:du&&du!=="none"?Number(du):null,needs_clarification:clar};Object.defineProperty(r,"confidence",{value:Math.min(a?.date?.confidence??1,a?.start?.confidence??1),enumerable:false});return r;}
export async function jevAdapter(text,today,{fetchImpl=fetch,signal,onUsage}={}){
 const res=await fetchImpl("https://api.typesafe.ai/v1/systemone",{method:"POST",signal,headers:{Authorization:`Bearer ${process.env.TYPESAFE_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:process.env.JEV_MODEL||"jev-latest",state:text,questions:jevQuestions(today)})});
 if(!res.ok)throw Error(`jev ${res.status} ${(await res.text().catch(()=>"")).slice(0,200)}`);
 const j=await res.json();onUsage?.({input:j.usage?.input_tokens||0,output:j.usage?.output_tokens||0,model:j.model});return fromJev(j.answers);}
