// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Walks the three directions at 1440 and 390 px in Päivä, Yö and Kontrasti
// with reduced motion. The default view in each: the direction's first
// dialog open for @mikko-l over Käyttäjät ja pääsy, no overflow. Then, in
// Päivä and Yö, each direction's flow: the typed login, the stages on both
// lists, the sum of limits on Levytila (128,5 → 102,7 → 88,5 GiB), cancel
// leaving access withdrawn, the interrupted removal (files_remain) and its
// retry. English last. Screenshots at device scale 2 into <out-dir>.
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
const names=['armonaika','heti','vaiheittain'];
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
const mark=(page,id='mikko')=>text(page,`access-state-${id}`);
const stage=(page,id='mikko')=>page.getByTestId(`access-row-${id}`).getAttribute('data-stage');
async function until(page,id,want,ms=6000){
 await page.waitForFunction(([i,w])=>document.querySelector(`[data-testid="access-row-${i}"]`)?.dataset.stage===w,[id,want],{timeout:ms});
}
async function closeDialog(page){await page.keyboard.press('Escape');await page.waitForTimeout(200);ok(!(await page.locator('.ah-overlay').count()),'dialog closed');}
/** The typed login gates the confirmation. */
async function typeLogin(page,login,at){
 ok(await page.getByTestId('remove-confirm').isDisabled(),`${at}: confirm waits for the login`);
 await page.getByTestId('type-login').fill('mikko');
 ok(await page.getByTestId('remove-confirm').isDisabled(),`${at}: a partial login does not confirm`);
 await page.getByTestId('type-login').fill(login);
 ok(await page.getByTestId('remove-confirm').isEnabled(),`${at}: the login confirms`);
}

async function defaultView(page,d,at){
 const dialog=d===2?'access-dialog':'remove-dialog';
 ok(await page.getByTestId(dialog).isVisible(),`${at}: the direction's dialog is open`);
 eq(await page.locator('.ra-lines li[aria-current]').count(),1,`${at}: its line is marked`);
 ok((await page.getByTestId(dialog).textContent()).includes('@mikko-l'),`${at}: names the person`);
 if(d===0){
  ok(await page.getByTestId('when-grace').isChecked(),`${at}: 14 days chosen`);
  ok((await text(page,'home-line')).includes('5.12.'),`${at}: the home goes on 5.12.`);
  eq(await text(page,'remove-confirm'),'Poista 5.12.',`${at}: the action names the day`);
 }
 if(d===1){
  eq(await page.getByTestId('when').count(),0,`${at}: no choice`);
  ok((await text(page,'home-line')).includes('heti'),`${at}: the home goes now`);
  eq(await text(page,'remove-confirm'),'Poista pysyvästi',`${at}: permanent`);
 }
 if(d===2)ok((await text(page,'access-stays')).includes('Poista henkilö'),`${at}: removal is the next step`);
 if(d!==2){
  const words=await text(page,'consequences');
  for(const w of ['kotisivu','GitHub','Google','keskustelu'])ok(!words.includes(w),`${at}: nothing of the home is named (${w})`);
  ok(words.includes('14,2 GiB'),`${at}: the home's size`);
 }
 ok(await fits(page),`${at}: overflow with the dialog`);
}

async function startState(page,at){
 await closeDialog(page);
 eq(await mark(page),'Käyttäjä',`${at}: mikko a user`);
 eq(await mark(page,'sanna'),'Ei pääsyä',`${at}: sanna no access`);
 eq(await page.getByTestId('remove-aino').count(),0,`${at}: no removing oneself`);
 ok(await fits(page),`${at}: list overflow`);
 await view(page,'levy');
 eq(await worst(page),'128.50',`${at}: sum of limits at start`);
 ok(await has(page,'storage-over'),`${at}: overcommitted at start`);
 eq(await page.getByTestId('administration-user-sanna-v').getAttribute('data-stage'),'noaccess',`${at}: sanna counted by use`);
 ok(await fits(page),`${at}: storage overflow`);
 await view(page,'kayttajat');
}

/** 1 Armonaika: schedule, cancel to no access, schedule again, the error at the end, retry; Poista heti. */
async function graceFlow(page,tag){
 const at=`armonaika ${tag}`;
 await page.getByTestId('remove-mikko').click();
 await typeLogin(page,'@mikko-l',at);
 await page.getByTestId('remove-confirm').click();
 await page.waitForTimeout(150);
 eq(await stage(page),'scheduled',`${at}: scheduled`);
 eq(await mark(page),'Poistetaan 5.12.',`${at}: the row's mark`);
 eq(await text(page,'access-days-mikko'),'14 pv jäljellä',`${at}: days left`);
 ok(await page.getByTestId('cancel-mikko').isVisible(),`${at}: Peru poisto on the row`);
 await shot(page,`0-${names[0]}-${tag}-access-scheduled`);
 await view(page,'levy');
 eq(await worst(page),'102.70',`${at}: the limit leaves the sum at once`);
 ok(!(await has(page,'storage-over')),`${at}: the warning clears`);
 ok(await fits(page),`${at}: storage overflow when scheduled`);
 await shot(page,`0-${names[0]}-${tag}-storage-scheduled`);
 await page.getByTestId('storage-cancel-mikko').click();
 eq(await page.getByTestId('administration-user-mikko-l').getAttribute('data-stage'),'noaccess',`${at}: cancel leaves access withdrawn`);
 eq(await worst(page),'102.70',`${at}: still counted by use`);
 await view(page,'kayttajat');
 eq(await mark(page),'Ei pääsyä',`${at}: no access after cancel`);
 eq(await page.getByTestId('withdraw-mikko').count(),0,`${at}: no withdrawal on a withdrawn row`);
 await page.getByTestId('remove-mikko').click();
 ok((await text(page,'consequences')).includes('jo poistettu'),`${at}: says access is already gone`);
 await page.getByTestId('type-login').fill('mikko-l');
 await page.getByTestId('remove-confirm').click();
 await page.getByTestId('event-day').click();
 eq(await text(page,'access-days-mikko'),'13 pv jäljellä',`${at}: a day later`);
 await page.getByTestId('event-fail').check();
 await page.getByTestId('event-grace').click();
 await until(page,'mikko','failed');
 ok((await text(page,'access-failed-mikko')).includes('files_remain'),`${at}: the fixed reason`);
 ok((await text(page,'access-failed-mikko')).includes('4 / 6'),`${at}: steps done`);
 eq(await page.locator('[data-testid="access-steps-mikko"] li[data-state="failed"]').getAttribute('data-step'),'space',`${at}: failed proving the space free`);
 eq(await page.getByTestId('cancel-mikko').count(),0,`${at}: no cancel after the data stage began`);
 ok(await fits(page),`${at}: overflow when failed`);
 await shot(page,`0-${names[0]}-${tag}-access-failed`);
 await view(page,'levy');
 eq(await worst(page),'88.80',`${at}: what is left still counts`);
 await shot(page,`0-${names[0]}-${tag}-storage-failed`);
 await page.getByTestId('storage-retry-mikko').click();
 await view(page,'kayttajat');
 await until(page,'mikko','removed');
 eq(await mark(page),'Poistettu',`${at}: removed`);
 ok((await text(page,'services-mikko')).includes('1 peruttu'),`${at}: provider counts`);
 ok((await text(page,'access-filter')).includes('Poistetut 2'),`${at}: counted as removed`);
 await shot(page,`0-${names[0]}-${tag}-access-removed`);
 await view(page,'levy');
 eq(await worst(page),'88.50',`${at}: sum after removal`);
 eq(await page.getByTestId('administration-user-mikko-l').count(),0,`${at}: off Levytila`);
 await view(page,'kayttajat');
 await page.getByTestId('remove-olli').click();
 await page.getByTestId('when-now').check();
 ok((await text(page,'home-line')).includes('heti'),`${at}: now says now`);
 await page.getByTestId('type-login').fill('olli-p');
 eq(await text(page,'remove-confirm'),'Poista heti',`${at}: remove now`);
 await page.getByTestId('remove-confirm').click();
 await until(page,'olli','removed');
 await view(page,'levy');
 eq(await worst(page),'58.50',`${at}: olli's limit gone`);
 await view(page,'kayttajat');
}

/** 2 Heti: typed login, progress in the window, error and retry; no undo. */
async function nowFlow(page,tag){
 const at=`heti ${tag}`;
 await page.getByTestId('event-fail').check();
 await page.getByTestId('remove-mikko').click();
 await typeLogin(page,'MIKKO-L',at);
 await page.getByTestId('remove-confirm').click();
 await page.getByTestId('dialog-retry').waitFor({timeout:6000});
 ok((await text(page,'remove-dialog-title')).includes('poisto kesken'),`${at}: unfinished in the window`);
 ok(await fits(page),`${at}: overflow when failed`);
 await shot(page,`1-${names[1]}-${tag}-failed`);
 await page.getByTestId('dialog-retry').click();
 await page.getByTestId('dialog-freed').waitFor({timeout:6000});
 ok((await text(page,'dialog-freed')).includes('14,2 GiB'),`${at}: freed`);
 await shot(page,`1-${names[1]}-${tag}-done`);
 await page.getByTestId('dialog-close').click();
 eq(await stage(page),'removed',`${at}: removed`);
 eq(await page.getByTestId('cancel-mikko').count(),0,`${at}: no undo`);
 await page.getByTestId('withdraw-olli').click();
 await page.getByTestId('access-confirm').click();
 eq(await mark(page,'olli'),'Ei pääsyä',`${at}: withdrawal stays separate`);
 await view(page,'levy');
 eq(await worst(page),'76.40',`${at}: olli counted by use`);
 await shot(page,`1-${names[1]}-${tag}-storage`);
 await view(page,'kayttajat');
}

/** 3 Vaiheittain: withdraw first, then removal from the withdrawn row. */
async function stepsFlow(page,tag){
 const at=`vaiheittain ${tag}`;
 eq(await page.getByTestId('remove-olli').count(),0,`${at}: no removal on an admitted row`);
 await page.getByTestId('withdraw-mikko').click();
 await page.getByTestId('access-confirm').click();
 eq(await mark(page),'Ei pääsyä',`${at}: withdrawn`);
 ok(await page.getByTestId('remove-mikko').isVisible(),`${at}: removal now offered`);
 await view(page,'levy');
 eq(await worst(page),'102.70',`${at}: counted by use once withdrawn`);
 await view(page,'kayttajat');
 await page.getByTestId('remove-mikko').click();
 eq(await page.getByTestId('when').count(),0,`${at}: no choice`);
 eq(await text(page,'remove-confirm'),'Poista 5.12.',`${at}: scheduled action`);
 await page.getByTestId('type-login').fill('mikko-l');
 await shot(page,`2-${names[2]}-${tag}-remove`);
 await page.getByTestId('remove-confirm').click();
 eq(await mark(page),'Poistetaan 5.12.',`${at}: scheduled`);
 ok(await fits(page),`${at}: overflow when scheduled`);
 await shot(page,`2-${names[2]}-${tag}-scheduled`);
 await page.getByTestId('event-grace').click();
 await until(page,'mikko','removed');
 await view(page,'levy');
 eq(await worst(page),'88.50',`${at}: sum after removal`);
 await view(page,'kayttajat');
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
   await [graceFlow,nowFlow,stepsFlow][d](page,tag);
  }
 }
 await page.close();
}
{
 const en=await open(1440,'light','en');
 ok((await en.getByTestId('remove-dialog').textContent()).includes('Remove person @mikko-l?'),'English: question');
 await en.getByTestId('type-login').fill('mikko-l');
 eq(await en.getByTestId('remove-confirm').textContent(),'Remove on 5 Dec','English: action');
 await shot(en,'en-0-armonaika-1440-light');
 await en.getByTestId('remove-confirm').click();
 eq(await en.getByTestId('access-state-mikko').textContent(),'Removed on 5 Dec','English: the row');
 eq(await en.getByTestId('access-days-mikko').textContent(),'14 days left','English: days left');
 await pick(en,1);
 eq(await en.getByTestId('remove-confirm').textContent(),'Remove for good','English: permanent');
 await shot(en,'en-1-heti-1440-light');
 await en.close();
 const enPhone=await open(390,'dark','en',2);
 ok((await enPhone.getByTestId('access-dialog').textContent()).includes('Remove person'),'English phone: the next step');
 ok(await fits(enPhone),'English phone fits');
 await shot(enPhone,'en-2-vaiheittain-390-dark');
 await enPhone.close();
}
}catch(e){console.log('errors:',errors);throw e;}finally{await browser.close();}
assert.deepEqual(errors,[],'console errors');
console.log(`${checks} checks passed`);
