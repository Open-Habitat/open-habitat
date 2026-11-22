// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// First the review page at 1440 × 900: the shared picker, four lines with
// the current one marked and each line's measured rows, the
// recommendation, and for A, B and C the model panel (both lists' meters,
// the allocation chart, the marginal-value chart and the bounds drawer).
// The height presets move the rule (720 icons, 1440 a bigger head in A);
// the slider sets the height; a bound changed in the drawer changes the
// allocation and Reset restores it.
// Then every direction (A, B, C and today) in the bare frame, whose viewport
// is exactly the window (1280 wide; 720, 800, 900, 1080 and 1440 high), in
// three worlds (ordinary 4 / 2 / 12 with 18 workspaces, little content
// 3 / 0 / 5 with 6, crowded 6 / 4 / 30 with 40). In every case: the open
// conversation's row is in sight, every destination has a visible way in
// with one treatment and no globe, the Työtilat heading and its
// new-workspace button are in sight, the last workspace can be reached, the
// document does not overflow and the console is clean. For A, B and C: the
// rows the rule gave each list are the rows in sight (within one), the
// order holds in A and C (a head bigger than icons only once both lists
// are at their "enough" or show everything), Hiljaiset stays open, and
// where Työtilat scrolls its edge says how many workspaces lie past it and
// a press pages the list. C's rail is 356 px and its rows name their
// workspace. Oma selain's three states show in its own slot.
// The conversation + workspace rows wholly in sight are written to
// rows.json (the source of text.ts's ROWS and result.md's table).
// Screenshots at device scale 2: <h>-<direction>-<world>-<theme>.png.
// --quick: 720, 900 and 1080, ordinary world, light only.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-22-rail-space-3';
const [input,out,flag]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <out-dir> [--quick]');process.exit(2);}
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const text=readFileSync(resolve(here,'text.ts'),'utf8');
const DEF=[...text.matchAll(/conv: \{ min: (\d+), enough: (\d+) \}, ws: \{ min: (\d+), enough: (\d+) \}/g)].map(m=>m.slice(1).map(Number));
const names=['A-tasan','B-keskustelut-ensin','C-levea','nyt'];
let checks=0;const errors=[];const rows={};
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};

async function open({width=1280,height,d=0,theme='light',world='ordinary',lang='fi',bare=true,browserState='idle'}){
 const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:2,reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 // Nothing leaves the page.
 await page.route(u=>!u.href.startsWith('http://prototype.test/')&&!u.href.startsWith('data:'),r=>r.abort());
 const q=new URLSearchParams({theme,world,lang,d:String(d),browser:browserState,...(bare?{bare:'1'}:{})});
 await page.goto(`http://prototype.test/?${q}`);
 await page.locator(`.rsp-review[data-direction="${d}"]`).waitFor({state:'attached'});
 await settle(page);
 return page;
}
// The rule measures after layout: wait until the allocation holds still.
async function settle(page){
 let last='';
 for(let i=0;i<25;i++){
  await page.waitForTimeout(120);
  const now=await page.evaluate(()=>{const s=document.querySelector('.rsp-shell');return s?`${s.dataset.alloc}|${s.style.cssText}|${document.querySelectorAll('.rsp-ws-edge').length}|${document.querySelector('[data-testid="rsp-rule"]')?.textContent}`:'';});
  if(now===last)return;last=now;
 }
}
// In sight: inside the window and every clipping ancestor up to the rail,
// and the topmost element at its centre is inside it (not a sticky heading
// or an edge chip).
const SEEN=`(el)=>{
 if(!el)return false;const r=el.getBoundingClientRect();if(!r.height||!r.width)return false;
 const top=r.top+2,bottom=r.bottom-2;
 if(top<0||bottom>innerHeight)return false;
 for(let a=el.parentElement;a&&!a.matches('body');a=a.parentElement){
  const o=getComputedStyle(a).overflowY;if(o==='visible')continue;
  const b=a.getBoundingClientRect();if(top<b.top||bottom>b.bottom)return false;
  if(a.matches('.ah-rail'))break;
 }
 const x=r.left+Math.min(14,r.width/2);
 return [r.top+3,(r.top+r.bottom)/2,r.bottom-3].every(y=>{const hit=document.elementFromPoint(x,y);return !!hit&&el.contains(hit);});
}`;
const seen=(page,sel)=>page.evaluate(([sel,f])=>(0,eval)(f)(document.querySelector(sel)),[sel,SEEN]);
const count=page=>page.evaluate(SEEN=>{
 const f=(0,eval)(SEEN);
 const conv=[...document.querySelectorAll('.ah-rail li[data-testid^="agent-item-"]')];
 const ws=[...document.querySelectorAll('.ah-rail .ah-workspace-list > li')];
 return {conv:conv.filter(f).length,ws:ws.filter(f).length,convAll:conv.length,wsAll:ws.length};
},SEEN);
const opened=page=>page.evaluate(()=>document.querySelector('.ah-rail a[aria-current="page"]')?.closest('li[data-testid^="agent-item-"]')?.dataset.testid);
const allocOf=page=>page.evaluate(()=>{const a=document.querySelector('.rsp-shell')?.dataset.alloc;return a?JSON.parse(a):undefined;});
const GLOBE='M3 12h18M12 3a14 14 0 0 1 0 18';
const DESTS=['home','shares','browser','resources'];

async function basics(page,d,at,{world}){
 const id=await opened(page);
 ok(id,`${at}: the open conversation is selected`);
 ok(await seen(page,`.ah-rail [data-testid="${id}"]`),`${at}: the open row is in sight`);
 ok(await seen(page,'.ah-rail [data-testid="workspace-create"]'),`${at}: new workspace in sight`);
 ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${at}: no horizontal overflow`);
 ok(await seen(page,'.ah-rail .ah-account-shelf button'),`${at}: person menu in sight`);
 if(d===3){
  for(const k of ['home-link','rail-shares','browser-rail-row','rail-resources','search-door'])ok(await seen(page,`.ah-rail [data-testid="${k}"]`),`${at}: today ${k}`);
  return;
 }
 const a=await allocOf(page);
 ok(a,`${at}: the rule ran`);
 for(const k of DESTS)ok(await seen(page,`.ah-rail-head [data-testid="rsp-dest-${k}"]`),`${at}: ${k} in sight`);
 ok(await seen(page,a.step===0?'[data-testid="rsp-dest-search"]':'.ah-rail-head [data-testid="search-door"]'),`${at}: search in sight`);
 const look=await page.evaluate(()=>{
  const items=[...document.querySelectorAll('.ah-rail-head [data-testid="rsp-head"] [data-testid^="rsp-dest-"]')];
  return {borders:new Set(items.map(e=>{const s=getComputedStyle(e);return `${s.borderTopStyle} ${s.borderTopWidth} ${s.backgroundColor}`;})).size,
   paths:[...document.querySelectorAll('.ah-rail-head [data-testid="rsp-head"] path')].map(p=>p.getAttribute('d')),
   card:document.querySelectorAll('.ah-rail-head .sb-railrow').length};
 });
 eq(look.borders,1,`${at}: one treatment for every destination`);
 ok(!look.paths.some(p=>p.includes(GLOBE)),`${at}: no destination uses the globe`);
 eq(look.card,0,`${at}: no destination is a card of its own`);
 eq(await page.locator('[data-testid="rail-quiet"][data-folded]').count(),0,`${at}: Hiljaiset stays open`);
 // The rule's rows are on screen. The conversations' count is a floor:
 // it pays for every heading, and a list scrolled to the open row has
 // some headings out of sight, so up to a few more rows show.
 const c=await count(page);
 ok(c.conv>=a.conv-1&&c.conv<=a.conv+3,`${at}: conversations in sight ${c.conv} vs the rule's ${a.conv}`);
 ok(Math.abs(c.ws-a.ws)<=1,`${at}: workspaces in sight ${c.ws} ≈ the rule's ${a.ws}`);
 // The order (knees): the head grows only once both lists are at enough.
 if(a.step>0){
  const [,ce,,we]=DEF[d];
  ok(a.conv>=Math.min(ce,a.n[0])&&a.ws>=Math.min(we,a.n[1]),`${at}: a bigger head only past both lists' enough (${a.conv}/${a.ws})`);
 }
 // Työtilat's edge says what lies past it.
 if(a.ws<a.n[1]){
  const below=page.getByTestId('rsp-ws-below');
  ok(await below.isVisible(),`${at}: Työtilat's lower edge chip`);
  ok(/\d/.test(await below.innerText()),`${at}: the chip counts the workspaces`);
 }else eq(await page.locator('.rsp-ws-edge').count(),0,`${at}: no Työtilat chip when all show`);
 if(d===2){
  eq(await page.evaluate(()=>Math.round(document.querySelector('.ah-rail').getBoundingClientRect().width)),356,`${at}: C's rail is 356 px`);
  ok(await page.locator('.ah-rail [data-testid="rail-row-workspace"]').count()>0,`${at}: C's rows name their workspace`);
 }
}
async function reachLast(page,at){
 const last=page.locator('.ah-rail .ah-workspace-list > li').last();
 await last.evaluate(el=>el.scrollIntoView({block:'nearest'}));await page.waitForTimeout(80);
 ok(await last.evaluate((el,f)=>(0,eval)(f)(el),SEEN),`${at}: the last workspace can be reached`);
}

const HEIGHTS=[720,800,900,1080,1440];
const WORLDS=['ordinary','like','crowded'];
try{
 // The review page.
 const p0=await open({width:1440,height:900,bare:false});
 await checkPicker(p0,round);
 eq(await p0.getByTestId('recommendation').count(),1,'the recommendation is on the page');
 ok((await p0.getByTestId('recommendation').innerText()).length>20,'the recommendation says something');
 eq(await p0.locator('.rsp-lines li').count(),4,'four lines');
 for(let d=0;d<4;d++){
  await p0.locator('.proto-picker-item').nth(d).click();
  await p0.locator(`.rsp-review[data-direction="${d}"]`).waitFor({state:'attached'});
  await settle(p0);
  eq(await p0.locator('.rsp-lines li[aria-current]').count(),1,`picker ${d}: its line is marked`);
  ok(/720: \d+ · 900: \d+ · 1080: \d+/.test(await p0.locator('.rsp-lines li[aria-current]').innerText()),`picker ${d}: its line gives rows at 720, 900 and 1080`);
  ok(/\S/.test(await p0.getByTestId('rsp-rule').innerText()),`picker ${d}: the rule line`);
  if(d<3){
   for(const k of ['rsp-meter-conv','rsp-meter-ws','rsp-alloc-chart','rsp-curve-chart','rsp-drawer'])ok(await p0.getByTestId(k).isVisible(),`picker ${d}: ${k}`);
   await p0.getByTestId('rsp-h-720').click();await settle(p0);
   eq((await allocOf(p0)).step,0,`picker ${d}: 720 gives icons`);
   if(d!==1){
    await p0.getByTestId('rsp-h-1440').click();await settle(p0);
    ok((await allocOf(p0)).step>0,`picker ${d}: 1440 gives a bigger head`);
   }
   await p0.getByTestId('rsp-h-900').click();await settle(p0);
  }
  await p0.screenshot({path:`${out}/review-${names[d]}.png`,fullPage:true});
 }
 await p0.locator('.proto-picker-item').nth(0).click();await settle(p0);
 await p0.locator('[data-testid="rsp-height"]').fill('1000');await settle(p0);
 ok(/1000 px/.test(await p0.getByTestId('rsp-rule').innerText()),'the slider sets the height');
 // The drawer moves the rule.
 await p0.getByTestId('rsp-h-900').click();await settle(p0);
 const before=await allocOf(p0);
 await p0.locator('[data-testid="rsp-drawer"] summary').click();
 await p0.getByTestId('rsp-ws-min').fill('3');await p0.getByTestId('rsp-ws-enough').fill('4');await settle(p0);
 const after=await allocOf(p0);
 ok(after.ws<before.ws,`a smaller Työtilat bound gives it fewer rows (${before.ws} → ${after.ws})`);
 await p0.screenshot({path:`${out}/review-drawer.png`,fullPage:true});
 await p0.getByTestId('rsp-reset').click();await settle(p0);
 eq(JSON.stringify(await allocOf(p0)),JSON.stringify(before),'Reset restores the defaults');
 await p0.locator('[data-testid="rsp-iconset"] summary').click();
 const icons=await p0.locator('[data-testid="rsp-iconset"] li svg').evaluateAll(s=>s.map(e=>e.innerHTML));
 eq(new Set(icons).size,5,'the icon set lists five distinct icons');
 await p0.close();

 for(const height of quick?[720,900,1080]:HEIGHTS)for(const world of quick?['ordinary']:WORLDS)for(let d=0;d<4;d++){
  const at=`${height} ${names[d]} ${world}`;
  const page=await open({height,d,world});
  await basics(page,d,at,{world});
  const c=await count(page);
  rows[height]??={};rows[height][world]??={};
  rows[height][world][names[d]]={...c,step:(await allocOf(page))?.step};
  if(world!=='like'||height===800)await page.screenshot({path:`${out}/${height}-${names[d]}-${world}-light.png`});
  if(d<3&&c.ws<c.wsAll){
   const below=page.getByTestId('rsp-ws-below');
   if(await below.count()){
    const top0=await page.locator('.ah-rail-ws-scroll').evaluate(e=>e.scrollTop);
    await below.click();await page.waitForTimeout(120);
    ok(await page.locator('.ah-rail-ws-scroll').evaluate(e=>e.scrollTop)>top0,`${at}: the lower chip pages Työtilat`);
    ok(await page.getByTestId('rsp-ws-above').isVisible(),`${at}: then the upper chip shows`);
   }
  }
  await reachLast(page,at);
  await page.close();
 }
 // Oma selain's states in its own slot.
 for(const [height,world] of [[720,'ordinary'],[1440,'ordinary'],[900,'like']])for(const st of ['agent','ask']){
  const page=await open({height,d:0,world,browserState:st});
  const step=(await allocOf(page)).step;
  const b='.ah-rail-head [data-testid="rsp-dest-browser"]';
  ok(await page.locator(`${b} .rsp-dot[data-state="${st}"]`).isVisible(),`${st} ${height}: the state dot`);
  const word=st==='ask'?/Odottaa sinua/:/Agentti työssä/;
  if(step===0)ok(word.test(await page.locator(b).getAttribute('aria-label')),`${st} ${height}: the state is named`);
  else ok(word.test(await page.locator(b).innerText()),`${st} ${height}: the state is written`);
  await page.screenshot({path:`${out}/${height}-browser-${st}-s${step}.png`});
  await page.close();
 }
 // A press answers.
 {
  const page=await open({height:720,d:0});
  await page.getByTestId('rsp-dest-shares').click();
  ok(await page.getByTestId('toast').isVisible(),'an icon answers');
  await page.close();
 }
 if(!quick){
  for(const theme of ['dark','contrast'])for(let d=0;d<4;d++)for(const height of [720,1080]){
   const page=await open({height,d,theme});
   await basics(page,d,`${theme} ${height} ${names[d]}`,{world:'ordinary'});
   await page.screenshot({path:`${out}/${height}-${names[d]}-ordinary-${theme}.png`});
   await page.close();
  }
  for(let d=0;d<4;d++)for(const height of [720,1080]){
   const page=await open({height,d,lang:'en'});
   await basics(page,d,`en ${height} ${names[d]}`,{world:'ordinary'});
   ok(await page.evaluate(()=>!/Etusivu|Tuotokset|Agentin käytössä|Hae keskusteluista|työtilaa/.test(document.querySelector('.ah-rail').innerText)),`en ${names[d]}: the rail is in English`);
   await page.screenshot({path:`${out}/${height}-${names[d]}-ordinary-en.png`});
   await page.close();
  }
  for(const theme of ['dark']){
   const page=await open({width:1440,height:900,d:2,theme,bare:false,lang:'en'});
   await page.screenshot({path:`${out}/review-C-dark-en.png`,fullPage:true});
   await page.close();
  }
 }
 eq(errors.length,0,`console clean: ${errors.join(' | ')}`);
 writeFileSync(`${out}/rows.json`,JSON.stringify(rows,null,1));
 const sum=c=>c.conv+c.ws;
 // The numbers on the page are the numbers measured here.
 const said=text.match(/ROWS[^=]*= \[([\s\S]*?)\];/)[1].match(/\[[^\]]*\]/g);
 for(let d=0;d<4;d++)
  eq(said[d],JSON.stringify([720,900,1080].map(h=>sum(rows[h].ordinary[names[d]]))).replaceAll(',',', '),`text.ts ROWS[${d}] matches the measurement`);
 for(const [h,ws] of Object.entries(rows)){
  console.log(`\n${h}`);
  for(const [world,ds] of Object.entries(ws))console.log(`  ${world.padEnd(9)} `+Object.entries(ds).map(([d,c])=>`${d} ${sum(c)} (${c.conv}+${c.ws}${c.step!==undefined?` s${c.step}`:''})`).join('  '));
 }
 console.log(`\n${checks} checks passed; screenshots in ${out}`);
}finally{await browser.close();}
