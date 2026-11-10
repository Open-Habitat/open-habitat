// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Walks every direction at 1440 and 390 px, light and dark, with reduced
// motion, on the default turn (eight files): asserts what each direction
// shows of the turn's changes and that Nyt shows none. Then at 1440 light:
// the binary and deleted rows, Avaa editorissa and its absence on a phone,
// the one-small-edit turn, the running turn part way and played to its end,
// English, and the running mark's motion with and without reduced motion.
// Screenshots at device scale 2 named
// r1-d<n>-<direction>-<case>-<width>-<theme>.png; --quick takes only 1440
// light.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-10-vuoron-muutokset';
const [input,out,flag]=process.argv.slice(2);
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['nyt','yhteenveto','katselmointi','aikajana'];
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
const changes=page=>page.getByTestId('turn-changes');
const shot=(page,d,c,tag,full=false)=>page.screenshot({path:`${out}/r1-d${d}-${names[d]}-${c}-${tag}.png`,fullPage:full});

try{
for(const width of quick?[1440]:[1440,390])for(const theme of quick?['light']:['light','dark']){
 const tag=`${width}-${theme}`;
 const page=await open(width,theme);
 await checkPicker(page,round);
 for(let d=0;d<4;d++){
  await pick(page,d);
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${names[d]} ${tag}: document overflow`);
  eq(await page.locator('.vm-lines li[aria-current]').count(),1,`${names[d]}: its line is marked`);
  // Production's turn is the same in every direction: two folded stages.
  eq(await page.getByTestId('history-stage-toggle').count(),2,`${names[d]}: two stage rows`);
  eq(await page.locator('[data-testid="history-stage-toggle"][aria-expanded="true"]').count(),0,`${names[d]}: stages folded`);
  if(d===0){
   eq(await changes(page).count(),0,'nyt: no overall view');
   eq(await page.getByTestId('review-panel').count(),0,'nyt: no panel');
  }
  if(d===1){
   eq(await page.getByTestId('change-row').count(),8,'yhteenveto: eight files once each');
   eq(await page.locator('[data-testid="change-row"][aria-expanded="true"]').count(),1,'yhteenveto: the file edited three times is open');
   eq(await page.locator('li[data-path="src/reitit/haku.ts"] [data-testid="edit-count"]').count(),1,'yhteenveto: says it was edited several times');
   eq(await page.locator('[data-tag="created"]').count(),2,'yhteenveto: two new files');
   eq(await page.locator('[data-tag="deleted"]').count(),1,'yhteenveto: one deleted');
   eq(await page.locator('[data-tag="command"]').count(),2,'yhteenveto: two by command');
   ok(await changes(page).isVisible(),'yhteenveto: in view on the default page');
  }
  if(d===2){
   const panel=page.getByTestId('review-panel');
   ok(await panel.isVisible(),'katselmointi: the panel is open');
   eq(await panel.getByTestId('review-file').count(),8,'katselmointi: eight files');
   eq(await panel.locator('[data-testid="review-file"][aria-current]').locator('.vm-base').textContent(),'haku.ts','katselmointi: starts at the file edited three times');
   const pb=await panel.boundingBox(),fb=await page.locator('.ah-conversation-frame').boundingBox();
   if(width===1440)ok(pb.x>=fb.x+fb.width-1,'katselmointi: beside the conversation');
   else ok(pb.width>=width-2,'katselmointi: its own view on a phone');
   eq(await page.getByTestId('review-position').textContent(),'2 / 8','katselmointi: position');
  }
  if(d===3){
   eq(await page.getByTestId('timeline-row').count(),8,'aikajana: eight tracks');
   eq(await page.getByTestId('timeline-mark').count(),10,'aikajana: ten changes');
   eq(await page.locator('[data-testid="timeline-mark"][data-tool="bash"]').count(),2,'aikajana: two by command');
   eq(await page.locator('[data-testid="timeline-mark"][aria-pressed="true"]').count(),1,'aikajana: one change chosen');
   eq(await page.getByTestId('timeline-step').count(),3,'aikajana: the chosen file\'s three edits');
   ok(await changes(page).isVisible(),'aikajana: in view on the default page');
  }
  await shot(page,d,'oletus',tag);
 }
 if(width===390){
  // A phone has no editor in production: no button to open one.
  await pick(page,1);
  eq(await page.getByTestId('open-editor').count(),0,'phone: no Avaa editorissa');
  await pick(page,2);
  await page.getByTestId('review-close').click();
  eq(await page.getByTestId('review-panel').count(),0,'phone: back to the conversation');
  ok(await page.getByTestId('review-open').isVisible(),'phone: the conversation offers the panel again');
 }
 await page.close();
}

{
 const tag='1440-light';
 // Yhteenveto: the binary and deleted rows, and the editor at the changed line.
 let page=await open(1440,'light');
 await pick(page,1);
 await page.locator('li[data-path="public/kuvakkeet/laavu.png"] [data-testid="change-row"]').click();
 await page.locator('li[data-path="src/vanha/kartta-legacy.ts"] [data-testid="change-row"]').click();
 await page.locator('li[data-path="src/reitit/haku.ts"] [data-testid="change-row"]').click();
 eq(await page.getByTestId('binary-note').count(),1,'yhteenveto: a binary file says it has no text diff');
 eq(await page.getByTestId('command-note').count(),2,'yhteenveto: the command that changed them is named');
 eq(await page.locator('li[data-path="src/vanha/kartta-legacy.ts"] .ah-diff-remove').count(),22,'yhteenveto: the deleted file\'s lines');
 eq(await page.locator('li[data-path="src/vanha/kartta-legacy.ts"] [data-testid="open-editor"]').count(),0,'yhteenveto: a deleted file has no editor');
 await page.locator('li[data-path="public/kuvakkeet/laavu.png"]').scrollIntoViewIfNeeded();
 await shot(page,1,'binaari',tag);
 await page.locator('li[data-path="src/kartta/korkeus.ts"] [data-testid="change-row"]').click();
 await page.locator('li[data-path="src/kartta/korkeus.ts"] [data-testid="open-editor"]').click();
 ok((await page.getByTestId('editor-toast').textContent()).includes('src/kartta/korkeus.ts'),'yhteenveto: the editor opened the file');
 await shot(page,1,'editori',tag);
 await page.close();

 // Katselmointi: Seuraava steps to the next file; the editor opens at its first change.
 page=await open(1440,'light');
 await pick(page,2);
 await page.getByTestId('review-next').click();
 eq(await page.getByTestId('review-position').textContent(),'3 / 8','katselmointi: Seuraava');
 await page.getByTestId('review-next').click();await page.getByTestId('review-next').click();
 eq(await page.locator('[data-testid="review-file"][aria-current]').locator('.vm-base').textContent(),'kartta-legacy.ts','katselmointi: on to the deleted file');
 await shot(page,2,'poistettu',tag);
 await page.getByTestId('review-close').click();
 eq(await page.getByTestId('review-panel').count(),0,'katselmointi: closes');
 await page.getByTestId('review-open').click();
 eq(await page.getByTestId('review-panel').count(),1,'katselmointi: opens again from the reply');
 await page.close();

 // Aikajana: one edit at a time, and the result.
 page=await open(1440,'light');
 await pick(page,3);
 await page.getByTestId('timeline-final').click();
 eq(await page.locator('[data-testid="timeline-detail"] [data-testid="file-diff"]').count(),1,'aikajana: Lopputulos is the net diff');
 await page.locator('[data-testid="timeline-row"][data-path="src/vanha/kartta-legacy.ts"] [data-testid="timeline-mark"]').click();
 eq(await page.getByTestId('command-note').count(),1,'aikajana: a command\'s mark names it');
 await page.getByTestId('timeline-detail').scrollIntoViewIfNeeded();
 await shot(page,3,'komento',tag);
 await page.close();

 // One small edit: every direction has one file.
 page=await open(1440,'light','case=pieni');
 for(let d=0;d<4;d++){
  await pick(page,d);
  if(d===1)eq(await page.getByTestId('change-row').count(),1,'pieni: one row');
  if(d===2)eq(await page.getByTestId('review-file').count(),1,'pieni: one file');
  if(d===3)eq(await page.getByTestId('timeline-mark').count(),1,'pieni: one mark');
  await shot(page,d,'pieni',tag);
 }
 await page.close();

 // Running, stopped part way: what has changed so far.
 for(const [at,n] of [[70000,2],[95000,4]]){
  page=await open(1440,'light',`case=kesken&at=${at}`);
  for(let d=0;d<4;d++){
   await pick(page,d);
   eq(await page.getByTestId('turn-progress').count(),1,`kesken ${at}: the turn is running`);
   if(d===1)eq(await page.getByTestId('change-row').count(),n,`kesken ${at}: ${n} files so far`);
   if(d===2)eq(await page.getByTestId('review-file').count(),n,`kesken ${at}: ${n} files so far`);
   if(d===3)ok(await page.locator('.vm-tl-now').count()>0,`kesken ${at}: the timeline marks now`);
   if(d>0)eq(await page.locator('.vm-running').count(),1,`kesken ${at}: says the list grows`);
   if(at===95000)await shot(page,d,'kesken',tag);
  }
  await page.close();
 }
 // Played on: the running list grows to the whole turn when it ends.
 page=await open(1440,'light','case=kesken&at=95000&warp=40');
 await pick(page,1);
 await page.getByTestId('vm-pause').click();
 await page.getByTestId('turn-progress').waitFor({state:'detached',timeout:20000});
 await page.waitForTimeout(300);
 eq(await page.getByTestId('change-row').count(),8,'kesken: all eight when the turn ends');
 eq(await page.locator('.vm-running').count(),0,'kesken: no longer says it grows');
 await page.close();

 // English.
 page=await open(1440,'light');
 await page.locator('#language').selectOption('en');
 for(const d of [1,2,3]){
  await pick(page,d);
  ok((await page.locator('.vm-head-meta').first().textContent()).includes('8 files'),`${names[d]}: English`);
  await shot(page,d,'oletus-en',tag);
 }
 await page.close();

 // Motion: the running turn's mark moves, and stands still with reduced
 // motion from the system or from the page's Liike.
 for(const motion of ['no-preference','reduce']){
  page=await open(1440,'light','case=kesken&at=95000',motion);
  await pick(page,1);
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
