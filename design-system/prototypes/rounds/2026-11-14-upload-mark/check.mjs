// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Walks Nyt and the three directions at 1440 and 390 px in the three themes
// (Päivä, Yö, Kontrasti): the five scenes are there, every unsaved chip keeps
// production's progressbar with the real percentage (37 % large, 64 % and two
// waiting in the batch, 100 % saving, 62 % failed and one waiting), no chip
// mark takes the agent's working state while the agent's own working mark
// shows above the batch, the direction's mark is where it says, and the
// document does not overflow. Then at 1440 Päivä per direction: Toista on the
// small file plays it through to a settled chip, and Yritä uudelleen on the
// failed one clears the banner and the percentage climbs again. Last, reduced
// motion and forced colours at 1440 and 390. Screenshots are full pages at
// device scale 2 named <n>-<direction>-<width>-<theme|mode>.png, and
// close-ups of the chips at scale 4 (<n>-<direction>-closeup-<scene>-<theme>); --quick
// takes only 1440 Päivä.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-14-upload-mark';
const [input,out,flag]=process.argv.slice(2);
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['nyt','taeyttyy','palkki','kehys'];
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};

async function open(width,theme,{reducedMotion='no-preference',forcedColors='none'}={}){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:1000},deviceScaleFactor:2,reducedMotion,forcedColors,hasTouch:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 return page;
}
const pick=async(page,d)=>{await page.locator('.proto-picker-item').nth(d).click();await page.locator(`.um-review[data-direction="${d}"]`).waitFor({state:'attached'});await page.waitForTimeout(300);};
const shot=(page,d,tag)=>page.screenshot({path:`${out}/${d}-${names[d]}-${tag}.png`,fullPage:true});
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const scene=(page,id)=>page.getByTestId(`scene-${id}`);
const bars=(page,id)=>scene(page,id).locator('[role="progressbar"]');
const values=async(page,id)=>Promise.all((await bars(page,id).all()).map(b=>b.getAttribute('aria-valuenow')));

async function scenes(page,d,at){
 eq(await page.locator('.um-scene').count(),5,`${at}: five scenes`);
 eq(await bars(page,'small').count(),0,`${at}: the small file is saved`);
 if(d>0)ok(await scene(page,'small').getByTestId('attachment-saved').isVisible(),`${at}: saved says so in words`);
 eq((await values(page,'large')).join(),'37',`${at}: large at 37`);
 ok((await bars(page,'large').textContent()).includes('37 %'),`${at}: 37 % in the chip`);
 eq((await values(page,'many')).join(),'64,0,0',`${at}: batch: one uploading, two waiting`);
 eq((await values(page,'saving')).join(),'100',`${at}: sent, saving`);
 eq(await bars(page,'saving').getAttribute('aria-valuetext'),'Tallennetaan',`${at}: saving said`);
 eq((await values(page,'failed')).join(),'62,0',`${at}: failed at 62, the next waits`);
 eq(await bars(page,'failed').first().getAttribute('aria-valuetext'),'Tallennus katkesi',`${at}: failure said`);
 eq(await scene(page,'failed').getByTestId('attachment-refusal-retry').count(),1,`${at}: retry offered`);
 // Uploading never wears the agent's working mark; the agent's own does.
 eq(await page.locator('[data-testid="attachment-chips"] .oh-mark[data-state="working"]').count(),0,`${at}: no chip mark is working`);
 eq(await scene(page,'many').locator('.ah-working-progress .oh-mark[data-state="working"]').count(),1,`${at}: the agent's working mark beside the batch`);
 eq(await scene(page,'large').getByTestId('upload-mark').count(),d===0?0:1,`${at}: the mark in the uploading chip`);
 if(d===0)eq(await scene(page,'large').getByTestId('attachment-progress-ring').count(),1,`${at}: production ring`);
 if(d===1){
  const dash=await scene(page,'large').locator('.um-progress').evaluate(e=>parseFloat(e.style.strokeDasharray));
  ok(Math.abs(dash-0.37*81.3)<1.5,`${at}: the ring is drawn to 37 % of the open mark (${dash})`);
 }
 if(d===2)ok((await scene(page,'large').locator('.um-bar > span').evaluate(e=>e.getBoundingClientRect().width/e.parentElement.getBoundingClientRect().width))>0.3,`${at}: bar at 37 %`);
 if(d===3)eq(await scene(page,'many').locator('img.um-settled').count(),1,`${at}: the image settled into its thumbnail`);
 ok(await fits(page),`${at}: document overflow`);
}

try{
for(const width of quick?[1440]:[1440,390])for(const theme of quick?['light']:['light','dark','contrast']){
 const tag=`${width}-${theme}`;
 const page=await open(width,theme);
 await checkPicker(page,round);
 eq(await page.getByTestId('recommendation').count(),1,'the recommendation is on the page');
 for(let d=0;d<4;d++){
  await pick(page,d);
  const at=`${names[d]} ${tag}`;
  eq(await page.locator('.um-lines li[aria-current]').count(),1,`${at}: its line is marked`);
  await scenes(page,d,at);
  await shot(page,d,tag);
 }
 await page.close();
}

{
 const page=await open(1440,'light');
 for(let d=0;d<4;d++){
  await pick(page,d);
  const at=`events ${names[d]}`;
  await page.getByTestId('replay-small').click();
  await page.waitForTimeout(250);
  eq(await bars(page,'small').count(),1,`${at}: replay uploads again`);
  await page.waitForTimeout(2600);
  eq(await bars(page,'small').count(),0,`${at}: replay ends saved`);
  if(d>0){
   eq(await scene(page,'small').getByTestId('attachment-saved').count(),0,`${at}: the saved word goes`);
   eq(await scene(page,'small').locator('.um-settled').count(),1,`${at}: settled into the file icon`);
  }
  await scene(page,'failed').getByTestId('attachment-refusal-retry').click();
  await page.waitForTimeout(1500);
  eq(await scene(page,'failed').getByTestId('attachment-refusal').count(),0,`${at}: retry clears the banner`);
  const now=Number((await values(page,'failed'))[0]);
  ok(now>5&&now<62,`${at}: retry starts over and climbs (${now})`);
  await shot(page,d,'events-1440-light');
 }
 await page.close();

 // Close-ups at device scale 4: the chips are small in a full page.
 {
  const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:4});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
  for(const theme of quick?['light']:['light','dark','contrast']){
   await page.goto('http://prototype.test/');
   await page.locator('#theme').selectOption(theme);
   for(let d=0;d<4;d++){
    await pick(page,d);
    for(const id of ['large','many','saving','failed'])
     await scene(page,id).getByTestId('attachment-chips').screenshot({path:`${out}/${d}-${names[d]}-closeup-${id}-${theme}.png`,animations:'disabled'});
   }
  }
  await page.close();
 }

 for(const width of quick?[1440]:[1440,390]){
  const calm=await open(width,'light',{reducedMotion:'reduce'});
  for(let d=0;d<4;d++){
   await pick(calm,d);
   const at=`reduced ${names[d]} ${width}`;
   await scenes(calm,d,at);
   if(d===1){
    const dot=await scene(calm,'saving').locator('.oh-dot').evaluate(e=>({a:getComputedStyle(e).animationName,t:getComputedStyle(e).transform}));
    eq(dot.a,'none',`${at}: still`);
    ok(dot.t!=='none',`${at}: the resident stands in the door while saving`);
   }
   await shot(calm,d,`${width}-reduced`);
  }
  await calm.close();
  const forced=await open(width,'light',{forcedColors:'active'});
  for(let d=0;d<4;d++){
   await pick(forced,d);
   const at=`forced ${names[d]} ${width}`;
   await scenes(forced,d,at);
   if(d===3)eq(await scene(forced,'large').locator('.um-bar').evaluate(e=>getComputedStyle(e).display),'block',`${at}: the fill becomes a bar`);
   await shot(forced,d,`${width}-forced`);
  }
  await forced.close();
 }
}
}finally{await browser.close();}
assert.deepEqual(errors,[],'console errors');
console.log(`${checks} checks passed`);
