// Generates time-focused corpus cases with an independent oracle (plain date arithmetic from the Tom 23.9 rules),
// anchored to Wed 2026-09-23 10:36 Asia/Jerusalem. Output: test/fixtures/hebrew-when-corpus-generated.json
import { writeFileSync } from "node:fs";
const today="2026-09-23",dow=3,add=n=>{const d=new Date(`${today}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const next=w=>add(((w-dow+7)%7)||7);
const DAYS=[["ראשון",0],["שני",1],["שלישי",2],["רביעי",3],["חמישי",4],["שישי",5],["שבת",6]];
const PARTS=[["בבוקר",360],["בצהריים",720],["אחה\"צ",960],["בערב",1140],["בלילה",1200]];
const out=[];
for(const [d,w] of DAYS)for(const [p,m] of PARTS)for(const pre of ["","ב","יום ","ביום "])out.push([`${pre}${d} ${p}`,next(w),m]);
for(let n=1;n<=7;n++)out.push([`מחר ב-${n}`,add(1),(n+12)*60]);
for(const n of [11,12])out.push([`מחר ב-${n}`,add(1),n*60]);
for(let n=6;n<=10;n++)out.push([`מחר ב-${n} בבוקר`,add(1),n*60]);
for(let n=6;n<=11;n++)out.push([`מחר ב-${n} בערב`,add(1),(n+12)*60]);
const W=[["אחת",1],["שתיים",2],["שלוש",3],["ארבע",4],["חמש",5],["שש",6],["שבע",7]];
for(const [w,n] of W)out.push([`מחר ב${w}`,add(1),(n+12)*60]);
for(const [w,n] of W)out.push([`מחר ב${w} וחצי`,add(1),(n+12)*60+30]);
for(let n=16;n<=22;n++)out.push([`מחר ב-${n}:00`,add(1),n*60],[`מחרתיים אחרי ${n}:30`,add(2),n*60+30]);
for(let n=2;n<=9;n++)out.push([`בעוד ${n} ימים`,add(n),null]);
for(let i=1;i<=15;i++){const iso=add(i),[,mm,dd]=iso.split("-").map(Number);out.push([`${dd}/${mm} בערב`,iso,1140],[`ב-${dd}.${mm} ב-20:00`,iso,1200]);}
writeFileSync(new URL("./fixtures/hebrew-when-corpus-generated.json",import.meta.url),JSON.stringify(out));
console.log(out.length);
