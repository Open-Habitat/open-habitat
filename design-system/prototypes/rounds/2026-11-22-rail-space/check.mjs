// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// First the review page at 1440 × 900: the shared picker, four lines with
// the current one marked, the recommendation, the placement table.
// Then every direction (A, B, C and today) in the bare frame, whose
// viewport is exactly the window size (1280 × 720, 1440 × 800, 1920 × 1080),
// in three worlds (ordinary 4 / 2 / 12 with 18 workspaces, like the
// screenshot 3 / 0 / 5 with 6, crowded 6 / 4 / 30 with 40). In every case:
// the open conversation's row is in sight, every former fixed item still
// has a visible way in (A's icons, B's title-row search and person-menu
// entries, C's tiles), Työtilat's heading and its new-workspace button are
// in sight, the last workspace can be scrolled into sight, the document
// does not overflow and the console is clean. C: after scrolling the rail
// to its end the search door is still in sight. B: the filter icon opens
// the filter field. A: the field shows only past 12 workspaces.
// The conversation + workspace rows wholly in sight are written to
// rows.json (the source of text.ts's ROWS_1280 and result.md's table).
// Screenshots at device scale 2: <frame>-<direction>-<world>-<theme>.png;
// English once per direction. --quick: 1280 × 720 ordinary light only.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-22-rail-space';
const [input,out,flag]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <out-dir> [--quick]');process.exit(2);}
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['A-tiivis','B-muualle','C-yksi-vieritys','nyt'];
let checks=0;const errors=[];const rows={};
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};

async function open({width,height,d=0,theme='light',world='ordinary',lang='fi',bare=true,browserState='idle'}){
 const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:2,reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 // Nothing leaves the page.
 await page.route(u=>!u.href.startsWith('http://prototype.test/')&&!u.href.startsWith('data:'),r=>r.abort());
 const q=new URLSearchParams({theme,world,lang,d:String(d),...(bare?{bare:'1'}:{}),...(browserState==='ask'?{browser:'ask'}:{})});
 await page.goto(`http://prototype.test/?${q}`);
 await page.locator(`.rsp-review[data-direction="${d}"]`).waitFor({state:'attached'});
 await page.waitForTimeout(250);
 return page;
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
 const x=r.left+Math.min(40,r.width/2);
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

async function basics(page,d,at,world){
 const id=await opened(page);
 ok(id,`${at}: the open conversation is selected`);
 ok(await seen(page,`.ah-rail [data-testid="${id}"]`),`${at}: the open row is in sight`);
 ok(await seen(page,'.ah-rail [data-testid="workspace-create"]')||d===2,`${at}: new workspace in sight`);
 ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${at}: no horizontal overflow`);
 ok(await seen(page,'.ah-rail [data-testid="rsp-person-menu"], .ah-rail .ah-account-shelf button'),`${at}: person menu in sight`);
 if(d===0){
  for(const k of ['home','shares','browser','resources','search'])ok(await seen(page,`[data-testid="rsp-dock-${k}"]`),`${at}: A icon ${k}`);
  const many=world==='crowded'||world==='ordinary';
  eq(await page.locator('[data-testid="workspace-filter"]').isVisible(),many,`${at}: A filter only past 12 workspaces`);
  ok(await seen(page,'.rsp-refresh [data-ah-primitive="button"]'),`${at}: A refresh in the heading`);
 }
 if(d===1){
  ok(await seen(page,'[data-testid="rsp-title-search"]'),`${at}: B search in the title row`);
  eq(await page.locator('[data-testid="workspace-filter"]').isVisible(),false,`${at}: B filter folded`);
  eq(await page.locator('[data-testid="rsp-dock"], [data-testid="rail-shares"], [data-testid="search-door"]').count(),0,`${at}: B has no fixed block`);
 }
 if(d===2){
  for(const k of ['home','shares','browser','resources'])ok(await seen(page,`[data-testid="rsp-tile-${k}"]`),`${at}: C tile ${k}`);
  ok(await seen(page,'[data-testid="search-door"]'),`${at}: C search`);
 }
 if(d===3){
  for(const k of ['home-link','rail-shares','browser-rail-row','rail-resources','search-door','workspace-filter'])ok(await seen(page,`.ah-rail [data-testid="${k}"]`),`${at}: today ${k}`);
 }
}
async function reachLast(page,d,at){
 const last=page.locator('.ah-rail .ah-workspace-list > li').last();
 await last.evaluate(el=>el.scrollIntoView({block:'nearest'}));await page.waitForTimeout(80);
 ok(await last.evaluate((el,f)=>(0,eval)(f)(el),SEEN),`${at}: the last workspace can be reached`);
 if(d===2)ok(await seen(page,'[data-testid="search-door"]'),`${at}: C search stays at the top`);
 await page.evaluate(()=>document.querySelectorAll('.ah-rail *').forEach(e=>{if(e.scrollTop)e.scrollTop=0;}));
}

const FRAMES=[[1280,720],[1440,800],[1920,1080]];
const WORLDS=['ordinary','like','crowded'];
try{
 // The review page.
 const p0=await open({width:1440,height:900,bare:false});
 await checkPicker(p0,round);
 eq(await p0.getByTestId('recommendation').count(),1,'the recommendation is on the page');
 eq(await p0.locator('.rsp-lines li').count(),4,'four lines');
 for(let d=0;d<4;d++){
  await p0.locator('.proto-picker-item').nth(d).click();
  await p0.locator(`.rsp-review[data-direction="${d}"]`).waitFor({state:'attached'});
  eq(await p0.locator('.rsp-lines li[aria-current]').count(),1,`picker ${d}: its line is marked`);
  ok(await p0.locator('.rsp-places tr').count()>=5,`picker ${d}: the placement table`);
  await p0.screenshot({path:`${out}/review-${names[d]}.png`});
 }
 await p0.close();

 for(const [w,h] of quick?[FRAMES[0]]:FRAMES)for(const world of quick?['ordinary']:WORLDS)for(let d=0;d<4;d++){
  const at=`${w}x${h} ${names[d]} ${world}`;
  const page=await open({width:w,height:h,d,world});
  await basics(page,d,at,world);
  const c=await count(page);
  rows[`${w}x${h}`]??={};rows[`${w}x${h}`][world]??={};
  rows[`${w}x${h}`][world][names[d]]=c;
  if(world==='ordinary'||world==='like')await page.screenshot({path:`${out}/${w}x${h}-${names[d]}-${world}-light.png`});
  await reachLast(page,d,at);
  await page.close();
 }
 // Interactions at 1280 × 720.
 {
  const page=await open({width:1280,height:720,d:1});
  await page.getByTestId('rsp-filter-toggle').click();
  ok(await page.getByTestId('workspace-filter').isVisible(),'B: the filter icon opens the field');
  await page.getByTestId('workspace-filter').fill('kirja');await page.waitForTimeout(80);
  ok((await count(page)).wsAll<5,'B: the filter narrows Työtilat');
  await page.getByTestId('rsp-person-menu').click();
  for(const n of ['Tuotokset','Agentin käytössä','Oma selain'])ok(await page.getByRole('menuitem',{name:new RegExp(n)}).isVisible(),`B: person menu has ${n}`);
  await page.keyboard.press('Escape');
  await page.getByTestId('rsp-title-search').click();
  ok(await page.getByTestId('toast').isVisible(),'B: the title search answers');
  await page.close();
 }
 {
  const page=await open({width:1280,height:720,d:2});
  const before=(await count(page));
  await page.getByTestId('rsp-group-toggle').click();await page.waitForTimeout(80);
  eq(await page.locator('[data-testid^="rsp-tile-"]').count(),0,'C: the group folds');
  ok((await count(page)).conv+(await count(page)).ws>before.conv+before.ws,'C: folding gives rows room');
  await page.close();
 }
 {
  const page=await open({width:1280,height:720,d:0});
  await page.getByTestId('rsp-dock-shares').click();
  ok(await page.getByTestId('toast').isVisible(),'A: an icon answers');
  await page.close();
 }
 // Browser asking for the person: a row appears in A, B and today.
 for(const d of [0,1,3]){
  const page=await open({width:1280,height:720,d,browserState:'ask'});
  ok(await seen(page,'.ah-rail [data-testid="browser-rail-row"]'),`${names[d]}: a request shows as a rail row`);
  await page.close();
 }
 if(!quick){
  for(const theme of ['dark','contrast'])for(let d=0;d<4;d++){
   const page=await open({width:1280,height:720,d,theme});
   await basics(page,d,`${theme} ${names[d]}`,'ordinary');
   await page.screenshot({path:`${out}/1280x720-${names[d]}-ordinary-${theme}.png`});
   await page.close();
  }
  for(let d=0;d<4;d++){
   const page=await open({width:1440,height:800,d,lang:'en'});
   await basics(page,d,`en ${names[d]}`,'ordinary');
   ok(await page.evaluate(()=>!/Etusivu|Tuotokset|Agentin käytössä|Hae keskusteluista/.test(document.querySelector('.ah-rail').innerText)),`en ${names[d]}: the rail is in English`);
   await page.screenshot({path:`${out}/1440x800-${names[d]}-ordinary-en.png`});
   await page.close();
  }
 }
 eq(errors.length,0,`console clean: ${errors.join(' | ')}`);
 writeFileSync(`${out}/rows.json`,JSON.stringify(rows,null,1));
 const sum=c=>c.conv+c.ws;
 // The number on the page is the number measured here.
 const said=JSON.parse(readFileSync(resolve(here,'text.ts'),'utf8').match(/ROWS_1280 = (\[[^\]]*\])/)[1]);
 const measured=names.map(n=>sum(rows['1280x720'].ordinary[n]));
 eq(JSON.stringify(said),JSON.stringify(measured),'text.ts ROWS_1280 matches the measurement');
 for(const [frame,ws] of Object.entries(rows)){
  console.log(`\n${frame}`);
  for(const [world,ds] of Object.entries(ws))console.log(`  ${world.padEnd(9)} `+Object.entries(ds).map(([d,c])=>`${d} ${sum(c)} (${c.conv}+${c.ws})`).join('  '));
 }
 console.log(`\n${checks} checks passed; screenshots in ${out}`);
}finally{await browser.close();}
