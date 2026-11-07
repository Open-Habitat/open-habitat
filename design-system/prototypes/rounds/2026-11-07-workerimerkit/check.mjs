// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. For
// "Nyt" (production unchanged) and each direction: the default view with the
// production Workerit panel open over five live and eight ended workers and
// the sheet of every state beside it; a close-up of the strip; the same view
// when the agent's wait is not readable (the 7.11. case); on the phone also
// the sheet and the rail drawer. Screenshots at device scale factor 2 at
// 1440 px and 390 px (touch), light and dark, named
// r1-<direction>-<step>-<width>-<theme>. The console must stay clean.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-07-workerimerkit';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['0-nyt','1-pallot','2-kotelo','3-taytto'];
let checks=0;const errors=[];
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
 for(const d of [0,1,2,3]){
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.rq-review.variant-${d}`).waitFor({state:'attached'});
  const shot=async(step)=>{await page.waitForTimeout(300);await fits();await page.screenshot({path:`${out}/r1-${names[d]}-${step}-${tag}.png`});};
  assert.match(await page.getByTestId('direction-lines').locator('li[aria-current]').innerText(),new RegExp(`^${d?d+' ':'Nyt'}`));checks++;
  // The default view: the production panel is open on the Workerit tab.
  await page.locator('.ah-bg-pop [data-testid="spinoff-worker-badge-wait"]').waitFor();checks++;
  const pill=page.getByTestId('background-spinoffs');
  if(d===0){
   ok(await pill.locator('.ah-bg-wait-dot.ah-background-dot').count()===2,'today: two waited marks');
   ok(await pill.locator('.ah-bg-wait-dot.nowait').count()===1,'today: one dashed ring');
  }else{
   await pill.locator('.wb-pill-marks .wb-m').first().waitFor();
   ok(await pill.locator('.wb-pill-marks .wb-m').count()===9,'five live and four ended marks in the pill');
   ok(await pill.locator('.wb-pill-marks .wb-m[data-k$="-w"]').count()===2,'two waited workers');
   ok(!(await pill.locator('.ah-bg-marks:not(.wb-pill-marks)').first().isVisible()),'production marks hidden');
   if(d===2) ok(await pill.locator('.wb-capsule, [data-testid="wb-capsule"]').count()===1,'one capsule in the pill');
   ok(await page.locator('.ah-bg-row[data-kind="spin"] .wb-row-mark .wb-m, .ah-bg-row[data-kind="spin"] .wb-row-mark svg').count()>=7,'row marks replaced');
  }
  if(!mobile){
   ok(await page.getByTestId('wb-sheet').isVisible(),'the sheet beside the view');
   ok(await page.locator('[data-testid="agent-item-rupeama"]').isVisible(),'rail visible');
   if(d) ok(await page.locator('[data-testid="agent-item-rupeama"] .wb-rail').count()===1,'rail mark replaced');
  }
  await shot('0-oletus');
  await page.evaluate(()=>document.activeElement?.blur());
  const b=await page.getByTestId('background-work').boundingBox();ok(b,'strip');
  await page.screenshot({path:`${out}/r1-${names[d]}-0-lahi-${tag}.png`,clip:mobile?{x:0,y:Math.max(0,b.y-8),width,height:Math.min(b.height+16,844-Math.max(0,b.y-8))}:{x:Math.max(0,b.x-12),y:Math.max(0,b.y-8),width:Math.min(b.width+24,720),height:b.height+16}});
  // The agent waits, but its run ids came from the shell and were not read.
  await page.locator('#wait').selectOption('unread');
  await page.locator('.ah-bg-pop [data-testid="spinoff-worker-badge-wait"]').waitFor();
  if(d===0){await page.waitForFunction(()=>document.querySelectorAll('[data-testid="background-spinoffs"] .ah-bg-wait-dot.nowait').length===2);checks++;}
  else{await page.locator('[data-testid="background-spinoffs"] .wb-m[data-k="unread"]').first().waitFor();checks++;}
  await shot('1-tunnistamaton');
  await page.locator('#wait').selectOption('read');
  await page.locator('.ah-bg-pop [data-testid="spinoff-worker-badge-wait"]').waitFor();
  if(mobile){
   await page.getByTestId('wb-sheet-toggle').click();
   await page.getByTestId('wb-sheet').waitFor();checks++;
   await shot('2-merkisto');
   await page.getByTestId('wb-sheet-toggle').click();
   await page.getByTestId('wb-sheet').waitFor({state:'hidden'});checks++;
   await page.getByTestId('navigation-open').click();
   await page.locator('[data-testid="agent-item-rupeama"]').waitFor({state:'visible'});checks++;
   if(d) ok(await page.locator('[data-testid="agent-item-rupeama"] .wb-rail').count()===1,'rail mark replaced');
   await shot('3-sivupalkki');
   await page.keyboard.press('Escape');
   await page.waitForTimeout(200);
  }
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
