// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Walks the three directions in the crowded world (6 / 5 / 30, 40
// workspaces) at 1440 with a 900 px shell (Päivä, Yö, Kontrasti), 1024 ×
// 768 (also in English), 700 and 560 px shells, and the 390 px phone drawer (Päivä, Yö), with
// Hiljaiset open and folded; then the ordinary world (2 / 1 / 5, 24). In
// every case: the direction's line is marked, the whole rail does not
// scroll, the open conversation's row is in sight, the Työtilat heading
// with its new-workspace button and the filter are in sight, the Työtilat
// list is its own scrolling region, and the document does not overflow.
// Scrolling Työtilat to its end leaves the conversations in sight as they were.
// The keys: from the composer, Alt+↓ through every row to the end and Alt+↑
// back, and every opened row is revealed (in sight, not under a sticky
// heading). Direction 1's Alempana foot names the sections with rows
// further down and scrolls to them. Direction 3's Show all opens and closes in place. English last.
// The rows each section shows are printed as a table for result.md.
// Screenshots at device scale 2, <n>-<direction>-<case>.png; --quick takes
// only 1440 light.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-16-rail-scroll';
const [input,out,flag]=process.argv.slice(2);
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['tyotilat-vierii','laatikot','katto'];
let checks=0;const errors=[];const table=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};

// sim hNNN makes the production shell NNN px tall, as in a window of that
// height; the viewport leaves room for the review bar and the picker.
async function open({width,theme='light',world='crowded',sim='h900',quiet='open',lang='fi'}){
 const phone=width===390;
 const height=phone?844:sim==='window'?900:Number(sim.slice(1))+300;
 const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:2,reducedMotion:'reduce',hasTouch:phone,isMobile:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 const q=new URLSearchParams({theme,world,lang,...(sim==='window'?{}:{height:sim}),...(quiet==='folded'?{quiet}:{})});
 await page.goto(`http://prototype.test/?${q}`);
 await page.locator('.rs-review').waitFor({state:'attached'});
 return page;
}
const pick=async(page,d)=>{await page.locator('.proto-picker-item').nth(d).click();await page.locator(`.rs-review[data-direction="${d}"]`).waitFor({state:'attached'});await page.waitForTimeout(150);};
// The whole page, and the rail alone for side-by-side reading.
const shot=async(page,d,tag)=>{
 await page.screenshot({path:`${out}/${d+1}-${names[d]}-${tag}.png`});
 const rail=page.locator('.ah-rail:not(.ah-rail-collapsed)');
 if(await rail.count()&&await rail.isVisible())await rail.screenshot({path:`${out}/rail-${d+1}-${names[d]}-${tag}.png`});
};
const settle=page=>page.waitForTimeout(120);
const opened=page=>page.evaluate(()=>document.querySelector('.ah-rail a[aria-current="page"]')?.closest('li[data-testid^="agent-item-"]')?.dataset.testid.slice(11));

// In sight: inside the window and inside every clipping ancestor up to the
// rail, and the topmost element at its centre is the element itself (not a
// sticky heading or a scroll shade).
const SEEN=`(el)=>{
 if(!el)return false;const r=el.getBoundingClientRect();if(!r.height)return false;
 const top=r.top+2,bottom=r.bottom-2;
 if(top<0||bottom>innerHeight)return false;
 for(let a=el.parentElement;a&&!a.matches('body');a=a.parentElement){
  const o=getComputedStyle(a).overflowY;if(o==='visible')continue;
  const b=a.getBoundingClientRect();if(top<b.top||bottom>b.bottom)return false;
  if(a.matches('.ah-rail'))break;
 }
 const hit=document.elementFromPoint(r.left+Math.min(40,r.width/2),(r.top+r.bottom)/2);
 return !!hit&&el.contains(hit);
}`;
const seen=(page,sel)=>page.evaluate(([sel,f])=>(0,eval)(f)(document.querySelector(sel)),[sel,SEEN]);
const state=page=>page.evaluate(SEEN=>{
 const f=(0,eval)(SEEN);const rail=document.querySelector('.ah-rail');
 const count=t=>[...document.querySelectorAll(`.ah-rail [data-testid="${t}"] li[data-testid^="agent-item-"]`)].filter(f).length;
 const all=t=>document.querySelectorAll(`.ah-rail [data-testid="${t}"] li[data-testid^="agent-item-"]`).length;
 const content=rail.querySelector('.ah-rail-content');
 return {
  yours:`${count('rail-yours')}/${all('rail-yours')}`,
  running:`${count('rail-running')}/${all('rail-running')}`,
  quiet:`${count('rail-quiet')}/${all('rail-quiet')}`,
  ws:`${[...rail.querySelectorAll('.ah-workspace-list > li')].filter(f).length}/${rail.querySelectorAll('.ah-workspace-list > li').length}`,
  regions:[...rail.querySelectorAll('[data-rs-region]')].map(e=>e.matches('.ah-workspace-list')?'ws':e.matches('.rs-convs')?'convs':e.dataset.testid).join('+'),
  railScrolls:content.scrollHeight>content.clientHeight+1&&getComputedStyle(content).overflowY!=='clip',
  railTop:content.scrollTop,
 };
},SEEN);

async function basics(page,d,at){
 eq(await page.locator('.rs-lines li[aria-current]').count(),1,`${at}: its line is marked`);
 const s=await state(page);
 eq(s.railScrolls,false,`${at}: the whole rail does not scroll`);
 eq(s.railTop,0,`${at}: the rail content is not scrolled`);
 const id=await opened(page);
 ok(id,`${at}: the open conversation is selected in the rail`);
 ok(await seen(page,`.ah-rail [data-testid="agent-item-${id}"]`),`${at}: the open row is in sight`);
 ok(await seen(page,'.ah-rail [data-testid="workspace-create"]'),`${at}: new workspace in sight`);
 ok(await seen(page,'.ah-rail [data-testid="workspace-filter"]'),`${at}: the filter in sight`);
 // Sinun vuorosi's conversations are in sight, or direction 1 names them
 // at the region's top.
 ok(Number(s.yours.split('/')[0])>0||(d===0&&await seen(page,'[data-testid="rs-above-yours"]')),`${at}: Sinun vuorosi in sight or named`);
 ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${at}: document overflow`);
 return s;
}
async function scrollWorkspaces(page,at){
 const before=await state(page);
 await page.locator('.ah-workspace-list').evaluate(el=>{el.scrollTop=el.scrollHeight;});await settle(page);
 const after=await state(page);
 eq(`${after.yours} ${after.running} ${after.quiet}`,`${before.yours} ${before.running} ${before.quiet}`,`${at}: the conversations in sight stay when Työtilat scrolls`);
 ok(await page.locator('.ah-workspace-list').evaluate(el=>el.hasAttribute('data-above')),`${at}: the edge cue marks rows above`);
 const last=await page.locator('.ah-workspace-list > li').last();
 ok(await last.evaluate((el,f)=>(0,eval)(f)(el),SEEN),`${at}: the last workspace is reachable`);
 // The row's + (new conversation here) shows on hover and stays reachable.
 await last.hover();
 ok(await last.locator('[data-testid^="workspace-start-"]').isVisible(),`${at}: + new conversation on the last workspace`);
 await page.locator('.ah-workspace-list').evaluate(el=>{el.scrollTop=0;});await settle(page);
}
async function keys(page,d,at){
 const field=page.getByTestId('message-input');
 await field.click();
 // To the top first, then down through every row and back.
 for(let i=0;i<60;i++)await page.keyboard.press('Alt+ArrowUp');await settle(page);
 const first=await opened(page);let steps=0,prev=first;
 for(let i=0;i<60;i++){
  await page.keyboard.press('Alt+ArrowDown');await settle(page);
  const id=await opened(page);if(id===prev)break;prev=id;steps++;
  ok(await seen(page,`.ah-rail [data-testid="agent-item-${id}"]`),`${at}: Alt+↓ reveals ${id}`);
  eq((await state(page)).railTop,0,`${at}: the whole rail did not move for ${id}`);
 }
 ok(steps>=10,`${at}: Alt+↓ walked ${steps} rows`);
 for(let i=0;i<steps;i++){
  await page.keyboard.press('Alt+ArrowUp');await settle(page);
  const id=await opened(page);
  ok(await seen(page,`.ah-rail [data-testid="agent-item-${id}"]`),`${at}: Alt+↑ reveals ${id}`);
 }
 eq(await opened(page),first,`${at}: Alt+↑ back to the first row`);
 return steps;
}

try{
 const page0=await open({width:1440});
 await checkPicker(page0,round);
 eq(await page0.getByTestId('recommendation').count(),1,'the recommendation is on the page');
 await page0.close();

 const cases=quick?[{width:1440,theme:'light',tag:'1440-light'}]:[
  {width:1440,theme:'light',tag:'1440-light'},
  {width:1440,theme:'dark',tag:'1440-dark'},
  {width:1440,theme:'contrast',tag:'1440-contrast'},
  {width:1440,theme:'light',quiet:'folded',tag:'1440-light-folded'},
  {width:1024,sim:'h768',theme:'light',tag:'1024-light'},
  {width:1024,sim:'h768',theme:'light',lang:'en',tag:'1024-light-en'},
  {width:1440,theme:'light',sim:'h700',tag:'h700-light'},
  {width:1440,theme:'dark',sim:'h700',quiet:'folded',tag:'h700-dark-folded'},
  {width:1440,theme:'light',sim:'h560',tag:'h560-light'},
  {width:1440,theme:'light',world:'modest',tag:'modest-1440-light'},
  {width:1440,theme:'light',world:'modest',sim:'h700',tag:'modest-h700-light'},
  {width:390,sim:'window',theme:'light',tag:'390-light'},
  {width:390,sim:'window',theme:'dark',tag:'390-dark'},
  {width:390,sim:'window',theme:'light',world:'modest',tag:'modest-390-light'},
 ];
 for(const c of cases){
  console.error(`case ${c.tag}`);
  const page=await open(c);
  if(c.width===390)await checkPicker(page,round);
  for(let d=0;d<3;d++){
   await pick(page,d);
   const at=`${names[d]} ${c.tag}`;
   if(c.width===390){
    await shot(page,d,`${c.tag}-conversation`);
    await page.getByTestId('navigation-open').click();await page.waitForTimeout(250);
   }
   const s=await basics(page,d,at);
   ok(s.regions.includes('ws')||c.world==='modest',`${at}: Työtilat scrolls in its own region`);
   // In a 900 px window. Direction 2's boxes cap Hiljaiset even then, and a
   // 700 px window cannot hold 2 / 1 / 5 above Työtilat's floor in any
   // direction; the table records both and result.md says so.
   if(c.world==='modest'&&(c.sim??'h900')==='h900'&&c.width!==390&&d!==1)ok(!s.regions.includes('convs')&&!/rail-/.test(s.regions),`${at}: ordinary use scrolls conversations nowhere`);
   table.push({direction:d+1,case:c.tag,...s});
   await shot(page,d,c.tag);
   if(d===0&&s.regions.includes('convs')){
    // Direction 1 names the sections with rows further down, and a name
    // scrolls to its section.
    const bar=page.getByTestId('rs-below');
    if(!await bar.count()){
     // Nothing is named because nothing is out of sight: every heading shows.
     for(const t of ['rail-yours','rail-running','rail-quiet'])ok(await seen(page,`.ah-rail [data-testid="${t}"] h2`),`${at}: no Alempana, ${t} in sight`);
    }else{
    ok(await bar.isVisible(),`${at}: Alempana names what lies further down`);
    const last=bar.locator('button').last();
    const key=(await last.getAttribute('data-testid')).slice(9);
    await last.click({timeout:5000});await settle(page);
    ok(await seen(page,`.ah-rail [data-testid="rail-${key}"] h2`),`${at}: Alempana scrolls to ${key}`);
    eq((await state(page)).railTop,0,`${at}: the whole rail did not move for Alempana`);
    ok(await page.getByTestId('rs-above').isVisible(),`${at}: Ylempänä names what lies above`);
    await page.getByTestId('rs-above').locator('button').first().click();await settle(page);
    ok(await seen(page,'.ah-rail [data-testid="rail-yours"] h2'),`${at}: Ylempänä scrolls back to Sinun vuorosi`);
    }
    await page.locator('.rs-convs').evaluate(el=>{el.scrollTop=0;});await settle(page);
   }
   if(s.regions.includes('ws'))await scrollWorkspaces(page,at);
   if(c.width===390){await page.keyboard.press('Escape');await page.waitForTimeout(150);}
  }
  await page.close();
 }

 // The keys at a short and a tall rail, Hiljaiset open.
 for(const c of quick?[{width:1440,tag:'1440'}]:[{width:1440,tag:'1440'},{width:1440,sim:'h700',tag:'h700'}]){
  const page=await open(c);
  for(let d=0;d<3;d++){
   await pick(page,d);
   const n=await keys(page,d,`${names[d]} keys ${c.tag}`);
   if(c.tag==='h700'){
    // Stop in Hiljaiset's depth, where reveal matters most.
    await page.getByTestId('message-input').click();
    for(let i=0;i<20;i++)await page.keyboard.press('Alt+ArrowDown');await settle(page);
    await shot(page,d,`keys-deep-${c.tag}`);
   }
   console.log(`${names[d]} ${c.tag}: Alt+↓ walked ${n} rows`);
  }
  await page.close();
 }

 // Direction 3: Show all opens and closes in place.
 {
  const page=await open({width:1440,sim:'h700'});
  await pick(page,2);
  const quietRows=()=>page.locator('.ah-rail [data-testid="rail-quiet"] li[data-testid^="agent-item-"]:not([data-rs-capped])').count();
  const before=await quietRows();
  ok((await page.getByTestId('show-all-quiet').textContent()).includes('lisää'),'katto: Show all says how many more');
  await page.getByTestId('show-all-quiet').click();await settle(page);
  ok(await quietRows()>before,'katto: Show all opens the rest');
  eq(await page.getByTestId('show-all-quiet').getAttribute('aria-expanded'),'true','katto: Show all is expanded');
  ok(await seen(page,'.ah-rail [data-testid="workspace-create"]'),'katto: new workspace still in sight after Show all');
  await shot(page,2,'show-all-h700');
  await page.getByTestId('show-all-quiet').click();await settle(page);
  eq(await quietRows(),before,'katto: Show less closes');
  await page.getByTestId('rail-quiet-fold').click();await settle(page);
  eq(await page.getByTestId('show-all-quiet').count(),0,'katto: no Show all under folded Hiljaiset');
  await page.close();
 }

 // English.
 {
  const page=await open({width:1440,lang:'en'});
  ok((await page.locator('[data-testid="rail-yours"] h2').textContent()).includes('Your turn'),'English: production heading');
  ok((await page.locator('.rs-lines li[aria-current]').textContent()).includes('Workspaces'),'English: direction line');
  await shot(page,0,'en-1440-light');
  await pick(page,2);
  ok((await page.locator('.rs-show-all').first().textContent()).includes('more'),'English: Show all');
  await shot(page,2,'en-1440-light');
  await page.close();
 }
}finally{await browser.close();}
writeFileSync(`${out}/rows.json`,JSON.stringify(table,null,1));
console.table(table);
assert.deepEqual(errors,[],'console errors');
console.log(`${checks} checks passed`);
