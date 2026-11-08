// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. For
// "Nyt" (production unchanged) and each direction, at 1440 px and 390 px
// (touch), light and dark, device scale factor 2, named
// r1-<direction>-<step>-<width>-<theme>:
//   0-oletus  the default view with the direction's list showing (Nyt: the
//             Tiedostot panel; Sivupalkki on the phone: the rail drawer);
//   0-lahi    a close-up of the header's entry control (not Sivupalkki);
//   1-versiot the quarterly report's three versions unfolded (directions);
//   2-nakyma  an older version opened from the list (Nyt: from its card,
//             scrolled up to it in the conversation);
//   3-loyda   the oldest file offer's card (Paneeli: the first version's)
//             found in the conversation from the list (directions).
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
const round='2026-11-08-keskustelun-aineisto';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['0-nyt','1-siru','2-paneeli','3-sivupalkki'];
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
 for(const d of [0,1,2,3]){
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.rq-review.variant-${d}`).waitFor({state:'attached'});
  const shot=async(step)=>{await page.waitForTimeout(350);await fits();await page.screenshot({path:`${out}/r1-${names[d]}-${step}-${tag}.png`});};
  assert.match(await page.getByTestId('direction-lines').locator('li[aria-current]').innerText(),new RegExp(`^${d?d+' ':'Nyt'}`));checks++;
  // Every card is in the conversation in every direction.
  ok(await page.getByTestId('view-offer').count()===6,'six view cards');
  ok(await page.getByTestId('file-offer').count()===4,'four file cards');
  const list=page.getByTestId('ac-list');
  if(d===0){
   await page.getByTestId('file-shelf').waitFor();checks++;
   ok(await list.count()===0,'today: no list of views');
   ok(await page.getByTestId('file-shelf-row').count()===8,'today: eight file rows');
  }else{
   if(d===3&&mobile){await page.getByTestId('navigation-open').click();}
   await list.waitFor();checks++;
   ok(await list.locator('[data-testid="ac-entry"][data-kind="view"]').count()===(d===3?2:3),'view entries');
   if(d!==2) ok(await list.locator('[data-testid="ac-entry"][data-kind="file"]').count()===(d===3?2:4),'file entries');
   else ok(await list.getByTestId('file-shelf-row').count()===8,'production file rows in the panel');
   ok(/tumma/.test(await list.locator('[data-testid="ac-entry"]').first().innerText()),'newest first');
  }
  await shot('0-oletus');
  if(d<3){
   await page.evaluate(()=>document.activeElement?.blur());
   const head=await page.locator('.ah-agent-header').boundingBox();ok(head,'header');
   await page.screenshot({path:`${out}/r1-${names[d]}-0-lahi-${tag}.png`,clip:{x:head.x+Math.max(0,head.width-(mobile?390:620)),y:head.y,width:Math.min(head.width,mobile?390:620),height:Math.min(head.height,120)}});
  }
  if(d===0){
   // Today: the first version is found by scrolling up to its card.
   await page.getByTestId('close-file-shelf').click();
   const first=page.getByTestId('view-offer').first();
   await first.scrollIntoViewIfNeeded();
   await press(first.getByTestId('view-open'));
   await page.getByTestId('view-panel').waitFor();checks++;
   ok(await page.getByTestId('view-frame').count()===1,'view frame');
   await shot('2-nakyma');
   await page.getByTestId('close-view').click();
   continue;
  }
  const quarterly=list.locator('[data-testid="ac-entry"][data-kind="view"]').first();
  await press(quarterly.getByTestId('ac-versions'));
  await quarterly.getByTestId('ac-older').waitFor();
  ok(await quarterly.getByTestId('ac-open-older').count()===2,'two older versions');
  await shot('1-versiot');
  await press(quarterly.getByTestId('ac-open-older').last());
  await page.getByTestId('view-panel').waitFor();checks++;
  ok(/11\.15/.test(await page.getByTestId('view-panel').locator('h2').innerText()),'the first version opened');
  if(d===2) ok(await page.getByTestId('ac-back').isVisible(),'back to the list');
  await shot('2-nakyma');
  // The oldest file offer, found in the conversation from the list.
  // On the phone the view covers the header: close it first.
  if(mobile&&d!==2) await press(page.getByTestId('close-view'));
  if(d===1) await press(page.getByTestId('ac-chip'));
  if(d===2) await press(page.getByTestId('ac-back'));
  if(d===3&&mobile) await page.getByTestId('navigation-open').click();
  if(d===3) {const more=page.getByTestId('ac-rail-more');if(await more.getAttribute('aria-expanded')==='false') await press(more);}
  await list.waitFor();
  // Paneeli lists files as production's rows, which have no way back; it finds the first version.
  let found='[data-testid="file-offer"].ac-found';
  if(d===2){
   const q=list.locator('[data-testid="ac-entry"][data-kind="view"]').first();
   if(!(await q.getByTestId('ac-older').count())) await press(q.getByTestId('ac-versions'));
   await press(q.getByTestId('ac-locate-older').last());
   found='[data-testid="view-offer"].ac-found';
  }else await press(list.locator('[data-testid="ac-entry"][data-kind="file"][data-id^="fc"]').getByTestId('ac-locate'));
  await page.locator(found).waitFor();checks++;
  const card=await page.locator(found).boundingBox();
  ok(card&&card.y>0&&card.y<H,'found card on screen');
  await shot('3-loyda');
  if(d===3&&!mobile){await press(page.getByTestId('ac-rail-more'));}
  if(await page.getByTestId('close-view').count()) await page.getByTestId('close-view').click();
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
