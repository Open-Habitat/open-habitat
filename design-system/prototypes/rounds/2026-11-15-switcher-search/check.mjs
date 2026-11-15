// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Walks the three directions at 1440 (Päivä, Yö, Kontrasti) and 390 (touch,
// Päivä and Yö): each direction's line is marked, its default view shows
// its own difference (1 the narrow list with message hits, 2 the wide
// dialog with filters and preview, 3 the search page), and the document does
// not overflow. On 390 the rail's search door opens a full-screen sheet.
// Then at 1440 Päivä the flows run from the keyboard: Esc closes; ⌘K/Ctrl+K
// and / open on recent conversations with the previous one chosen, and
// Enter swaps; typing finds names and inflected words; Enter on a message
// hit opens the conversation at that message with the band and highlight;
// "Continue search" returns the query. Direction 2's filters and preview,
// direction 3's palette row to the page and back from a hit, the
// index-building state, Mac labels and English last. Screenshots at device
// scale 2 named <n>-<direction>-<tag>.png; --quick takes only 1440 light.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-15-switcher-search';
const [input,out,flag]=process.argv.slice(2);
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['lista','esikatselu','hakusivu'];
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
  if(d<2){
   ok(await sw(page).isVisible(),`${at}: the switcher is open with the example query`);
   eq(await page.getByTestId('switcher-input').inputValue(),'kartta',`${at}: example query`);
   ok(await page.locator('[role="option"][data-kind="hit"]').count()>=6,`${at}: message hits`);
   eq(await page.getByTestId('filters').isVisible(),d===1,`${at}: filters only in Esikatselu`);
   eq(await page.getByTestId('preview').isVisible(),d===1&&width!==390,`${at}: preview only in Esikatselu on a wide screen`);
   if(d===1&&width!==390)ok((await page.getByTestId('preview').textContent()).length>40,`${at}: the preview shows the message`);
  }else{
   ok(await page.getByTestId('search-page').isVisible(),`${at}: the search page`);
   ok(await page.locator('.sw-page-hit').count()>=6,`${at}: page hits`);
  }
  ok(await page.locator('mark').count()>3,`${at}: matches marked`);
  ok(await fits(page),`${at}: document overflow`);
  await shot(page,d,tag);
  if(width===390){
   if(d<2){await page.keyboard.press('Escape');await settle(page);eq(await sw(page).count(),0,`${at}: Esc closes the sheet`);}
   await shot(page,d,`${tag}-conversation`);
   await page.getByTestId('navigation-open').click();await page.waitForTimeout(250);
   ok(await page.getByTestId('search-entry').isVisible(),`${at}: the rail's search door`);
   await page.getByTestId('search-entry').click();await settle(page);
   if(d<2)ok(await sw(page).isVisible(),`${at}: the door opens the sheet`);
   else ok(await page.getByTestId('search-page').isVisible(),`${at}: the door opens the page`);
   ok(await fits(page),`${at}: sheet overflow`);
   await shot(page,d,`${tag}-door`);
  }
 }
 await page.close();
}

{
 const page=await open(1440,'light');
 for(let d=0;d<2;d++){
  await pick(page,d);
  const n=names[d];
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
  // / opens outside text fields only.
  await page.locator('.ah-agent-header').first().click();
  await page.keyboard.press('/');await settle(page);
  ok(await sw(page).isVisible(),`${n}: / opens outside a field`);
  await page.keyboard.type('kartan');await settle(page);
  ok(await page.getByTestId('row-c-tiles').count()===1,`${n}: inflected "kartan" finds Karttatiilten välimuisti`);
  ok(await page.getByTestId('row-c-glossary').count()===1,`${n}: and the compound Tilikartan sanasto`);
  ok(await page.getByTestId('row-c-provider').count()===1,`${n}: archived conversations are searched`);
  eq(await page.getByTestId('row-h-tiles-2').count(),0,`${n}: tool output is not searched by default`);
  if(d===0)ok(await page.locator('.sw-more').count()>=1,`${n}: at most two hits per conversation, then a count`);
  await shot(page,d,'inflected-1440-light');
  // To the a11y question: a hit opens at its message.
  const target='row-h-a11y-2';
  for(let i=0;i<20&&(await selected(page))!==target;i++)await page.keyboard.press('ArrowDown');
  eq(await selected(page),target,`${n}: arrows reach the agent's question`);
  if(d===1)ok((await page.getByTestId('preview').textContent()).includes('Upotetulla'),`${n}: the preview follows the selection`);
  await page.keyboard.press('Enter');await page.waitForTimeout(300);
  eq(await opened(page),'a11y',`${n}: the hit's conversation opens`);
  ok(await page.getByTestId('jump-target').isVisible(),`${n}: at the matching message`);
  eq(await page.getByTestId('jump-target').getAttribute('data-msg'),'2',`${n}: the right message`);
  ok((await page.getByTestId('jump-band').textContent()).includes('kartan'),`${n}: the band names the query`);
  ok(await page.evaluate(()=>CSS.highlights?.get('sw-hit')?.size>0),`${n}: the words are highlighted in the production message`);
  ok(await inField(page),`${n}: focus in the composer`);
  await shot(page,d,'jump-1440-light');
  await page.keyboard.press('Control+KeyK');await settle(page);
  eq(await page.getByTestId('switcher-input').inputValue(),'',`${n}: Ctrl+K reopens empty, so Enter still swaps`);
  await page.keyboard.press('End');
  for(let i=0;i<12&&(await selected(page))!=='row-continue';i++)await page.keyboard.press('ArrowUp');
  eq(await selected(page),'row-continue',`${n}: "Continue search" is in the recent list`);
  await page.keyboard.press('Enter');await settle(page);
  eq(await page.getByTestId('switcher-input').inputValue(),'kartan',`${n}: and brings the query back`);
  await page.keyboard.press('Escape');await settle(page);
  await page.getByTestId('jump-close').click();await settle(page);
  eq(await page.getByTestId('jump-band').count(),0,`${n}: the band closes`);
  // No hits.
  await page.keyboard.press('Control+KeyK');await page.keyboard.type('zzz');await settle(page);
  ok(await page.locator('.sw-empty').isVisible(),`${n}: the empty result says what to try`);
  await page.keyboard.press('Escape');await settle(page);
  // Back to tiles for the next direction.
  await page.keyboard.press('Control+KeyK');await page.keyboard.type('välimuisti');await page.keyboard.press('Enter');await settle(page);
 }

 // 2 Esikatselu: filters by mouse and keyboard.
 await pick(page,1);
 const hits=()=>page.locator('[role="option"][data-kind="hit"]').count();
 const all=await hits();
 await page.getByTestId('f-who').click();await settle(page);
 ok((await page.getByTestId('f-who').textContent()).includes('Minä'),'Esikatselu: who → I said');
 const mine=await hits();
 ok(mine>0&&mine<all,'Esikatselu: only my messages');
 ok(await page.locator('[role="option"][data-kind="hit"] .sw-who-agent').count()===0,'Esikatselu: no agent hits');
 await page.getByTestId('f-who').click();await page.getByTestId('f-who').click();await settle(page);
 await page.getByTestId('f-archived').click();await settle(page);
 eq(await page.getByTestId('row-c-provider').count(),0,'Esikatselu: archived ones leave');
 await page.getByTestId('f-tools').click();await settle(page);
 await page.getByTestId('switcher-input').fill('offline');await settle(page);
 eq(await page.getByTestId('row-h-tiles-2').count(),1,'Esikatselu: tool output joins (its text is the test run)');
 await page.getByTestId('switcher-input').fill('kartta');await settle(page);
 await page.getByTestId('f-ws').click();await page.getByTestId('f-ws').click();await settle(page);
 ok((await page.getByTestId('f-ws').textContent()).includes('kotisivu'),'Esikatselu: workspace chip cycles');
 ok(await page.locator('[role="option"][data-kind="hit"]').count()>0&&await page.getByTestId('row-c-tiles').count()===0,'Esikatselu: only kotisivu');
 await shot(page,1,'filters-1440-light');
 await page.getByTestId('switcher-input').focus();
 await page.keyboard.press('Tab');
 eq(await page.evaluate(()=>document.activeElement?.dataset.testid),'f-who','Esikatselu: Tab reaches the filters');
 await page.keyboard.press('Escape');await settle(page);
 eq(await sw(page).count(),0,'Esikatselu: Esc from a filter closes');

 // 3 Hakusivu.
 await pick(page,2);
 ok(await page.getByTestId('search-page').isVisible(),'Hakusivu: default is the page');
 ok(await page.evaluate(()=>document.activeElement?.dataset.testid==='page-input'),'Hakusivu: focus in its field');
 await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await page.waitForTimeout(300);
 ok(await page.getByTestId('jump-target').isVisible(),'Hakusivu: Enter opens at the message');
 ok(await page.getByTestId('jump-back').isVisible(),'Hakusivu: the band leads back to the results');
 await shot(page,2,'jump-1440-light');
 await page.getByTestId('jump-back').click();await settle(page);
 eq(await page.getByTestId('page-input').inputValue(),'kartta','Hakusivu: back with the query');
 await page.keyboard.press('Escape');await settle(page);
 eq(await page.getByTestId('search-page').count(),0,'Hakusivu: Esc returns to the conversation');
 await field(page).click();
 await page.keyboard.press('Control+KeyK');await page.keyboard.type('reitti');await settle(page);
 eq(await page.locator('[role="option"][data-kind="hit"]').count(),0,'Hakusivu: the palette jumps by name only');
 eq(await page.getByTestId('row-page').count(),1,'Hakusivu: its last row searches everything');
 await shot(page,2,'palette-1440-light');
 await page.keyboard.press('Control+Enter');await settle(page);
 ok(await page.getByTestId('search-page').isVisible(),'Hakusivu: Ctrl+Enter opens the page');
 eq(await page.getByTestId('page-input').inputValue(),'reitti','Hakusivu: with the query');
 await page.locator('.sw-page-filters input[name="who"]').nth(2).check();await settle(page);
 ok(await page.locator('.sw-page-hit .sw-who-me').count()===0,'Hakusivu: who filter');
 await page.close();

 // Index still building: names complete, messages newest first.
 const b=await open(1440,'light','pc','&building=1');
 for(let d=0;d<3;d++){
  await pick(b,d);
  ok(await b.getByTestId('building').isVisible(),`${names[d]}: building line`);
  eq(await b.getByTestId('row-c-provider').count(),1,`${names[d]}: names are all found while building`);
  eq(await b.getByTestId('row-h-colors-1').count(),0,`${names[d]}: older messages wait`);
  await shot(b,d,'building-1440-light');
 }
 await b.close();

 const mac=await open(1440,'dark','mac');
 ok((await mac.locator('.sw-lines li[aria-current]').textContent()).includes('⌘K'),'Mac labels use ⌘');
 await mac.keyboard.press('Escape');await settle(mac);
 await mac.keyboard.press('Meta+KeyK');await settle(mac);
 ok(await sw(mac).isVisible(),'⌘K opens on a Mac');
 await shot(mac,0,'mac-recent-1440-dark');
 await mac.close();

 const en=await open(1440,'light');
 await en.locator('#language').selectOption('en');
 for(let d=0;d<3;d++){
  await pick(en,d);
  ok(await en.locator('mark').count()>3,`English ${names[d]}: "map" hits`);
  await shot(en,d,'en-1440-light');
 }
 ok((await en.locator('[data-testid="rail-yours"] h2').textContent()).includes('Your turn'),'English: production heading');
 await en.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[],'console errors');
console.log(`${checks} checks passed`);
