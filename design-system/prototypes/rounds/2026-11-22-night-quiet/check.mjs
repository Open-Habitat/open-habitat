// node check.mjs <offline.html> <out-dir>
// Authored synthetic component lab, not a host-backed acceptance test.
// First the round directory: no image or HTML file and nothing over 100 KB.
// Desktop (1440 × 900, Päivä and Yö), every direction, at 23.40 with the
// device dark: A and C put the night status line first on the page, above
// the intro and the Äänet card; B has no status line, its Äänet row carries
// the Yö tag and "Päällä, mutta nyt hiljaa" with Soita silti under it, and
// Hiljennä yöllä sits in the same card. Every direction: the preview note
// sits above the tiles, the test note under Testaa ääni, the opened menu's
// Äänet row says night. Soita silti turns the page and the menu to the
// override; Hiljennä taas returns. Pressing a tile still shows it playing.
// At 14.10 with dark mode all day: A and B are silenced, C is not (the
// clock says day). C: moving the start to 0.00 makes 23.40 day. Day:
// no status line anywhere. English once. Phone (390 × 844, touch, the bare
// page) every direction, light and dark: the night state is inside the
// first screen, no sideways scroll. The picker; a clean console.
// Screenshots: d<n>-<what>-<width>-<theme>.png.
import {createRequire} from 'node:module';
import {dirname,resolve,join,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync,readdirSync,statSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-22-night-quiet';
const [input,out]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <out-dir>');process.exit(2);}
mkdirSync(out,{recursive:true});
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
for(const f of readdirSync(here)){
 ok(!['.png','.jpg','.jpeg','.avif','.webp','.html'].includes(extname(f).toLowerCase()),`round directory holds ${f}`);
 ok(statSync(join(here,f)).size<100*1024,`${f} is over 100 KB`);
}
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const wait=(page,ms=250)=>page.waitForTimeout(ms);
async function open(width,query){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:900},deviceScaleFactor:phone?2:1,hasTouch:phone,isMobile:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto(`http://prototype.test/${query}`);
 await wait(page,600);
 return page;
}
const tid=(scope,id)=>scope.locator(`[data-testid="${id}"]`);
const shot=(page,name)=>page.screenshot({path:join(out,`${name}.png`)});
async function pick(page,d){
 await page.locator('.proto-picker-item').nth(d).click();
 await wait(page,400);
}
async function select(page,id,value){await page.locator(`#${id}`).selectOption(value);await wait(page,300);}

for(const theme of ['light','dark']){
 const page=await open(1440,`?theme=${theme}`);
 await checkPicker(page,round);checks++;
 for(const d of [0,1,2]){
  await pick(page,d);
  const s=page.locator('[data-testid="desktop-stage"]');
  const body=tid(s,'sound-settings');
  if(d!==1){
   const status=tid(body,'night-status');
   ok(await status.isVisible(),`d${d} status line visible`);
   const first=await body.evaluate(el=>el.firstElementChild?.getAttribute('data-testid'));
   ok(first==='night-status',`d${d} status line is first, got ${first}`);
   const box=await status.boundingBox();ok(box.y<300,`d${d} status near the top (${box.y})`);
  }else{
   ok(await tid(body,'night-status').count()===0,'B has no status line');
   ok(await tid(body,'master-night-tag').isVisible(),'B master Yö tag');
   ok((await tid(body,'master-state').innerText()).length>10,'B master state words');
   ok(await tid(tid(body,'master-card'),'sound-night').count()===1,'B night row in the master card');
  }
  ok(await tid(body,'preview-bypass').isVisible(),`d${d} preview note`);
  ok(await tid(body,'test-bypass').count()===1,`d${d} test note`);
  const menu=tid(page,'sound-menu-state');
  ok((await menu.getAttribute('data-status'))==='night',`d${d} menu says night`);
  await shot(page,`d${d}-night-1440-${theme}`);
  if(theme==='light'){
   await tid(body,'sound-tile-marimba').click();await wait(page,150);
   ok((await tid(body,'sound-tile-marimba').getAttribute('aria-checked'))==='true',`d${d} tile chosen at night`);
   await tid(body,'night-play-anyway').click();await wait(page);
   ok(await tid(page,'toast').isVisible(),`d${d} override toast`);
   ok(await tid(body,'preview-bypass').count()===0,`d${d} override lifts the preview note`);
   ok((await menu.getAttribute('data-status'))==='plays',`d${d} menu follows the override`);
   await shot(page,`d${d}-override-1440-${theme}`);
   await tid(body,'night-quiet-again').click();await wait(page);
   ok(await tid(body,'preview-bypass').isVisible(),`d${d} quiet again`);
   if(d!==0){
    await tid(page,'menu-play-anyway').click();await wait(page);
    ok(await tid(body,'night-quiet-again').isVisible(),`d${d} menu Soita silti reaches the page`);
    await tid(body,'night-quiet-again').click();await wait(page);
   }
  }
 }
 if(theme==='light'){
  await select(page,'scenario','darkday');
  for(const d of [0,1,2]){
   await pick(page,d);
   const body=tid(page.locator('[data-testid="desktop-stage"]'),'sound-settings');
   const silenced=await tid(body,'preview-bypass').count();
   ok(d===2?silenced===0:silenced===1,`darkday d${d} silenced=${silenced}`);
   await shot(page,`d${d}-darkday-1440-light`);
 }
  await select(page,'scenario','day');
  for(const d of [0,1,2]){
   await pick(page,d);
   const body=tid(page.locator('[data-testid="desktop-stage"]'),'sound-settings');
   ok(await tid(body,'night-status').count()===0&&await tid(body,'preview-bypass').count()===0,`day d${d} quiet page`);
  }
  await shot(page,'d2-day-1440-light');
  await select(page,'scenario','night');
  await pick(page,2);
  {
   const body=tid(page.locator('[data-testid="desktop-stage"]'),'sound-settings');
   await tid(body,'night-start').click();await wait(page);
   const items=page.locator('[role^="menuitem"]');
   ok(await items.count()===9,`C start choices ${await items.count()}`);
   await items.filter({hasText:/klo 0\.00/}).first().click();await wait(page);
   ok(await tid(body,'night-status').count()===0,'C: night from 0.00 makes 23.40 day');
   ok(!(await tid(body,'sound-night-now').getAttribute('data-night')),'C now line says day');
   await shot(page,'d2-clock-moved-1440-light');
   await select(page,'scenario','day');await select(page,'scenario','night');
  }
  await select(page,'language','en');
  await pick(page,2);
  const t=await tid(page.locator('[data-testid="desktop-stage"]'),'night-status-title').innerText();
  ok(/quiet until 07:00/.test(t),`English status: ${t}`);
  await shot(page,'d2-night-1440-light-en');
 }
 await page.close();
}
for(const theme of ['light','dark'])for(const d of [0,1,2]){
 const page=await open(390,`?bare=1&d=${d}&theme=${theme}`);
 const target=d===1?tid(page,'master-night-tag'):tid(page,'night-status');
 const box=await target.boundingBox();
 ok(box&&box.y+box.height<844,`phone d${d} night state on first screen`);
 const wide=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
 ok(wide<=1,`phone d${d} sideways scroll ${wide}`);
 await shot(page,`d${d}-night-390-${theme}`);
 await page.close();
}
await browser.close();
ok(errors.length===0,`console errors: ${errors.join(' | ')}`);
console.log(`${checks} checks passed; screenshots in ${out}`);
