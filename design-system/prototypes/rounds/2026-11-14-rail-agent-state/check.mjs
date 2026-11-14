// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Walks Nyt and the three directions at 1440 and 390 px in the three themes
// (Päivä, Yö, Kontrasti): every row is in the section its direction says,
// the declared lines are where the direction puts them (Agentin rivi: four,
// Sama kieli: only the question, Kysymysrivi: none but two question rows),
// the declared waiting-for-workers row carries the background mark, and the
// document does not overflow. At 390 the rail opens from the menu. Then at
// 1440 Päivä on Agentin rivi and Kysymysrivi: the worker's question
// escalates to Sinun vuorosi, the person's message ends a declaration, the
// workers finishing ends another. English last. Screenshots at device scale
// 2 named <n>-<direction>-<width>-<theme>.png; --quick takes only 1440 light.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-14-rail-agent-state';
const [input,out,flag]=process.argv.slice(2);
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['nyt','agentin-rivi','sama-kieli','kysymysrivi'];
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};

async function open(width,theme){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:1000},deviceScaleFactor:2,reducedMotion:'reduce',hasTouch:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 return page;
}
const pick=async(page,d)=>{await page.locator('.proto-picker-item').nth(d).click();await page.locator(`.ra-review[data-direction="${d}"]`).waitFor({state:'attached'});await page.waitForTimeout(150);};
const shot=(page,d,tag)=>page.screenshot({path:`${out}/${d}-${names[d]}-${tag}.png`});
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const inSection=(page,section,id)=>page.locator(`[data-testid="${section}"] [data-testid="agent-item-${id}"]`).count();
const mark=(page,id)=>page.locator(`[data-testid="agent-item-${id}"]`).getAttribute('data-mark');

async function sections(page,d,at){
 // Nyt: the done conversation still waits for the person as a new reply.
 eq(await inSection(page,'rail-yours','glossary'),d===0?1:0,`${at}: glossary in Sinun vuorosi only today`);
 eq(await inSection(page,'rail-quiet','glossary'),d===0?0:1,`${at}: glossary quiet when declared done`);
 eq(await inSection(page,'rail-yours','notice'),1,`${at}: the escalated question waits for you`);
 eq(await inSection(page,'rail-yours','a11y'),1,`${at}: an observed new reply waits for you`);
 for(const id of ['release','tiles','elevation','backups'])
  eq(await inSection(page,'rail-running',id),1,`${at}: ${id} in Käynnissä`);
 eq(await inSection(page,'rail-quiet','receipts'),1,`${at}: receipts quiet`);
 const lines=page.getByTestId('declared-line');
 eq(await lines.count(),[0,4,1,0][d],`${at}: declared lines`);
 eq(await page.locator('[data-testid^="question-row-"]').count(),d===3?2:0,`${at}: question rows`);
 if(d>0){
  eq(await mark(page,'tiles'),'background',`${at}: declared wait has the background mark`);
  eq(await mark(page,'notice'),'waiting',`${at}: a question has the waiting mark`);
  eq(await mark(page,'backups'),'working',`${at}: a stale declaration falls back to the observation`);
 }
 if(d===1){
  eq(await page.locator('[data-testid="agent-item-backups"] [data-tone="stale"]').count(),1,`${at}: stale says stale`);
  eq(await page.locator('[data-testid="agent-item-elevation"] [data-tone="worker"]').count(),1,`${at}: the worker's question on the parent row`);
 }
 if(d===3){
  eq(await page.locator('[data-testid="rail-running"] [data-testid="question-row-elevation"]').count(),1,`${at}: the worker's question in Käynnissä while the agent answers`);
  eq(await page.locator('[data-testid="rail-yours"] [data-testid="question-row-notice"]').count(),1,`${at}: the agent's question in Sinun vuorosi`);
 }
 // The line never pushes the row wider than the rail.
 for(const l of await lines.all()){
  const box=await l.boundingBox();const rail=await page.locator('.ah-rail').boundingBox();
  ok(box&&rail&&box.x+box.width<=rail.x+rail.width+1,`${at}: line inside the rail`);
 }
}

try{
for(const width of quick?[1440]:[1440,390])for(const theme of quick?['light']:['light','dark','contrast']){
 const tag=`${width}-${theme}`;
 const page=await open(width,theme);
 await checkPicker(page,round);
 eq(await page.getByTestId('recommendation').count(),1,'the recommendation is on the page');
 for(let d=0;d<4;d++){
  await pick(page,d);
  const at=`${names[d]} ${tag}`;
  eq(await page.locator('.ra-lines li[aria-current]').count(),1,`${at}: its line is marked`);
  if(width===390){
   await page.getByTestId('navigation-open').click();
   await page.waitForTimeout(250);
   ok(await page.locator('[data-testid="rail-yours"]').isVisible(),`${at}: the rail opens from the menu`);
  }
  ok(await fits(page),`${at}: document overflow`);
  await sections(page,d,at);
  await shot(page,d,tag);
  if(width===390){await page.keyboard.press('Escape');await page.waitForTimeout(150);}
 }
 await page.close();
}

{
 const page=await open(1440,'light');
 for(const d of [1,3]){
  await pick(page,d);
  const at=`events ${names[d]}`;
  await page.getByTestId('event-escalate').click();
  eq(await inSection(page,'rail-yours','elevation'),1,`${at}: the escalated worker question reaches Sinun vuorosi`);
  eq(await mark(page,'elevation'),'waiting',`${at}: escalated mark`);
  if(d===1)ok((await page.locator('[data-testid="agent-item-elevation"] [data-testid="declared-line"]').textContent()).includes('Korkeusdata'),`${at}: says which worker asked`);
  if(d===3)eq(await page.locator('[data-testid="rail-yours"] [data-testid="question-row-elevation"]').count(),1,`${at}: question row moves with it`);
  await page.getByTestId('event-write').click();
  eq(await inSection(page,'rail-running','notice'),1,`${at}: writing ends the declaration; the turn runs`);
  eq(await mark(page,'notice'),'working',`${at}: notice works`);
  ok((await page.getByTestId('story-notice').textContent()).includes('kirjoitit'),`${at}: the story says why it ended`);
  await page.getByTestId('event-workers').click();
  eq(await mark(page,'tiles'),'working',`${at}: workers finished, the agent carries on`);
  await shot(page,d,'events-1440-light');
  await page.getByTestId('event-reset').click();
  eq(await inSection(page,'rail-running','elevation'),1,`${at}: reset`);
 }
 await page.close();

 const en=await open(1440,'light');
 await en.locator('#language').selectOption('en');
 await pick(en,1);
 ok((await en.locator('[data-testid="rail-yours"] h2').textContent()).includes('Your turn'),'English: production heading');
 ok((await en.locator('[data-testid="agent-item-tiles"] [data-testid="declared-line"]').textContent()).includes('Waiting for two workers'),'English: the agent\'s line');
 await shot(en,1,'en-1440-light');
 await en.close();
 const enPhone=await open(390,'dark');
 await enPhone.locator('#language').selectOption('en');
 await pick(enPhone,1);
 await enPhone.getByTestId('navigation-open').click();
 await enPhone.waitForTimeout(250);
 ok(await fits(enPhone),'English phone fits');
 await shot(enPhone,1,'en-390-dark');
 await enPhone.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[],'console errors');
console.log(`${checks} checks passed`);
