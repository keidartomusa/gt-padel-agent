// Admin dashboard (Tom 23.9 15:32 redesign): overview, WhatsApp-style conversations with quick switching, booking clicks.
// Client JS avoids template-literal syntax so the page can live inside one template string.
const CSS = `
*{box-sizing:border-box}body{margin:0;font-family:-apple-system,"Segoe UI",Heebo,Arial,sans-serif;background:#f0f2f5;color:#111b21}
button{font:inherit;cursor:pointer}
.top{background:#075e54;color:#fff;padding:12px 20px;display:flex;align-items:center;gap:16px;position:sticky;top:0;z-index:5}
.top h1{font-size:18px;margin:0;font-weight:700;white-space:nowrap}
.tabs{display:flex;gap:4px;margin-inline-start:auto}
.tabs button{background:transparent;border:0;color:#d1f4ec;padding:8px 14px;border-radius:18px;font-size:15px}
.tabs button.on{background:#fff;color:#075e54;font-weight:700}
.authing #login{display:none}
.login{max-width:360px;margin:12vh auto;background:#fff;border-radius:16px;padding:28px;box-shadow:0 2px 12px #0001}
.login h2{margin:0 0 16px;font-size:20px}.login input{width:100%;padding:12px;border:1px solid #d1d7db;border-radius:10px;font-size:16px;margin:8px 0 14px}
.btn{background:#00a884;color:#fff;border:0;border-radius:10px;padding:11px 18px;font-weight:700}.err{color:#d93025;margin-top:10px;min-height:1em}
.page{max-width:1200px;margin:0 auto;padding:20px}
.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.kpi{background:#fff;border-radius:14px;padding:16px;box-shadow:0 1px 3px #0000000f}.kpi b{display:block;font-size:28px;color:#008069}.kpi span{color:#54656f;font-size:14px}.kpi small{display:block;color:#8696a0;font-size:12px;margin-top:4px}
h2.sec{font-size:16px;color:#54656f;margin:24px 0 10px}
.panel{background:#fff;border-radius:14px;box-shadow:0 1px 3px #0000000f;overflow:hidden}
table{width:100%;border-collapse:collapse;font-size:14px}th{background:#f7f8fa;color:#54656f;font-weight:600}th,td{padding:10px 12px;text-align:right;border-bottom:1px solid #eef0f2}
.pill{display:inline-block;padding:3px 10px;border-radius:12px;font-size:12px;background:#eef0f2;color:#54656f}.pill.ok{background:#d9fdd3;color:#1d6b33}
.page a{color:#027eb5;text-decoration:none;font-weight:600}.tabs button{white-space:nowrap}.game{background:#fff;border-radius:14px;box-shadow:0 1px 3px #0000000f;padding:14px 16px;margin-bottom:12px}.gh{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.gh b{font-size:16px}.gh .cnt{margin-inline-start:auto}.next{color:#667781;font-size:13px}.pill.rec{background:#e7f0fe;color:#1a56b0}.pill.one{background:#fff4e0;color:#8a5a00}.gd{color:#54656f;font-size:14px;margin:8px 0 10px}.ppl{display:flex;flex-wrap:wrap;gap:8px}.pp{display:flex;align-items:center;gap:8px;background:#f5f6f6;border-radius:12px;padding:6px 10px;color:#111b21!important;font-weight:400!important}.pp small{color:#667781}.tag2{color:#008069!important}.av.sm{width:32px;height:32px;font-size:14px}.gf{color:#8696a0;font-size:12px;margin-top:10px}.mini{border:1px solid #d1d7db;background:#fff;border-radius:8px;padding:5px 9px;font-size:13px;margin:2px}
.hint{color:#8696a0;font-size:13px;margin:8px 2px}
.chat{display:grid;grid-template-columns:340px 1fr;height:calc(100vh - 58px);background:#fff}
.list{border-inline-end:1px solid #e9edef;display:flex;flex-direction:column;min-height:0;min-width:0}
.search{padding:10px}.search input{width:100%;padding:9px 14px;border:0;background:#f0f2f5;border-radius:10px;font-size:15px}
.users{overflow-y:auto;flex:1}
.u{display:flex;gap:12px;align-items:center;padding:10px 14px;border-bottom:1px solid #f0f2f5;cursor:pointer}.u:hover{background:#f5f6f6}.u.on{background:#f0f2f5}
.av{width:44px;height:44px;border-radius:50%;background:#dfe5e7;color:#54656f;display:flex;align-items:center;justify-content:center;font-weight:700;flex:none}
.u .mid{flex:1;min-width:0}.u .nm{font-weight:600;display:flex;justify-content:space-between;gap:8px}.u .nm time{font-weight:400;color:#667781;font-size:12px}
.u .sub2{color:#8696a0;font-size:12px}.u .me{color:#8696a0}.bad{color:#d93025}.u .sub{color:#667781;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pane{display:flex;flex-direction:column;min-height:0;background:#efeae2}
.ph{background:#f0f2f5;padding:10px 16px;display:flex;align-items:center;gap:12px;border-bottom:1px solid #e9edef}.ph .mid{flex:1}.ph .nm{font-weight:600}.ph .sub{font-size:12px;color:#667781}
.ph button:disabled{opacity:.3;cursor:default}.ph button{border:0;background:transparent;font-size:20px;color:#54656f;padding:4px 8px}.back{display:none}
.msgs{flex:1;overflow-y:auto;padding:16px 6%;background-color:#efeae2;background-image:radial-gradient(#0000000a 1px,transparent 1px);background-size:18px 18px}
.day{text-align:center;margin:10px 0}.day span{background:#fff;color:#54656f;font-size:12px;padding:4px 12px;border-radius:8px;box-shadow:0 1px 1px #0000000d}
.b{max-width:75%;margin:3px 0;padding:6px 9px 18px;border-radius:8px;position:relative;white-space:pre-wrap;word-wrap:break-word;font-size:14.5px;line-height:1.4;box-shadow:0 1px 1px #0000001a;width:fit-content;min-width:80px}
.b.in{background:#fff;margin-inline-start:0;margin-inline-end:auto;border-start-start-radius:0}
.b.out{background:#d9fdd3;margin-inline-start:auto;margin-inline-end:0;border-start-end-radius:0}
.b time{position:absolute;bottom:3px;inset-inline-end:8px;font-size:11px;color:#667781}
.kind{font-size:12px;font-weight:700;padding:3px 9px;border-radius:999px}.kind.open{background:#fff4e0;color:#b25e00;border:1px dashed #f0a020}.kind.conn{background:#e3f7ec;color:#0a7a3e;border:1px solid #25d366}.game.open{border:1.5px dashed #f0a020;background:#fffcf6}.game.conn{border-inline-start:4px solid #25d366}.legend{display:flex;gap:8px;margin:0 0 12px}.kpi.go{cursor:pointer}.kpi.go:hover{box-shadow:0 0 0 2px #25d366 inset}.b .tag{font-size:11px;color:#8696a0;display:block;margin-bottom:2px}.b.fail{background:#fde8e8}.b .tag.bad{color:#d93025}
.chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}.chips span{background:#ffffffb3;border:1px solid #cfe9c9;color:#027eb5;border-radius:14px;padding:2px 10px;font-size:13px}
.empty{flex:1;display:flex;align-items:center;justify-content:center;color:#667781;background:#f0f2f5}
@media(max-width:760px){.top{flex-wrap:wrap;gap:6px 10px}.tabs{margin-inline-start:0;width:100%;overflow-x:auto}.chat{height:calc(100vh - 92px)}.gh .cnt{margin-inline-start:0}.kpis{grid-template-columns:repeat(2,1fr)}.kpi b{font-size:24px}.top{padding:10px 12px}.top h1{font-size:15px}.tabs button{padding:6px 10px;font-size:14px}.page{padding:12px}
.chat{grid-template-columns:minmax(0,1fr)}.chat.open .list{display:none}.chat:not(.open) .pane{display:none}.back{display:block}.b{max-width:88%}.wide{display:none}.msgs{padding:12px 10px}
table.clicks thead{display:none}table.clicks tr{display:block;border-bottom:1px solid #eef0f2;padding:8px 0}table.clicks td{display:flex;justify-content:space-between;border:0;padding:4px 12px}table.clicks td::before{content:attr(data-l);color:#8696a0}}
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
function usd(n){return'$'+Number(n||0).toFixed(2)}
function initials(u){var n=(u.name||'').trim();return n?n[0]:'#'}
function phone(p){p=String(p||'');return p.indexOf('972')===0?'0'+p.slice(3):p}
async function api(q){const r=await fetch('/.netlify/functions/admin-data'+(q||''),{headers:{authorization:'Bearer '+TOKEN}});if(r.status===429){var j={};try{j=await r.json()}catch(e){}throw Error('יותר מדי ניסיונות כניסה. נסו שוב בעוד '+(j.retryAfterMinutes||15)+' דקות.')}if(!r.ok)throw Error(r.status===401?'סיסמה שגויה':await r.text()||'שגיאת שרת');return r.json()}
async function load(token){TOKEN=token;D=await api();sessionStorage.setItem('gt-admin-token',token);$('#login').hidden=true;$('#tabs').hidden=false;render()}
function tab(v){VIEW=v;render()}
function render(){document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.v===VIEW));var a=$('#app');a.hidden=false;
 if(VIEW==='chats')a.innerHTML=chatsView();else if(VIEW==='overview')a.innerHTML=overview();else if(VIEW==='live')a.innerHTML=liveView();else a.innerHTML=clicksView();
 if(VIEW!=='chats'&&CUR===null)history.replaceState(null,'',location.pathname);if(VIEW==='chats'){drawUsers();var h=decodeURIComponent((location.hash.match(/u=(\d+)/)||[])[1]||'');if(h)showConv(h,true)}}
function overview(){var s=D.summary,m=(D.messages||{}).totals||{};var k=[['משתמשים',(D.messages&&D.messages.users.length)||s.registrations,'כתבו לבוט לפחות פעם אחת','chats'],['בקשות פעילות',s.activeRequests,'מופיעות עכשיו בלוח','live'],['הצעות התאמה',s.matches,''],['חיבורים שאושרו',s.acceptedMatches,'שני הצדדים הסכימו','live'],['לחיצות על "להזמנה"',s.bookingClicks,'פתחו את דף ההזמנה באתר','clicks'],['עלות הודעות',usd(m.estimatedUsd),(m.sent||0)+' נשלחו · '+(m.received||0)+' התקבלו']];
 return'<div class="page"><div class="kpis">'+k.map(x=>'<div class="kpi'+(x[3]?' go" data-v="'+x[3]+'" role="button" tabindex="0':'')+'"><b>'+esc(x[1])+'</b><span>'+esc(x[0])+'</span>'+(x[2]?'<small>'+esc(x[2])+'</small>':'')+'</div>').join('')+'</div>'+(m.failed?'<p class="hint">'+m.failed+' הודעות לא נשלחו. אפשר לראות אותן בשיחה (מסומנות באדום).</p>':'')+'</div>'}
var SRC={availability:'מגרש פנוי',matching:'התאמה'};
function clicksView(){var c=(D.bookingClicks||[]).slice().sort((a,b)=>String(b.clickedAt).localeCompare(String(a.clickedAt)));
 if(!c.length)return'<div class="page"><p class="hint">עוד אף אחד לא לחץ על "להזמנה".</p></div>';
 return'<div class="page"><p class="hint">משתמשים שלחצו על "להזמנה" בבוט ופתחו את דף ההזמנה באתר. זה לא אומר שההזמנה הושלמה.</p><div class="panel"><table class="clicks"><thead><tr><th>משתמש</th><th>טלפון</th><th>מתי לחצו</th><th>מקור</th><th>המשחק</th><th>מחיר</th></tr></thead><tbody>'+c.map(x=>'<tr><td data-l="משתמש">'+(x.userId?'<a href="#u='+esc(x.userId)+'" data-user-open="'+esc(x.userId)+'">'+esc(x.userName||'ללא שם')+'</a>':'<span class="hint">לא ידוע</span>')+'</td><td data-l="טלפון">'+(x.userId?esc(phone(x.userId)):'-')+'</td><td data-l="מתי לחצו">'+esc(stamp(x.clickedAt))+'</td><td data-l="מקור">'+esc(SRC[x.source]||x.source)+'</td><td data-l="המשחק">'+esc(gameDay(x.date)+' · '+x.time+' · '+x.duration+' דק׳')+'</td><td data-l="מחיר">'+(x.price==null?'-':'₪'+esc(x.price))+'</td></tr>').join('')+'</tbody></table></div>'+(c.some(x=>!x.userId)?'<p class="hint">לחיצות ישנות נרשמו לפני שהתחלנו לשמור מי לחץ.</p>':'')+'</div>'}
var dash=v=>String(v??'').replace(/[\u2013\u2014]/g,'-');
function relDay(iso){var t=new Date().toLocaleDateString('en-CA',TZ),m=new Date(Date.now()+864e5).toLocaleDateString('en-CA',TZ);return iso===t?'היום':iso===m?'מחר':gameDay(iso)}
function liveView(){var O=(D.open||[]).map(g=>Object.assign({kind:'open'},g)),C=(D.live||[]).map(g=>Object.assign({kind:'conn'},g)),L=O.concat(C).sort((a,b)=>a.nextDate.localeCompare(b.nextDate)||a.startMinute-b.startMinute);if(!L.length)return'<div class="page"><p class="hint">אין כרגע בקשות פתוחות או חיבורים. בקשה מופיעה כאן מרגע שנפתחה, וחיבור אחרי ששני הצדדים אישרו, עד שמועד המשחק עובר.</p></div>';
 var last='',out='<div class="page"><p class="hint">בקשות שעדיין מחפשות התאמה, וחיבורים ששני הצדדים אישרו. כל כרטיס הוא משחק אחד, מהקרוב לרחוק.</p><div class="legend"><span class="kind open">בקשה פתוחה · '+O.length+'</span><span class="kind conn">חיבור · '+C.length+'</span></div>';
 L.forEach(g=>{var day=relDay(g.nextDate);if(day!==last){out+='<h2 class="sec">'+esc(day)+'</h2>';last=day}
  var dur='';
  var court=g.court?'מגרש '+esc(g.court.name)+(g.court.start?' · '+esc(g.court.start):'')+(g.court.price!=null?' · ₪'+esc(g.court.price):''):(g.hasCourt?'יש להם מגרש':'בלי מגרש עדיין');
  var op=g.kind==='open';out+='<div class="game '+(op?'open':'conn')+'"><div class="gh"><span class="kind '+(op?'open':'conn')+'">'+(op?'בקשה פתוחה':'חיבור')+'</span><span class="pill '+(g.type==='recurring'?'rec':'one')+'">'+(g.type==='recurring'?'קבוע':'חד-פעמי')+'</span><b>'+esc(dash(g.type==='recurring'?g.when:gameDay(g.nextDate)+' · '+g.when.split(' · ').slice(1).join(' · ')))+'</b>'+(g.type==='recurring'?'<span class="next">הבא: '+esc(gameDay(g.nextDate))+'</span>':'')+'<span class="pill '+(g.full?'ok':'')+' cnt">'+(g.full?'מלא · 4/4':g.total+' מתוך 4 · חסר '+(4-g.total))+'</span></div>'
   +'<div class="gd">'+[g.level?'רמה '+esc(dash(g.level)):'',esc(dur),court].filter(Boolean).join(' · ')+'</div>'
   +'<div class="ppl">'+g.participants.map(p=>'<a href="#u='+esc(p.userId)+'" data-user-open="'+esc(p.userId)+'" class="pp"><span class="av sm">'+esc(initials(p))+'</span><span><b>'+esc(p.name||'ללא שם')+'</b>'+(p.party>1?' <small>+'+(p.party-1)+'</small>':'')+(p.role==='owner'?' <small class="tag2">פתח/ה את הבקשה</small>':'')+'<br><small>'+esc(phone(p.userId))+'</small></span></a>').join('')+'</div>'
   +'<div class="gf">'+(op?'נפתחה '+esc(stamp(g.createdAt))+' · מחפשת התאמה':'חובר '+esc(stamp(g.firstConnectedAt)))+'</div></div>'});
 return out+'</div>'}
function chatsView(){return'<div class="chat" id="chat"><div class="list"><div class="search"><input id="q" placeholder="חיפוש לפי שם או מספר" autocomplete="off"></div><div class="users" id="users"></div></div><div class="pane" id="pane"><div class="empty">בחרו שיחה מהרשימה</div></div></div>'}
function users(){return(D.messages&&D.messages.users)||[]}
function drawUsers(){var q=($('#q')&&$('#q').value||'').trim().toLowerCase();var l=users().filter(u=>!q||(u.name||'').toLowerCase().indexOf(q)>=0||phone(u.userId).indexOf(q)>=0||u.userId.indexOf(q)>=0);
 $('#users').innerHTML=l.length?l.map(u=>'<div class="u'+(u.userId===CUR?' on':'')+'" data-user="'+esc(u.userId)+'"><div class="av">'+esc(initials(u))+'</div><div class="mid"><div class="nm"><span>'+esc(u.name||phone(u.userId))+'</span><time>'+esc(when(u.lastAt))+'</time></div><div class="sub">'+(u.lastText!=null?(u.lastDirection==='out'?'<span class="me">בוט: </span>':'')+esc(u.lastText||'...'):esc(phone(u.userId)))+'</div><div class="sub2">'+esc(phone(u.userId))+(u.failed?' · <span class="bad">'+u.failed+' נכשלו</span>':'')+'</div></div></div>').join(''):'<p class="hint" style="padding:0 14px">אין תוצאות</p>'}
function bubble(x){var body=String(x.body||''),chips=[],m;var lines=body.split('\n').filter(function(l){if((m=/^\[(כפתורים|רשימה)\]\s*(.*)$/.exec(l))){chips=chips.concat(m[2].split(' | ').map(s=>s.trim()).filter(Boolean));return false}if((m=/^\[קישור\]\s*(.*?)\s*(https?:\S+)?$/.exec(l))){chips.push('↗ '+m[1]);return false}return true});
 var tpl=x.kind==='template',fail=x.sent===false,tag=tpl?'<span class="tag">תבנית</span>':'';if(fail)tag+='<span class="tag bad">לא נשלחה'+(x.reason?' ('+esc(x.reason)+')':'')+'</span>';
 return'<div class="b '+(x.direction==='in'?'in':'out')+(fail?' fail':'')+'">'+tag+esc(lines.join('\n').trim())+(chips.length?'<div class="chips">'+chips.map(c=>'<span>'+esc(c)+'</span>').join('')+'</div>':'')+'<time>'+esc(hm(x.at))+'</time></div>'}
async function showConv(user,quiet){CUR=user;drawUsers();var u=users().find(x=>x.userId===user)||{userId:user};$('#chat').classList.add('open');history.replaceState(null,'','#u='+user);
 var p=$('#pane');p.innerHTML='<div class="empty">טוען את השיחה…</div>';var d;try{d=await api('?user='+encodeURIComponent(user))}catch(e){p.innerHTML='<div class="empty">'+esc(e.message)+'</div>';return}
 var last='',html='';d.messages.forEach(x=>{var dy=dayOf(x.at);if(dy!==last){html+='<div class="day"><span>'+esc(dy)+'</span></div>';last=dy}html+=bubble(x)});
 var i=users().findIndex(x=>x.userId===user);
 p.innerHTML='<div class="ph"><button class="back" data-back="1" aria-label="חזרה">→</button><div class="av">'+esc(initials(d.name?{name:d.name}:u))+'</div><div class="mid"><div class="nm">'+esc(d.name||'ללא שם')+'</div><div class="sub">'+esc(phone(user))+'<span class="wide"> · '+(u.received||0)+' התקבלו · '+(u.sent||0)+' נשלחו · עלות '+usd(u.estimatedUsd)+'</span></div></div><button data-step="-1" title="השיחה הקודמת" aria-label="השיחה הקודמת"'+(i<=0?' disabled':'')+'>↑</button><button data-step="1" title="השיחה הבאה" aria-label="השיחה הבאה"'+(i>=users().length-1?' disabled':'')+'>↓</button></div><div class="msgs" id="msgs">'+(html||'<p class="hint">אין הודעות</p>')+'</div>';
 var ms=$('#msgs');ms.scrollTop=ms.scrollHeight}
document.addEventListener('click',async function(e){var t=e.target.closest('[data-user],[data-user-open],[data-back],[data-step],[data-v]');if(!t)return;if(t.dataset.userOpen){e.preventDefault();VIEW='chats';render();return showConv(t.dataset.userOpen)}
 if(t.dataset.v)return tab(t.dataset.v);if(t.dataset.user)return showConv(t.dataset.user);
 if(t.dataset.back){CUR=null;$('#chat').classList.remove('open');history.replaceState(null,'',location.pathname);return drawUsers()}
 if(t.dataset.step){var l=users(),i=l.findIndex(x=>x.userId===CUR)+Number(t.dataset.step);if(l[i])showConv(l[i].userId);return}});
document.addEventListener('input',function(e){if(e.target.id==='q')drawUsers()});
document.addEventListener('keydown',function(e){if(VIEW!=='chats'||!CUR||e.target.id==='q')return;if(e.key==='ArrowDown'||e.key==='ArrowUp'){var l=users(),i=l.findIndex(x=>x.userId===CUR)+(e.key==='ArrowDown'?1:-1);if(l[i]){e.preventDefault();showConv(l[i].userId)}}});
async function enter(){$('#error').textContent='';try{await load($('#password').value)}catch(e){$('#error').textContent=e.message;sessionStorage.removeItem('gt-admin-token')}}
$('#enter').onclick=enter;$('#password').onkeydown=e=>{if(e.key==='Enter')enter()};
var saved=sessionStorage.getItem('gt-admin-token');if(saved)load(saved).catch(e=>{document.documentElement.classList.remove('authing');$('#error').textContent=e.message;sessionStorage.removeItem('gt-admin-token')});
`;
export const html = '<!doctype html><html dir="rtl" lang="he"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GT PADEL - מערכת ניהול</title><style>' + CSS + '</style>'
 + '<header class="top"><h1>GT PADEL - מערכת ניהול</h1><nav class="tabs" id="tabs" hidden><button data-v="overview">סקירה</button><button data-v="chats">שיחות</button><button data-v="live">בקשות וחיבורים</button><button data-v="clicks">הזמנות</button></nav></header>'
 + '<script>try{if(sessionStorage.getItem("gt-admin-token"))document.documentElement.classList.add("authing")}catch(e){}</script>'
 + '<div id="login" class="login"><h2>כניסה</h2><label for="password">סיסמת ניהול</label><input id="password" type="password" autocomplete="current-password"><button id="enter" class="btn">כניסה</button><div id="error" class="err"></div></div><main id="app" hidden></main>'
 + '<script>' + JS + '</script></html>';
export default async () => new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
