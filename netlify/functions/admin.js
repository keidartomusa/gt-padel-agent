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
.login{max-width:360px;margin:12vh auto;background:#fff;border-radius:16px;padding:28px;box-shadow:0 2px 12px #0001}
.login h2{margin:0 0 16px;font-size:20px}.login input{width:100%;padding:12px;border:1px solid #d1d7db;border-radius:10px;font-size:16px;margin:8px 0 14px}
.btn{background:#00a884;color:#fff;border:0;border-radius:10px;padding:11px 18px;font-weight:700}.err{color:#d93025;margin-top:10px;min-height:1em}
.page{max-width:1200px;margin:0 auto;padding:20px}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.kpi{background:#fff;border-radius:14px;padding:16px;box-shadow:0 1px 3px #0000000f}.kpi b{display:block;font-size:28px;color:#008069}.kpi span{color:#54656f;font-size:14px}.kpi small{display:block;color:#8696a0;font-size:12px;margin-top:4px}
h2.sec{font-size:16px;color:#54656f;margin:24px 0 10px}
.panel{background:#fff;border-radius:14px;box-shadow:0 1px 3px #0000000f;overflow:hidden}
table{width:100%;border-collapse:collapse;font-size:14px}th{background:#f7f8fa;color:#54656f;font-weight:600}th,td{padding:10px 12px;text-align:right;border-bottom:1px solid #eef0f2}
.pill{display:inline-block;padding:3px 10px;border-radius:12px;font-size:12px;background:#eef0f2;color:#54656f}.pill.ok{background:#d9fdd3;color:#1d6b33}
.mini{border:1px solid #d1d7db;background:#fff;border-radius:8px;padding:5px 9px;font-size:13px;margin:2px}
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
.b .tag{font-size:11px;color:#8696a0;display:block;margin-bottom:2px}.b.fail{background:#fde8e8}.b .tag.bad{color:#d93025}
.chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}.chips span{background:#ffffffb3;border:1px solid #cfe9c9;color:#027eb5;border-radius:14px;padding:2px 10px;font-size:13px}
.empty{flex:1;display:flex;align-items:center;justify-content:center;color:#667781;background:#f0f2f5}
@media(max-width:760px){.kpis{grid-template-columns:repeat(2,1fr)}.kpi b{font-size:24px}.top{padding:10px 12px}.top h1{font-size:15px}.tabs button{padding:6px 10px;font-size:14px}.page{padding:12px}
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
async function api(q){const r=await fetch('/.netlify/functions/admin-data'+(q||''),{headers:{authorization:'Bearer '+TOKEN}});if(!r.ok)throw Error(r.status===401?'סיסמה שגויה':await r.text()||'שגיאת שרת');return r.json()}
async function load(token){TOKEN=token;D=await api();sessionStorage.setItem('gt-admin-token',token);$('#login').hidden=true;$('#tabs').hidden=false;render()}
function tab(v){VIEW=v;render()}
function render(){document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.v===VIEW));var a=$('#app');a.hidden=false;
 if(VIEW==='chats')a.innerHTML=chatsView();else if(VIEW==='overview')a.innerHTML=overview();else a.innerHTML=clicksView();
 if(VIEW!=='chats'&&CUR===null)history.replaceState(null,'',location.pathname);if(VIEW==='chats'){drawUsers();var h=decodeURIComponent((location.hash.match(/u=(\d+)/)||[])[1]||'');if(h)showConv(h,true)}}
function overview(){var s=D.summary,m=(D.messages||{}).totals||{};var k=[['משתמשים',(D.messages&&D.messages.users.length)||s.registrations,'כתבו לבוט לפחות פעם אחת'],['בקשות פעילות',s.activeRequests,'מופיעות עכשיו בלוח'],['הצעות התאמה',s.matches,''],['חיבורים שאושרו',s.acceptedMatches,'שני הצדדים הסכימו'],['לחיצות על הזמנה',s.bookingClicks,'לחיצה אינה הזמנה'],['הזמנות שאושרו',s.verifiedBookings,'מסומנות ידנית בלשונית הזמנות'],['הכנסה מהזמנות שאושרו','₪'+s.attributedRevenue,''],['עלות הודעות',usd(m.estimatedUsd),(m.sent||0)+' נשלחו · '+(m.received||0)+' התקבלו']];
 return'<div class="page"><div class="kpis">'+k.map(x=>'<div class="kpi"><b>'+esc(x[1])+'</b><span>'+esc(x[0])+'</span>'+(x[2]?'<small>'+esc(x[2])+'</small>':'')+'</div>').join('')+'</div>'+(m.failed?'<p class="hint">'+m.failed+' הודעות לא נשלחו. אפשר לראות אותן בשיחה (מסומנות באדום).</p>':'')+'</div>'}
var ST={clicked:['לחיצה בלבד',''],user_confirmed:['המשתמש אישר שהזמין','ok'],provider_verified:['מופיע ביומן המועדון','ok']},SRC={availability:'מגרש פנוי',matching:'התאמה'};
function clicksView(){var c=(D.bookingClicks||[]).slice().sort((a,b)=>String(b.clickedAt).localeCompare(String(a.clickedAt)));
 if(!c.length)return'<div class="page"><p class="hint">עוד אין לחיצות על הזמנה.</p></div>';
 return'<div class="page"><p class="hint">כל לחיצה על "להזמנה" נרשמת כאן. היא נספרת כהזמנה רק אחרי שמסמנים שהמשתמש אישר או שההזמנה מופיעה ביומן המועדון.</p><div class="panel"><table class="clicks"><thead><tr><th>נלחץ</th><th>מקור</th><th>משחק</th><th>מחיר</th><th>סטטוס</th><th>סימון הזמנה</th></tr></thead><tbody>'+c.map(x=>{var st=ST[x.status]||[x.status,''];return'<tr><td data-l="נלחץ">'+esc(stamp(x.clickedAt))+'</td><td data-l="מקור">'+esc(SRC[x.source]||x.source)+'</td><td data-l="משחק">'+esc(gameDay(x.date)+' · '+x.time+' · '+x.duration+' דק׳')+'</td><td data-l="מחיר">'+(x.price==null?'-':'₪'+esc(x.price))+'</td><td data-l="סטטוס"><span class="pill '+st[1]+'">'+esc(st[0])+'</span></td><td>'+(x.status==='clicked'?'<button class="mini" data-verify="user_confirmed" data-id="'+esc(x.id)+'">המשתמש אישר</button><button class="mini" data-verify="provider_verified" data-id="'+esc(x.id)+'">מופיע ביומן</button>':'')+'</td></tr>'}).join('')+'</tbody></table></div></div>'}
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
document.addEventListener('click',async function(e){var t=e.target.closest('[data-user],[data-back],[data-step],[data-verify],[data-v]');if(!t)return;
 if(t.dataset.v)return tab(t.dataset.v);if(t.dataset.user)return showConv(t.dataset.user);
 if(t.dataset.back){CUR=null;$('#chat').classList.remove('open');history.replaceState(null,'',location.pathname);return drawUsers()}
 if(t.dataset.step){var l=users(),i=l.findIndex(x=>x.userId===CUR)+Number(t.dataset.step);if(l[i])showConv(l[i].userId);return}
 if(t.dataset.verify){const r=await fetch('/.netlify/functions/booking-confirm',{method:'POST',headers:{authorization:'Bearer '+TOKEN,'content-type':'application/json'},body:JSON.stringify({clickId:t.dataset.id,verification:t.dataset.verify})});if(!r.ok){alert(await r.text());return}D=await api();render()}});
document.addEventListener('input',function(e){if(e.target.id==='q')drawUsers()});
document.addEventListener('keydown',function(e){if(VIEW!=='chats'||!CUR||e.target.id==='q')return;if(e.key==='ArrowDown'||e.key==='ArrowUp'){var l=users(),i=l.findIndex(x=>x.userId===CUR)+(e.key==='ArrowDown'?1:-1);if(l[i]){e.preventDefault();showConv(l[i].userId)}}});
async function enter(){$('#error').textContent='';try{await load($('#password').value)}catch(e){$('#error').textContent=e.message;sessionStorage.removeItem('gt-admin-token')}}
$('#enter').onclick=enter;$('#password').onkeydown=e=>{if(e.key==='Enter')enter()};
var saved=sessionStorage.getItem('gt-admin-token');if(saved)load(saved).catch(e=>{$('#error').textContent=e.message;sessionStorage.removeItem('gt-admin-token')});
`;
export const html = '<!doctype html><html dir="rtl" lang="he"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GT PADEL - מערכת ניהול</title><style>' + CSS + '</style>'
 + '<header class="top"><h1>GT PADEL - מערכת ניהול</h1><nav class="tabs" id="tabs" hidden><button data-v="overview">סקירה</button><button data-v="chats">שיחות</button><button data-v="clicks">הזמנות</button></nav></header>'
 + '<div id="login" class="login"><h2>כניסה</h2><label for="password">סיסמת ניהול</label><input id="password" type="password" autocomplete="current-password"><button id="enter" class="btn">כניסה</button><div id="error" class="err"></div></div><main id="app" hidden></main>'
 + '<script>' + JS + '</script></html>';
export default async () => new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
