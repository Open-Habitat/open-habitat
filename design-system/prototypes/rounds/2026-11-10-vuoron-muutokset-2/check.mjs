// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Walks the three variants at 1440 and 390 px, light and dark, with reduced
// motion, on the default turn (eight files): the Muutokset card is collapsed,
// its line says what the variant says, and the timeline button is on the
// line only in Aikajana rivillä. Each variant is also opened. Then at 1440
// light: rows and their diffs, binary, deleted, Avaa editorissa, the
// timeline behind its button, the one-small-edit turn, the running turn part
// way and played to its end, English, the keyboard, and the running mark's
// motion with and without reduced motion. At 390: no editor, the opened
// list and the timeline. Screenshots at device scale 2 named
// r2-v<n>-<variant>-<case>-<width>-<theme>.png; --quick takes only 1440 light.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-10-vuoron-muutokset-2';
const [input,out,flag]=process.argv.slice(2);
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['tiivis','nimet','aikajana'];
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};

async function open(width,theme,query='',motion='reduce'){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:900},deviceScaleFactor:2,reducedMotion:motion,hasTouch:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto(`http://prototype.test/?${query}`);
 await page.locator('#theme').selectOption(theme);
 return page;
}
const pick=async(page,d)=>{await page.locator('.proto-picker-item').nth(d).click();await page.locator(`.vm-review[data-direction="${d}"]`).waitFor({state:"attached"});await page.waitForTimeout(250);};
const card=page=>page.getByTestId('turn-changes');
const toggle=page=>page.getByTestId('changes-toggle');
const meta=async page=>(await page.getByTestId('changes-meta').textContent()).replace(/\s+/g,' ');
const into=async page=>{await card(page).scrollIntoViewIfNeeded();await page.locator('.ah-conversation-stream').evaluate(s=>{const c=s.querySelector('[data-testid="turn-changes"]');s.scrollTop+=c.getBoundingClientRect().top-s.getBoundingClientRect().top-s.clientHeight*0.18;});await page.waitForTimeout(100);};
const shot=(page,d,c,tag)=>page.screenshot({path:`${out}/r2-v${d+1}-${names[d]}-${c}-${tag}.png`});

try{
for(const width of quick?[1440]:[1440,390])for(const theme of quick?['light']:['light','dark']){
 const tag=`${width}-${theme}`;
 const page=await open(width,theme);
 await checkPicker(page,round);
 for(let d=0;d<3;d++){
  await pick(page,d);
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${names[d]} ${tag}: document overflow`);
  eq(await page.locator('.vm-lines li[aria-current]').count(),1,`${names[d]}: its line is marked`);
  eq(await page.getByTestId('history-stage-toggle').count(),2,`${names[d]}: two stage rows`);
  // Collapsed by default (Jari, round 1), in view under the reply.
  ok(await card(page).isVisible(),`${names[d]}: the card is in view`);
  eq(await toggle(page).getAttribute('aria-expanded'),'false',`${names[d]}: collapsed`);
  eq(await page.getByTestId('change-row').count(),0,`${names[d]}: no rows while collapsed`);
  ok((await meta(page)).includes('8 tiedostoa'),`${names[d]}: the line counts the files`);
  ok((await meta(page)).includes('+'),`${names[d]}: the line has line counts`);
  eq(await page.getByTestId('changes-names').count(),d===1?1:0,`${names[d]}: names on the line only in Nimet`);
  if(d===1){
   const n=await page.getByTestId('changes-names').textContent();
   ok(n.startsWith('korkeus.ts')&&n.includes('+4 muuta'),`nimet: first names and the rest counted (${n})`);
  }
  eq(await page.getByTestId('timeline-toggle').count(),d===2?1:0,`${names[d]}: timeline button on the collapsed line only in Aikajana rivillä`);
  const box=await card(page).boundingBox();
  ok(box.height<(width===390?90:60),`${names[d]} ${tag}: the collapsed card is one line (${box.height})`);
  await shot(page,d,'oletus',tag);
  // Opened: the list, every file once, all rows closed; the timeline button is there in every variant.
  await toggle(page).click();
  eq(await page.getByTestId('change-row').count(),8,`${names[d]}: eight files once each`);
  eq(await page.locator('[data-testid="change-row"][aria-expanded="true"]').count(),0,`${names[d]}: rows start closed`);
  eq(await page.getByTestId('timeline-toggle').count(),1,`${names[d]}: timeline button when open`);
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${names[d]} ${tag} open: document overflow`);
  await into(page);
  await shot(page,d,'auki',tag);
 }
 if(width===390&&theme==='light'){
  // A phone has no editor in production; the opened row and the timeline fit.
  await pick(page,0);
  await toggle(page).click();
  await page.locator('li[data-path="src/reitit/haku.ts"] [data-testid="change-row"]').click();
  eq(await page.getByTestId('open-editor').count(),0,'phone: no Avaa editorissa');
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'phone: an opened diff fits');
  await page.locator('li[data-path="src/reitit/haku.ts"]').scrollIntoViewIfNeeded();
  await shot(page,0,'tiedosto',tag);
  await pick(page,2);
  await page.getByTestId('timeline-toggle').click();
  eq(await page.getByTestId('timeline-row').count(),8,'phone: the timeline opens from the line');
  await page.locator('[data-testid="timeline-row"][data-path="src/reitit/haku.ts"] [data-testid="timeline-mark"]').nth(1).click();
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'phone: the timeline fits');
  await into(page);
  await shot(page,2,'aikajana',tag);
 }
 await page.close();
}

{
 const tag='1440-light';
 // The list: binary and deleted rows, several edits, the editor at the changed line.
 let page=await open(1440,'light');
 await pick(page,0);
 await toggle(page).click();
 eq(await page.locator('li[data-path="src/reitit/haku.ts"] [data-testid="edit-count"]').count(),1,'list: says haku.ts was edited several times');
 eq(await page.locator('[data-tag="created"]').count(),2,'list: two new files');
 eq(await page.locator('[data-tag="deleted"]').count(),1,'list: one deleted');
 eq(await page.locator('[data-tag="command"]').count(),2,'list: two by command');
 await page.locator('li[data-path="public/kuvakkeet/laavu.png"] [data-testid="change-row"]').click();
 await page.locator('li[data-path="src/vanha/kartta-legacy.ts"] [data-testid="change-row"]').click();
 eq(await page.getByTestId('binary-note').count(),1,'list: a binary file says it has no text diff');
 eq(await page.getByTestId('command-note').count(),2,'list: the command that changed them is named');
 eq(await page.locator('li[data-path="src/vanha/kartta-legacy.ts"] .ah-diff-remove').count(),22,'list: the deleted file\'s lines');
 eq(await page.locator('li[data-path="src/vanha/kartta-legacy.ts"] [data-testid="open-editor"]').count(),0,'list: a deleted file has no editor');
 await page.locator('li[data-path="public/kuvakkeet/laavu.png"]').scrollIntoViewIfNeeded();
 await shot(page,0,'binaari',tag);
 await page.locator('li[data-path="src/kartta/korkeus.ts"] [data-testid="change-row"]').click();
 await page.locator('li[data-path="src/kartta/korkeus.ts"] [data-testid="open-editor"]').click();
 ok((await page.getByTestId('editor-toast').textContent()).includes('src/kartta/korkeus.ts'),'list: the editor opened the file');
 await shot(page,0,'editori',tag);
 // Collapsing again hides the list.
 await toggle(page).click();
 eq(await page.getByTestId('change-row').count(),0,'list: collapses again');
 await page.close();

 // Timeline behind its button, in Tiivis from the opened header.
 page=await open(1440,'light');
 await pick(page,0);
 await toggle(page).click();
 await page.getByTestId('timeline-toggle').click();
 eq(await page.getByTestId('timeline-toggle').getAttribute('aria-pressed'),'true','tiivis: timeline on');
 eq(await page.getByTestId('timeline-row').count(),8,'timeline: eight tracks');
 eq(await page.getByTestId('timeline-mark').count(),10,'timeline: ten changes');
 eq(await page.locator('[data-testid="timeline-mark"][data-tool="bash"]').count(),2,'timeline: two by command');
 eq(await page.getByTestId('change-row').count(),0,'timeline: replaces the list');
 await page.locator('[data-testid="timeline-row"][data-path="src/reitit/haku.ts"] [data-testid="timeline-mark"]').nth(1).click();
 eq(await page.getByTestId('timeline-step').count(),3,'timeline: the chosen file\'s three edits');
 await page.getByTestId('timeline-final').click();
 eq(await page.locator('[data-testid="timeline-detail"] [data-testid="file-diff"]').count(),1,'timeline: Lopputulos is the net diff');
 await page.getByTestId('timeline-step').nth(1).click();
 await into(page);
 await shot(page,0,'aikajana',tag);
 await page.locator('[data-testid="timeline-row"][data-path="src/vanha/kartta-legacy.ts"] [data-testid="timeline-mark"]').click();
 eq(await page.getByTestId('command-note').count(),1,'timeline: a command\'s mark names it');
 await page.getByTestId('timeline-detail').scrollIntoViewIfNeeded();
 await shot(page,0,'komento',tag);
 await page.getByTestId('timeline-toggle').click();
 eq(await page.getByTestId('change-row').count(),8,'timeline: off returns to the list');
 // Aikajana rivillä: the collapsed line's button opens straight to the timeline.
 await pick(page,2);
 await page.getByTestId('timeline-toggle').click();
 eq(await toggle(page).getAttribute('aria-expanded'),'true','rivillä: the button opens the card');
 eq(await page.getByTestId('timeline-row').count(),8,'rivillä: straight to the timeline');
 await into(page);
 await shot(page,2,'aikajana',tag);
 await page.close();

 // One small edit: the line names the file instead of counting.
 page=await open(1440,'light','case=pieni');
 for(let d=0;d<3;d++){
  await pick(page,d);
  ok((await meta(page)).includes('README.md'),`pieni ${names[d]}: the line names the file`);
  eq(await page.getByTestId('changes-names').count(),0,`pieni ${names[d]}: no names line for one file`);
  await shot(page,d,'pieni',tag);
 }
 await toggle(page).click();
 eq(await page.getByTestId('change-row').count(),1,'pieni: one row');
 await page.close();

 // Running, stopped part way: what has changed so far, still collapsed.
 for(const [at,n] of [[70000,2],[95000,4]]){
  page=await open(1440,'light',`case=kesken&at=${at}`);
  for(let d=0;d<3;d++){
   await pick(page,d);
   eq(await page.getByTestId('turn-progress').count(),1,`kesken ${at}: the turn is running`);
   ok((await meta(page)).includes(`${n} tiedostoa`),`kesken ${at}: ${n} files so far on the line`);
   ok((await toggle(page).textContent()).includes('tähän mennessä'),`kesken ${at}: the line says so far`);
   if(at===95000)await shot(page,d,'kesken',tag);
  }
  await toggle(page).click();
  eq(await page.getByTestId('change-row').count(),n,`kesken ${at}: ${n} rows when opened`);
  eq(await page.locator('.vm-running').count(),1,`kesken ${at}: says the list grows`);
  if(at===95000){await into(page);await shot(page,2,'kesken-auki',tag);}
  await page.close();
 }
 // Played on, opened: the running list grows to the whole turn when it ends.
 page=await open(1440,'light','case=kesken&at=95000&warp=40');
 await pick(page,0);
 await toggle(page).click();
 await page.getByTestId('vm-pause').click();
 await page.getByTestId('turn-progress').waitFor({state:'detached',timeout:20000});
 await page.waitForTimeout(300);
 eq(await page.getByTestId('change-row').count(),8,'kesken: all eight when the turn ends');
 eq(await page.locator('.vm-running').count(),0,'kesken: no longer says it grows');
 ok(!(await toggle(page).textContent()).includes('tähän mennessä'),'kesken: the line no longer says so far');
 await page.close();

 // English.
 page=await open(1440,'light');
 await page.locator('#language').selectOption('en');
 for(let d=0;d<3;d++){
  await pick(page,d);
  ok((await meta(page)).includes('8 files'),`${names[d]}: English`);
  if(d===1)ok((await page.getByTestId('changes-names').textContent()).includes('+4 more'),'nimet: English');
  if(d===2)ok((await page.getByTestId('timeline-toggle').textContent()).includes('Timeline'),'rivillä: English');
  await shot(page,d,'oletus-en',tag);
 }
 await page.close();

 // Keyboard: the line opens with Enter and closes with Space.
 page=await open(1440,'light');
 await pick(page,1);
 await toggle(page).focus();
 await page.keyboard.press('Enter');
 eq(await toggle(page).getAttribute('aria-expanded'),'true','keyboard: Enter opens');
 await page.keyboard.press('Space');
 eq(await toggle(page).getAttribute('aria-expanded'),'false','keyboard: Space closes');
 ok((await toggle(page).getAttribute('aria-label')).includes('8 tiedostoa'),'keyboard: the line has a name');
 await page.close();

 // Motion: the running turn's mark moves, and stands still with reduced
 // motion from the system or from the page's Liike.
 for(const motion of ['no-preference','reduce']){
  page=await open(1440,'light','case=kesken&at=95000',motion);
  await pick(page,0);
  const moving=()=>page.locator('[data-testid="turn-progress"] *').evaluateAll(els=>els.some(e=>getComputedStyle(e).animationName!=='none'));
  if(motion==='reduce')eq(await moving(),false,'reduced motion: still');
  else{
   eq(await moving(),true,'the running mark moves');
   await page.locator('#motion').selectOption('reduce');
   eq(await moving(),false,'Liike Vähennetty: still');
  }
  await page.close();
 }
}
}finally{await browser.close();}
assert.deepEqual(errors,[],'console errors');
console.log(`${checks} checks passed`);
