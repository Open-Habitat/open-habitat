// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. For
// each direction, at 1440 px and 390 px (touch), light and dark, device
// scale factor 2, named r2-<direction>-<step>-<width>-<theme>:
//   0-oletus  the default view of the Jaetut page;
//   1-auki    the folder Testikuvat opened (A, C: the panel beside, on a
//             phone over the page; B: the share shown large);
//   2-kesto   the public view Testikierros 7.11.'s duration menu;
//   3-kopioi  its link copied;
//   4-tyhja   the page with nothing shared yet.
// Between 3 and 4 the removed item's address is deleted through the dialog.
// It asserts what each direction promises on its default view: A sections
// the ten shares by state in a grid with Kopioi linkki on the public tiles;
// B lists them beside the newest shown large (on a phone the list alone);
// C puts the conversations on a timeline with their cards and opens nothing.
// The console must stay clean and nothing may overflow sideways.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-09-jaetut-sivu';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['a-galleria','b-lista','c-aikajana'];
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const runs=[{width:1440,theme:'light'},{width:1440,theme:'dark'},{width:390,theme:'light'},{width:390,theme:'dark'}];
try{
for(const {width,theme} of runs){
 const mobile=width===390,H=mobile?844:900;
 // The clipboard needs a secure origin; the page is served from https.
 const context=await browser.newContext({viewport:{width,height:H},deviceScaleFactor:2,reducedMotion:'reduce',isMobile:mobile,hasTouch:mobile,permissions:['clipboard-read','clipboard-write']});
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('https://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));
 await page.goto('https://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 await checkPicker(page,round);
 const tag=`${width}-${theme}`;
 const fits=async()=>ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'document overflow');
 const press=async(loc)=>{await loc.scrollIntoViewIfNeeded();await (mobile?loc.tap():loc.click());};
 for(const d of [0,1,2]){
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.rq-review.variant-${d}`).waitFor({state:'attached'});
  const shot=async(step)=>{await page.waitForTimeout(250);await fits();await page.screenshot({path:`${out}/r2-${names[d]}-${step}-${tag}.png`});};
  assert.match(await page.getByTestId('direction-lines').locator('li[aria-current]').innerText(),new RegExp(`^${'ABC'[d]} `));checks++;
  const section=page.getByTestId('js-section');
  await section.waitFor();checks++;
  ok(await page.getByTestId('rail-shares').count()===1,'a page under Etusivu');
  const rows=section.getByTestId('js-row');
  const row=(t)=>rows.filter({hasText:t}).first();
  const detail=page.getByTestId('js-detail'),pane=page.getByTestId('js-pane');
  ok(await rows.count()===10,'all ten shares');
  if(d===0){
   ok(await section.getByTestId('js-group').count()===3,'three state groups');
   ok(await section.locator('[data-group="public"] [data-testid="js-row"]').count()===2,'two public now');
   ok(await section.getByTestId('js-copy').count()===2,'Kopioi linkki on both public tiles');
   ok(await pane.count()===0,'nothing open by default');
  }
  if(d===1){
   if(mobile)ok(await detail.count()===0,'the list alone on a phone');
   else{
    ok(/Asetukset › Tili/.test(await detail.innerText()),'the newest shown large');
    ok(await detail.locator('input[readonly]').isVisible(),'its address shown');
   }
  }
  if(d===2){
   ok(await section.getByTestId('js-group').count()===6,'five conversations and the removed item');
   ok(await section.locator('time').count()===6,'each on the timeline with its date');
   ok(await pane.count()===0,'nothing open by default');
  }
  await shot('0-oletus');

  // 1: the folder opened.
  await press(row('Testikuvat').getByTestId(d===2?'offer-open':'js-open'));
  if(d===1){await detail.filter({hasText:'Testikuvat'}).waitFor();checks++;}
  else{await pane.filter({hasText:'Testikuvat'}).waitFor();checks++;}
  await shot('1-auki');
  if(d===1){if(mobile){await press(page.getByTestId('js-back'));await detail.waitFor({state:'detached'});checks++;}}
  else{await press(page.getByTestId('js-pane-close'));await pane.waitFor({state:'detached'});checks++;}

  // 2-3: the public view's duration and link.
  let scope=row('Testikierros 7.11.');
  if(d===1){await press(row('Testikierros 7.11.').getByTestId('js-open'));scope=detail;await detail.filter({hasText:'Testikierros 7.11.'}).waitFor();checks++;}
  if(d===2&&!mobile)await scope.hover();
  ok(/7\.12\./.test(await scope.innerText()),'its expiry shown');
  await press(scope.getByTestId('view-public-until'));
  await page.locator('.ah-view-offer-durations').waitFor();checks++;
  await shot('2-kesto');
  await page.keyboard.press('Escape');
  await page.locator('.ah-view-offer-durations').waitFor({state:'detached'});checks++;
  if(d===2&&!mobile)await scope.hover();
  const copy=scope.getByTestId(d===2?'view-copy-link':'js-copy');
  await press(copy);
  await scope.locator('[data-copied="yes"]').waitFor();checks++;
  if(d===1)ok(await page.evaluate(()=>navigator.clipboard.readText())===await detail.locator('input[readonly]').inputValue(),'the shown address on the clipboard');
  ok(/^https:\/\/birch\.habitat\.example\/n\//.test(await page.evaluate(()=>navigator.clipboard.readText())),'a /n/ address copied');
  await shot('3-kopioi');
  if(d===1&&mobile){await press(page.getByTestId('js-back'));await detail.waitFor({state:'detached'});checks++;}

  // The removed item's address deleted for good.
  let bin=row('vanha kortti').getByTestId('js-remove');
  if(d===1){await press(row('vanha kortti').getByTestId('js-open'));bin=detail.getByTestId('js-remove');}
  await press(bin);
  await page.getByTestId('js-remove-dialog').waitFor();checks++;
  await press(page.getByTestId('js-remove-confirm'));
  await page.getByTestId('js-status').filter({hasText:'Osoite poistettu'}).waitFor();checks++;
  ok(await rows.count()===9,'one address fewer');

  // 4: nothing shared yet.
  await page.locator('#empty').check();
  await page.getByTestId('js-empty').waitFor();checks++;
  ok(await page.getByTestId('js-row').count()===0,'no rows');
  ok(await page.getByTestId('rail-shares').locator('.ah-rail-count').count()===0,'no count in the rail');
  await shot('4-tyhja');
  await page.locator('#empty').uncheck();
  await page.getByTestId('js-row').first().waitFor();checks++;
 }
 await context.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
