import {dashboardVenue} from "../../src/admin-tenant.js";
// Admin dashboard (Tom 23.9 15:32 redesign): overview, WhatsApp-style conversations with quick switching, booking clicks.
// Client JS avoids template-literal syntax so the page can live inside one template string.
const CSS = `
*{box-sizing:border-box}
:root{--ink:#0f172a;--ink2:#475569;--ink3:#94a3b8;--line:#e2e8f0;--bg:#f4f6fb;--card:#fff;--brand:#0b5cff;--brand2:#0a2a66;--green:#10b981;--amber:#f59e0b;--red:#ef4444;--r:16px;--sh:0 1px 2px rgba(15,23,42,.04),0 4px 16px rgba(15,23,42,.06)}
body{margin:0;font-family:Heebo,-apple-system,"Segoe UI",Arial,sans-serif;background:var(--bg);color:var(--ink);display:grid;grid-template-columns:248px minmax(0,1fr);min-height:100vh;-webkit-font-smoothing:antialiased}
button{font:inherit;cursor:pointer}
.top{grid-column:1;grid-row:1/span 3;background:linear-gradient(180deg,#0a2a66,#081c44);color:#fff;padding:26px 16px;display:flex;flex-direction:column;gap:28px;position:sticky;top:0;height:100vh;z-index:5}
.top h1{font-size:17px;margin:0 6px;font-weight:800;letter-spacing:.2px;line-height:1.35}
.top h1::before{content:"";display:block;width:38px;height:38px;border-radius:11px;margin-bottom:12px;background:radial-gradient(circle at 35% 35%,#d9f99d,#84cc16 60%,#4d7c0f);box-shadow:0 4px 14px rgba(132,204,22,.45)}
.tabs{display:flex;flex-direction:column;gap:4px}
.tabs button{background:transparent;border:0;color:#c7d2fe;padding:11px 14px;border-radius:12px;font-size:15px;text-align:start;display:flex;align-items:center;gap:12px;white-space:nowrap;transition:background .15s,color .15s}
.tabs button::before{content:"";width:18px;height:18px;flex:none;background:currentColor;-webkit-mask:var(--ic) center/contain no-repeat;mask:var(--ic) center/contain no-repeat}
.tabs button[data-v=overview]{--ic:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M3 13h8V3H3zm0 8h8v-6H3zm10 0h8V11h-8zm0-18v6h8V3z'/%3E%3C/svg%3E")}
.tabs button[data-v=chats]{--ic:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2z'/%3E%3C/svg%3E")}
.tabs button[data-v=live]{--ic:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 2c-2.7 0-8 1.3-8 4v3h16v-3c0-2.7-5.3-4-8-4zm8 0c-.3 0-.7 0-1.1.1 1.3.9 2.1 2.2 2.1 3.9v3h7v-3c0-2.7-5.3-4-8-4z'/%3E%3C/svg%3E")}
.tabs button[data-v=clicks]{--ic:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V9h14z'/%3E%3C/svg%3E")}
.tabs button:hover{background:rgba(255,255,255,.07);color:#fff}
.tabs button.on{background:#fff;color:var(--brand2);font-weight:700;box-shadow:0 6px 18px rgba(0,0,0,.18)}
.authing #login{display:none}
#login,#app{grid-column:2}
.login{max-width:380px;margin:14vh auto;background:#fff;border-radius:20px;padding:32px;box-shadow:var(--sh);width:calc(100% - 32px)}
.login h2{margin:0 0 18px;font-size:22px}.login label{color:var(--ink2);font-size:14px}.login input{width:100%;padding:13px 14px;border:1px solid var(--line);border-radius:12px;font-size:16px;margin:8px 0 16px;outline:none}.login input:focus{border-color:var(--brand);box-shadow:0 0 0 4px rgba(11,92,255,.12)}
.btn{background:var(--brand);color:#fff;border:0;border-radius:12px;padding:12px 20px;font-weight:700;width:100%}.err{color:var(--red);margin-top:12px;min-height:1em;font-size:14px}
.page{max-width:1240px;margin:0 auto;padding:30px 32px 48px}
.ptitle{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:22px}.ptitle h2{margin:0;font-size:26px;font-weight:800;letter-spacing:-.3px}.ptitle p{margin:4px 0 0;color:var(--ink2);font-size:14px}.stamp{color:var(--ink3);font-size:13px;white-space:nowrap}
.kpis{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:12px}@media(max-width:1300px){.kpis{grid-template-columns:repeat(4,minmax(0,1fr))}}.kpi b{font-size:30px!important;white-space:nowrap}
.kpi{background:var(--card);border-radius:var(--r);padding:18px 20px;box-shadow:var(--sh);position:relative;overflow:hidden;border:1px solid rgba(226,232,240,.7)}
.kpi::after{content:"";position:absolute;inset-inline-start:0;top:0;bottom:0;width:4px;background:var(--brand)}
.kpi:nth-child(2)::after{background:var(--amber)}.kpi:nth-child(3)::after{background:#8b5cf6}.kpi:nth-child(4)::after{background:var(--green)}.kpi:nth-child(5)::after{background:#06b6d4}.kpi:nth-child(6)::after{background:#16a34a}.kpi:nth-child(7)::after{background:#64748b}
.kpi b{display:block;font-size:34px;font-weight:800;letter-spacing:-.5px;color:var(--ink);line-height:1.1}.kpi span{display:block;color:var(--ink2);font-size:14px;font-weight:600;margin-top:6px}.kpi small{display:block;color:var(--ink3);font-size:12.5px;margin-top:3px}
.kpi.go{cursor:pointer;transition:transform .15s,box-shadow .15s}.kpi.go:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(15,23,42,.1)}
.grid2{display:grid;grid-template-columns:1.1fr .9fr;gap:16px;margin-top:18px}
.card{background:var(--card);border-radius:var(--r);box-shadow:var(--sh);padding:20px 22px;border:1px solid rgba(226,232,240,.7)}.card h3{margin:0 0 14px;font-size:16px;font-weight:700}.card h3 small{color:var(--ink3);font-weight:400;font-size:13px;margin-inline-start:6px}
.fun{display:flex;flex-direction:column;gap:12px}.fr{display:grid;grid-template-columns:130px 1fr 44px;align-items:center;gap:12px;font-size:14px}.fr span{color:var(--ink2)}.fr i{display:block;height:12px;border-radius:99px;background:linear-gradient(90deg,#0b5cff,#60a5fa);min-width:4px}.fb{background:#eef2f7;border-radius:99px}.fr b{text-align:end}
.up{display:flex;flex-direction:column}.ur{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px}.ur:last-child{border:0}.ur .d{width:52px;text-align:center;flex:none;background:#eff6ff;color:var(--brand);border-radius:10px;padding:6px 0;font-weight:700;font-size:12px;line-height:1.3}.ur .m{flex:1;min-width:0}.ur .m b{display:block}.ur .m small{color:var(--ink3)}
.seats{display:inline-flex;gap:4px;vertical-align:middle}.seats i{width:10px;height:10px;border-radius:50%;background:#e2e8f0}.seats i.f{background:var(--green)}
h2.sec{font-size:14px;color:var(--ink2);margin:26px 2px 12px;font-weight:700;text-transform:none;display:flex;align-items:center;gap:10px}h2.sec::after{content:"";flex:1;height:1px;background:var(--line)}
.panel{background:#fff;border-radius:var(--r);box-shadow:var(--sh);overflow:hidden;border:1px solid rgba(226,232,240,.7)}
table{width:100%;border-collapse:collapse;font-size:14px}th{background:#f8fafc;color:var(--ink2);font-weight:600;font-size:13px}th,td{padding:14px 16px;text-align:right;border-bottom:1px solid #f1f5f9}tbody tr:hover{background:#fafcff}
.pill{display:inline-block;padding:4px 10px;border-radius:99px;font-size:12px;font-weight:600;background:#f1f5f9;color:var(--ink2)}.pill.ok{background:#dcfce7;color:#166534}
.page a{color:var(--brand);text-decoration:none;font-weight:600}
.games{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:14px}
.game{background:#fff;border-radius:var(--r);box-shadow:var(--sh);padding:18px 20px;border:1px solid rgba(226,232,240,.7)}.gh{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.gh b{font-size:16px;font-weight:700;flex-basis:100%;order:-1;margin-bottom:4px}.gh .cnt{margin-inline-start:auto}.next{color:var(--ink3);font-size:13px}
.pill.rec{background:#ede9fe;color:#5b21b6}.pill.one{background:#fef3c7;color:#92400e}.gd{color:var(--ink2);font-size:14px;margin:10px 0 14px}
.ppl{display:flex;flex-wrap:wrap;gap:8px}.pp{display:flex;align-items:center;gap:10px;background:#f8fafc;border:1px solid #eef2f7;border-radius:12px;padding:8px 12px;color:var(--ink)!important;font-weight:400!important}.pp small{color:var(--ink3)}.tag2{color:var(--brand)!important;font-weight:600}
.av{width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#dbeafe,#bfdbfe);color:#1e3a8a;display:flex;align-items:center;justify-content:center;font-weight:700;flex:none}.av.sm{width:34px;height:34px;font-size:14px}
.gf{color:var(--ink3);font-size:12.5px;margin-top:14px;padding-top:12px;border-top:1px solid #f1f5f9}.mini{border:1px solid var(--line);background:#fff;border-radius:8px;padding:5px 9px;font-size:13px;margin:2px}
.hint{color:var(--ink3);font-size:13.5px;margin:6px 2px}
.kind{font-size:12px;font-weight:700;padding:4px 10px;border-radius:99px}.kind.open{background:#fff7ed;color:#c2410c}.kind.conn{background:#ecfdf5;color:#047857}
.game.open{border-top:3px solid var(--amber)}.game.conn{border-top:3px solid var(--green)}.legend{display:flex;gap:8px;margin:0 0 6px}
.chat{display:grid;grid-template-columns:360px 1fr;height:100vh;background:#fff}
.list{border-inline-end:1px solid var(--line);display:flex;flex-direction:column;min-height:0;min-width:0}
.search{padding:18px 16px 12px}.search input{width:100%;padding:11px 16px;border:1px solid var(--line);background:#f8fafc;border-radius:12px;font-size:15px;outline:none}.search input:focus{border-color:var(--brand);background:#fff}
.users{overflow-y:auto;flex:1}
.u{display:flex;gap:12px;align-items:center;padding:12px 16px;border-bottom:1px solid #f1f5f9;cursor:pointer}.u:hover{background:#f8fafc}.u.on{background:#eff6ff;box-shadow:inset -3px 0 0 var(--brand)}
.u .mid{flex:1;min-width:0}.u .nm{font-weight:700;display:flex;justify-content:space-between;gap:8px}.u .nm time{font-weight:400;color:var(--ink3);font-size:12px}
.u .sub2{color:var(--ink3);font-size:12px}.u .me{color:var(--ink3)}.bad{color:var(--red)}.u .sub{color:var(--ink2);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pane{display:flex;flex-direction:column;min-height:0;background:#efeae2}
.ph{background:#fff;padding:12px 18px;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--line)}.ph .mid{flex:1}.ph .nm{font-weight:700}.ph .sub{font-size:12.5px;color:var(--ink3)}
.ph button:disabled{opacity:.3;cursor:default}.ph button{border:1px solid var(--line);background:#fff;font-size:16px;color:var(--ink2);padding:5px 10px;border-radius:10px}.back{display:none}
.msgs{flex:1;overflow-y:auto;padding:18px 7%;background-color:#efeae2;background-image:radial-gradient(#0000000a 1px,transparent 1px);background-size:18px 18px}
.day{text-align:center;margin:12px 0}.day span{background:#fff;color:var(--ink2);font-size:12px;padding:4px 12px;border-radius:8px;box-shadow:0 1px 1px #0000000d}
.b{max-width:72%;margin:4px 0;padding:7px 10px 19px;border-radius:10px;position:relative;white-space:pre-wrap;word-wrap:break-word;font-size:14.5px;line-height:1.45;box-shadow:0 1px 1px #0000001a;width:fit-content;min-width:80px}
.b.in{background:#fff;margin-inline-start:0;margin-inline-end:auto;border-start-start-radius:0}
.b.out{background:#d9fdd3;margin-inline-start:auto;margin-inline-end:0;border-start-end-radius:0}
.b time{position:absolute;bottom:3px;inset-inline-end:8px;font-size:11px;color:#667781}
.b .tag{font-size:11px;color:#8696a0;display:block;margin-bottom:2px}.b.fail{background:#fde8e8}.b .tag.bad{color:#d93025}
.chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:7px}.chips span{background:#ffffffc0;border:1px solid #cfe9c9;color:#027eb5;border-radius:14px;padding:2px 10px;font-size:13px}
.empty{flex:1;display:flex;align-items:center;justify-content:center;color:var(--ink3);background:#f8fafc}
@media(max-width:1000px){.grid2{grid-template-columns:1fr}.games{grid-template-columns:1fr}}
@media(max-width:760px){body{display:block}.top{position:sticky;height:auto;flex-direction:row;flex-wrap:wrap;align-items:center;gap:8px 12px;padding:10px 12px}.top h1{font-size:15px;margin:0}.top h1::before{display:none}.tabs{flex-direction:row;width:100%;overflow-x:auto}.tabs button{padding:7px 12px;font-size:14px}.tabs button::before{display:none}.chat{height:calc(100vh - 92px)}.gh .cnt{margin-inline-start:0}.kpis{grid-template-columns:repeat(2,1fr);gap:10px}.kpi b{font-size:26px}.page{padding:16px 12px 32px}.ptitle h2{font-size:21px}.fr{grid-template-columns:100px 1fr 36px}
.chat{grid-template-columns:minmax(0,1fr)}.chat.open .list{display:none}.chat:not(.open) .pane{display:none}.back{display:block}.b{max-width:88%}.wide{display:none}.msgs{padding:12px 10px}
table.clicks thead{display:none}table.clicks tr{display:block;border-bottom:1px solid #f1f5f9;padding:8px 0}table.clicks td{display:flex;justify-content:space-between;border:0;padding:5px 14px}table.clicks td::before{content:attr(data-l);color:var(--ink3)}}
`;
const JS = String.raw`
var $=function(s){return document.querySelector(s)};var D=null,TOKEN=null,CUR=null,VIEW=/[#&]u=\d/.test(location.hash)?'chats':'overview';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
var TZ={timeZone:'Asia/Jerusalem'};
function hm(v){return v?new Date(v).toLocaleTimeString('he-IL',Object.assign({hour:'2-digit',minute:'2-digit'},TZ)):''}
function dayOf(v){return new Date(v).toLocaleDateString('he-IL',Object.assign({weekday:'long',day:'numeric',month:'numeric'},TZ))}
function when(v){if(!v)return'';var d=new Date(v),n=new Date();return d.toDateString()===n.toDateString()?hm(v):d.toLocaleDateString('he-IL',Object.assign({day:'numeric',month:'numeric'},TZ))}
function stamp(v){if(!v)return'-';var d=new Date(v),n=new Date(),y=new Date(n.getTime()-864e5);var ds=function(x){return x.toLocaleDateString('he-IL',TZ)};return(ds(d)===ds(n)?'היום':ds(d)===ds(y)?'אתמול':when(v))+' '+hm(v)}
function gameDay(s){var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s||'');if(!m)return s||'';var d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3],12));return d.toLocaleDateString('he-IL',{weekday:'long',timeZone:'UTC'})+' '+(+m[3])+'.'+(+m[2])}
function wa(h){return h.replace(/\*([^*\n]+)\*/g,'<b>$1</b>').replace(/(^|\s)_([^_\n]+)_(?=\s|$)/g,'$1<i>$2</i>')}
function seats(n){n=Math.max(0,Math.min(4,n||0));var o='<span class="seats" aria-label="'+n+' מתוך 4">';for(var i=0;i<4;i++)o+='<i'+(i<n?' class="f"':'')+'></i>';return o+'</span>'}
function head(t,sub){return'<div class="ptitle"><div><h2>'+esc(t)+'</h2>'+(sub?'<p>'+esc(sub)+'</p>':'')+'</div>'+(D&&D.generatedAt?'<span class="stamp">עודכן '+esc(stamp(D.generatedAt))+'</span>':'')+'</div>'}
function ils(n){return Math.round(Number(n||0)).toLocaleString('he-IL')+' ₪'}
function clickValue(){return(D.bookingClicks||[]).reduce((a,x)=>a+(x.price==null?0:Number(x.price)||0),0)}
function usd(n){return'$'+Number(n||0).toFixed(2)}
function initials(u){var n=(u.name||'').trim();return n?n[0]:'#'}
function phone(p){p=String(p||'');return p.indexOf('972')===0?'0'+p.slice(3):p}
async function api(q){const r=await fetch('/.netlify/functions/admin-data'+(q||''),{headers:{authorization:'Bearer '+TOKEN}});if(r.status===429){var j={};try{j=await r.json()}catch(e){}throw Error('יותר מדי ניסיונות כניסה. נסו שוב בעוד '+(j.retryAfterMinutes||15)+' דקות.')}if(!r.ok)throw Error(r.status===401?'סיסמה שגויה':await r.text()||'שגיאת שרת');return r.json()}
async function load(token){TOKEN=token;D=await api();sessionStorage.setItem('gt-admin-token',token);$('#login').hidden=true;$('#tabs').hidden=false;render()}
function tab(v){VIEW=v;render()}
function render(){document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.v===VIEW));var a=$('#app');a.hidden=false;
 if(VIEW==='chats')a.innerHTML=chatsView();else if(VIEW==='overview')a.innerHTML=overview();else if(VIEW==='live')a.innerHTML=liveView();else a.innerHTML=clicksView();
 if(VIEW!=='chats'&&CUR===null)history.replaceState(null,'',location.pathname);if(VIEW==='chats'){drawUsers();var h=decodeURIComponent((location.hash.match(/u=(\d+)/)||[])[1]||'');if(h)showConv(h,true)}}
function overview(){var s=D.summary,m=(D.messages||{}).totals||{};var k=[['משתמשים',(D.messages&&D.messages.users.length)||s.registrations,'כתבו לבוט לפחות פעם אחת','chats'],['בקשות פעילות',s.activeRequests,'מופיעות עכשיו בלוח','live'],['הצעות התאמה',s.matches,''],['חיבורים שאושרו',s.acceptedMatches,'שני הצדדים הסכימו','live'],['לחיצות על "להזמנה"',s.bookingClicks,'פתחו את דף ההזמנה באתר','clicks'],['שווי הלחיצות',ils(clickValue()),'סכום המחירים בלחיצות · פוטנציאל, לא הזמנות','clicks'],['עלות הודעות',usd(m.estimatedUsd),(m.sent||0)+' נשלחו · '+(m.received||0)+' התקבלו']];
 var users0=(D.messages&&D.messages.users.length)||s.registrations||0,F=[['משתמשים',users0],['בקשות פעילות',s.activeRequests||0],['הצעות התאמה',s.matches||0],['חיבורים שאושרו',s.acceptedMatches||0],['לחיצות על "להזמנה"',s.bookingClicks||0]],mx=Math.max.apply(null,F.map(f=>f[1]).concat([1]));
 var G=(D.open||[]).map(g=>Object.assign({kind:'open'},g)).concat((D.live||[]).map(g=>Object.assign({kind:'conn'},g))).sort((a,b)=>a.nextDate.localeCompare(b.nextDate)||a.startMinute-b.startMinute).slice(0,5);
 var RC=(D.bookingClicks||[]).slice().sort((a,b)=>String(b.clickedAt).localeCompare(String(a.clickedAt))).slice(0,4);
 var extra='<div class="grid2"><div class="card"><h3>המשחקים הקרובים<small>בקשות פתוחות וחיבורים</small></h3>'+(G.length?'<div class="up">'+G.map(g=>'<a class="ur" data-v="live" href="#"><span class="d">'+esc(relDay(g.nextDate))+'</span><span class="m"><b>'+esc(dash(g.type==='recurring'?g.when:g.when.split(' · ').slice(1).join(' · ')||g.when))+'</b><small>'+esc(g.participants.map(p=>p.name||'ללא שם').join(', '))+(g.level?' · רמה '+esc(dash(g.level)):'')+'</small></span>'+seats(g.total)+'</a>').join('')+'</div>':'<p class="hint">אין כרגע משחקים פתוחים.</p>')+'</div>'
  +'<div class="card"><h3>מהשיחה ועד ההזמנה<small>כמה הגיעו לכל שלב</small></h3><div class="fun">'+F.map(f=>'<div class="fr"><span>'+esc(f[0])+'</span><div class="fb"><i style="width:'+Math.round(100*f[1]/mx)+'%"></i></div><b>'+esc(f[1])+'</b></div>').join('')+'</div>'+(RC.length?'<h3 style="margin-top:22px">לחיצות אחרונות על "להזמנה"<small>לא נספרות כהזמנות</small></h3><div class="up">'+RC.map(x=>'<div class="ur"><span class="av sm">'+esc(initials({name:x.userName}))+'</span><span class="m"><b>'+esc(x.userName||'לא ידוע')+'</b><small>'+esc(gameDay(x.date)+' · '+x.time+(x.price!=null?' · ₪'+x.price:''))+'</small></span><small class="hint">'+esc(stamp(x.clickedAt))+'</small></div>').join('')+'</div>':'')+'</div></div>';
 return'<div class="page">'+head('סקירה','תמונת מצב של הבוט: משתמשים, בקשות, חיבורים ולחיצות')+'<div class="kpis">'+k.map(x=>'<div class="kpi'+(x[3]?' go" data-v="'+x[3]+'" role="button" tabindex="0':'')+'"><b>'+esc(x[1])+'</b><span>'+esc(x[0])+'</span>'+(x[2]?'<small>'+esc(x[2])+'</small>':'')+'</div>').join('')+'</div>'+(m.failed?'<p class="hint">'+m.failed+' הודעות לא נשלחו. אפשר לראות אותן בשיחה (מסומנות באדום).</p>':'')+extra+'</div>'}
var SRC={availability:'מגרש פנוי',matching:'התאמה'};
function clicksView(){var c=(D.bookingClicks||[]).slice().sort((a,b)=>String(b.clickedAt).localeCompare(String(a.clickedAt)));
 if(!c.length)return'<div class="page">'+head('הזמנות')+'<p class="hint">עוד אף אחד לא לחץ על "להזמנה".</p></div>';
 return'<div class="page">'+head('הזמנות','לחיצות על "להזמנה" בבוט · '+c.length+' סה"כ')+'<p class="hint">משתמשים שלחצו על "להזמנה" בבוט ופתחו את דף ההזמנה באתר. זה לא אומר שההזמנה הושלמה.</p><div class="panel"><table class="clicks"><thead><tr><th>משתמש</th><th>טלפון</th><th>מתי לחצו</th><th>מקור</th><th>המשחק</th><th>מחיר</th></tr></thead><tbody>'+c.map(x=>'<tr><td data-l="משתמש">'+(x.userId?'<a href="#u='+esc(x.userId)+'" data-user-open="'+esc(x.userId)+'">'+esc(x.userName||'ללא שם')+'</a>':'<span class="hint">לא ידוע</span>')+'</td><td data-l="טלפון">'+(x.userId?esc(phone(x.userId)):'-')+'</td><td data-l="מתי לחצו">'+esc(stamp(x.clickedAt))+'</td><td data-l="מקור">'+esc(SRC[x.source]||x.source)+'</td><td data-l="המשחק">'+esc(gameDay(x.date)+' · '+x.time+' · '+x.duration+' דק׳')+'</td><td data-l="מחיר">'+(x.price==null?'-':'₪'+esc(x.price))+'</td></tr>').join('')+'</tbody></table></div>'+(c.some(x=>!x.userId)?'<p class="hint">לחיצות ישנות נרשמו לפני שהתחלנו לשמור מי לחץ.</p>':'')+'</div>'}
var dash=v=>String(v??'').replace(/[\u2013\u2014]/g,'-');
function relDay(iso){var t=new Date().toLocaleDateString('en-CA',TZ),m=new Date(Date.now()+864e5).toLocaleDateString('en-CA',TZ);return iso===t?'היום':iso===m?'מחר':gameDay(iso)}
function liveView(){var O=(D.open||[]).map(g=>Object.assign({kind:'open'},g)),C=(D.live||[]).map(g=>Object.assign({kind:'conn'},g)),L=O.concat(C).sort((a,b)=>a.nextDate.localeCompare(b.nextDate)||a.startMinute-b.startMinute);if(!L.length)return'<div class="page">'+head('בקשות וחיבורים')+'<p class="hint">אין כרגע בקשות פתוחות או חיבורים. בקשה מופיעה כאן מרגע שנפתחה, וחיבור אחרי ששני הצדדים אישרו, עד שמועד המשחק עובר.</p></div>';
 var last='',out='<div class="page">'+head('בקשות וחיבורים',O.length+' בקשות פתוחות · '+C.length+' חיבורים')+'<p class="hint">בקשות שעדיין מחפשות התאמה, וחיבורים ששני הצדדים אישרו. כל כרטיס הוא משחק אחד, מהקרוב לרחוק.</p><div class="legend"><span class="kind open">בקשה פתוחה · '+O.length+'</span><span class="kind conn">חיבור · '+C.length+'</span></div>';
 L.forEach(g=>{var day=relDay(g.nextDate);if(day!==last){out+=(last?'</div>':'')+'<h2 class="sec">'+esc(day)+'</h2><div class="games">';last=day}
  var dur='';
  var court=g.court?'מגרש '+esc(g.court.name)+(g.court.start?' · '+esc(g.court.start):'')+(g.court.price!=null?' · ₪'+esc(g.court.price):''):(g.hasCourt?'יש להם מגרש':'בלי מגרש עדיין');
  var op=g.kind==='open';out+='<div class="game '+(op?'open':'conn')+'"><div class="gh"><span class="kind '+(op?'open':'conn')+'">'+(op?'בקשה פתוחה':'חיבור')+'</span><span class="pill '+(g.type==='recurring'?'rec':'one')+'">'+(g.type==='recurring'?'קבוע':'חד-פעמי')+'</span><b>'+esc(dash(g.type==='recurring'?g.when:gameDay(g.nextDate)+' · '+g.when.split(' · ').slice(1).join(' · ')))+'</b>'+(g.type==='recurring'?'<span class="next">הבא: '+esc(gameDay(g.nextDate))+'</span>':'')+seats(g.total)+'<span class="pill '+(g.full?'ok':'')+' cnt">'+(g.full?'מלא · 4/4':g.total+' מתוך 4 · חסר '+(4-g.total))+'</span></div>'
   +'<div class="gd">'+[g.level?'רמה '+esc(dash(g.level)):'',esc(dur),court].filter(Boolean).join(' · ')+'</div>'
   +'<div class="ppl">'+g.participants.map(p=>'<a href="#u='+esc(p.userId)+'" data-user-open="'+esc(p.userId)+'" class="pp"><span class="av sm">'+esc(initials(p))+'</span><span><b>'+esc(p.name||'ללא שם')+'</b>'+(p.party>1?' <small>+'+(p.party-1)+'</small>':'')+(p.role==='owner'?' <small class="tag2">פתח/ה את הבקשה</small>':'')+'<br><small>'+esc(phone(p.userId))+'</small></span></a>').join('')+'</div>'
   +'<div class="gf">'+(op?'נפתחה '+esc(stamp(g.createdAt))+' · מחפשת התאמה':'חובר '+esc(stamp(g.firstConnectedAt)))+'</div></div>'});
 return out+(last?'</div>':'')+'</div>'}
function chatsView(){return'<div class="chat" id="chat"><div class="list"><div class="search"><input id="q" placeholder="חיפוש לפי שם או מספר" autocomplete="off"></div><div class="users" id="users"></div></div><div class="pane" id="pane"><div class="empty">בחרו שיחה מהרשימה</div></div></div>'}
function users(){return(D.messages&&D.messages.users)||[]}
function drawUsers(){var q=($('#q')&&$('#q').value||'').trim().toLowerCase();var l=users().filter(u=>!q||(u.name||'').toLowerCase().indexOf(q)>=0||phone(u.userId).indexOf(q)>=0||u.userId.indexOf(q)>=0);
 $('#users').innerHTML=l.length?l.map(u=>'<div class="u'+(u.userId===CUR?' on':'')+'" data-user="'+esc(u.userId)+'"><div class="av">'+esc(initials(u))+'</div><div class="mid"><div class="nm"><span>'+esc(u.name||phone(u.userId))+'</span><time>'+esc(when(u.lastAt))+'</time></div><div class="sub">'+(u.lastText!=null?(u.lastDirection==='out'?'<span class="me">בוט: </span>':'')+esc(u.lastText||'...'):esc(phone(u.userId)))+'</div><div class="sub2">'+esc(phone(u.userId))+(u.failed?' · <span class="bad">'+u.failed+' נכשלו</span>':'')+'</div></div></div>').join(''):'<p class="hint" style="padding:0 14px">אין תוצאות</p>'}
function bubble(x){var body=String(x.body||''),chips=[],m;var lines=body.split('\n').filter(function(l){if((m=/^\[(כפתורים|רשימה)\]\s*(.*)$/.exec(l))){chips=chips.concat(m[2].split(' | ').map(s=>s.trim()).filter(Boolean));return false}if((m=/^\[קישור\]\s*(.*?)\s*(https?:\S+)?$/.exec(l))){chips.push('↗ '+m[1]);return false}return true});
 var tpl=x.kind==='template',fail=x.sent===false,tag=tpl?'<span class="tag">תבנית</span>':'';if(fail)tag+='<span class="tag bad">לא נשלחה'+(x.reason?' ('+esc(x.reason)+')':'')+'</span>';
 return'<div class="b '+(x.direction==='in'?'in':'out')+(fail?' fail':'')+'">'+tag+wa(esc(lines.join('\n').trim()))+(chips.length?'<div class="chips">'+chips.map(c=>'<span>'+esc(c)+'</span>').join('')+'</div>':'')+'<time>'+esc(hm(x.at))+'</time></div>'}
async function showConv(user,quiet){CUR=user;drawUsers();var u=users().find(x=>x.userId===user)||{userId:user};$('#chat').classList.add('open');history.replaceState(null,'','#u='+user);
 var p=$('#pane');p.innerHTML='<div class="empty">טוען את השיחה…</div>';var d;try{d=await api('?user='+encodeURIComponent(user))}catch(e){p.innerHTML='<div class="empty">'+esc(e.message)+'</div>';return}
 var last='',html='';d.messages.forEach(x=>{var dy=dayOf(x.at);if(dy!==last){html+='<div class="day"><span>'+esc(dy)+'</span></div>';last=dy}html+=bubble(x)});
 var i=users().findIndex(x=>x.userId===user);
 p.innerHTML='<div class="ph"><button class="back" data-back="1" aria-label="חזרה">→</button><div class="av">'+esc(initials(d.name?{name:d.name}:u))+'</div><div class="mid"><div class="nm">'+esc(d.name||'ללא שם')+'</div><div class="sub">'+esc(phone(user))+'<span class="wide"> · '+(u.received||0)+' התקבלו · '+(u.sent||0)+' נשלחו · עלות '+usd(u.estimatedUsd)+'</span></div></div><button data-step="-1" title="השיחה הקודמת" aria-label="השיחה הקודמת"'+(i<=0?' disabled':'')+'>↑</button><button data-step="1" title="השיחה הבאה" aria-label="השיחה הבאה"'+(i>=users().length-1?' disabled':'')+'>↓</button></div><div class="msgs" id="msgs">'+(html||'<p class="hint">אין הודעות</p>')+'</div>';
 var ms=$('#msgs');ms.scrollTop=ms.scrollHeight}
document.addEventListener('click',async function(e){var t=e.target.closest('[data-user],[data-user-open],[data-back],[data-step],[data-v]');if(!t)return;if(t.dataset.userOpen){e.preventDefault();VIEW='chats';render();return showConv(t.dataset.userOpen)}
 if(t.dataset.v){e.preventDefault();return tab(t.dataset.v)}if(t.dataset.user)return showConv(t.dataset.user);
 if(t.dataset.back){CUR=null;$('#chat').classList.remove('open');history.replaceState(null,'',location.pathname);return drawUsers()}
 if(t.dataset.step){var l=users(),i=l.findIndex(x=>x.userId===CUR)+Number(t.dataset.step);if(l[i])showConv(l[i].userId);return}});
document.addEventListener('input',function(e){if(e.target.id==='q')drawUsers()});
document.addEventListener('keydown',function(e){if(VIEW!=='chats'||!CUR||e.target.id==='q')return;if(e.key==='ArrowDown'||e.key==='ArrowUp'){var l=users(),i=l.findIndex(x=>x.userId===CUR)+(e.key==='ArrowDown'?1:-1);if(l[i]){e.preventDefault();showConv(l[i].userId)}}});
async function enter(){$('#error').textContent='';try{await load($('#password').value)}catch(e){$('#error').textContent=e.message;sessionStorage.removeItem('gt-admin-token')}}
$('#enter').onclick=enter;$('#password').onkeydown=e=>{if(e.key==='Enter')enter()};
var saved=sessionStorage.getItem('gt-admin-token');if(saved)load(saved).catch(e=>{document.documentElement.classList.remove('authing');$('#error').textContent=e.message;sessionStorage.removeItem('gt-admin-token')});
`;
export const html = '<!doctype html><html dir="rtl" lang="he"><meta charset="utf-8"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800&display=swap" rel="stylesheet"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GT PADEL - מערכת ניהול</title><style>' + CSS + '/* Sky blue side menu (Tom picked, 2026-09-23) */.top{background:linear-gradient(180deg,#eff6ff,#dbeafe)!important;color:#1e3a8a!important;border-inline-start:1px solid #bfdbfe}.top h1{color:#1e3a8a}.tabs button{color:#1e40af}.tabs button:hover{background:rgba(0,0,0,.05);color:#1e3a8a}.tabs button.on{background:#2563eb!important;color:#fff!important;box-shadow:0 4px 12px rgba(0,0,0,.12)}</style>'
 + '<header class="top"><h1>GT PADEL - מערכת ניהול</h1><nav class="tabs" id="tabs" hidden><button data-v="overview">סקירה</button><button data-v="chats">שיחות</button><button data-v="live">בקשות וחיבורים</button><button data-v="clicks">הזמנות</button></nav></header>'
 + '<script>try{if(sessionStorage.getItem("gt-admin-token"))document.documentElement.classList.add("authing")}catch(e){}</script>'
 + '<div id="login" class="login"><h2>כניסה</h2><label for="password">סיסמת ניהול</label><input id="password" type="password" autocomplete="current-password"><button id="enter" class="btn">כניסה</button><div id="error" class="err"></div></div><main id="app" hidden></main>'
 + '<script>' + JS + '</script></html>';
export async function renderAdmin(req,forcedVenue){
 const venue=forcedVenue||dashboardVenue(req?.url||'https://gtpadel.netlify.app/admin');
 if(!venue)return new Response('not found',{status:404});
 const title=venue.key==='gt'?'GT PADEL - מערכת ניהול':`${venue.dashboardName||venue.name} - מערכת ניהול`;
 const page=html.replaceAll('GT PADEL - מערכת ניהול',title).replace('var D=null,TOKEN=null,',`var VENUE='${venue.key}',D=null,TOKEN=null,`)
  .replace("'/.netlify/functions/admin-data'+(q||'')", "'/.netlify/functions/admin-data?venue='+VENUE+(q?'&'+q.slice(1):'')")
  .replace("sessionStorage.setItem('gt-admin-token',token)","sessionStorage.setItem('gt-admin-token-'+VENUE,token)")
  .replaceAll("sessionStorage.removeItem('gt-admin-token')","sessionStorage.removeItem('gt-admin-token-'+VENUE)")
  .replaceAll("sessionStorage.getItem('gt-admin-token')","sessionStorage.getItem('gt-admin-token-'+VENUE)")
  .replaceAll('gt-admin-token-', 'club-admin-token-')
  .replaceAll('gt-admin-token', 'club-admin-token');
 const secure=page.replace('<button data-v="clicks">הזמנות</button>', '<button data-v="clicks">הזמנות</button><button data-v="contact">מספר קשר</button>')
 .replace("if(VIEW==='chats')a.innerHTML=chatsView();", "if(VIEW==='contact')a.innerHTML=contactView();else if(VIEW==='chats')a.innerHTML=chatsView();")
 .replace('function chatsView(){', `function contactView(){return '<div class="page">'+head('מספר קשר','המספר שאליו מוביל כפתור דבר עם המועדון')+'<div class="card"><label for="contact-number">מספר וואטסאפ בפורמט בינלאומי</label><input id="contact-number" inputmode="tel" placeholder="9725..."><button id="save-contact" class="btn">שמירה</button><p id="contact-status"></p></div></div>'}
async function loadContact(){var r=await fetch('/.netlify/functions/club-contact?venue='+VENUE,{headers:{authorization:'Bearer '+TOKEN}});if(!r.ok)throw Error('לא ניתן לטעון את המספר');var d=await r.json();$('#contact-number').value=new URL(d.url).pathname.slice(1)}
async function saveContact(){var n=$('#contact-number').value.trim(),s=$('#contact-status');if(!/^972[0-9]{8,9}$/.test(n)){s.textContent='הזינו מספר ישראלי בפורמט 972...';return}var r=await fetch('/.netlify/functions/club-contact?venue='+VENUE,{method:'PUT',headers:{authorization:'Bearer '+TOKEN,'content-type':'application/json'},body:JSON.stringify({number:n})});s.textContent=r.ok?'המספר נשמר למועדון הזה בלבד.':'השמירה נכשלה.'}
function chatsView(){`)
 .replace("if(VIEW!=='chats'&&CUR===null)", "if(VIEW==='contact')loadContact().catch(e=>$('#contact-status').textContent=e.message);if(VIEW!=='chats'&&CUR===null)")
 .replace("document.addEventListener('click',async function(e){", "document.addEventListener('click',async function(e){if(e.target.id==='save-contact')return saveContact();");
 return new Response(secure, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
};

export default req=>renderAdmin(req);
