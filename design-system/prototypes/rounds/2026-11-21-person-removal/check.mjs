// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Walks the three directions at 1440 and 390 px in Päivä, Yö and Kontrasti
// with reduced motion. The default view in each: the direction's own
// confirmation open for @mikko-l over Käyttäjät ja pääsy, no overflow. Then,
// in Päivä and Yö, each direction's flow: the stages on both lists, the sum
// of limits on Levytila (128,5 → 102,7 → 88,5 GiB), the undo, the error
// mid-removal and its retry. English last. Screenshots at device scale 2.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-21-person-removal';
const [input,out,flag]=process.argv.slice(2);
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['armonaika','luettelo','arkisto'];
const dialogs=['grace-dialog','list-dialog','archive-dialog'];
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};

async function open(width,theme,lang='fi',d=0){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:1000},deviceScaleFactor:2,reducedMotion:'reduce',hasTouch:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto(`http://prototype.test/?theme=${theme}${lang==='en'?'&lang=en':''}`);
 if(d)await pick(page,d);
 await page.locator(`.ra-review[data-direction="${d}"]`).waitFor({state:'attached'});
 return page;
}
// Picking remounts the direction with its default view; picking the current
// one would only close the dialog, so R remounts it.
async function pick(page,d){
 const cur=await page.locator('.ra-review').getAttribute('data-direction');
 if(String(d)===cur){await page.keyboard.press('Escape');await page.waitForTimeout(100);await page.keyboard.press('r');}
 else await page.locator('.proto-picker-item').nth(d).click();
 await page.locator(`.ra-review[data-direction="${d}"]`).waitFor({state:'attached'});
 await page.waitForTimeout(200);
}
const shot=(page,name)=>page.screenshot({path:`${out}/${name}.png`});
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const has=async(page,id)=>(await page.getByTestId(id).count())>0;
const text=async(page,id)=>(await page.getByTestId(id).first().textContent())??'';
const view=async(page,v)=>{await page.getByTestId(`settings-${v}`).click();await page.getByTestId(`settings-section-${v}`).waitFor();await page.waitForTimeout(100);};
const worst=page=>page.getByTestId('server-storage').getAttribute('data-worst');
const mark=page=>text(page,'access-state-mikko');
const stage=(page,id='mikko')=>page.getByTestId(`access-row-${id}`).getAttribute('data-stage');
async function until(page,id,want,ms=6000){
 await page.waitForFunction(([i,w])=>document.querySelector(`[data-testid="access-row-${i}"]`)?.dataset.stage===w,[id,want],{timeout:ms});
}
async function closeDialog(page){await page.keyboard.press('Escape');await page.waitForTimeout(200);ok(!(await page.locator('.ah-overlay').count()),'dialog closed');}

async function defaultView(page,d,at){
 ok(await page.getByTestId(dialogs[d]).isVisible(),`${at}: the direction's confirmation is open`);
 for(const other of dialogs.filter((_,i)=>i!==d))eq(await page.getByTestId(other).count(),0,`${at}: not ${other}`);
 eq(await page.locator('.ra-lines li[aria-current]').count(),1,`${at}: its line is marked`);
 ok((await page.getByTestId(dialogs[d]).textContent()).includes('@mikko-l'),`${at}: names the person`);
 if(d===0){
  ok((await text(page,'grace-when')).includes('28.11.'),`${at}: says when the data goes`);
  ok(await page.getByTestId('inventory-short').isVisible(),`${at}: short inventory`);
 }
 if(d===1){
  eq(await page.locator('[data-testid="inventory"] li').count(),6,`${at}: full inventory`);
  ok((await text(page,'inventory')).includes('/home/mikko-l'),`${at}: the home's path`);
 }
 if(d===2)ok((await text(page,'archive-path')).includes('mikko-l-2026-11-21.tar.zst'),`${at}: the archive's path`);
 ok(await fits(page),`${at}: overflow with the dialog`);
}

async function startState(page,at){
 await closeDialog(page);
 eq(await mark(page),'Käyttäjä',`${at}: mikko a user`);
 eq(await text(page,'access-state-sanna'),'Ei pääsyä',`${at}: sanna no access`);
 ok(await fits(page),`${at}: list overflow`);
 await view(page,'levy');
 eq(await worst(page),'128.50',`${at}: sum of limits at start`);
 ok(await has(page,'storage-over'),`${at}: overcommitted at start`);
 eq(await page.getByTestId('administration-user-sanna-v').getAttribute('data-stage'),'noaccess',`${at}: sanna on Levytila without access`);
 ok(await fits(page),`${at}: storage overflow`);
 await view(page,'kayttajat');
}

/** 1 Armonaika: grace, its countdown, undo on Levytila, the error at the end, retry. */
async function graceFlow(page,tag){
 const at=`armonaika ${tag}`;
 await page.getByTestId('remove-mikko').click();
 await page.getByTestId('grace-confirm').click();
 await page.waitForTimeout(150);
 eq(await stage(page),'grace',`${at}: in grace`);
 eq(await mark(page),'Poistetaan 7 pv päästä',`${at}: the countdown mark`);
 ok(await page.getByTestId('undo-mikko').isVisible(),`${at}: Peru poisto on the row`);
 await shot(page,`0-${names[0]}-${tag}-access-grace`);
 await view(page,'levy');
 eq(await worst(page),'102.70',`${at}: the limit leaves the sum at once`);
 ok(!(await has(page,'storage-over')),`${at}: the warning clears`);
 ok(await page.getByTestId('storage-undo-mikko').isVisible(),`${at}: undo on Levytila`);
 ok(await fits(page),`${at}: storage overflow in grace`);
 await shot(page,`0-${names[0]}-${tag}-storage-grace`);
 await page.getByTestId('storage-undo-mikko').click();
 eq(await worst(page),'128.50',`${at}: undo restores the limit`);
 await view(page,'kayttajat');
 eq(await mark(page),'Käyttäjä',`${at}: undo restores access`);
 await page.getByTestId('remove-mikko').click();
 await page.getByTestId('grace-confirm').click();
 await page.getByTestId('event-day').click();
 eq(await mark(page),'Poistetaan 6 pv päästä',`${at}: a day later`);
 await page.getByTestId('event-fail').check();
 await page.getByTestId('event-week').click();
 await until(page,'mikko','failed');
 ok((await text(page,'access-failed-mikko')).includes('3 / 5'),`${at}: steps done`);
 eq(await page.locator('[data-testid="access-steps-mikko"] li[data-state="failed"]').getAttribute('data-step'),'home',`${at}: failed at home`);
 ok(await fits(page),`${at}: overflow when failed`);
 await shot(page,`0-${names[0]}-${tag}-access-failed`);
 await view(page,'levy');
 eq(await worst(page),'102.70',`${at}: nothing freed yet`);
 await shot(page,`0-${names[0]}-${tag}-storage-failed`);
 await page.getByTestId('storage-retry-mikko').click();
 await view(page,'kayttajat');
 await until(page,'mikko','removed');
 eq(await mark(page),'Poistettu',`${at}: removed`);
 ok((await text(page,'access-filter')).includes('Poistetut 2'),`${at}: counted as removed`);
 await view(page,'levy');
 eq(await worst(page),'88.50',`${at}: sum after removal`);
 eq(await page.getByTestId('administration-user-mikko-l').count(),0,`${at}: off Levytila`);
 await shot(page,`0-${names[0]}-${tag}-storage-removed`);
 await view(page,'kayttajat');
}

/** 2 Luettelo: two presses, progress in the window, error and retry; access only. */
async function listFlow(page,tag){
 const at=`luettelo ${tag}`;
 await page.getByTestId('event-fail').check();
 await page.getByTestId('remove-mikko').click();
 await page.getByTestId('list-confirm').click();
 eq(await text(page,'list-confirm'),'Vahvista poisto',`${at}: armed`);
 ok((await text(page,'armed-note')).includes('uudelleen'),`${at}: says press again`);
 await shot(page,`1-${names[1]}-${tag}-armed`);
 await page.getByTestId('list-confirm').click();
 await page.getByTestId('dialog-retry').waitFor({timeout:6000});
 ok((await text(page,'list-dialog-title')).includes('poisto kesken'),`${at}: unfinished in the window`);
 ok(await fits(page),`${at}: overflow when failed`);
 await shot(page,`1-${names[1]}-${tag}-failed`);
 await page.getByTestId('dialog-retry').click();
 await page.getByTestId('list-freed').waitFor({timeout:6000});
 ok((await text(page,'list-freed')).includes('14,2 GiB'),`${at}: freed`);
 await page.getByTestId('dialog-close').click();
 eq(await stage(page),'removed',`${at}: removed`);
 eq(await page.getByTestId('undo-mikko').count(),0,`${at}: no undo`);
 await page.getByTestId('remove-olli').click();
 await page.getByTestId('access-only').click();
 eq(await text(page,'access-state-olli'),'Ei pääsyä',`${at}: access only`);
 await view(page,'levy');
 eq(await worst(page),'76.40',`${at}: olli counted by use`);
 await shot(page,`1-${names[1]}-${tag}-storage`);
 await view(page,'kayttajat');
}

/** 3 Arkisto: archive then removal on the row, restore; no archive asks twice. */
async function archiveFlow(page,tag){
 const at=`arkisto ${tag}`;
 await page.getByTestId('remove-mikko').click();
 await page.getByTestId('archive-confirm').click();
 await page.waitForTimeout(100);
 eq(await mark(page),'Arkistoidaan…',`${at}: archiving on the row`);
 await shot(page,`2-${names[2]}-${tag}-archiving`);
 await until(page,'mikko','removed');
 ok((await text(page,'archive-kept-mikko')).includes('21.12.'),`${at}: archive kept`);
 ok(await page.getByTestId('restore-mikko').isVisible(),`${at}: restore offered`);
 await shot(page,`2-${names[2]}-${tag}-removed`);
 await view(page,'levy');
 eq(await worst(page),'88.50',`${at}: sum after removal`);
 ok((await text(page,'archives-figure')).includes('11,4 GiB'),`${at}: archive on the disk`);
 ok(await fits(page),`${at}: storage overflow`);
 await shot(page,`2-${names[2]}-${tag}-storage`);
 await view(page,'kayttajat');
 await page.getByTestId('restore-mikko').click();
 eq(await mark(page),'Ei pääsyä',`${at}: restored without access`);
 await page.getByTestId('remove-sanna').click();
 await page.getByTestId('archive-toggle').uncheck();
 eq(await text(page,'archive-confirm'),'Poista ilman arkistoa',`${at}: no archive`);
 await page.getByTestId('archive-confirm').click();
 eq(await text(page,'archive-confirm'),'Vahvista poisto',`${at}: asks twice`);
 await page.getByTestId('archive-confirm').click();
 await until(page,'sanna','removed');
 eq(await page.getByTestId('archive-kept-sanna').count(),0,`${at}: no archive kept`);
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
   await startState(page,`${names[d]} ${tag}`);
   await [graceFlow,listFlow,archiveFlow][d](page,tag);
  }
 }
 await page.close();
}
{
 const en=await open(1440,'light','en');
 ok((await en.getByTestId('grace-dialog').textContent()).includes('Remove @mikko-l?'),'English: question');
 eq(await en.getByTestId('grace-confirm').textContent(),'Remove in 7 days','English: action');
 await shot(en,'en-0-armonaika-1440-light');
 await en.getByTestId('grace-confirm').click();
 eq(await en.getByTestId('access-state-mikko').textContent(),'Deleted in 7 days','English: countdown');
 await pick(en,1);
 eq(await en.locator('[data-testid="inventory"] li').count(),6,'English: inventory');
 ok((await en.getByTestId('list-dialog').textContent()).includes('Removal cannot be undone.'),'English: no undo');
 await shot(en,'en-1-luettelo-1440-light');
 await en.close();
 const enPhone=await open(390,'dark','en',2);
 ok((await enPhone.getByTestId('archive-dialog').textContent()).includes('only the server'),'English phone: who reaches the archive');
 ok(await fits(enPhone),'English phone fits');
 await shot(enPhone,'en-2-arkisto-390-dark');
 await enPhone.close();
}
}catch(e){console.log("errors:",errors);throw e;}finally{await browser.close();}
assert.deepEqual(errors,[],'console errors');
console.log(`${checks} checks passed`);
