// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Walks the three directions at 1440 and 390 px in Päivä, Yö and Kontrasti
// with reduced motion. Default view: Ville's run in progress with tools, the
// full-rights chip and the direction's take-back control, Ville's view at
// the side (toggled on the phone), no overflow. Flows (Päivä and Yö):
// taking full rights back (1: one tap, summary card, stop a process and the
// run; 2: the sheet, stop the run and the process before confirming; 3: the
// grant ends by itself, extend and the duration choice when granting), the
// run then finishing text-only into a waiting request the owner releases,
// removing Ville (his view closes, the share leaves his rail) and archiving
// (only the owner sees it). English last. Screenshots at device scale 2.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-21-take-back-rights';
const [input,out,flag]=process.argv.slice(2);
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['heti','arkki','maaraaika'];
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
const settle=page=>page.waitForTimeout(200);
const toBottom=page=>page.evaluate(()=>{const s=document.querySelector('[data-testid="conversation-stream"]');if(s)s.scrollTop=s.scrollHeight;});
const reset=async page=>{await page.getByTestId('event-reset').click();await settle(page);};
const run=page=>page.locator('[data-reply="rv2"]');
const text=async(page,id)=>(await page.getByTestId(id).first().textContent())||'';
const phoneOf=page=>page.viewportSize().width===390;
/** Ville's side: always there on desktop, opened on the phone. */
async function side(page,f){
 const phone=phoneOf(page);
 if(phone){await page.getByTestId('event-side').click();await settle(page);}
 ok(await page.getByTestId('side').isVisible(),'side visible');
 await f();
 if(phone){await page.getByTestId('side-close').click();await settle(page);ok(!(await page.getByTestId('side').isVisible()),'side closed');
  // The close button sits over the header's ⋯; leave no tooltip behind it.
  await page.mouse.move(10,700);await page.keyboard.press('Escape');await settle(page);}
}
const openPeople=async page=>{await page.getByTestId('people-open').click();await settle(page);ok(await page.getByTestId('people-panel').isVisible(),'people panel');};

async function defaultView(page,d,at){
 eq(await page.locator('.ra-lines li[aria-current]').count(),1,`${at}: its line is marked`);
 eq(await page.getByTestId('author-name').allTextContents(),['Sinä','Ville Virtanen','Ville Virtanen'],`${at}: attributed`);
 eq(await run(page).getAttribute('data-mode'),'live',`${at}: Ville's run in progress`);
 ok((await run(page).getByTestId('mode-mark').textContent()).includes('Työkalut käytössä'),`${at}: with tools`);
 eq(await page.locator('[data-testid="tool"][data-state="running"]').count(),1,`${at}: one running tool`);
 ok(await page.getByTestId('full-chip').isVisible(),`${at}: full-rights chip`);
 const chip=await text(page,'full-chip');
 ok(chip.includes('Ville'),`${at}: chip names Ville`);
 ok((await text(page,'chip-take-back')).startsWith('Ota pois'),`${at}: take-back on the chip`);
 eq((await text(page,'chip-take-back')).endsWith('…'),d===1,`${at}: only 2 opens a sheet`);
 eq(await has(page,'time-left'),d===2,`${at}: time left only in 3`);
 if(d===2)ok((await text(page,'time-left')).includes('34 min'),`${at}: 34 min left`);
 else if(!phoneOf(page))ok(chip.includes('ajo käynnissä'),`${at}: chip says a run is going`);
 ok(chip.length>0,`${at}: chip text`);
 eq(await has(page,'summary-card'),false,`${at}: no summary yet`);
 await side(page,async()=>{
  ok((await text(page,'side-strip')).includes('Täydet oikeudet'),`${at}: Ville sees full rights`);
  eq((await text(page,'side-strip')).includes('Päättyy'),d===2,`${at}: Ville sees the end time only in 3`);
  ok((await text(page,'side-run')).includes('käynnissä'),`${at}: Ville's run running`);
  ok(await page.getByTestId('side-shared').isVisible(),`${at}: shared with Ville`);
 });
 ok(await fits(page),`${at}: document overflow`);
}

async function afterTextOnly(page,at){
 // The run finishes as text only: the started command finishes, the next is blocked.
 await page.getByTestId('event-advance').click();await settle(page);
 eq(await run(page).getAttribute('data-mode'),'text',`${at}: ended text only`);
 ok((await run(page).textContent()).includes('En korjannut'),`${at}: says it did not fix`);
 eq(await page.locator(`[data-testid="tool"][data-state="blocked"]`).count(),1,`${at}: blocked call`);
 eq(await page.locator(`[data-testid="tool"][data-tool="node scripts/check-links.mjs"][data-state="succeeded"]`).count(),1,`${at}: started call finished`);
 ok(await page.getByTestId('waiting').isVisible(),`${at}: waiting request`);
 await side(page,async()=>ok((await text(page,'side-run')).includes('odottaa Ainoa'),`${at}: Ville sees it waiting`));
 await toBottom(page);await shot(page,`${at.replace(/ /g,'-')}-text-done`);
 await page.getByTestId('waiting-allow').click();await settle(page);
 ok((await page.getByTestId('habitat-line').last().textContent()).includes('antoi agentin jatkaa'),`${at}: released`);
 ok((await page.getByTestId('agent-reply').last().textContent()).includes('Korjasin'),`${at}: fixed with tools`);
 // Ville writes again: text only now.
 await page.getByTestId('event-ville').click();await settle(page);
 eq(await page.getByTestId('agent-reply').last().getAttribute('data-mode'),'text',`${at}: Ville text only now`);
 ok(await page.getByTestId('waiting').isVisible(),`${at}: his new request waits`);
}

async function takeFlow(page,d,tag){
 const at=`${names[d]} ${tag} take`;
 if(d===0){
  await page.getByTestId('chip-take-back').click();await settle(page);
  ok(await page.getByTestId('summary-card').isVisible(),`${at}: summary after the fact`);
  eq(await page.getByTestId('sum-run').getAttribute('data-phase'),'textOnly',`${at}: run continues text only`);
  ok((await text(page,'sum-run')).includes('vain tekstinä'),`${at}: says text only`);
  eq(await run(page).getAttribute('data-mode'),'text',`${at}: reply marked text only`);
  ok((await text(page,'sum-proc-preview')).includes('npm run preview'),`${at}: lists Ville's process`);
  eq(await page.locator('[data-testid^="sum-proc-"]').count(),1,`${at}: not Aino's own process`);
  ok((await text(page,'sum-did')).includes('3'),`${at}: three actions`);
  ok((await text(page,'sum-reads')).includes('näkee keskustelun edelleen'),`${at}: Ville still reads`);
  ok(!(await has(page,'full-chip')),`${at}: chip gone`);
  eq(await page.getByTestId('role-ville').count(),0,`${at}: role tags not on messages`);
  await side(page,async()=>{
   ok((await text(page,'side-strip')).includes('otti täydet oikeudet pois'),`${at}: Ville told`);
   ok((await text(page,'side-run')).includes('vain tekstinä'),`${at}: Ville's run text only`);
   ok((await text(page,'side-reads')).includes('koko keskustelun'),`${at}: Ville still reads`);
  });
  await toBottom(page);await shot(page,`${d}-${names[d]}-${tag}-summary`);
  await page.getByTestId('sum-stop-preview').click();await settle(page);
  ok((await text(page,'sum-proc-preview')).includes('pysäytetty'),`${at}: process stopped`);
  ok((await page.getByTestId('habitat-line').last().textContent()).includes('npm run preview'),`${at}: stop line`);
  await afterTextOnly(page,at);
  ok((await text(page,'sum-run')).includes('odottaa lupaasi'),`${at}: card follows the run`);
  ok(!(await has(page,'sum-stop-run')),`${at}: no stop for an ended run`);
  ok(await fits(page),`${at}: overflow`);
  await reset(page);
  // Stopping the run from the card.
  await page.getByTestId('chip-take-back').click();await settle(page);
  await page.getByTestId('sum-stop-run').click();await settle(page);
  eq(await page.getByTestId('sum-run').getAttribute('data-phase'),'stopped',`${at}: run stopped from the card`);
  eq(await page.locator('[data-testid="tool"][data-state="interrupted"]').count(),1,`${at}: interrupted call`);
  await side(page,async()=>ok((await text(page,'side-run')).includes('pysäytti'),`${at}: Ville sees it stopped`));
 }
 if(d===1){
  await page.getByTestId('chip-take-back').click();await settle(page);
  ok(await page.getByTestId('take-sheet').isVisible(),`${at}: sheet`);
  ok((await text(page,'take-sheet')).includes('klo 14.05'),`${at}: says since when`);
  ok((await text(page,'sheet-did')).includes('3'),`${at}: three actions`);
  ok(await page.getByTestId('sheet-run-finish').isChecked(),`${at}: finish as text is the default`);
  ok(await page.getByTestId('sheet-proc-preview').isChecked(),`${at}: Ville's process checked`);
  ok((await text(page,'sheet-procs')).includes('Omat prosessisi (1)'),`${at}: own processes untouched`);
  ok(!(await page.getByTestId('sheet-remove').isChecked()),`${at}: removal off`);
  ok(await fits(page),`${at}: sheet overflow`);
  await shot(page,`${d}-${names[d]}-${tag}-sheet`);
  await page.getByTestId('sheet-cancel').click();await settle(page);
  ok(await page.getByTestId('full-chip').isVisible(),`${at}: cancel keeps rights`);
  // Text-only path: keep the process, finish as text.
  await page.getByTestId('chip-take-back').click();await settle(page);
  await page.getByTestId('sheet-proc-preview').uncheck();
  await page.getByTestId('sheet-confirm').click();await settle(page);
  ok(!(await has(page,'summary-card')),`${at}: no card afterwards`);
  ok((await page.getByTestId('habitat-line').last().textContent()).includes('Otit täydet oikeudet pois'),`${at}: line`);
  eq(await run(page).getAttribute('data-mode'),'text',`${at}: run text only`);
  await afterTextOnly(page,at);
  await reset(page);
  // Stop path.
  await page.getByTestId('chip-take-back').click();await settle(page);
  await page.getByTestId('sheet-run-stop').check();
  await page.getByTestId('sheet-confirm').click();await settle(page);
  eq(await page.locator('[data-testid="tool"][data-state="interrupted"]').count(),1,`${at}: interrupted`);
  const lines=(await page.getByTestId('habitat-line').allTextContents()).join(' ');
  ok(lines.includes('Ajo pysäytettiin')&&lines.includes('npm run preview'),`${at}: run and process stopped`);
  await side(page,async()=>ok((await text(page,'side-run')).includes('pysäytti'),`${at}: Ville sees it stopped`));
  await toBottom(page);await shot(page,`${d}-${names[d]}-${tag}-stopped`);
 }
 if(d===2){
  await openPeople(page);
  ok((await text(page,'person-ville')).includes('34 min'),`${at}: panel time left`);
  await page.getByTestId('extend-ville').click();await settle(page);
  ok((await text(page,'person-ville')).includes('94 min'),`${at}: extended`);
  await page.getByTestId('grant-maija').click();await settle(page);
  ok(await page.getByTestId('grant-duration').isVisible(),`${at}: duration when granting`);
  eq(await page.locator('[data-testid="grant-duration"] input').count(),4,`${at}: four durations`);
  await shot(page,`${d}-${names[d]}-${tag}-grant`);
  await page.getByTestId('grant-cancel').click();await settle(page);
  await page.getByTestId('people-close').click();await settle(page);
  await page.getByTestId('event-expire').click();await settle(page);
  ok(await page.getByTestId('summary-card').isVisible(),`${at}: expiry card`);
  eq(await page.getByTestId('summary-card').getAttribute('data-how'),'expired',`${at}: expired`);
  ok((await text(page,'summary-card')).includes('päättyivät'),`${at}: says ended`);
  eq(await page.getByTestId('sum-run').getAttribute('data-phase'),'textOnly',`${at}: run text only`);
  await side(page,async()=>ok((await text(page,'side-strip')).includes('päättyivät'),`${at}: Ville told it ended`));
  await toBottom(page);await shot(page,`${d}-${names[d]}-${tag}-expired`);
  await afterTextOnly(page,at);
  await reset(page);
  await page.getByTestId('chip-take-back').click();await settle(page);
  eq(await page.getByTestId('summary-card').getAttribute('data-how'),'taken',`${at}: take back at once too`);
 }
 ok(await fits(page),`${at}: overflow`);
 await reset(page);
}

async function removeFlow(page,d,tag){
 const at=`${names[d]} ${tag} remove`;
 await openPeople(page);
 await page.getByTestId('remove-ville').click();await settle(page);
 if(d===1){
  ok(await page.getByTestId('take-sheet').isVisible(),`${at}: sheet`);
  ok(await page.getByTestId('sheet-remove').isChecked(),`${at}: removal checked`);
  await page.getByTestId('sheet-confirm').click();await settle(page);
 }else{
  ok(await page.getByTestId('summary-card').isVisible(),`${at}: card`);
  eq(await page.getByTestId('summary-card').getAttribute('data-how'),'removed',`${at}: removed card`);
  ok((await text(page,'sum-reads')).includes('ei enää näe'),`${at}: Ville no longer reads`);
 }
 ok((await page.getByTestId('habitat-line').last().textContent()).includes('Poistit keskustelusta')||(await page.getByTestId('habitat-line').allTextContents()).join(' ').includes('Poistit keskustelusta'),`${at}: removed line`);
 ok(await page.getByTestId('event-ville').isDisabled(),`${at}: Ville cannot write`);
 await side(page,async()=>{
  ok(await page.getByTestId('side-gone').isVisible(),`${at}: Ville's view closed`);
  ok((await text(page,'side-gone')).includes('poisti sinut'),`${at}: says removed`);
  ok(await page.getByTestId('side-shared-none').isVisible(),`${at}: share gone from his rail`);
  eq(await has(page,'side-strip'),false,`${at}: nothing of the conversation`);
  await shot(page,`${d}-${names[d]}-${tag}-removed-side`);
 });
 await toBottom(page);await shot(page,`${d}-${names[d]}-${tag}-removed`);
 await reset(page);
 // Archive.
 await page.getByTestId('event-archive').click();await settle(page);
 ok(await page.getByTestId('archive-dialog').isVisible(),`${at}: archive window`);
 ok((await text(page,'archive-dialog')).includes('Ville ja Maija'),`${at}: names who lose it`);
 await shot(page,`${d}-${names[d]}-${tag}-archive-ask`);
 await page.getByTestId('archive-confirm').click();await settle(page);
 ok(await page.getByTestId('archived-note').isVisible(),`${at}: archived`);
 await side(page,async()=>{
  ok((await text(page,'side-gone')).includes('arkistoi'),`${at}: Ville sees archived`);
  ok(await page.getByTestId('side-shared-none').isVisible(),`${at}: not in his rail`);
 });
 ok(await fits(page),`${at}: overflow`);
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
   await takeFlow(page,d,tag);
   await removeFlow(page,d,tag);
  }
 }
 await page.close();
}
for(const width of [1440,390]){
 const en=await open(width,width===390?'dark':'light','en');
 for(let d=0;d<3;d++){
  await pick(en,d);
  ok((await en.getByTestId('chip-take-back').textContent()).startsWith('Take back'),`English ${width} ${d}: chip`);
  eq((await en.getByTestId('author-name').allTextContents())[0],'You',`English ${width} ${d}: You`);
  ok(await fits(en),`English ${width} ${d}: fits`);
  await shot(en,`en-${d}-${names[d]}-${width}`);
  if(d===1){await en.getByTestId('chip-take-back').click();await settle(en);ok((await en.getByTestId('take-sheet').textContent()).includes('What you lent'),`English ${width}: sheet`);await shot(en,`en-sheet-${width}`);await en.getByTestId('sheet-confirm').click();await settle(en);}
  else if(d===2){await en.getByTestId('event-expire').click();await settle(en);}
  else {await en.getByTestId('chip-take-back').click();await settle(en);}
  if(d!==1)ok((await en.getByTestId('summary-card').textContent()).includes(d===2?'ended':'took full rights back'),`English ${width} ${d}: card`);
  ok(await fits(en),`English ${width} ${d}: fits after`);
  await toBottom(en);await shot(en,`en-${d}-${names[d]}-${width}-after`);
 }
 await en.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[],'console errors');
console.log(`${checks} checks passed`);
