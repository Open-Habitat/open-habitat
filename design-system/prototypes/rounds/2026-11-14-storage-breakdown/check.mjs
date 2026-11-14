// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Walks the three directions at 1440 and 390 px, light and dark, in every
// situation: no document overflow, the direction's line marked, the
// warning only from 85 %, the breakdown's caches and both kinds of
// worktree build directory shown (or the first measurement said), and
// production's Worktrees and Trash below. Then at 1440 light it clicks the
// clean-up: the stand-in conversation carries the prepared request, which
// names the caches and leaves the running workers' directories alone; B's
// unticked item leaves the request; remeasure; English. Screenshots at
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
const round='2026-11-14-storage-breakdown';
const [input,out,flag]=process.argv.slice(2);
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['pylvas','vapautettavissa','kansioittain'];
const cases=['varoitus','normaali','mitataan','jaettu'];
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
const settle=page=>page.waitForTimeout(300);
const closeModal=async page=>{if(await page.locator('.ah-overlay').count()){await page.keyboard.press('Escape');await settle(page);}};
const pick=async(page,d)=>{await closeModal(page);await page.locator('.proto-picker-item').nth(d).click();await page.locator(`.rq-review[data-direction="${d}"]`).waitFor({state:'attached'});await settle(page);};
const setCase=async(page,c)=>{await closeModal(page);await page.locator('#scenario').selectOption(c);await page.getByTestId('breakdown').waitFor({state:'attached'});await page.locator('[data-settings-row="trash"]').waitFor({state:'attached'});await settle(page);};
const shot=(page,d,c,tag)=>page.screenshot({path:`${out}/v${d+1}-${names[d]}-${c}-${tag}.png`});
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const request=page=>page.getByTestId('request-text').inputValue();

try{
for(const width of quick?[1440]:[1440,390])for(const theme of quick?['light']:['light','dark']){
 const tag=`${width}-${theme}`;
 const page=await open(width,theme);
 await checkPicker(page,round);
 eq(await page.getByTestId('recommendation').count(),1,'the recommendation is on the page');
 for(let d=0;d<3;d++){
  await pick(page,d);
  for(const c of cases){
   await setCase(page,c);
   const at=`${names[d]} ${c} ${tag}`;
   ok(await fits(page),`${at}: document overflow`);
   eq(await page.locator('.rq-lines li[aria-current]').count(),1,`${at}: its line is marked`);
   eq(await page.getByTestId('breakdown').count(),1,`${at}: one breakdown`);
   eq(await page.locator('[data-settings-row="usage"]:visible').count(),0,`${at}: production's usage card replaced`);
   eq(await page.getByTestId('storage-warning').count(),c==='normaali'?0:1,`${at}: warning from 85 %`);
   ok(await page.getByTestId('ask-agent').count()===1,`${at}: the clean-up button`);
   eq(await page.locator('[data-settings-row="trash"]').count(),1,`${at}: production's Trash below`);
   eq(await page.getByTestId('worktrees').count(),1,`${at}: production's Worktrees below`);
   if(c==='mitataan'){
    eq(await page.locator('[data-item]').count(),0,`${at}: nothing itemised before the first measurement`);
    ok((await page.getByTestId('measured').innerText()).length>10,`${at}: measuring said`);
   }else{
    // C shows the ten largest at first; A shows the caches open.
    if(d!==2)ok(await page.locator('[data-item="go-build"]').count()===1,`${at}: Go build cache itemised`);
    if(d===1)eq(await page.locator('[data-item="wt-kalenteri"]').count(),1,`${at}: running worker's target listed`);
    if(c==='varoitus'&&d===1)eq(await page.locator('[data-item="wt-vanha-haku"]').count(),1,`${at}: finished worktree's target listed`);
    if(d===2)ok(await page.locator('[data-group="live"]').count()===2,`${at}: C shows the live targets among the largest`);
   }
   if(d===1&&c!=='mitataan')eq(await page.locator('[data-testid="pick-wt-kalenteri"][data-disabled]').count(),1,`${at}: B cannot select a running worker`);
   await shot(page,d,c,tag);
  }
 }
 await page.close();
}

// Flows at 1440 light.
const page=await open(1440,'light');
// A: open the stand-in from the card; the request names the caches and spares the workers.
await pick(page,0);await setCase(page,'varoitus');
await page.getByTestId('open-finished').click();await settle(page);
eq(await page.locator('[data-item="wt-vanha-haku"]').count(),1,'A: finished group opens');
await shot(page,0,'avattu','1440-light');
await page.getByTestId('ask-agent').click();await settle(page);
eq(await page.getByTestId('conversation-standin').count(),1,'A: the stand-in conversation');
let r=await request(page);
for(const p of ['~/.cache/go-build','go clean -cache','~/.npm/_cacache','~/.cache/ms-playwright','~/.cache/uv','wt-vanha-haku/target'])ok(r.includes(p),`A: request names ${p}`);
ok(r.includes('Älä koske')&&r.includes('wt-kalenteri/target'),'A: request spares the running worker');
ok(!r.includes('~/src/aurinkokello/target'),'A: main checkout not in the request');
await shot(page,0,'pyynto','1440-light');
await page.getByTestId('conversation-send').click();await settle(page);
ok((await page.getByTestId('rq-toast').innerText()).includes('aurinkokello'),'A: sent says where');
// The warning's own button.
await page.getByTestId('warning-ask').click();await settle(page);
eq(await page.getByTestId('conversation-standin').count(),1,'warning opens the stand-in');
await page.getByTestId('conversation-cancel').click();await settle(page);
// Remeasure.
await page.getByTestId('remeasure').click();await page.waitForTimeout(200);
ok((await page.getByTestId('measured').innerText()).length>5,'remeasuring');
await page.waitForTimeout(1400);
eq(await page.getByTestId('remeasure').count(),1,'measured again');
// B: untick Go build cache, tick the main checkout.
await pick(page,1);await setCase(page,'varoitus');
const before=await page.getByTestId('selected-total').innerText();
await page.getByTestId('pick-go-build').click();await settle(page);
ok((await page.getByTestId('selected-total').innerText())!==before,'B: total follows the selection');
await page.getByTestId('pick-own-aurinkokello').click();await settle(page);
await page.getByTestId('ask-agent').click();await settle(page);
r=await request(page);
ok(!r.includes('go-build'),'B: unticked item left out');
ok(r.includes('~/src/aurinkokello/target'),'B: ticked main checkout included');
ok(r.includes('wt-haku-nopeus/target'),'B: running workers still spared');
await shot(page,1,'pyynto-valitut','1440-light');
await page.getByTestId('conversation-cancel').click();await settle(page);
// B: nothing selected disables the button.
for(const id of ['npm','cargo','go-mod','playwright','uv','pip','wt-vanha-haku','wt-otsikko','own-aurinkokello'])await page.getByTestId(`pick-${id}`).click();
await settle(page);
ok(await page.getByTestId('ask-agent').isDisabled(),'B: nothing selected, nothing to ask');
// B: the first measurement's request asks the agent to find them.
await setCase(page,'mitataan');
await page.getByTestId('ask-agent').click();await settle(page);
ok((await request(page)).includes('Etsi'),'unmeasured: the agent finds them');
await page.getByTestId('conversation-cancel').click();await settle(page);
// C: show all.
await pick(page,2);await setCase(page,'varoitus');
await page.getByTestId('show-all').click();await settle(page);
ok(await page.locator('[data-group="own"]').count()===2,'C: all rows');
await shot(page,2,'kaikki','1440-light');
// English.
await pick(page,1);
await page.locator('#language').selectOption('en');await settle(page);await setCase(page,'varoitus');
ok((await page.getByTestId('storage-warning').innerText()).includes('nearly full'),'English warning');
await page.getByTestId('ask-agent').click();await settle(page);
ok((await request(page)).includes('Do not touch the directories of running workers'),'English request');
await shot(page,1,'pyynto-en','1440-light');
await page.getByTestId('conversation-cancel').click();await settle(page);
await shot(page,1,'varoitus-en','1440-light');
await page.close();
}finally{await browser.close();}
assert.deepEqual(errors,[],`console: ${errors.join('\n')}`);
console.log(`${checks} checks, console clean`);
