// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic walkthrough check, not a host-backed acceptance test.
// Default view (every direction and situation, 1440 and 390 px, Päivä and
// Yö, reduced motion): no document overflow, the direction's line marked,
// production's Settings on Tili with the block after its card, the block's
// own body (A rendered file, B the file as text with Muokkaa tekstinä, C
// section rows), where the file comes from (path, Pi, Claude), and each
// situation: no file shows the empty state, a self-written file says so and
// that Claude does not read it, and C shows such a file as it is. Flows
// (1440 light, plus A at 390 dark): A edits with the agent (change, save,
// back, file updated), writes a missing file (both files written, Claude
// now reads it) and adds Claude's reference to a self-written file; B edits
// as text and writes a missing file itself; C changes one section through
// the agent and cancels a free-text change to another; English last.
// Screenshots at device scale 2 into <out-dir>; the console must stay clean.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-21-instructions-settings';
const [input,out,flag]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <out-dir> [--quick]');process.exit(2);}
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['luku','teksti','osiot'];
const A=0,B=1,C=2;
const scenarios=['habitat','missing','own'];
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};

async function open(width,theme,lang='fi'){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:1000},deviceScaleFactor:2,reducedMotion:'reduce',hasTouch:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto('http://prototype.test/'+(lang==='en'?'?lang=en':''));
 await page.locator('#theme').selectOption(theme);
 await ready(page);
 return page;
}
const settle=page=>page.waitForTimeout(200);
const tid=(page,id)=>page.getByTestId(id);
const ready=async page=>{await page.locator('.ii-section [data-testid^="direction-"]').waitFor();await settle(page);};
const pick=async(page,d)=>{await page.locator('.proto-picker-item').nth(d).click();await page.locator(`.ii-review[data-direction="${d}"]`).waitFor({state:'attached'});await ready(page);};
const sel=async(page,v)=>{await page.locator('#scenario').selectOption(v);await ready(page);};
const toBlock=page=>page.evaluate(()=>document.querySelector('.ii-wrap')?.scrollIntoView({block:'start'}));
const shot=(page,name)=>page.screenshot({path:`${out}/${name}.png`});
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const shown=async(page,id)=>(await tid(page,id).count())>0&&await tid(page,id).first().isVisible();
const press=async(page,id,n=0)=>{await tid(page,id).nth(n).click();await settle(page);};
const chip=async(page,label)=>{await tid(page,'quick-reply').filter({hasText:label}).click();await settle(page);};
const field=page=>page.locator('.ah-composer textarea, [data-testid="composer-input"]').first();
const say=async(page,text)=>{await field(page).fill(text);await field(page).focus();await page.keyboard.press('Enter');await settle(page);};
const inChat=async page=>{await tid(page,'conversation').waitFor();await settle(page);};
const back=async page=>{await press(page,'back-to-settings');await ready(page);};
const dirId=['direction-a','direction-b','direction-c'];

try{
// ---- Default views ----
for(const width of quick?[1440]:[1440,390])for(const theme of quick?['light']:['light','dark']){
 const tag=`${width}-${theme}`;
 const page=await open(width,theme);
 await checkPicker(page,round);
 eq(await tid(page,'recommendation').count(),1,'recommendation on the page');
 for(let d=0;d<3;d++){
  await pick(page,d);
  for(const s of scenarios){
   await sel(page,s);
   const at=`${names[d]} ${s} ${tag}`;
   ok(await fits(page),`${at}: document overflow`);
   eq(await page.locator('.ii-lines li[aria-current]').count(),1,`${at}: its line is marked`);
   eq(await tid(page,dirId[d]).count(),1,`${at}: the direction's body`);
   eq(await tid(page,'settings-section-tili').count(),1,`${at}: production's Tili section`);
   ok(await page.evaluate(()=>{const s=document.querySelector('.s-main > .s-card');const b=document.querySelector('.ii-section');return !!s&&!!b&&!!(s.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING);}),`${at}: block after the Tili card`);
   ok((await tid(page,'instructions-heading').innerText()).toLowerCase().includes('ohjeet agentille'),`${at}: heading`);
   ok((await tid(page,'source').innerText()).includes('~/.pi/agent/AGENTS.md'),`${at}: the file's path`);
   eq(await tid(page,'source-claude').getAttribute('data-claude'),{habitat:'imports',missing:'none',own:'own'}[s],`${at}: Claude's state`);
   ok(await shown(page,'anywhere'),`${at}: any conversation works too`);
   eq(await shown(page,'missing'),s==='missing',`${at}: empty state`);
   eq(await shown(page,'own-note'),s==='own',`${at}: own-file note`);
   if(d===A)eq(await shown(page,'file-rendered'),s!=='missing',`${at}: rendered file`);
   if(d===B){eq(await shown(page,'file-raw'),s!=='missing',`${at}: file as text`);ok(await shown(page,'edit-as-text'),`${at}: edit as text`);}
   if(d===C){
    eq(await shown(page,'no-sections'),s==='own',`${at}: own file shown as it is`);
    if(s!=='own'){eq(await tid(page,'section-list').locator('.ii-sec').count(),5,`${at}: five section rows`);
     eq(await tid(page,'section-extra').getAttribute('data-empty'),'true',`${at}: empty section says so`);}
    if(s==='habitat')ok((await tid(page,'section-style').innerText()).includes('Selitä'),`${at}: section text`);
   }
   if(!(d===C&&s==='habitat'))ok(await shown(page,'edit-with-agent'),`${at}: agent button`);
   else eq(await tid(page,'section-change-style').count(),1,`${at}: per-section change`);
   await toBlock(page);await settle(page);
   await shot(page,`v${d+1}-${names[d]}-${s}-${tag}`);
  }
 }
 await page.close();
}

// ---- Flows ----
const page=await open(1440,'light');
// A: edit with the agent.
await pick(page,A);await sel(page,'habitat');
await press(page,'edit-with-agent');await inChat(page);
eq(await tid(page,'person-message').count(),1,'A: the opener is the person\'s message');
ok((await tid(page,'agent-reply').first().innerText()).includes('Luin'),'A: agent read the file');
eq(await tid(page,'quick-reply').count(),4,'A: style and ask choices');
await shot(page,'flow-a-chat-1440-light');
await chip(page,'Lyhyesti ja suoraan');
eq(await tid(page,'proposal').getAttribute('data-file'),'pi','A: proposal for Pi file');
eq(await tid(page,'proposal').locator('.ii-line[data-k="del"]').count(),1,'A: replaced line shown removed');
eq(await tid(page,'proposal').locator('.ii-line[data-k="add"]').count(),1,'A: new line shown added');
await shot(page,'flow-a-proposal-1440-light');
await chip(page,'Tallenna');
eq(await tid(page,'ii-tool').count(),1,'A: one edit');
ok((await tid(page,'ii-tool').innerText()).includes('edit'),'A: tool row is an edit');
await shot(page,'flow-a-saved-1440-light');
await back(page);
ok(await shown(page,'updated-tag'),'A: just updated');
ok((await tid(page,'file-rendered').innerText()).includes('Vastaa lyhyesti ja suoraan.'),'A: file updated');
ok(!(await tid(page,'file-rendered').innerText()).includes('Selitä mitä teet'),'A: old line gone');
// A: missing file written with the agent.
await sel(page,'missing');
await press(page,'edit-with-agent');await inChat(page);
ok((await tid(page,'agent-reply').first().innerText()).includes('GitHubista'),'A missing: agent says what it knows');
await chip(page,'Selitä vaiheet');
ok((await tid(page,'proposal').innerText()).includes('Uusi tiedosto'),'A missing: new file');
await chip(page,'Tallenna');
eq(await tid(page,'ii-tool').count(),2,'A missing: both files written');
await back(page);
ok(await shown(page,'file-rendered'),'A missing: the file is there');
eq(await tid(page,'source-claude').getAttribute('data-claude'),'imports','A missing: Claude reads it now');
// A: own file, Claude's reference.
await sel(page,'own');
await press(page,'edit-with-agent');await inChat(page);
await chip(page,'Lisää viittaus Claudelle');
eq(await tid(page,'proposal').getAttribute('data-file'),'claude','A own: proposal for Claude file');
ok((await tid(page,'proposal').locator('.ii-line[data-k="add"]').first().innerText()).includes('@~/.pi/agent/AGENTS.md'),'A own: import line added');
eq(await tid(page,'proposal').locator('.ii-line[data-k="del"]').count(),0,'A own: nothing removed from Claude file');
await chip(page,'Tallenna');await back(page);
eq(await tid(page,'source-claude').getAttribute('data-claude'),'imports','A own: Claude reads it now');
ok((await tid(page,'file-rendered').innerText()).includes('tyyppivihjeitä'),'A own: own text kept');
// A own: an addition keeps the own text.
await press(page,'edit-with-agent');await inChat(page);
await chip(page,'Kysy ennen pushia');
eq(await tid(page,'proposal').locator('.ii-line[data-k="del"]').count(),0,'A own: nothing removed');
await chip(page,'Älä muuta');
ok((await tid(page,'agent-reply').last().innerText()).includes('en muuttanut'),'A own: cancel writes nothing');
await back(page);

// B: edit as text.
await pick(page,B);await sel(page,'habitat');
await press(page,'edit-as-text');
ok(await shown(page,'text-editor'),'B: editor open');
await toBlock(page);await shot(page,'flow-b-editor-1440-light');
await tid(page,'text-editor').fill((await tid(page,'text-editor').inputValue())+'\n\n## Muuta\n\n- Pidän lyhyistä esimerkeistä.');
await press(page,'text-save');
ok(await shown(page,'toast'),'B: saved toast');
ok((await tid(page,'file-raw').innerText()).includes('Pidän lyhyistä esimerkeistä.'),'B: file updated');
ok(await shown(page,'updated-tag'),'B: just updated');
await press(page,'edit-as-text');await press(page,'text-cancel');
ok(await shown(page,'file-raw'),'B: cancel returns to the file');
await sel(page,'missing');
await press(page,'edit-as-text');
eq(await tid(page,'text-editor').inputValue(),'','B missing: empty editor');
await tid(page,'text-editor').fill('# Aino\n\n- Vastaa lyhyesti.');
await press(page,'text-save');
ok((await tid(page,'file-raw').innerText()).includes('Vastaa lyhyesti.'),'B missing: file written');
eq(await tid(page,'source-claude').getAttribute('data-claude'),'imports','B missing: Claude reads it');

// C: change one section.
await pick(page,C);await sel(page,'habitat');
await press(page,'section-change-ask');await inChat(page);
ok((await tid(page,'agent-reply').first().innerText()).includes('Kysy ennen kuin poistat'),'C: agent quotes the section');
eq(await tid(page,'quick-reply').count(),2,'C: the section\'s own choices');
await chip(page,'Kysy ennen pushia');await chip(page,'Tallenna');await back(page);
ok((await tid(page,'section-ask').innerText()).includes('pushaat'),'C: section updated');
ok((await tid(page,'section-ask').innerText()).includes('poistat'),'C: old line kept (addition)');
await toBlock(page);await shot(page,'flow-c-updated-1440-light');
await press(page,'section-change-who');await inChat(page);
eq(await tid(page,'quick-reply').count(),0,'C who: free text only');
await say(page,'Olen myös kuoronjohtaja.');
ok((await tid(page,'proposal').innerText()).includes('kuoronjohtaja'),'C who: free text in proposal');
await chip(page,'Älä muuta');await back(page);
ok(!(await tid(page,'section-who').innerText()).includes('kuoronjohtaja'),'C who: cancel wrote nothing');
await press(page,'show-file');ok(await shown(page,'file-raw'),'C: whole file on request');
await sel(page,'own');
ok(await shown(page,'no-sections'),'C own: shown as is');
ok(await fits(page),'flows: no overflow');
await page.close();

// Phone, dark: A through the agent.
if(!quick){
 const p=await open(390,'dark');
 await sel(p,'habitat');
 await press(p,'edit-with-agent');await inChat(p);
 ok(await fits(p),'phone chat: no overflow');
 await chip(p,'Kysy ennen pushia');
 await shot(p,'flow-a-proposal-390-dark');
 await chip(p,'Tallenna');await back(p);
 ok(await shown(p,'updated-tag'),'phone: just updated');
 await toBlock(p);await shot(p,'flow-a-updated-390-dark');
 await p.close();
}

// English.
const en=await open(1440,'light','en');
ok((await tid(en,'instructions-heading').innerText()).toLowerCase().includes('agent instructions'),'en: heading');
ok((await tid(en,'file-rendered').innerText()).includes('Answer in English.'),'en: file');
await press(en,'edit-with-agent');await inChat(en);
await chip(en,'Short and direct');await chip(en,'Save');await back(en);
ok((await tid(en,'file-rendered').innerText()).includes('Answer briefly and directly.'),'en: updated');
await toBlock(en);await shot(en,'en-a-updated-1440-light');
await en.close();

eq(errors.length,0,`console errors: ${errors.join(' | ')}`);
console.log(`ok: ${checks} checks, screenshots in ${out}`);
}finally{await browser.close();}
