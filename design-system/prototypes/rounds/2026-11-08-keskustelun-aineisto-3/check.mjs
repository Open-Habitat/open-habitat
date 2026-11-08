// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. For
// each riff, at 1440 px and 390 px (touch), light and dark, device scale
// factor 2, named r3-<riff>-<step>-<width>-<theme>:
//   0-oletus    the default view: the list open; on the desktop the CSV open
//               beside and the newest report's row drawn hovered;
//   0-lahi      a close-up of the list;
//   1-valikko   B only: a row's ⋯ menu open;
//   2-paneeli   the newest report opened beside and made public from the
//               panel's top bar (a phone: the panel covers the conversation);
//   3-valilehti its own tab, opened from the riff's place (C: a ⌘-click on
//               the row on the desktop, the panel's top bar on a phone).
// It also checks that pressing the open row again closes the panel, that
// Lataa says it started, and that nothing overflows sideways. The console
// must stay clean.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-08-keskustelun-aineisto-3';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['a-kuvakkeet','b-valikko','c-paneeli'];
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
  // The picker's own press must not count as the reviewer's pointer in the list.
  await page.mouse.move(width-4,4);
  const shot=async(step)=>{await page.waitForTimeout(300);await fits();await page.screenshot({path:`${out}/r3-${names[d]}-${step}-${tag}.png`});};
  assert.match(await page.getByTestId('direction-lines').locator('li[aria-current]').innerText(),new RegExp(`^${'ABC'[d]} `));checks++;
  const list=page.getByTestId('ac-list');
  await list.waitFor();checks++;
  ok(await page.getByTestId('view-offer').count()===6,'six view cards');
  ok(await list.locator('[data-testid="ac-entry"]').count()===7,'three reports and four file offers');
  const rowOf=(text)=>list.locator('.ac-line-row').filter({hasText:text});
  const newest=rowOf('tumma versio'),csv=rowOf('Myyntidata Q3');
  ok(/tumma/.test(await list.locator('[data-testid="ac-entry"]').first().innerText()),'newest first');
  const pop=await page.getByTestId('ac-pop').boundingBox(),chip=await page.getByTestId('ac-chip').boundingBox();
  ok(pop.y+pop.height<=chip.y+1,'the list above the strip');
  if(!mobile){
   ok((await page.getByTestId('ac-item-title').innerText())==='Myyntidata Q3','the CSV open beside');
   ok(await csv.getAttribute('data-open')==='true','its row marked open');
   ok(await newest.getAttribute('data-hover')==='true','the newest row drawn hovered');
  }else ok(await page.getByTestId('ac-item').count()===0,'a phone opens nothing at first');
  // What the default view shows on the hovered (desktop) or every (touch) row.
  const vis=async(loc)=>loc.isVisible();
  if(d===0){
   ok(await vis(newest.getByTestId('ac-act-tab')),'A: icons on the hovered row');
   ok(mobile?await vis(csv.getByTestId('ac-act-tab')):!(await vis(csv.getByTestId('ac-act-tab'))),'A: icons elsewhere only on touch');
  }
  if(d===1){
   ok(await vis(csv.getByTestId('ac-act-tab')),'B: own tab on every row');
   ok(await vis(newest.getByTestId('ac-more')),'B: ⋯ on the hovered row');
   ok(mobile?await vis(csv.getByTestId('ac-more')):!(await vis(csv.getByTestId('ac-more'))),'B: ⋯ elsewhere only on touch');
  }
  if(d===2){
   ok(await list.getByTestId('ac-acts').count()===0,'C: no actions on rows');
   ok(mobile?await list.getByTestId('ac-hint').count()===0:await vis(newest.getByTestId('ac-hint')),'C: the ⌘ hint on the hovered row only on the desktop');
  }
  await shot('0-oletus');
  await page.screenshot({path:`${out}/r3-${names[d]}-0-lahi-${tag}.png`,clip:{x:Math.max(0,pop.x-16),y:Math.max(0,pop.y-16),width:Math.min(width-Math.max(0,pop.x-16),pop.width+32),height:Math.min(H-Math.max(0,pop.y-16),pop.height+chip.height+40)}});
  if(!mobile){
   // The open row pressed again closes the panel; once more opens it.
   await press(csv.getByTestId('ac-open'));
   await page.getByTestId('ac-item').waitFor({state:'detached'});checks++;
   ok(await list.isVisible(),'the list stays open');
   await press(csv.getByTestId('ac-open'));
   await page.getByTestId('ac-item').waitFor();checks++;
  }
  if(d===1){
   await newest.hover();
   await press(newest.getByTestId('ac-more'));
   await page.getByTestId('ac-more-menu').waitFor();checks++;
   await shot('1-valikko');
   await page.keyboard.press('Escape');
   await page.getByTestId('ac-more-menu').waitFor({state:'detached'});checks++;
   if(!(await list.isVisible())) await press(page.getByTestId('ac-chip'));
  }
  // The newest report beside, made public from the panel's top bar.
  await press(newest.getByTestId('ac-open'));
  await page.getByTestId('ac-item').waitFor();checks++;
  ok(/tumma/.test(await page.getByTestId('ac-item-title').innerText()),'the newest report beside');
  if(mobile) ok(!(await list.isVisible()),'a phone closes the list over it');
  const tools=page.getByTestId('ac-item-tools');
  if(d===1){
   await press(tools.getByTestId('ac-more'));
   await page.getByTestId('ac-more-menu').getByTestId('ac-act-public').click();
  }else await press(tools.getByTestId('ac-act-public'));
  await page.getByTestId('ac-item').getByText(/Julkinen \d+\.\d+\. asti/).waitFor();checks++;
  if(d!==1) ok(await tools.getByTestId('ac-act-copy').isVisible(),'Kopioi linkki while public');
  await shot('2-paneeli');
  // Lataa says it started.
  if(d===1){await press(tools.getByTestId('ac-more'));await page.getByTestId('ac-more-menu').getByTestId('ac-act-download').click();}
  else await press(tools.getByTestId('ac-act-download'));
  await page.getByTestId('ac-toast').waitFor();checks++;
  // Its own tab, from the riff's place.
  if(mobile||d===2&&mobile) await press(tools.getByTestId('ac-act-tab'));
  else{
   if(!(await list.isVisible())) await press(page.getByTestId('ac-chip'));
   if(d===2) await newest.getByTestId('ac-open').click({modifiers:['ControlOrMeta']});
   else{await newest.hover();await newest.getByTestId('ac-act-tab').click();}
  }
  await page.getByTestId('ac-tab').waitFor();checks++;
  ok(/tumma/.test(await page.getByTestId('ac-tab').innerText()),'the newest report in its own tab');
  if(!mobile) ok(await page.getByTestId('ac-item').count()===1,'the panel stays beside');
  await shot('3-valilehti');
  await press(page.getByTestId('ac-tab-close'));
  await page.getByTestId('ac-tab').waitFor({state:'detached'});checks++;
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
