import test from "node:test";import assert from "node:assert/strict";import fs from "node:fs";
import{memoryStore}from"../src/store.js";import{logInbound,logOutbound,logTemplate,summarizeMessages,conversation,parseKey,describe}from"../src/messagelog.js";
import{deliver,MATCH_TEMPLATE,recordInbound}from"../src/notify.js";import{makeUser,turn}from"./harness.mjs";import adminPage from"../netlify/functions/admin.js";
// Tom 23.9: every conversation of every user is stored and viewable; per-user sent/received counts with free-form vs template split (Meta billing from Oct 1).
test("every inbound and outbound turn is stored in order with direction, type and body",async()=>{const store=memoryStore(),u=makeUser("972500000111","דנה",store);await turn(u,{text:"היי"});await turn(u,{text:"תפריט"});const conv=await conversation(store,u.userId);assert.equal(conv.filter(x=>x.direction==="in").length,2);assert.equal(conv.filter(x=>x.direction==="out").length,2);assert.deepEqual(conv.map(x=>x.direction),["in","out","in","out"]);assert.equal(conv[0].body,"היי");assert.ok(conv[1].body.length>0);assert.ok(conv.every(x=>x.at&&x.type));});
test("counts: received, sent, free-form vs template, failed sends not billable",async()=>{const store=memoryStore(),n="972500000222",now=new Date("2026-10-02T10:00:00Z");await logInbound(store,n,{id:"w1",type:"text"},{text:"שלום"},now);await logOutbound(store,n,{text:"היי"},{sent:true,data:{messages:[{id:"o1"}]}},now);await logOutbound(store,n,{text:"x"},{sent:false,reason:"api_error_500"},now);await logTemplate(store,n,MATCH_TEMPLATE,MATCH_TEMPLATE.body,{sent:true},now);const s=summarizeMessages(await store.keys("msg/"),{[n]:{name:"רון"}}),u=s.users[0];assert.equal(u.name,"רון");assert.equal(u.received,1);assert.equal(u.sent,2);assert.equal(u.service,1);assert.equal(u.template,1);assert.equal(u.failed,1);assert.equal(u.estimatedUsd,0.0106);assert.equal(s.totals.sent,2);});
test("window-aware deliver logs free-form inside window and template outside",async()=>{const store=memoryStore(),a="972500000333",b="972500000444",now=new Date("2026-10-02T10:00:00Z");await recordInbound(store,a,now);const send=async()=>({sent:true}),sendTemplate=async()=>({sent:true});await deliver(store,a,{text:"התאמה"},{now,send,sendTemplate});await deliver(store,b,{text:"התאמה"},{now,send,sendTemplate});const s=summarizeMessages(await store.keys("msg/"));const ua=s.users.find(x=>x.userId===a),ub=s.users.find(x=>x.userId===b);assert.equal(ua.service,1);assert.equal(ua.template,0);assert.equal(ub.template,1);const cb=await conversation(store,b);assert.match(cb[0].body,/gt_match_found/);assert.doesNotMatch(cb[0].body,/05\d|972/);});
test("buttons and lists are stored readably",()=>{assert.equal(describe({text:"מה?",buttons:[{id:"a",title:"כן"},{id:"b",title:"לא"}]}),"מה?\n[כפתורים] כן | לא");});
test("keys parse; unrelated keys ignored",()=>{assert.equal(parseKey("profile/1"),null);assert.equal(parseKey("msg/972/1790000000000-000001-out-template-ok").kind,"template");});
test("admin shows per-user counts and conversation view, escaping user text",async()=>{const html=await(await adminPage()).text();assert.match(html,/>שיחות</);assert.match(html,/data-user=/);assert.match(html,/api\('\?user='/);assert.match(html,/const esc=/);assert.match(html,/esc\(lines\.join/);});
// Defect found 23.9: \' inside the template literal rendered as a bare quote, so the admin script failed to parse and login never worked.
test("admin inline script parses",async()=>{const html=await(await adminPage()).text();const js=html.split("<script>")[1].split("</script>")[0];assert.doesNotThrow(()=>new Function(js));});
test("admin-data validates user param and requires auth",()=>{const src=fs.readFileSync(new URL("../netlify/functions/admin-data.js",import.meta.url),"utf8");assert.match(src,/\^\\d\{6,15\}\$/);assert.ok(src.indexOf("unauthorized")<src.indexOf("searchParams.get(\"user\")"));});

// Tom 23.9 15:32-15:33: dashboard redesign - WhatsApp-style chats, easy switching, clear booking labels.
test("dashboard: chat list + bubbles + prev/next, clear booking labels, no raw ids", async () => {
  const html = await (await adminPage()).text();
  assert.match(html, /class="b '\+\(x\.direction==='in'\?'in':'out'\)/); assert.match(html, /data-step="-1"/); assert.match(html, /data-step="1"/); assert.match(html, /id="q"/);
  assert.doesNotMatch(html, />אישור משתמש<|>אימות ספק<|>clicked</); assert.match(html, /המשתמש אישר שהזמין/); assert.match(html, /מופיע ביומן המועדון/);
  assert.doesNotMatch(html, /[–—]/);
});

// Tom 23.9 15:46: last-message preview in the dashboard chat list.
test("dashboard: last message preview per user, without buttons or template tag", async () => {
  const { previewText, addPreviews, logMessage } = await import("../src/messagelog.js"); const { memoryStore } = await import("../src/store.js");
  assert.equal(previewText("*מה הרמה שלכם?*\n[רשימה] 1-2 | 2-2.5"), "מה הרמה שלכם?");
  assert.equal(previewText("[תבנית match_alert] יש התאמה"), "יש התאמה");
  const st = memoryStore();
  await logMessage(st, "972500000001", { direction: "in", kind: "user", body: "שלום", at: new Date("2026-09-23T10:00:00Z") });
  await logMessage(st, "972500000001", { direction: "out", kind: "service", body: "ברוכים הבאים\n[כפתורים] a | b", at: new Date("2026-09-23T10:00:05Z") });
  const m = { users: [{ userId: "972500000001" }] };
  await addPreviews(st, await st.keys("msg/"), m);
  assert.equal(m.users[0].lastText, "ברוכים הבאים"); assert.equal(m.users[0].lastDirection, "out");
  const html = await (await adminPage()).text(); assert.match(html, /u\.lastText/);
});
// Tom 23.9 15:59: "סקירה" is the default tab and the first one; a chat deep link (#u=) still opens the chat.
test("dashboard opens on the overview tab", async () => {
  const html = await (await adminPage()).text();
  assert.match(html, /VIEW=\/\[#&\]u=\\d\/\.test\(location\.hash\)\?'chats':'overview'/);
  assert.ok(html.indexOf('data-v="overview"') < html.indexOf('data-v="chats"'));
});
