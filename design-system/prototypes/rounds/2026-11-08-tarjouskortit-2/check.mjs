// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. For
// each riff of Kortti, at 1440 px and 390 px (touch), light and dark, device
// scale factor 2, named r2-<direction>-<step>-<width>-<theme>:
//   0-oletus      the default view: the CSV is open where this riff opens;
//   0-kortit      a tall window with all six cards and nothing open;
//   1-nakyma … 5-kansio  each kind opened from its card;
//   6-julkinen    the CSV made public (A, B in the top bar; C from the card's mark);
//   7-valilehti-<kind>   Avaa omalle välilehdelle for every kind (A; C the table);
//   8-lista       the conversation's list behind the header chip.
// It asserts where each press opens (A the panel, B a window, C the panel on
// desktop and a window on the phone), that Esc closes a window, that every
// kind can be made public and opened in its own tab, that the console stays
// clean and that nothing overflows sideways.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-08-tarjouskortit-2';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['a-viereen','b-ikkuna','c-merkki'];
const steps=[['1-nakyma','view'],['2-taulukko','csv'],['3-kuva','image'],['4-asiakirja','pdf'],['5-kansio','folder']];
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const runs=[{width:1440,theme:'light'},{width:1440,theme:'dark'},{width:390,theme:'light'},{width:390,theme:'dark'}];
try{
for(const {width,theme} of runs){
 const mobile=width===390,H=mobile?844:900;
 const page=await browser.newPage({viewport:{width,height:H},deviceScaleFactor:2,reducedMotion:'reduce',isMobile:mobile,hasTouch:mobile});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 await checkPicker(page,round);
 const tag=`${width}-${theme}`;
 const fits=async()=>ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'document overflow');
 const press=async(loc)=>{await loc.scrollIntoViewIfNeeded();await (mobile?loc.tap():loc.click());};
 for(const d of [0,1,2]){
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.rq-review.variant-${d}`).waitFor({state:'attached'});
  const shot=async(step)=>{await page.waitForTimeout(350);await fits();await page.screenshot({path:`${out}/r2-${names[d]}-${step}-${tag}.png`});};
  const place=d===1||(d===2&&mobile)?'window':'panel';
  assert.match(await page.getByTestId('direction-lines').locator('li[aria-current]').innerText(),new RegExp(`^${'ABC'[d]} `));checks++;
  ok(await page.getByTestId('oc-card').count()===6,'six cards of one shape');
  ok(await page.getByTestId('oc-pill').count()===(d===2?7:0),'C: a mark on every card and in the top bar');
  const panel=page.getByTestId('oc-panel');
  const expectOpen=async(kind)=>{
   await panel.waitFor();checks++;
   ok(await panel.getAttribute('data-kind')===kind,`${kind} opens`);
   ok(await panel.getAttribute('data-place')===place,`${kind} opens in the ${place}`);
   ok((await page.locator('.oc-overlay [role="dialog"]').count()>0)===(place==='window'),'a window only where the riff opens one');
   ok(await page.getByTestId('oc-open-tab').isVisible(),'own tab in the top bar');
  };
  const closeIt=async()=>{
   if(place==='window'){await page.keyboard.press('Escape');}
   else await press(page.getByTestId('oc-panel-close'));
   await panel.waitFor({state:'detached'});checks++;
  };
  await expectOpen('csv');
  await shot('0-oletus');
  await closeIt();
  await page.setViewportSize({width,height:mobile?3000:2300});
  await page.waitForTimeout(200);
  await shot('0-kortit');
  await page.setViewportSize({width,height:H});
  const cardOf=kind=>page.locator(`[data-testid="oc-card"][data-kind="${kind}"]`).first();
  for(const [step,kind] of steps){
   const card=cardOf(kind);
   await press(d===2?card.getByTestId('oc-hit'):card);
   await expectOpen(kind);
   if(!mobile&&place==='panel') ok(await card.getAttribute('data-open')==='true','the open card is marked');
   if(kind==='csv') ok(await page.getByTestId('oc-table').isVisible(),'table');
   if(kind==='pdf') ok(await page.getByTestId('oc-doc').isVisible(),'document');
   if(kind==='folder') ok(await page.getByTestId('oc-folder-row').count()===5,'five files in the folder');
   ok(await page.locator('[data-testid="oc-panel"] [data-testid="oc-share"], [data-testid="oc-panel"] [data-testid="oc-pill"]').count()===1,`${kind}: sharing in the top bar`);
   await shot(step);
   if(kind==='folder'){
    await press(page.getByTestId('oc-folder-row').nth(1));
    ok(/tyytyvaisyys/.test(await page.getByTestId('oc-panel-title').innerText()),'a file of the folder opens in place');
    await press(page.getByTestId('oc-back'));
    await page.getByTestId('oc-folder').waitFor();checks++;
   }
   await press(page.getByTestId('oc-open-tab'));
   await page.getByTestId('oc-tab').waitFor();checks++;
   ok(await page.getByTestId('oc-tab').getAttribute('data-kind')===kind,`${kind} opens in its own tab`);
   if(d===0||(d===2&&kind==='csv')) await shot(`7-valilehti-${step.slice(2)}`);
   await press(page.getByTestId('oc-tab-close'));
   await page.getByTestId('oc-tab').waitFor({state:'detached'});
   await closeIt();
  }
  // Make the table public.
  if(d<2){
   await press(cardOf('csv'));
   await expectOpen('csv');
   await press(page.locator('[data-testid="oc-panel"] [data-testid="oc-public"]'));
   ok(await page.locator('[data-testid="oc-panel"] [data-testid="oc-copy"]').isVisible(),'Kopioi linkki when public');
   ok(await page.locator('[data-testid="oc-panel"] [data-testid="oc-until"]').isVisible(),'the date when public');
   await shot('6-julkinen');
   await press(page.locator('[data-testid="oc-panel"] [data-testid="oc-public"]'));
   ok(await page.locator('[data-testid="oc-panel"] [data-testid="oc-copy"]').count()===0,'private again');
   await closeIt();
  }else{
   await press(cardOf('csv').getByTestId('oc-pill'));
   await page.getByTestId('oc-share-pop').waitFor();checks++;
   ok(await panel.count()===0,'the mark shares without opening the item');
   await press(page.locator('[data-testid="oc-share-pop"] [data-testid="oc-public"]'));
   ok(await cardOf('csv').getByTestId('oc-pill').getAttribute('data-public')==='true','the card shows the globe');
   await shot('6-julkinen');
   await press(page.locator('[data-testid="oc-share-pop"] [data-testid="oc-public"]'));
   await page.keyboard.press('Escape');
   await page.getByTestId('oc-share-pop').waitFor({state:'detached'});checks++;
  }
  await press(page.getByTestId('oc-chip'));
  await page.getByTestId('oc-list').waitFor();checks++;
  ok(await page.getByTestId('oc-list-row').count()===6,'six entries in the list');
  await shot('8-lista');
  await press(page.getByTestId('oc-list-row').nth(2));
  await panel.waitFor();checks++;
  await press(page.getByTestId('oc-back'));
  await page.getByTestId('oc-list').waitFor();checks++;
  await press(page.locator('[data-testid="oc-list"] [aria-label="Sulje"]'));
  await page.getByTestId('oc-list').waitFor({state:'detached'});checks++;
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
