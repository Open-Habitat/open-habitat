// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. For
// today and every direction it opens the default view (Levytila and
// Keskustelut side by side in a 440px settings pane), measures every person
// row, and requires the directions' rows to be one height in both lists
// (today's are recorded, not required). It then resets aino's own limit in
// both sections through the direction's control and checks that the row
// says "oletus" and the heights still match. Screenshots at device scale
// factor 2 at 1440×900 and 390×844 (touch), light and dark; desktop also
// with the 720px pane. The console must stay clean.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-07-oletukseen-paikka';
const [input,out]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <evidence-dir>');process.exit(2);}
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['nyt','a-saadin','b-linkki','c-valikko'];
let checks=0;const errors=[];const heights=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const runs=[{width:1440,theme:'light'},{width:1440,theme:'dark'},{width:390,theme:'light'},{width:390,theme:'dark'}];
try{
for(const {width,theme} of runs){
 const mobile=width===390;
 const page=await browser.newPage({viewport:{width,height:mobile?844:900},deviceScaleFactor:2,reducedMotion:'reduce',isMobile:mobile,hasTouch:mobile});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 await checkPicker(page,round);
 const tag=`${width}-${theme}`;
 const fits=async()=>ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'document overflow');
 const shot=async(d,name,full=false)=>{await page.waitForTimeout(250);await fits();await page.screenshot({path:`${out}/r1-${names[d]}-${name}-${tag}.png`,fullPage:full});};
 const levy=page.getByTestId('pane-levy'),live=page.getByTestId('pane-keskustelut');
 const rows=async pane=>pane.locator('.ah-people-row').evaluateAll(els=>els.map(e=>Math.round(e.getBoundingClientRect().height)));
 const even=async(d,when)=>{
  for(const [id,pane] of [['levy',levy],['keskustelut',live]]){
   const h=await rows(pane);heights.push(`${names[d]} ${tag} ${when} ${id}: ${h.join(' ')}`);
   if(d)ok(Math.max(...h)-Math.min(...h)<=1,`${names[d]} ${tag} ${when} ${id}: rows differ ${h}`);
  }
 };
 for(const d of [0,1,2,3]){
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.rq-review.variant-${d}`).waitFor({state:'attached'});
  await page.getByTestId('administration-user-aino').waitFor();
  await page.locator('[data-testid="administration-user-aino"][data-own]').waitFor({state:'attached'});
  await page.locator('[data-testid="live-person-aino"][data-own]').waitFor({state:'attached'});
  await page.evaluate(()=>scrollTo(0,0));
  assert.match(await page.getByTestId('direction-lines').locator('li[aria-current]').innerText(),d?/^[ABC] /:/^Nyt: /);checks++;
  await even(d,'oletus');
  await shot(d,'0-oletus',!mobile);
  if(mobile){await live.scrollIntoViewIfNeeded();await shot(d,'0-keskustelut');}
  // Reset aino's own limit in both sections through the direction's control.
  for(const [pane,id,row] of [[levy,'storage-limit-aino-reset','administration-user-aino'],[live,'live-person-aino-reset','live-person-aino']]){
   if(d===3){
    await pane.getByTestId(`${id}-menu`).click();
    const item=page.getByTestId('menu-reset');await item.waitFor();
    if(pane===levy){await shot(d,'1-valikko-auki');}
    await item.click();
   }else{
    await pane.getByTestId(id).click();
   }
   await page.waitForFunction(r=>!document.querySelector(`[data-testid="${r}"]`)?.hasAttribute('data-own'),row);checks++;
   ok((await page.getByTestId(row).innerText()).includes('oletus'),`${names[d]}: ${row} says oletus`);
  }
  if(d===3){
   // A person on the default: the menu item is there but unavailable.
   await levy.getByTestId('storage-limit-anna-reset-menu').click();
   ok(await page.getByTestId('menu-reset').getAttribute('aria-disabled')==='true','C: reset unavailable for anna');
   await page.keyboard.press('Escape');
  }
  await even(d,'palautettu');
  await page.evaluate(()=>scrollTo(0,0));
  await shot(d,'2-aino-palautettu');
  // Let the settled writes reach the host before it is reset.
  await page.waitForTimeout(1500);
  await page.waitForFunction(()=>['storage-status','live-status'].every(t=>!document.querySelector(`[data-testid="${t}"]`)?.textContent));
  await page.getByTestId('rq-reset').click();
  await page.locator('[data-testid="administration-user-aino"][data-own]').waitFor({state:'attached'});
  if(!mobile){
   await page.getByTestId('pane').selectOption('720');
   await page.waitForTimeout(300);
   await even(d,'leveä');
   await shot(d,'3-levea-paneeli',true);
   await page.getByTestId('pane').selectOption('440');
  }
 }
 await page.close();
}
}finally{await browser.close();}
console.log(heights.join('\n'));
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
