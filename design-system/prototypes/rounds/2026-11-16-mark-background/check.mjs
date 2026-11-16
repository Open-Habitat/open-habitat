// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Walks Nyt and the three directions at 1440 and 390 px in Päivä, Yö and
// Kontrasti with reduced motion: every row is in its production section,
// the round marks exactly the rows whose conversation has a process its
// direction assumes the host reports (Nyt: none), each direction's sign is
// drawn on those rows only (Lamppu: the lamp, and no end dot; Vaeltava ovi:
// the drifting door and a done door ajar; Takahuone: the back room), the
// end dot is where the direction keeps it, and the document does not
// overflow. At 390 the rail opens from the menu. Then: the review's Liike
// toggle stops the door, forced colours keep the signs, opening the read
// reply keeps the sign, the sleep ending removes it, English last.
// Screenshots at device scale 2, <n>-<direction>-<width>-<theme>.png, plus
// a 4x crop of the rail's rows per direction (marks-<n>-<theme>.png).
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-16-mark-background';
const [input,out,flag]=process.argv.slice(2);
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['nyt','lamppu','ovi','takahuone'];
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};

async function open(width,theme,opts={}){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:1000},deviceScaleFactor:opts.scale??2,reducedMotion:opts.motion?'no-preference':'reduce',forcedColors:opts.forced?'active':'none',hasTouch:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 return page;
}
const pick=async(page,d)=>{await page.locator('.proto-picker-item').nth(d).click();await page.locator(`.ra-review[data-direction="${d}"]`).waitFor({state:'attached'});await page.waitForTimeout(150);};
const shot=(page,d,tag)=>page.screenshot({path:`${out}/${d}-${names[d]}-${tag}.png`});
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const inSection=(page,section,id)=>page.locator(`[data-testid="${section}"] [data-testid="agent-item-${id}"]`).count();
const row=(page,id)=>page.locator(`[data-testid="agent-item-${id}"]`);
const marked=page=>page.evaluate(()=>[...document.querySelectorAll('li[data-bg]')].map(l=>l.dataset.testid.replace('agent-item-','')).sort());
const dots=page=>page.evaluate(()=>[...document.querySelectorAll('.ah-nav-service')].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.closest('li').dataset.testid.replace('agent-item-','')).sort());
const pseudo=(page,id,which)=>row(page,id).locator('.ah-row-mark-hit').evaluate((e,w)=>getComputedStyle(e,w).content,which);
const ring=(page,id)=>row(page,id).locator('.oh-ring').evaluate(e=>{const s=getComputedStyle(e);return {anim:s.animationName,dash:s.strokeDasharray};});
const markState=(page,id)=>row(page,id).locator('svg.oh-mark').getAttribute('data-state');

const BG=['bench','form','preview','report','tiles'];
const TODAY_DOTS=['form','preview'];

async function directionChecks(page,d,at){
 eq(await inSection(page,'rail-yours','preview'),1,`${at}: unread reply in Sinun vuorosi`);
 eq(await inSection(page,'rail-yours','form'),1,`${at}: read reply in Sinun vuorosi`);
 eq(await inSection(page,'rail-yours','a11y'),1,`${at}: a11y in Sinun vuorosi`);
 for(const id of ['release','tiles','bench'])eq(await inSection(page,'rail-running',id),1,`${at}: ${id} in Käynnissä`);
 eq(await inSection(page,'rail-quiet','report'),1,`${at}: the non-waking sleep's conversation is quiet`);
 eq(await inSection(page,'rail-quiet','receipts'),1,`${at}: receipts quiet`);
 // Production marks for the states.
 eq(await markState(page,'form'),'read',`${at}: read mark`);
 eq(await markState(page,'preview'),'waiting',`${at}: your-turn mark`);
 eq(await markState(page,'bench'),'background',`${at}: background mark`);
 eq(await markState(page,'report'),'done',`${at}: quiet row's mark`);
 eq(await marked(page),d===0?[]:BG,`${at}: rows with a running process`);
 eq(await dots(page),d===0?TODAY_DOTS:d===1?[]:['form','preview','report','tiles'],`${at}: end dots`);
 for(const id of [...BG,'release','a11y','receipts']){
  const has=d>0&&BG.includes(id);
  eq(await pseudo(page,id,'::after')!=='none',has&&d===1,`${at}: ${id} lamp`);
  eq(await pseudo(page,id,'::before')!=='none',has&&d===3,`${at}: ${id} back room`);
 }
 if(d===2){
  eq((await ring(page,'form')).dash.startsWith('81.3'),true,`${at}: read door open`);
  eq((await ring(page,'report')).dash.startsWith('81.3'),true,`${at}: done door ajar`);
  ok(!(await ring(page,'receipts')).dash.startsWith('81.3'),`${at}: a done row without a process stays shut`);
 }
 // The lamp and the back room stay inside the rail.
 const rail=await page.locator('.ah-rail').boundingBox();
 const hit=await row(page,'form').locator('.ah-row-mark-hit').boundingBox();
 ok(rail&&hit&&hit.x>=rail.x,`${at}: mark inside the rail`);
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
  eq(await page.locator('.ra-lines li[aria-current]').count(),1,`${at}: its line is marked`);
  if(width===390){
   await page.getByTestId('navigation-open').click();
   await page.waitForTimeout(250);
   ok(await page.locator('[data-testid="rail-yours"]').isVisible(),`${at}: the rail opens from the menu`);
  }
  ok(await fits(page),`${at}: document overflow`);
  await directionChecks(page,d,at);
  await shot(page,d,tag);
  if(width===390){await page.keyboard.press('Escape');await page.waitForTimeout(150);}
 }
 await page.close();
}

// 4x crops of the rows, the marks' own size made visible.
for(const theme of quick?['light']:['light','dark','contrast']){
 const page=await open(1440,theme,{scale:4});
 for(let d=0;d<4;d++){
  await pick(page,d);
  const top=await page.locator('[data-testid="rail-yours"]').boundingBox();
  const bottom=await page.locator('[data-testid="rail-quiet"]').boundingBox();
  await page.screenshot({path:`${out}/marks-${d}-${names[d]}-${theme}.png`,clip:{x:top.x,y:top.y,width:top.width,height:bottom.y+bottom.height-top.y}});
 }
 await page.close();
}

{
 // Motion on: the door drifts; the review's Liike toggle stops it.
 const page=await open(1440,'light',{motion:true});
 await pick(page,2);
 eq((await ring(page,'form')).anim,'oh-drift','motion: the read row\'s door drifts');
 await page.locator('#motion').selectOption('off');
 eq((await ring(page,'form')).anim,'none','Liike vähennetty stops the door');
 eq((await ring(page,'form')).dash.startsWith('81.3'),true,'still: the door stays open off its corner');
 await page.locator('#motion').selectOption('on');
 // Events.
 await pick(page,1);
 await page.getByTestId('event-read').click();
 eq(await markState(page,'preview'),'read','events: the opened reply is read');
 ok((await marked(page)).includes('preview'),'events: the read row keeps its lamp');
 await page.getByTestId('event-stop').click();
 ok(!(await marked(page)).includes('report'),'events: the sleep ended, the lamp goes out');
 eq(await inSection(page,'rail-quiet','report'),1,'events: the row stays quiet');
 await shot(page,1,'events-1440-light');
 await page.getByTestId('event-reset').click();
 ok((await marked(page)).includes('report'),'events: reset');
 await page.close();

 // Forced colours keep the signs.
 const fc=await open(1440,'dark',{forced:true});
 for(const d of [1,3]){
  await pick(fc,d);
  const color=await row(fc,'form').locator('.ah-row-mark-hit').evaluate((e,w)=>{const s=getComputedStyle(e,w);return w==='::after'?s.backgroundColor:s.borderRightColor;},d===1?'::after':'::before');
  ok(color&&color!=='rgba(0, 0, 0, 0)','forced colours: the sign keeps a colour');
  await shot(fc,d,'forced-1440');
 }
 await fc.close();

 const en=await open(1440,'light');
 await en.locator('#language').selectOption('en');
 await pick(en,1);
 ok((await en.locator('[data-testid="rail-yours"] h2').textContent()).includes('Your turn'),'English: production heading');
 ok((await row(en,'form').getAttribute('title')).includes('Running in the background: vite --port 5174'),'English: the row says what runs');
 ok((await row(en,'report').getAttribute('title')).includes('sleep 900'),'English: the quiet row says what runs');
 await shot(en,1,'en-1440-light');
 await en.close();
 const enPhone=await open(390,'dark');
 await enPhone.locator('#language').selectOption('en');
 await pick(enPhone,1);
 await enPhone.getByTestId('navigation-open').click();
 await enPhone.waitForTimeout(250);
 ok(await fits(enPhone),'English phone fits');
 await shot(enPhone,1,'en-390-dark');
 await enPhone.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[],'console errors');
console.log(`${checks} checks passed`);
