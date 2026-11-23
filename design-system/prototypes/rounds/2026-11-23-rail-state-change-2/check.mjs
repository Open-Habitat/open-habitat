// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// The page is served the way a Habitat view is: with the view's sandbox CSP
// (opaque origin, connect-src/frame-src 'none'), and the check fails on any
// iframe, any request beyond the document, any navigation, any console error.
// First the round directory: no image or HTML file and nothing over 100 KB.
// Then, at 1440 × 900:
//  - Default view of every direction (auto-play on): the first change plays
//    by itself and the direction's motion runs (data-fx on .rsc-shell lists
//    what ran; A travel+glow+roll, B sweep, C roll of count and time).
//  - The whole script stepped in every direction, Päivä and Yö: each step's
//    motions; a start never glows or sweeps; the question out of view
//    reaches production's edge chip; five at once: A slides all without a
//    glow, B one band over Sinun vuorosi, C rolls the counts once.
//  - Reduced motion (Playwright's reducedMotion): A's still tint, B's still
//    outline, C's ring, and no running animation anywhere in the rail.
//  - Phone view on the desktop window: a 390 px box with production's
//    phone toolbar (menu button), the drawer closed; A flies the name into
//    the button and the badge then says 1; B sweeps the toolbar; C rolls.
//  - A real 390 × 844 window: the panel above, the phone layout on the rest.
//  - Viisi kerralla button; English once; the picker.
// Screenshots: d<n>-<what>-<theme>.png, some taken mid-motion.
import {createRequire} from 'node:module';
import {dirname,resolve,join,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync,readdirSync,statSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-23-rail-state-change-2';
const [input,out,flag]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <out-dir> [--quick]');process.exit(2);}
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};
for(const f of readdirSync(here)){
 ok(!['.png','.jpg','.jpeg','.avif','.webp','.html'].includes(extname(f).toLowerCase()),`round directory holds ${f}`);
 ok(statSync(join(here,f)).size<100*1024,`${f} is over 100 KB`);
}
// The gateway's view policy (internal/gateway/views_linux.go) without a host.
const CSP="sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none'; object-src 'none'; manifest-src 'none'; form-action 'none'; base-uri 'none'";
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const wait=(page,ms=250)=>page.waitForTimeout(ms);
async function open(query,{reduced=false,width=1440,height=900}={}){
 const page=await browser.newPage({viewport:{width,height},reducedMotion:reduced?'reduce':'no-preference'});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 let docs=0;
 page.on('request',r=>{if(r.resourceType()==='document')docs++;else errors.push(`request: ${r.url().slice(0,80)}`);});
 page.on('framenavigated',f=>{if(f!==page.mainFrame())errors.push('a frame navigated');});
 await page.route('**/*',r=>r.request().url().startsWith('http://prototype.test/')&&r.request().resourceType()==='document'
  ?r.fulfill({contentType:'text/html',body:html,headers:{'content-security-policy':CSP}}):r.abort());
 await page.goto(`http://prototype.test/${query}`);
 await wait(page,600);
 page.docs=()=>docs;
 return page;
}
const fx=page=>page.locator('.rsc-shell').getAttribute('data-fx').then(v=>(v??'').split(' ').filter(Boolean));
const has=(list,...want)=>want.every(w=>list.includes(w));
const next=async page=>{await page.getByTestId('event-next').click();};
const shot=(page,name)=>page.screenshot({path:join(out,`${name}.png`)});
const inSection=(page,id,sec)=>page.locator(`[data-testid="rail-${sec}"] li[data-testid="agent-item-${id}"]`).count();
const running=(page,sel)=>page.locator(sel).evaluate(e=>e.getAnimations({subtree:true}).filter(a=>a.playState==='running').length);
const sameView=async(page,label)=>{
 eq(await page.locator('iframe').count(),0,`${label}: no iframe`);
 eq(page.docs(),1,`${label}: one document, no navigation`);
 eq(await page.evaluate(()=>origin),'null',`${label}: served sandboxed (opaque origin)`);
};

// Default view: the difference shows without touching anything.
const first=[['travel:r1','glow:r1','roll:yours'],['sweep:r1'],['roll:yours','roll:time-r1']];
for(let d=0;d<3;d++){
 const page=await open(`?v=${d+1}`);
 await checkPicker(page,round);
 await page.waitForFunction(()=>document.querySelector('.rsc-shell')?.dataset.step==='1',null,{timeout:3000});
 await wait(page,d===0?200:300);
 await shot(page,`d${d}-default-mid`);
 ok(has(await fx(page),...first[d]),`d${d} default: ${first[d]} ran (${await fx(page)})`);
 eq(await page.getByTestId('direction-lines').locator('li').count(),3,`d${d}: three lines at the top`);
 ok((await page.getByTestId('recommendation').innerText()).includes('A'),`d${d}: recommendation`);
 await sameView(page,`d${d} default`);
 await page.close();
}

// The whole script, stepped.
for(let d=0;d<3;d++){
 for(const theme of quick?['light']:['light','dark']){
  const page=await open(`?v=${d+1}&auto=0&theme=${theme}`);
  const label=`d${d} ${theme}`;
  ok(await page.getByTestId('rail-yours-empty').isVisible(),`${label}: Sinun vuorosi empty at start`);
  await next(page);await wait(page,280);
  await shot(page,`d${d}-1-turn-ends-mid-${theme}`);
  eq(await inSection(page,'r1','yours'),1,`${label}: r1 in Sinun vuorosi`);
  ok(has(await fx(page),...first[d]),`${label}: step 1 motion`);
  if(d===0)ok(await running(page,'li[data-testid="agent-item-r1"]')>0,`${label}: r1 is moving`);
  await wait(page,1800);
  eq(await page.locator('[data-rsc-glow],[data-rsc-sweep],[data-rsc-roll]').count(),0,`${label}: motion is over within 2 s`);
  await next(page);await wait(page,200);
  let f=await fx(page);
  ok(!f.some(x=>/^(glow|sweep|still|outline):/.test(x)),`${label}: a start neither glows nor sweeps (${f})`);
  if(d===0)ok(has(f,'travel:q1','roll:running'),`${label}: the start slides`);
  if(d===2)ok(has(f,'roll:running'),`${label}: the start rolls Käynnissä`);
  await wait(page,900);
  await next(page);await wait(page,200);
  f=await fx(page);
  ok(has(f,[`glow:r3`,`sweep:r3`,`roll:time-r3`][d]),`${label}: failure in place (${f})`);
  await wait(page,900);
  await next(page);await wait(page,400);
  const reg=await page.getByTestId('rail-conversations').boundingBox();
  await next(page);await wait(page,250);
  await shot(page,`d${d}-5-out-of-view-mid-${theme}`);
  await wait(page,1400);
  const r4=await page.locator('li[data-testid="agent-item-r4"]').boundingBox();
  ok(r4.y+r4.height<=reg.y+30,`${label}: the question is out of view above`);
  ok(await page.getByTestId('rail-beyond-above-yours').isVisible(),`${label}: production's edge chip above`);
  f=await fx(page);
  ok(has(f,['roll:rail-beyond-above-yours','sweep:rail-beyond-above-yours','roll:rail-beyond-above-yours'][d]),`${label}: the chip tells it (${f})`);
  if(d===0)ok(f.includes('travel:r4'),`${label}: r4 slides over the edge`);
  await next(page);await wait(page,400);
  await next(page);await wait(page,250);
  await shot(page,`d${d}-7-five-mid-${theme}`);
  f=await fx(page);
  if(d===0){ok(has(f,'travel:r5','travel:r6','travel:r7','travel:q2','travel:q3'),`${label}: five slide`);ok(!f.some(x=>x.startsWith('glow:')),`${label}: no glow in a burst`);}
  if(d===1)ok(f.length===1&&f[0]==='sweep:yours',`${label}: one band over Sinun vuorosi (${f})`);
  if(d===2)ok(has(f,'roll:yours','roll:running'),`${label}: counts roll once`);
  ok((await page.getByTestId('rsc-live').innerText()).includes('5 keskustelua'),`${label}: burst announced once`);
  ok(await page.getByTestId('event-next').isDisabled(),`${label}: script ends`);
  await wait(page,2000);
  await shot(page,`d${d}-7-five-rest-${theme}`);
  await page.close();
 }
}

// Reduced motion: still alternatives, nothing runs.
const still=[['still:r1','hold:yours'],['outline:r1'],['hold:yours']];
for(let d=0;d<3;d++){
 const page=await open(`?v=${d+1}&auto=0`,{reduced:true});
 ok(await page.getByTestId('reduce').isChecked(),`d${d} reduced: the switch follows the device`);
 await next(page);await wait(page,150);
 ok(has(await fx(page),...still[d]),`d${d} reduced: ${still[d]} (${await fx(page)})`);
 eq(await running(page,'.ah-rail'),0,`d${d} reduced: no animation in the rail`);
 await shot(page,`d${d}-1-turn-ends-reduced`);
 await page.close();
}

// Phone view on a desktop window.
for(let d=0;d<3;d++){
 const page=await open(`?v=${d+1}&auto=0&view=phone`);
 const box=await page.getByTestId('phone-frame').boundingBox();
 ok(Math.abs(box.width-390-16)<2,`d${d} phone: a 390 px box`);
 ok(await page.getByTestId('navigation-open').isVisible(),`d${d} phone: production's menu button`);
 ok(!(await page.getByTestId('rail-conversations').isVisible())||!(await page.locator('.ah-mobile-open').count())&&
  (await page.getByTestId('rail-conversations').boundingBox()).x+10<box.x,`d${d} phone: drawer closed`);
 await next(page);await wait(page,d===0?700:300);
 await shot(page,`d${d}-phone-1-mid`);
 const f=await fx(page);
 ok(has(f,['fly','sweep:toolbar','roll:badge'][d]),`d${d} phone: ${f}`);
 if(d===0)ok(await page.getByTestId('rsc-fly').isVisible(),`d${d} phone: the name is in flight`);
 await wait(page,1600);
 eq(await page.getByTestId('navigation-badge').innerText(),'1',`d${d} phone: badge says 1`);
 eq(await page.getByTestId('rsc-fly').count(),0,`d${d} phone: the flight is over`);
 await page.getByTestId('navigation-open').click();await wait(page,500);
 ok(await page.locator('[data-testid="rail-yours"] li[data-testid="agent-item-r1"]').isVisible(),`d${d} phone: drawer shows r1 in Sinun vuorosi`);
 await shot(page,`d${d}-phone-drawer`);
 await sameView(page,`d${d} phone`);
 await page.close();
}

// A real phone window.
{const page=await open('?v=1',{width:390,height:844});
 await checkPicker(page,round);
 ok(await page.getByTestId('navigation-open').isVisible(),'narrow window: phone layout');
 const bar=await page.locator('.rsc-bar').boundingBox();
 const stage=await page.getByTestId('stage').boundingBox();
 ok(stage.y>=bar.y+bar.height-1,'narrow window: panel above the stage');
 await page.waitForFunction(()=>document.querySelector('.rsc-shell')?.dataset.step==='1',null,{timeout:3000});
 await wait(page,600);
 await shot(page,'d0-narrow-window');
 ok((await fx(page)).includes('fly'),'narrow window: the flight plays');
 await page.close();}

// Viisi kerralla on its own.
{const page=await open('?v=1&auto=0');
 await page.getByTestId('play-five').click();
 await page.waitForFunction(()=>document.querySelector('.rsc-shell')?.dataset.step==='1',null,{timeout:3000});
 await wait(page,200);
 ok(has(await fx(page),'travel:r5','travel:q3'),'five button plays the burst');
 ok((await page.getByTestId('event-caption').innerText()).includes('Viisi'),'five caption');
 await page.getByTestId('play-one').click();
 await page.waitForFunction(()=>document.querySelector('.rsc-shell')?.dataset.step==='1',null,{timeout:3000});
 ok((await fx(page)).includes('travel:r1'),'one button plays one change');
 await page.close();}

// English once.
{const page=await open('?v=2&auto=0&lang=en&theme=dark');
 await next(page);await wait(page,300);
 ok((await page.getByTestId('event-caption').innerText()).includes('Spring meeting'),'English caption');
 await shot(page,'d1-1-turn-ends-dark-en');
 await page.close();}

await browser.close();
const real=errors.filter(e=>!/favicon/.test(e));
eq(real.length,0,`console errors, requests or navigation: ${real.join(' | ')}`);
console.log(`ok: ${checks} checks; screenshots in ${out}`);
