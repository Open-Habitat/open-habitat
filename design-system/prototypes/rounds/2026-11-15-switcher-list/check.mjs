// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Walks the three directions at 1440 (Päivä, Yö, Kontrasti) and 390 (touch,
// Päivä and Yö) on the default case "kartta": each direction's line is
// marked and its default list shows its own row shape (1 one row per
// conversation with its sentence inside and a count, no headings; 2 one row
// per message with the conversation as a label, name rows only for title
// matches; 3 conversations with counts and no sentences), and the document
// does not overflow. On 390 the rail's door opens the sheet and the touch
// count/chevron works. Then at 1440 Päivä, per direction: each review case
// (empty, many, title, none) is captured; from the keyboard Esc closes,
// Ctrl+K and / open on recents with the previous one chosen and Enter swaps,
// → / ← open and close (1 expands the count, 2 shows the message before,
// 3 drills into a conversation), → leaves the caret alone mid-text, Enter
// opens at the right message with band and highlight, "Continue search"
// returns, a title match and a query matching nothing. Mac labels and
// English last. Screenshots at device scale 2, <n>-<direction>-<tag>.png;
// --quick takes only 1440 light.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-15-switcher-list';
const [input,out,flag]=process.argv.slice(2);
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['keskustelut','viestit','kaksi-vaihetta'];
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};

async function open(width,theme,kbd='pc',extra=''){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:900},deviceScaleFactor:2,reducedMotion:'reduce',hasTouch:phone,isMobile:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto(`http://prototype.test/?kbd=${kbd}${extra}`);
 await page.locator('#theme').selectOption(theme);
 return page;
}
const pick=async(page,d)=>{await page.locator('.proto-picker-item').nth(d).click();await page.locator(`.sw-review[data-direction="${d}"]`).waitFor({state:'attached'});await page.waitForTimeout(200);};
const shot=(page,d,tag)=>page.screenshot({path:`${out}/${d+1}-${names[d]}-${tag}.png`});
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const opened=page=>page.evaluate(()=>document.querySelector('.ah-rail a[aria-current="page"]')?.closest('li[data-testid^="agent-item-"]')?.dataset.testid.slice(11));
const selected=page=>page.locator('[role="option"][aria-selected="true"]').first().getAttribute('data-testid');
const inField=page=>page.evaluate(()=>document.activeElement?.dataset.testid==='message-input');
const sw=page=>page.getByTestId('switcher');
const settle=page=>page.waitForTimeout(150);
const field=page=>page.getByTestId('message-input');
const count=(page,s)=>page.locator(s).count();
const convs='[role="option"][data-kind="conv"]',hitsSel='[role="option"][data-kind="hit"]';
async function to(page,target,n){
 for(let i=0;i<30&&(await selected(page))!==target;i++)await page.keyboard.press('ArrowDown');
 eq(await selected(page),target,`${n}: arrows reach ${target}`);
}
async function jumped(page,n,conv,msg,q){
 await page.waitForTimeout(300);
 eq(await opened(page),conv,`${n}: ${conv} opens`);
 ok(await page.getByTestId('jump-target').isVisible(),`${n}: at the matching message`);
 eq(await page.getByTestId('jump-target').getAttribute('data-msg'),String(msg),`${n}: message ${msg}`);
 ok((await page.getByTestId('jump-band').textContent()).includes(q),`${n}: the band names the query`);
 ok(await page.evaluate(()=>CSS.highlights?.get('sw-hit')?.size>0),`${n}: words highlighted in the production message`);
 ok(await inField(page),`${n}: focus in the composer`);
}
async function search(page,q){
 await field(page).click();
 await page.keyboard.press('Control+KeyK');await settle(page);
 await page.keyboard.type(q);await settle(page);
}

// Each direction's default list on "kartta".
async function shape(page,d,at){
 eq(await page.getByTestId('switcher-input').inputValue(),'kartta',`${at}: example query`);
 eq(await count(page,'.sw-head'),0,`${at}: no section headings in a result`);
 if(d===0){
  ok(await count(page,convs)>=7,`${at}: one row per conversation`);
  eq(await count(page,hitsSel),0,`${at}: no separate message rows`);
  eq(await count(page,`${convs} .sw-card-line mark`),await count(page,`${convs} .sw-card-line:not(.sw-quiet)`),`${at}: each content row carries its marked sentence`);
  eq(await page.getByTestId('more-tiles').textContent(),'+4 osumaa →',`${at}: more hits are a count`);
 }else if(d===1){
  ok(await count(page,hitsSel)>=10,`${at}: one row per message`);
  eq(await count(page,convs),3,`${at}: conversation rows only for the three title matches`);
  eq(await count(page,`${convs} .sw-tag-name`),3,`${at}: each says "nimessä"`);
  eq(await count(page,`${hitsSel} .sw-label`),await count(page,hitsSel),`${at}: every message names its conversation`);
 }else{
  ok(await count(page,convs)>=7,`${at}: conversations only`);
  eq(await count(page,hitsSel),0,`${at}: no sentences in the first stage`);
  ok(await count(page,`${convs} .sw-count`)>=6,`${at}: each with its number of hits`);
  ok((await page.getByTestId('drill-tiles').textContent()).startsWith('5 osumaa'),`${at}: tiles has five`);
 }
 ok(await count(page,'mark')>=3,`${at}: matches marked`);
}

try{
for(const width of quick?[1440]:[1440,390])for(const theme of quick?['light']:width===390?['light','dark']:['light','dark','contrast']){
 const tag=`${width}-${theme}`;
 const page=await open(width,theme);
 await checkPicker(page,round);
 eq(await page.getByTestId('recommendation').count(),1,'the recommendation is on the page');
 for(let d=0;d<3;d++){
  await pick(page,d);
  const at=`${names[d]} ${tag}`;
  eq(await page.locator('.sw-lines li[aria-current]').count(),1,`${at}: its line is marked`);
  ok(await sw(page).isVisible(),`${at}: the list is open`);
  await shape(page,d,at);
  ok(await fits(page),`${at}: document overflow`);
  await shot(page,d,tag);
  if(width===390){
   // Touch has no arrows: the count (1) and the chevron (3) are buttons.
   if(d===0){await page.getByTestId('more-tiles').click();await settle(page);ok(await count(page,'[data-sub]')===4,`${at}: tapping the count expands`);await shot(page,d,`${tag}-expanded`);}
   if(d===2){await page.getByTestId('drill-tiles').click();await settle(page);ok(await page.getByTestId('crumb').isVisible(),`${at}: tapping the count drills in`);await shot(page,d,`${tag}-drilled`);await page.getByTestId('crumb-back').click();await settle(page);ok(await count(page,convs)>=7,`${at}: and back`);}
   ok(await fits(page),`${at}: sheet overflow`);
   await page.keyboard.press('Escape');await settle(page);eq(await sw(page).count(),0,`${at}: Esc closes the sheet`);
   await page.getByTestId('navigation-open').click();await page.waitForTimeout(250);
   ok(await page.getByTestId('search-entry').isVisible(),`${at}: the rail's search door`);
   await page.getByTestId('search-entry').click();await settle(page);
   ok(await sw(page).isVisible(),`${at}: the door opens the sheet`);
   await shot(page,d,`${tag}-door`);
  }
 }
 await page.close();
}

{
 const page=await open(1440,'light');
 for(let d=0;d<3;d++){
  await pick(page,d);
  const n=names[d];
  // The four review cases from the review bar.
  for(const c of ['empty','title','none','many']){
   await page.locator('#example').selectOption(c);await settle(page);
   ok(await sw(page).isVisible(),`${n} ${c}: open`);
   await shot(page,d,`case-${c}-1440-light`);
  }
  await page.keyboard.press('Escape');await settle(page);
  eq(await sw(page).count(),0,`${n}: Esc closes`);
  eq(await opened(page),'tiles',`${n}: Esc changes nothing`);
  await field(page).click();
  await page.keyboard.press('Control+KeyK');await settle(page);
  ok(await sw(page).isVisible(),`${n}: Ctrl+K opens`);
  ok(await page.evaluate(()=>document.activeElement?.dataset.testid==='switcher-input'),`${n}: focus in the search`);
  eq(await selected(page),'row-c-notice',`${n}: empty query, the previous conversation chosen`);
  ok((await page.locator('.sw-head').first().textContent()).includes('Viimeksi'),`${n}: recent heading`);
  await page.keyboard.press('Enter');await settle(page);
  eq(await opened(page),'notice',`${n}: Enter opens it`);
  ok(await inField(page),`${n}: focus back in the composer`);
  await page.keyboard.press('Control+KeyK');await settle(page);
  eq(await selected(page),'row-c-tiles',`${n}: now the previous is the first one`);
  await page.keyboard.press('Enter');await settle(page);
  eq(await opened(page),'tiles',`${n}: Ctrl+K Enter swaps back`);
  await page.locator('.ah-agent-header').first().click();
  await page.keyboard.press('/');await settle(page);
  ok(await sw(page).isVisible(),`${n}: / opens outside a field`);
  await page.keyboard.type('kartta');await settle(page);
  // → only acts at the end of the text.
  await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');await settle(page);
  eq(await page.evaluate(()=>document.activeElement.selectionStart),1,`${n}: mid-text → moves the caret`);
  eq(await count(page,'[data-sub],[data-testid="context"],[data-testid="crumb"]'),0,`${n}: and opens nothing`);
  await page.keyboard.press('End');
  eq(await selected(page),d===1?'row-c-tiles':'row-c-tiles',`${n}: the title match is first`);
  if(d===0){
   await page.keyboard.press('ArrowRight');await settle(page);
   eq(await page.getByTestId('row-c-tiles').getAttribute('aria-expanded'),'true',`${n}: → expands the count`);
   eq(await count(page,'[data-sub]'),4,`${n}: the other four hits under the row`);
   eq(await selected(page),'row-h-tiles-5',`${n}: selection moves to the first of them`);
   await shot(page,d,'expanded-1440-light');
   await page.keyboard.press('ArrowLeft');await settle(page);
   eq(await count(page,'[data-sub]'),0,`${n}: ← folds them`);
   eq(await selected(page),'row-c-tiles',`${n}: back on the conversation`);
   await page.keyboard.press('ArrowRight');await settle(page);
   await to(page,'row-h-tiles-1',n);
   await page.keyboard.press('Enter');
   await jumped(page,n,'tiles',1,'kartta');
   await search(page,'kartta');
   await to(page,'row-c-a11y',n);
   ok((await page.getByTestId('row-c-a11y').textContent()).includes('Upotetulla'),`${n}: the row shows the agent's question`);
   await page.keyboard.press('Enter');
   await jumped(page,n,'a11y',2,'kartta');
  }else if(d===1){
   await to(page,'row-h-a11y-2',n);
   await page.keyboard.press('ArrowRight');await settle(page);
   ok((await page.locator('[aria-selected="true"] [data-testid="context"]').textContent()).includes('Korjasin'),`${n}: → shows the message before`);
   await shot(page,d,'context-1440-light');
   await page.keyboard.press('ArrowLeft');await settle(page);
   eq(await count(page,'[data-testid="context"]'),0,`${n}: ← hides it`);
   await page.keyboard.press('Enter');
   await jumped(page,n,'a11y',2,'kartta');
   await search(page,'kartta');
   await to(page,'row-c-glossary',n);
   await page.keyboard.press('Enter');await page.waitForTimeout(300);
   eq(await opened(page),'glossary',`${n}: a name row opens the conversation`);
   eq(await page.getByTestId('jump-band').count(),0,`${n}: at its latest message, no band`);
  }else{
   await page.keyboard.press('ArrowRight');await settle(page);
   ok(await page.getByTestId('crumb').isVisible(),`${n}: → opens the conversation's hits`);
   eq(await count(page,convs),0,`${n}: the conversations step aside`);
   eq(await count(page,hitsSel),5,`${n}: its five hits`);
   eq(await selected(page),'row-h-tiles-6',`${n}: newest first`);
   await shot(page,d,'drilled-1440-light');
   await page.keyboard.press('ArrowLeft');await settle(page);
   eq(await selected(page),'row-c-tiles',`${n}: ← back to the same conversation`);
   await page.keyboard.press('ArrowRight');await settle(page);
   await to(page,'row-h-tiles-1',n);
   await page.keyboard.press('Enter');
   await jumped(page,n,'tiles',1,'kartta');
   await search(page,'kartta');
   await to(page,'row-c-notice',n);
   await page.keyboard.press('Enter');
   await jumped(page,n,'notice',1,'kartta');
  }
  await shot(page,d,'jump-1440-light');
  await page.keyboard.press('Control+KeyK');await settle(page);
  eq(await page.getByTestId('switcher-input').inputValue(),'',`${n}: Ctrl+K reopens empty, so Enter still swaps`);
  for(let i=0;i<12&&(await selected(page))!=='row-continue';i++)await page.keyboard.press('ArrowUp');
  eq(await selected(page),'row-continue',`${n}: "Continue search" is in the recent list`);
  await page.keyboard.press('Enter');await settle(page);
  eq(await page.getByTestId('switcher-input').inputValue(),'kartta',`${n}: and brings the query back`);
  // A title match.
  await page.getByTestId('switcher-input').fill('sanasto');await settle(page);
  eq(await selected(page),'row-c-glossary',`${n}: "sanasto" puts the glossary first`);
  ok(await count(page,'[data-testid="row-c-glossary"] .sw-title mark')===1,`${n}: its name is marked`);
  if(d===0)ok(await count(page,'[data-testid="row-c-glossary"] .sw-card-line mark')>=1,`${n}: and the sentence inside it`);
  if(d===1)eq(await count(page,'[data-testid^="row-h-glossary-"]'),2,`${n}: its two messages as rows of their own`);
  if(d===2)ok((await page.getByTestId('drill-glossary').textContent()).startsWith('2 osumaa'),`${n}: with two hits`);
  // Nothing.
  await page.getByTestId('switcher-input').fill('laskutus');await settle(page);
  ok(await page.getByTestId('empty').isVisible(),`${n}: the empty result says what to try`);
  eq(await count(page,'[role="option"]'),0,`${n}: nothing to choose`);
  await page.keyboard.press('Escape');await settle(page);
  if(await page.getByTestId('jump-close').count())await page.getByTestId('jump-close').click();
  // Back to tiles for the next direction.
  await search(page,'välimuisti');await page.keyboard.press('Enter');await settle(page);
  eq(await opened(page),'tiles',`${n}: back on tiles`);
 }
 await page.close();

 const mac=await open(1440,'dark','mac');
 ok((await mac.locator('.sw-lines li[aria-current]').textContent()).length>40,'Mac: line present');
 ok((await mac.getByTestId('recommendation').textContent()).includes('↵'),'Mac labels use ↵');
 await mac.keyboard.press('Escape');await settle(mac);
 await mac.keyboard.press('Meta+KeyK');await settle(mac);
 ok(await sw(mac).isVisible(),'⌘K opens on a Mac');
 await shot(mac,0,'mac-recent-1440-dark');
 await mac.close();

 const en=await open(1440,'light');
 await en.locator('#language').selectOption('en');
 for(let d=0;d<3;d++){
  await pick(en,d);
  eq(await en.getByTestId('switcher-input').inputValue(),'map',`English ${names[d]}: "map"`);
  ok(await en.locator('mark').count()>=(d===2?2:3),`English ${names[d]}: hits marked`);
  ok(await fits(en),`English ${names[d]}: overflow`);
  await shot(en,d,'en-1440-light');
 }
 ok((await en.locator('[data-testid="rail-yours"] h2').textContent()).includes('Your turn'),'English: production heading');
 await en.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[],'console errors');
console.log(`${checks} checks passed`);
