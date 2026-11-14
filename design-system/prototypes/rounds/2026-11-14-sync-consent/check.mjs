// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Walks the three directions at 1440 and 390 px, light and dark, in every
// situation: no document overflow, the direction's line marked, production's
// Microsoft card with OneDrive stopped (or syncing again), the stop in the
// direction's place, the count where the direction shows it, and the many-
// deletions warning gating its confirm. Then at 1440 light it clicks each
// direction's flow: look -> counting -> count -> continue once -> running ->
// done; cancel says nothing changed; a change after the count is refused;
// many deletions need the checkbox; ask the agent; English. Screenshots at
// device scale 2 named v<n>-<direction>-<situation>-<width>-<theme>.png;
// --quick takes 1440 light.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-14-sync-consent';
const [input,out,flag]=process.argv.slice(2);
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['rivi','ilmoitus','paneeli'];
const A=0,B=1,C=2;
const places=['row','notice','panel'];
// situation -> [phase, OneDrive's production state]
const cases={pysahtyi:['stopped','sync_failed'],lasketaan:['counting','sync_failed'],eipoistoja:['counted','sync_failed'],poistoja:['counted','sync_failed'],
 kaynnissa:['running','ok'],valmis:['done','ok'],torjuttu:['refused','sync_failed'],epaonnistui:['failed','sync_failed']};
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};

async function open(width,theme){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:900},deviceScaleFactor:2,reducedMotion:'reduce',hasTouch:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 return page;
}
const settle=page=>page.waitForTimeout(250);
const closeModal=async page=>{while(await page.locator('.ah-overlay').count()){await page.keyboard.press('Escape');await settle(page);}};
const card='[data-testid="integration-account-microsoft"]';
const odState=page=>page.locator(`${card} [data-testid="integration-service-onedrive"] [data-testid="integration-service-state"]`).getAttribute('data-state');
const ready=async page=>{await page.locator('[data-testid="sync-stop"]').waitFor({state:'attached'});await settle(page);};
const pick=async(page,d)=>{await closeModal(page);await page.locator('.proto-picker-item').nth(d).click();await page.locator(`.rq-review[data-direction="${d}"]`).waitFor({state:'attached'});await ready(page);};
const setCase=async(page,c)=>{await closeModal(page);await page.locator('#scenario').selectOption(c);await ready(page);};
const shot=(page,d,c,tag)=>page.screenshot({path:`${out}/v${d+1}-${names[d]}-${c}-${tag}.png`});
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const phase=page=>page.getByTestId('sync-stop').getAttribute('data-phase');

try{
for(const width of quick?[1440]:[1440,390])for(const theme of quick?['light']:['light','dark']){
 const tag=`${width}-${theme}`;
 const page=await open(width,theme);
 await checkPicker(page,round);
 eq(await page.getByTestId('recommendation').count(),1,'the recommendation is on the page');
 for(let d=0;d<3;d++){
  await pick(page,d);
  for(const [c,[ph,state]] of Object.entries(cases)){
   await setCase(page,c);
   const at=`${names[d]} ${c} ${tag}`;
   ok(await fits(page),`${at}: document overflow`);
   eq(await page.locator('.rq-lines li[aria-current]').count(),1,`${at}: its line is marked`);
   eq(await page.locator(card).count(),1,`${at}: production's Microsoft card`);
   eq(await odState(page),state,`${at}: OneDrive's production state`);
   eq(await page.getByTestId('sync-stop').count(),1,`${at}: one stop piece`);
   eq(await page.getByTestId('sync-stop').getAttribute('data-place'),places[d],`${at}: in the direction's place`);
   eq(await phase(page),ph,`${at}: phase`);
   const stopText=await page.getByTestId('sync-stop').innerText();
   if(['stopped','refused','failed'].includes(ph)){
    ok(stopText.length>40,`${at}: says why it stopped`);
    eq(await page.locator('[data-testid="open-consent"]').count(),1,`${at}: can look`);
    eq(await page.locator('[data-testid="ask-agent"]').count(),1,`${at}: can ask the agent`);
   }
   if(['running','done','refused','failed'].includes(ph))eq(await page.getByTestId('sync-outcome').getAttribute('data-phase'),ph,`${at}: outcome said`);
   // Where the count shows.
   const dialogs=d===C?0:1;
   if(ph==='counting'){
    eq(await page.getByTestId('consent-dialog').count(),dialogs,`${at}: dialog in A/B only`);
    ok(await page.getByTestId('dry-counting').isVisible(),`${at}: counting shown`);
   }
   if(ph==='counted'){
    eq(await page.getByTestId('consent-dialog').count(),dialogs,`${at}: dialog in A/B only`);
    ok(await page.getByTestId('dry-table').isVisible(),`${at}: the counts`);
    ok(await page.getByTestId('dry-binding').isVisible(),`${at}: what the consent covers`);
    const many=c==='poistoja';
    eq(await page.getByTestId('dry-summary').getAttribute('data-deletions'),many?'many':'none',`${at}: deletions`);
    eq(await page.getByTestId('dry-many').count(),many?1:0,`${at}: strong warning only for many deletions`);
    if(d!==C){
     eq(await page.getByTestId('consent-confirm').isDisabled(),many,`${at}: many deletions gate the confirm`);
     if(many)ok((await page.getByTestId('consent-confirm').innerText()).includes('212'),`${at}: confirm names the deletions`);
    }
   }
   if(d===A)eq(await page.locator(`${card} [data-testid="integration-service-onedrive"] [data-testid="sync-stop"]`).count(),1,`${at}: A inside OneDrive's row`);
   if(d===B)eq(await page.locator(`${card} > .rq-slot + .ig-svc`).count(),1,`${at}: B above the services`);
   if(d===C)eq(await page.locator(`${card} > [data-testid="integration-service-onedrive"] + .rq-slot [data-testid="sync-stop"]`).count(),1,`${at}: C under OneDrive's row`);
   await shot(page,d,c,tag);
  }
 }
 await page.close();
}

// Flows at 1440 light.
const page=await open(1440,'light');
for(const d of [0,1]){
 await pick(page,d);await setCase(page,'pysahtyi');
 const at=names[d];
 await page.getByTestId('open-consent').click();
 ok(await page.getByTestId('dry-counting').isVisible(),`${at}: look -> counting`);
 await page.getByTestId('dry-table').waitFor();
 eq(await page.getByTestId('consent-confirm').isDisabled(),false,`${at}: no deletions, confirm open`);
 await page.getByTestId('consent-confirm').click();await settle(page);
 eq(await phase(page),'running',`${at}: running`);
 eq(await odState(page),'ok',`${at}: production row syncing`);
 await page.waitForFunction(()=>document.querySelector('[data-testid="sync-stop"]')?.getAttribute('data-phase')==='done');await settle(page);
 ok((await page.getByTestId('sync-outcome').innerText()).includes('14'),`${at}: done says what went`);
 // Cancel.
 await setCase(page,'pysahtyi');
 await page.getByTestId('open-consent').click();await page.getByTestId('dry-table').waitFor();
 await page.getByTestId('consent-cancel').click();await settle(page);
 eq(await phase(page),'stopped',`${at}: cancel -> still stopped`);
 eq(await page.getByTestId('sync-outcome').count(),1,`${at}: cancel says nothing changed`);
 // A change after the count is refused.
 await page.getByTestId('open-consent').click();await page.getByTestId('dry-table').waitFor();
 await page.getByTestId('rq-change').click();
 await page.getByTestId('consent-confirm').click();await settle(page);
 eq(await phase(page),'refused',`${at}: changed after the count -> refused`);
 eq(await odState(page),'sync_failed',`${at}: refused leaves the stop`);
 // Many deletions need the checkbox.
 await setCase(page,'poistoja');
 await page.getByTestId('consent-agree').click();
 eq(await page.getByTestId('consent-confirm').isDisabled(),false,`${at}: checkbox opens the confirm`);
 await page.getByTestId('consent-confirm').click();await settle(page);
 eq(await phase(page),'running',`${at}: many -> running`);
 await page.waitForFunction(()=>document.querySelector('[data-testid="sync-stop"]')?.getAttribute('data-phase')==='done');
 ok((await page.getByTestId('sync-outcome').innerText()).includes('212'),`${at}: done names the deletions`);
}
// C: the count fills in, the dialog confirms.
await pick(page,2);await setCase(page,'pysahtyi');
await page.getByTestId('open-consent').click();
ok(await page.getByTestId('dry-counting').isVisible(),'C: counting inline');
await page.getByTestId('dry-table').waitFor();
eq(await page.locator('.ah-overlay').count(),0,'C: count without a dialog');
await page.getByTestId('c-continue').click();await settle(page);
eq(await page.getByTestId('c-confirm-dialog').count(),1,'C: confirm dialog');
await shot(page,2,'vahvistus','1440-light');
await page.getByTestId('consent-confirm').click();await settle(page);
eq(await phase(page),'running','C: running');
await page.waitForFunction(()=>document.querySelector('[data-testid="sync-stop"]')?.getAttribute('data-phase')==='done');
await setCase(page,'poistoja');
await page.getByTestId('c-continue').click();await settle(page);
eq(await page.getByTestId('consent-confirm').isDisabled(),true,'C: many deletions gate the confirm');
await shot(page,2,'vahvistus-poistoja','1440-light');
await page.getByTestId('consent-agree').click();
eq(await page.getByTestId('consent-confirm').isDisabled(),false,'C: checkbox opens it');
await page.getByTestId('c-confirm-cancel').click();await settle(page);
eq(await phase(page),'counted','C: cancel the confirm keeps the count');
// Ask the agent.
await page.getByTestId('ask-agent').click();await settle(page);
ok((await page.getByTestId('rq-toast').innerText()).length>40,'ask the agent says what would open');
// English.
await pick(page,1);
await page.locator('#language').selectOption('en');await settle(page);await setCase(page,'eipoistoja');
ok((await page.getByTestId('dry-would').innerText()).includes('Nothing is deleted'),'English count');
eq(await page.locator(`${card} [data-testid="integration-service-onedrive"] [data-testid="integration-service-state"]`).innerText(),'Stopped: every file changed at once','English production status');
await shot(page,1,'eipoistoja-en','1440-light');
await closeModal(page);await setCase(page,'pysahtyi');
await shot(page,1,'pysahtyi-en','1440-light');
await page.close();
}finally{await browser.close();}
assert.deepEqual(errors,[],`console: ${errors.join('\n')}`);
console.log(`${checks} checks, console clean`);
