// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Walks the three variations at 1440 and 390 px, light and dark, in every
// situation: no document overflow, the variation's line marked, the
// warning only from 85 %, plain-language groups with no path on the
// default view, the 85 % line on the bar, the preview (now → after) and
// production's Worktrees and Trash below. Then at 1440 light it clicks:
// "Näytä tarkemmin" shows paths; unticking a group moves the after number
// and the verdict; B2's bar part is the toggle; the request carries the
// selection and spares the running workers; remeasure; English.
// Screenshots at device scale 2 named
// v<n>-<variation>-<situation>-<width>-<theme>.png; --quick takes 1440 light.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-14-storage-breakdown-2';
const [input,out,flag]=process.argv.slice(2);
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['esikatselu','palkkivalinta','ennen-jalkeen'];
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
// B3 shows the after number in its second row; B1 and B2 in the numbers.
const after=(page,d)=>(d===2?page.getByTestId('cmp-after'):page.getByTestId('after')).innerText();
// Toggle a group: B2 by its bar part, the others by the group's checkbox.
const toggle=(page,d,g)=>(d===1?page.getByTestId(`seg-${g}`):page.getByTestId(`group-${g}`)).click();
const cardPaths=page=>page.locator('[data-testid="breakdown"] .rq-path:visible').count();

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
   eq(await page.getByTestId('ask-agent').count(),1,`${at}: the clean-up button`);
   eq(await page.locator('[data-settings-row="trash"]').count(),1,`${at}: production's Trash below`);
   eq(await page.getByTestId('worktrees').count(),1,`${at}: production's Worktrees below`);
   ok(await page.getByTestId('warn-line').count()>=1,`${at}: the 85 % line on the bar`);
   eq(await cardPaths(page),0,`${at}: no paths on the default view`);
   if(c==='mitataan'){
    eq(await page.locator('[data-group-row]').count(),0,`${at}: no groups before the first measurement`);
    ok((await page.getByTestId('measured').innerText()).length>10,`${at}: measuring said`);
   }else{
    for(const g of c==='normaali'?['caches','live']:['caches','finished','live'])eq(await page.locator(`[data-group-row="${g}"]`).count(),1,`${at}: ${g} group`);
    ok((await after(page,d)).includes('%'),`${at}: after number shown`);
    eq(await page.getByTestId('verdict').count(),1,`${at}: verdict`);
    if(c==='varoitus')eq(await page.getByTestId('verdict').getAttribute('data-ok'),'true',`${at}: default selection goes below 85 %`);
    if(c==='jaettu')eq(await page.getByTestId('verdict').getAttribute('data-ok'),null,`${at}: shared disk stays over 85 %`);
    if(d===1)eq(await page.locator('button.rq-seg-tap').count(),c==='normaali'?2:3,`${at}: three bar parts are toggles`);
    if(d===1&&width===390){
     for(const b of await page.locator('button.rq-seg-tap').all())ok((await b.boundingBox()).width>=44,`${at}: bar part tappable`);
    }
   }
   await shot(page,d,c,tag);
  }
 }
 await page.close();
}

// Flows at 1440 light.
const page=await open(1440,'light');
for(let d=0;d<3;d++){
 await pick(page,d);await setCase(page,'varoitus');
 const n=names[d];
 const before=await after(page,d);
 await toggle(page,d,'caches');await settle(page);
 ok((await after(page,d))!==before,`${n}: after follows the selection`);
 await shot(page,d,'ilman-valimuisteja','1440-light');
 await toggle(page,d,'caches');await settle(page);
 eq(await after(page,d),before,`${n}: re-ticking restores`);
 // Details: paths and per-folder choice.
 await page.getByTestId('more-caches').click();await settle(page);
 ok(await cardPaths(page)>=7,`${n}: Show details reveals paths`);
 await page.getByTestId('pick-go-build').click();await settle(page);
 eq(await page.locator('[data-group-row="caches"]').getAttribute('data-state'),'some',`${n}: partly selected group`);
 if(d===1)eq(await page.getByTestId('seg-caches').getAttribute('aria-pressed'),'mixed',`${n}: bar part mixed`);
 await shot(page,d,'tarkemmin','1440-light');
 await page.getByTestId('ask-agent').click();await settle(page);
 eq(await page.getByTestId('conversation-standin').count(),1,`${n}: the stand-in conversation`);
 const r=await request(page);
 ok(!r.includes('go-build'),`${n}: unticked folder left out`);
 for(const p of ['~/.npm/_cacache','npm cache clean --force','wt-vanha-haku/target'])ok(r.includes(p),`${n}: request names ${p}`);
 ok(r.includes('Älä koske')&&r.includes('wt-kalenteri/target'),`${n}: request spares the running worker`);
 ok(!r.includes('~/src/aurinkokello/target'),`${n}: main checkout not selected by default`);
 if(d===0)await shot(page,d,'pyynto','1440-light');
 await page.getByTestId('conversation-cancel').click();await settle(page);
}
// B1: the warning's own button, sending, remeasure, own builds, nothing selected.
await pick(page,0);await setCase(page,'varoitus');
await page.getByTestId('warning-ask').click();await settle(page);
eq(await page.getByTestId('conversation-standin').count(),1,'warning opens the stand-in');
await page.getByTestId('conversation-send').click();await settle(page);
ok((await page.getByTestId('rq-toast').innerText()).includes('aurinkokello'),'sent says where');
await page.getByTestId('remeasure').click();await page.waitForTimeout(200);
ok((await page.getByTestId('measured').innerText()).length>3,'remeasuring');
await page.waitForTimeout(1400);
eq(await page.getByTestId('remeasure').count(),1,'measured again');
await page.getByTestId('group-own').click();await settle(page);
await page.getByTestId('ask-agent').click();await settle(page);
ok((await request(page)).includes('~/src/aurinkokello/target'),'own builds included when ticked');
await page.getByTestId('conversation-cancel').click();await settle(page);
for(const g of ['caches','finished','own'])await page.getByTestId(`group-${g}`).click();
await settle(page);
ok(await page.getByTestId('ask-agent').isDisabled(),'nothing selected, nothing to ask');
eq(await page.getByTestId('after-tick').count(),0,'nothing selected, no after mark');
// First measurement: the agent finds them.
await setCase(page,'mitataan');
await page.getByTestId('ask-agent').click();await settle(page);
ok((await request(page)).includes('Etsi'),'unmeasured: the agent finds them');
await page.getByTestId('conversation-cancel').click();await settle(page);
// B3: the summary stays in view while the list scrolls.
await pick(page,2);await setCase(page,'varoitus');
await page.getByTestId('more-caches').click();await page.getByTestId('more-finished').click();await settle(page);
await page.getByTestId('ask-agent').scrollIntoViewIfNeeded();await settle(page);
const sum=await page.getByTestId('summary').boundingBox();
ok(sum&&sum.y>=0&&sum.y<300,'B3: summary stays in view');
await shot(page,2,'vieritetty','1440-light');
// English.
await pick(page,0);
await page.locator('#language').selectOption('en');await settle(page);await setCase(page,'varoitus');
ok((await page.getByTestId('storage-warning').innerText()).includes('nearly full'),'English warning');
ok((await page.locator('[data-group-row="caches"]').innerText()).includes('Programming tools'),'English group');
await page.getByTestId('ask-agent').click();await settle(page);
ok((await request(page)).includes('Do not touch the directories of running workers'),'English request');
await page.getByTestId('conversation-cancel').click();await settle(page);
await shot(page,0,'varoitus-en','1440-light');
await page.close();
}finally{await browser.close();}
assert.deepEqual(errors,[],`console: ${errors.join('\n')}`);
console.log(`${checks} checks, console clean`);
