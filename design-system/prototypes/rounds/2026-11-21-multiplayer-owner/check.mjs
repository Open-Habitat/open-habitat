// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Walks the three directions at 1440 and 390 px in Päivä, Yö and Kontrasti
// with reduced motion. Default view: Ville's request and the agent's
// text-only reply marked, attributed cards (names, avatars, roles), the
// people band, the direction's release control and no overflow. Flows (Päivä
// and Yö): Voit jatkaa posts the owner's message and the agent works with
// tools; Hyväksy yksitellen allows one step and denies the other (window in
// 1 and 2, card rows in 3); the owner's own message settles a pending stop
// and restores tools; marking Ville trusted (confirmation window) makes his
// next message a tools turn, revoking makes it text only again; Maija's
// question gets a text-only answer without a stop; inviting Pekka adds him
// as invited. English last. Screenshots at device scale 2 into <out-dir>.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-21-multiplayer-owner';
const [input,out,flag]=process.argv.slice(2);
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['kaista','merkki','kortti'];
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};

async function open(width,theme,lang='fi'){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:1000},deviceScaleFactor:2,reducedMotion:'reduce',hasTouch:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 if(lang==='en')await page.locator('#language').selectOption('en');
 return page;
}
const pick=async(page,d)=>{await page.locator('.proto-picker-item').nth(d).click();await page.locator(`.ra-review[data-direction="${d}"]`).waitFor({state:'attached'});await page.waitForTimeout(150);};
const shot=(page,name)=>page.screenshot({path:`${out}/${name}.png`});
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const has=async(page,id)=>(await page.getByTestId(id).count())>0;
const replies=page=>page.getByTestId('agent-reply');
const lastReply=page=>replies(page).last();
const settle=page=>page.waitForTimeout(200);
const toBottom=page=>page.evaluate(()=>{const s=document.querySelector('[data-testid="conversation-stream"]');if(s)s.scrollTop=s.scrollHeight;});
const reset=async page=>{await page.getByTestId('event-reset').click();await settle(page);};

async function defaultView(page,d,at){
 eq(await page.locator('.ra-lines li[aria-current]').count(),1,`${at}: its line is marked`);
 eq(await page.getByTestId('authored-message').count(),2,`${at}: two people's messages`);
 const authors=await page.getByTestId('author-name').allTextContents();
 eq(authors,['Sinä','Ville Virtanen'],`${at}: attributed by name`);
 ok(await page.locator('[data-author="ville"] .mp-avatar').isVisible(),`${at}: Ville's avatar`);
 ok((await page.locator('[data-author="ville"] .mp-role').textContent()).includes('Osallistuja'),`${at}: role tag`);
 const text=page.locator('.mp-reply[data-mode="text"]');
 eq(await text.count(),1,`${at}: one text-only reply`);
 ok((await text.getByTestId('mode-mark').textContent()).includes('Vain teksti'),`${at}: text-only marked`);
 ok((await text.textContent()).includes('Ville'),`${at}: reply says whom it answers`);
 eq(await page.locator('.mp-reply[data-mode="tools"] [data-testid="mode-mark"]').count(),d===1?1:0,`${at}: tools turns badged only in 2`);
 ok(await page.getByTestId('people-band').isVisible(),`${at}: people band`);
 ok(await page.getByTestId('invite-open').isVisible(),`${at}: invite entry`);
 eq(await has(page,'mode-strip'),d===0,`${at}: strip only in 1`);
 eq(await has(page,'under-reply'),d===1,`${at}: buttons under the reply only in 2`);
 eq(await has(page,'stop-card'),d===2,`${at}: card only in 3`);
 await toBottom(page);
 const control=d===0?'strip-go-on':d===1?'under-go-on':'card-go-on';
 ok(await page.getByTestId(control).isVisible(),`${at}: release control visible`);
 if(d===0){
  ok((await page.getByTestId('mode-strip').textContent()).includes('Vain teksti'),`${at}: strip says text only`);
  ok(!(await has(page,'strip-waiting')),`${at}: the latest reply is the waiting one, no extra line`);
 }
 if(d===2)eq(await page.getByTestId('card-op').count(),2,`${at}: card lists both steps`);
 ok(await fits(page),`${at}: document overflow`);
}

async function goOnFlow(page,d,tag){
 const at=`${names[d]} ${tag} go on`;
 await page.getByTestId(d===0?'strip-go-on':d===1?'under-go-on':'card-go-on').click();
 await settle(page);
 const authors=await page.getByTestId('author-name').allTextContents();
 eq(authors.at(-1),'Sinä','`Voit jatkaa` is the owner\'s message');
 ok((await page.getByTestId('authored-message').last().textContent()).includes('Voit jatkaa.'),`${at}: its text`);
 eq(await lastReply(page).getAttribute('data-mode'),'tools',`${at}: tools turn`);
 ok((await lastReply(page).textContent()).includes('julkaisin sivun'),`${at}: did the work`);
 ok((await page.locator('[data-tool-target="npm run deploy"]').count())>0,`${at}: the deploy tool row`);
 ok((await page.getByTestId('stop-outcome').last().textContent()).includes('Sallit jatkaa'),`${at}: outcome recorded`);
 if(d===0)ok((await page.getByTestId('mode-strip').textContent()).includes('Työkalut käytössä'),`${at}: strip says tools on`);
 eq(await has(page,'strip-go-on')||await has(page,'under-go-on')||await has(page,'card-go-on'),false,`${at}: no release left`);
 ok(await fits(page),`${at}: overflow`);
 await toBottom(page);await shot(page,`${d}-${names[d]}-${tag}-go-on`);
 await reset(page);
}

async function eachFlow(page,d,tag){
 const at=`${names[d]} ${tag} each`;
 if(d===2){
  await page.getByTestId('card-allow').first().click();await settle(page);
  ok(await page.getByTestId('card-go-on').count()===0,`${at}: all-at-once goes once a row is decided`);
  await toBottom(page);await shot(page,`${d}-${names[d]}-${tag}-each-half`);
  await page.getByTestId('card-deny').first().click();await settle(page);
  eq(await page.locator('[data-testid="card-op"][data-decision="allow"]').count(),1,`${at}: one allowed row`);
  eq(await page.locator('[data-testid="card-op"][data-decision="deny"]').count(),1,`${at}: one denied row`);
 }else{
  await page.getByTestId(d===0?'strip-each':'under-each').click();await settle(page);
  ok(await page.getByTestId('step-dialog').isVisible(),`${at}: window`);
  ok((await page.getByTestId('step-dialog').textContent()).includes('toimi 1/2'),`${at}: step 1 of 2`);
  ok((await page.getByTestId('step-op').textContent()).includes('content/events/kevatkokous.md'),`${at}: names the file`);
  ok(await fits(page),`${at}: overflow with window`);
  await shot(page,`${d}-${names[d]}-${tag}-each-window`);
  await page.getByTestId('step-allow').click();await settle(page);
  ok((await page.getByTestId('step-op').textContent()).includes('npm run deploy'),`${at}: step 2 names the command`);
  await page.getByTestId('step-deny').click();await settle(page);
  ok(!(await has(page,'step-dialog')),`${at}: window closed`);
 }
 eq(await lastReply(page).getAttribute('data-mode'),'each',`${at}: step-by-step turn`);
 eq(await lastReply(page).getAttribute('data-to'),'ville',`${at}: still Ville's turn`);
 ok((await lastReply(page).textContent()).includes('en julkaissut'),`${at}: reply says what was skipped`);
 eq(await page.locator('.mp-tool[data-state="denied"]').count(),1,`${at}: denied tool row`);
 ok((await page.getByTestId('stop-outcome').last().textContent()).includes('yksitellen'),`${at}: outcome`);
 ok(await fits(page),`${at}: overflow`);
 await toBottom(page);await shot(page,`${d}-${names[d]}-${tag}-each-done`);
 await reset(page);
}

async function ownerFlow(page,d,tag){
 const at=`${names[d]} ${tag} owner writes`;
 const field=page.locator('.ah-composer textarea, [data-testid="composer-input"]').first();
 ok((await field.inputValue()).length>0,`${at}: draft ready`);
 await field.focus();
 await page.keyboard.press('Enter');
 await settle(page);
 eq((await page.getByTestId('author-name').allTextContents()).at(-1),'Sinä',`${at}: owner's message last`);
 eq(await lastReply(page).getAttribute('data-mode'),'tools',`${at}: tools again`);
 ok((await page.getByTestId('stop-outcome').last().textContent()).includes('kirjoitit itse'),`${at}: stop settled by the owner`);
 if(d===0)ok((await page.getByTestId('mode-strip').textContent()).includes('viimeisin viesti on sinulta'),`${at}: strip`);
 ok(await fits(page),`${at}: overflow`);
 await toBottom(page);await shot(page,`${d}-${names[d]}-${tag}-owner`);
 await reset(page);
}

async function trustFlow(page,d,tag){
 const at=`${names[d]} ${tag} trust`;
 await page.getByTestId('people-open').click();await settle(page);
 ok(await page.getByTestId('people-panel').isVisible(),`${at}: panel`);
 eq(await page.locator('[data-testid^="person-"]').count(),3,`${at}: three people`);
 ok(await fits(page),`${at}: panel overflow`);
 await shot(page,`${d}-${names[d]}-${tag}-people`);
 await page.getByTestId('trust-ville').click();await settle(page);
 ok(await page.getByTestId('trust-dialog').isVisible(),`${at}: confirm window`);
 ok((await page.getByTestId('trust-dialog').textContent()).includes('GitHubia'),`${at}: says what is lent`);
 await shot(page,`${d}-${names[d]}-${tag}-trust-ask`);
 await page.getByTestId('trust-confirm').click();await settle(page);
 ok(await page.getByTestId('revoke-ville').isVisible(),`${at}: revoke offered`);
 await page.getByTestId('people-close').click();await settle(page);
 ok((await page.getByTestId('band-trusted').textContent()).includes('Ville'),`${at}: band shows trusted`);
 ok((await page.getByTestId('habitat-line').last().textContent()).includes('luotetuksi'),`${at}: line`);
 await page.getByTestId('event-ville').click();await settle(page);
 eq(await lastReply(page).getAttribute('data-mode'),'trusted',`${at}: trusted turn uses tools`);
 ok((await page.locator('[data-author="ville"] .mp-role').last().textContent()).includes('Luotettu'),`${at}: role tag trusted`);
 if(d===0){
  ok((await page.getByTestId('mode-strip').textContent()).includes('luotetulta'),`${at}: strip`);
  ok((await page.getByTestId('strip-waiting').textContent()).includes('Villen pyyntö klo 14.11'),`${at}: strip names the earlier waiting request`);
 }
 await toBottom(page);await shot(page,`${d}-${names[d]}-${tag}-trusted`);
 await page.getByTestId('people-open').click();await settle(page);
 await page.getByTestId('revoke-ville').click();await settle(page);
 await page.getByTestId('people-close').click();await settle(page);
 ok(!(await has(page,'band-trusted')),`${at}: band trust gone`);
 await page.getByTestId('event-ville').click();await settle(page);
 eq(await lastReply(page).getAttribute('data-mode'),'text',`${at}: text only again`);
 // Maija: a question that needs no tools, answered in text without a stop.
 await page.getByTestId('event-maija').click();await settle(page);
 eq(await lastReply(page).getAttribute('data-mode'),'text',`${at}: Maija text only`);
 ok((await lastReply(page).textContent()).includes('Rantatie 4'),`${at}: Maija answered`);
 if(d===0)ok((await page.getByTestId('mode-strip').textContent()).includes('Maija'),`${at}: strip names Maija`);
 // Invite
 await page.getByTestId('invite-open').click();await settle(page);
 ok(await page.getByTestId('invite-dialog').isVisible(),`${at}: invite window`);
 ok((await page.getByTestId('invite-dialog').textContent()).includes('vain tekstillä'),`${at}: invite says text only`);
 ok(await fits(page),`${at}: invite overflow`);
 await shot(page,`${d}-${names[d]}-${tag}-invite`);
 await page.getByTestId('invite-pekka').click();
 await page.getByTestId('invite-send').click();await settle(page);
 eq(await page.locator('.mp-band .mp-avatar').count(),4,`${at}: Pekka in the band`);
 ok((await page.getByTestId('habitat-line').last().textContent()).includes('Pekka'),`${at}: invited line`);
 await reset(page);
}

try{
for(const width of quick?[1440]:[1440,390])for(const theme of quick?['light']:['light','dark','contrast']){
 const tag=`${width}-${theme}`;
 const page=await open(width,theme);
 await checkPicker(page,round);
 eq(await page.getByTestId('recommendation').count(),1,'the recommendation is on the page');
 for(let d=0;d<3;d++){
  await pick(page,d);
  await defaultView(page,d,`${names[d]} ${tag}`);
  await shot(page,`${d}-${names[d]}-${tag}`);
  if(theme!=='contrast'){
   await goOnFlow(page,d,tag);
   await eachFlow(page,d,tag);
   await ownerFlow(page,d,tag);
   await trustFlow(page,d,tag);
  }
 }
 await page.close();
}
for(const width of [1440,390]){
 const en=await open(width,width===390?'dark':'light','en');
 for(let d=0;d<3;d++){
  await pick(en,d);
  ok((await en.locator('.mp-reply[data-mode="text"] [data-testid="mode-mark"]').textContent()).includes('Text only'),`English ${width} ${d}: mark`);
  eq((await en.getByTestId('author-name').allTextContents())[0],'You',`English ${width} ${d}: You`);
  ok(await fits(en),`English ${width} ${d}: fits`);
  await toBottom(en);
  await shot(en,`en-${d}-${names[d]}-${width}`);
 }
 await en.getByTestId('people-open').click();await settle(en);
 await en.getByTestId('trust-ville').click();await settle(en);
 ok((await en.getByTestId('trust-dialog').textContent()).includes('without asking you'),`English ${width}: trust window`);
 await shot(en,`en-trust-${width}`);
 await en.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[],'console errors');
console.log(`${checks} checks passed`);
