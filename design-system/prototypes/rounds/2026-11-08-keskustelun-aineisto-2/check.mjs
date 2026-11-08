// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. For
// "Nyt" (production unchanged) and each riff, at 1440 px and 390 px (touch),
// light and dark, device scale factor 2, named r2-<direction>-<step>-<width>-<theme>:
//   0-oletus   the default view: the strip by the message field, list closed;
//   0-lahi     a close-up of the strip;
//   0-pieni    Kasvava only: the chip shrunk back to its marks and a dot;
//   1-lista    the list open above the strip (riffs);
//   1-workerit Yhteinen only: the same panel on its Workerit tab;
//   2-viereen  an item opened beside: the CSV from the list (riffs), the
//              first view from its card (Nyt);
//   3-ikkunaan the newest view opened from the list as a window (riffs).
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
const round='2026-11-08-keskustelun-aineisto-2';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['0-nyt','1-oma','2-yhteinen','3-kasvava'];
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
  const shot=async(step)=>{await page.waitForTimeout(350);await fits();await page.screenshot({path:`${out}/r2-${names[d]}-${step}-${tag}.png`});};
  assert.match(await page.getByTestId('direction-lines').locator('li[aria-current]').innerText(),new RegExp(`^${d?d+' ':'Nyt'}`));checks++;
  ok(await page.getByTestId('view-offer').count()===6,'six view cards');
  ok(await page.getByTestId('file-offer').count()===4,'four file cards');
  const workers=page.getByTestId('background-spinoffs');
  const chip=page.getByTestId('ac-chip');
  await page.locator('.ah-bg-badges, [data-testid="ac-chip"]').first().waitFor();
  if(d===0){ok(await chip.count()===0,'today: no assets chip');ok(await workers.getAttribute('data-working')==='2','two workers');}
  if(d===1||d===3){ok(await workers.isVisible(),'Workerit beside');ok(await chip.isVisible(),'assets chip');
   const w=await workers.boundingBox(),c=await chip.boundingBox();ok(Math.abs((w.y+w.height/2)-(c.y+c.height/2))<2&&c.x>w.x,'chip on the same line, after Workerit');}
  if(d===2){ok(await workers.count()===0,'one merged chip only');ok(/Workerit 2/.test(await chip.getAttribute('aria-label')),'merged chip names the workers');}
  if(d===3) ok(await chip.getAttribute('data-grown')==='true','grown on arrival');
  await shot('0-oletus');
  await page.evaluate(()=>document.activeElement?.blur());
  const line=await page.locator('.ac-line, [data-testid="background-work"]').first().boundingBox();ok(line,'strip');
  const cx=mobile?0:Math.max(0,line.x-24),cw=mobile?width:Math.min(width-cx,line.width+48);
  await page.screenshot({path:`${out}/r2-${names[d]}-0-lahi-${tag}.png`,clip:{x:cx,y:Math.max(0,line.y-150),width:cw,height:Math.min(H-Math.max(0,line.y-150),line.height+260)}});
  if(d===0){
   const first=page.getByTestId('view-offer').first();
   await first.scrollIntoViewIfNeeded();
   await press(first.getByTestId('view-open'));
   await page.getByTestId('view-panel').waitFor();checks++;
   await shot('2-viereen');
   await page.getByTestId('close-view').click();
   continue;
  }
  if(d===3){
   await page.waitForTimeout(6500);
   ok(await chip.getAttribute('data-grown')===null,'shrunk after a moment');
   ok(await chip.getAttribute('data-unseen')==='true','dot until looked at');
   await shot('0-pieni');
  }
  const list=page.getByTestId('ac-list');
  await press(chip);
  await list.waitFor();checks++;
  ok(await list.locator('[data-testid="ac-entry"][data-kind="view"]').count()===3,'three reports');
  ok(await list.locator('[data-testid="ac-entry"][data-kind="file"]').count()===4,'four file offers');
  ok(/tumma/.test(await list.locator('[data-testid="ac-entry"]').first().innerText()),'newest first');
  const pop=await page.getByTestId('ac-pop').boundingBox(),strip=await chip.boundingBox();
  ok(pop.y+pop.height<=strip.y+1,'the list opens above the strip');
  await shot('1-lista');
  if(d===3) ok(await chip.getAttribute('data-unseen')===null,'looked at: no dot');
  if(d===2){
   await press(page.getByTestId('ac-tab-workers'));
   await page.locator('[data-testid="spinoff-pdf-luvut-tarkistus"]').waitFor();checks++;
   ok(await page.locator('.ac-tab-workers .ah-bg-badges').isHidden(),'no second chips inside the tab');
   await shot('1-workerit');
   await press(page.getByTestId('ac-tab-assets'));
   await list.waitFor();checks++;
  }
  // A file from the list opens beside, in the offer card's place.
  await press(list.locator('[data-testid="ac-entry"][data-kind="file"]').filter({hasText:'Myyntidata Q3'}).getByTestId('ac-open'));
  await page.getByTestId('ac-item').waitFor();checks++;
  ok(await page.getByTestId('ac-pop').count()===0,'the list closed');
  ok((await page.getByTestId('ac-item-title').innerText())==='Myyntidata Q3','the CSV opened');
  ok(await page.getByTestId('ac-table').isVisible(),'its table');
  ok(await page.getByTestId('ac-window').count()===0,'beside, not a window');
  await shot('2-viereen');
  await press(page.getByTestId('ac-item-close'));
  // The same list, the newest view as a window over the conversation.
  await page.locator('#openat').selectOption('window');
  await press(page.getByTestId('ac-chip'));
  await list.waitFor();
  await press(list.locator('[data-testid="ac-entry"][data-kind="view"]').first().getByTestId('ac-open'));
  await page.getByTestId('ac-window').waitFor();checks++;
  ok(/tumma/.test(await page.getByTestId('ac-item-title').innerText()),'the newest view in the window');
  await shot('3-ikkunaan');
  await page.keyboard.press('Escape');
  await page.getByTestId('ac-window').waitFor({state:'detached'});checks++;
  await page.locator('#openat').selectOption('beside');
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
