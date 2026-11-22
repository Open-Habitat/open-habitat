// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// First the review page at 1440 × 900: the shared picker, four lines with
// the current one marked, the recommendation, the step bands and the rule
// line; the height presets change the step, and the icon set lists five
// distinct icons.
// Then every direction (A, B, C and today) in the bare frame, whose viewport
// is exactly the window (1280 wide; 720, 800, 900, 1080 and 1440 high), in
// three worlds (ordinary 4 / 2 / 12 with 18 workspaces, little content
// 3 / 0 / 5 with 6, crowded 6 / 4 / 30 with 40). In every case: the open
// conversation's row is in sight, every destination (Etusivu, Tuotokset,
// Oma selain, Agentin käytössä, search) has a visible way in, all of them
// share one treatment and none uses the globe, the Työtilat heading and its
// new-workspace button are in sight, the last workspace can be scrolled
// into sight, the document does not overflow and the console is clean.
// A and C take their step from the height alone; Työtilat gets more than
// its three-row floor at 1080 and up in the ordinary world (A, B, C).
// Oma selain's three states show in its own slot in every step.
// The conversation + workspace rows wholly in sight are written to
// rows.json (the source of text.ts's ROWS and result.md's table).
// Screenshots at device scale 2: <h>-<direction>-<world>-<theme>.png.
// --quick: 720 and 1080, ordinary world, light only.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-22-rail-space-2';
const [input,out,flag]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <out-dir> [--quick]');process.exit(2);}
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const text=readFileSync(resolve(here,'text.ts'),'utf8');
const BREAKS=JSON.parse(text.match(/BREAKS = (\[[^\]]*\])/)[1]);
const names=['A-portaat','B-sisalto-ensin','C-suhteessa','nyt'];
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
// The rule measures after layout: wait until the step and floor hold still.
async function settle(page){
 let last='';
 for(let i=0;i<20;i++){
  await page.waitForTimeout(120);
  const now=await page.evaluate(()=>{const s=document.querySelector('.rsp-shell');return s?`${s.dataset.step}|${s.style.cssText}|${document.querySelector('[data-testid="rail-quiet"]')?.innerText.length}`:'';});
  if(now===last)return;last=now;
 }
}
// In sight: inside the window and every clipping ancestor up to the rail,
// and the topmost element at its centre is inside it (not a sticky heading).
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
const stepOf=page=>page.evaluate(()=>document.querySelector('.rsp-shell')?.dataset.step);
const GLOBE='M3 12h18M12 3a14 14 0 0 1 0 18';
const DESTS=['home','shares','browser','resources'];

async function basics(page,d,at,{height,world}){
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
 const step=Number(await stepOf(page));
 if(d!==1)eq(step,height<BREAKS[0]?0:height<BREAKS[1]?1:2,`${at}: the height decides the step`);
 for(const k of DESTS)ok(await seen(page,`.ah-rail-head [data-testid="rsp-dest-${k}"]`),`${at}: ${k} in sight`);
 ok(await seen(page,step===0?'[data-testid="rsp-dest-search"]':'.ah-rail-head [data-testid="search-door"]'),`${at}: search in sight`);
 const look=await page.evaluate(()=>{
  const items=[...document.querySelectorAll('.ah-rail-head [data-testid="rsp-head"] [data-testid^="rsp-dest-"]')];
  return {borders:new Set(items.map(e=>{const s=getComputedStyle(e);return `${s.borderTopStyle} ${s.borderTopWidth} ${s.backgroundColor}`;})).size,
   paths:[...document.querySelectorAll('.ah-rail-head [data-testid="rsp-head"] path')].map(p=>p.getAttribute('d')),
   card:document.querySelectorAll('.ah-rail-head .sb-railrow').length};
 });
 eq(look.borders,1,`${at}: one treatment for every destination`);
 ok(!look.paths.some(p=>p.includes(GLOBE)),`${at}: no destination uses the globe`);
 eq(look.card,0,`${at}: no destination is a card of its own`);
 if(world==='ordinary'&&height>=1080){
  const floorRows=await page.evaluate(()=>{const ws=document.querySelector('.ah-rail-ws-scroll');const li=ws.querySelector('li');return Math.floor(ws.clientHeight/(li.offsetHeight+2));});
  ok(floorRows>3,`${at}: Työtilat gets more than its three-row floor (${floorRows})`);
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
  ok((d<3?/\d/:/\S/).test(await p0.getByTestId('rsp-rule').innerText()),`picker ${d}: the rule line`);
  if(d<3){
   for(const [h,step] of [[720,'0'],[1080,d===1?null:'2']]){
    await p0.getByTestId(`rsp-h-${h}`).click();await settle(p0);
    if(step)eq(await stepOf(p0),step,`picker ${d}: ${h} preset gives step ${step}`);
    eq(await p0.locator('.rsp-break-band[data-current]').count(),1,`picker ${d} ${h}: one band is current`);
   }
   await p0.getByTestId('rsp-h-900').click();await settle(p0);
  }
  await p0.screenshot({path:`${out}/review-${names[d]}.png`});
 }
 await p0.locator('.proto-picker-item').nth(0).click();
 await p0.locator('[data-testid="rsp-height"]').fill('1000');await settle(p0);
 eq(await stepOf(p0),'1','the slider sets the height (1000 px: tiles)');
 await p0.locator('[data-testid="rsp-iconset"] summary').click();
 const icons=await p0.locator('[data-testid="rsp-iconset"] li svg').evaluateAll(s=>s.map(e=>e.innerHTML));
 eq(icons.length,5,'the icon set lists five icons');
 eq(new Set(icons).size,5,'the five icons differ');
 await p0.screenshot({path:`${out}/review-iconset.png`});
 await p0.close();

 for(const height of quick?[720,1080]:HEIGHTS)for(const world of quick?['ordinary']:WORLDS)for(let d=0;d<4;d++){
  const at=`${height} ${names[d]} ${world}`;
  const page=await open({height,d,world});
  await basics(page,d,at,{height,world});
  const c=await count(page);
  rows[height]??={};rows[height][world]??={};
  rows[height][world][names[d]]={...c,step:await stepOf(page)};
  if(world!=='like'||height===800)await page.screenshot({path:`${out}/${height}-${names[d]}-${world}-light.png`});
  await reachLast(page,at);
  await page.close();
 }
 // Oma selain's states in its own slot, in every step.
 for(const [height,step] of [[720,0],[900,1],[1080,2]])for(const st of ['agent','ask']){
  const page=await open({height,d:0,browserState:st});
  eq(await stepOf(page),String(step),`${st} ${height}: step`);
  const b='.ah-rail-head [data-testid="rsp-dest-browser"]';
  ok(await seen(page,`${b} .rsp-dot[data-state="${st}"]`)||await page.locator(`${b} .rsp-dot[data-state="${st}"]`).isVisible(),`${st} ${height}: the state dot`);
  const word=st==='ask'?/Odottaa sinua/:/Agentti työssä/;
  if(step===0)ok(word.test(await page.locator(b).getAttribute('aria-label')),`${st} ${height}: the state is named`);
  else ok(word.test(await page.locator(b).innerText()),`${st} ${height}: the state is written`);
  eq(await page.locator('.ah-rail [data-testid="browser-rail-row"]').count(),0,`${st} ${height}: no separate browser row`);
  await page.screenshot({path:`${out}/${height}-browser-${st}.png`});
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
   await basics(page,d,`${theme} ${height} ${names[d]}`,{height,world:'ordinary'});
   await page.screenshot({path:`${out}/${height}-${names[d]}-ordinary-${theme}.png`});
   await page.close();
  }
  for(let d=0;d<4;d++)for(const height of [720,900]){
   const page=await open({height,d,lang:'en'});
   await basics(page,d,`en ${height} ${names[d]}`,{height,world:'ordinary'});
   ok(await page.evaluate(()=>!/Etusivu|Tuotokset|Agentin käytössä|Hae keskusteluista/.test(document.querySelector('.ah-rail').innerText)),`en ${names[d]}: the rail is in English`);
   await page.screenshot({path:`${out}/${height}-${names[d]}-ordinary-en.png`});
   await page.close();
  }
 }
 eq(errors.length,0,`console clean: ${errors.join(' | ')}`);
 writeFileSync(`${out}/rows.json`,JSON.stringify(rows,null,1));
 const sum=c=>c.conv+c.ws;
 // The numbers on the page are the numbers measured here.
 const said=text.match(/ROWS[^=]*= \{\s*720: (\[[^\]]*\]),\s*1080: (\[[^\]]*\])/);
 for(const [i,h] of [[1,720],[2,1080]])
  eq(said[i],JSON.stringify(names.map(n=>sum(rows[h].ordinary[n]))).replaceAll(',',', '),`text.ts ROWS[${h}] matches the measurement`);
 for(const [h,ws] of Object.entries(rows)){
  console.log(`\n${h}`);
  for(const [world,ds] of Object.entries(ws))console.log(`  ${world.padEnd(9)} `+Object.entries(ds).map(([d,c])=>`${d} ${sum(c)} (${c.conv}+${c.ws}${c.step?` s${c.step}`:''})`).join('  '));
 }
 console.log(`\n${checks} checks passed; screenshots in ${out}`);
}finally{await browser.close();}
