// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// First the round directory: no image or HTML file and nothing over 100 KB.
// Desktop (1440 × 900, mouse, auto-play off), every direction, Päivä and
// Yö: the script is stepped with Seuraava tapahtuma and after each step
// the rail is read.
//  - Start: Sinun vuorosi is empty on one row; no effect anywhere.
//  - Step 2 (turn ends): the row is in Sinun vuorosi; Nyt shows nothing; A
//    and E glow it (A also has a running slide animation); B and E mark it
//    with an edge bar and the word "uusi" (not colour alone); C shows "+1"
//    on Sinun vuorosi's count; D lights the rail's edge and Työtilat says
//    "1 uusi" on the workspace's row.
//  - Step 1 (a start) never leaves a mark in any direction.
//  - Steps 5–6 (scrolled down, a question above): the row is out of view
//    and C and E add "+2" (r1, r4) to the production edge chip above.
//  - Step 7 (five at once): A glows five rows; E glows none (the burst
//    rule) but marks three more; E's live region says "5 keskustelua".
//  - Step 8 (open): the opened row loses its mark and the edge chip clears
//    above when its rows come into view.
// Reduced motion (Playwright's reducedMotion), A and E: the glow is the
// still tint and no animation runs on the row. English once (the tag says
// "new"). The picker; a clean console. Screenshots:
// d<n>-<step>-<theme>[-reduced|-en].png.
import {createRequire} from 'node:module';
import {dirname,resolve,join,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync,readdirSync,statSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-22-rail-state-change';
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
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const wait=(page,ms=250)=>page.waitForTimeout(ms);
async function open(query,reduced=false){
 const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:reduced?'reduce':'no-preference'});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto(`http://prototype.test/${query}`);
 await wait(page,700);
 return page;
}
const row=(page,id)=>page.locator(`li[data-testid="agent-item-${id}"]`);
const attr=(page,id,a)=>row(page,id).getAttribute(a);
const next=async(page,n=1)=>{for(let i=0;i<n;i++){await page.getByTestId('event-next').click();await wait(page,350);}};
const tagOf=(page,id)=>row(page,id).locator('.ah-nav-time').evaluate(e=>getComputedStyle(e,'::after').content).catch(()=>'none');
const shot=(page,name)=>page.screenshot({path:join(out,`${name}.png`)});
const inSection=(page,id,sec)=>page.locator(`[data-testid="rail-${sec}"] li[data-testid="agent-item-${id}"]`).count();

for(let d=0;d<6;d++){
 for(const theme of quick?['light']:['light','dark']){
  const page=await open(`?v=${d+1}&auto=0&theme=${theme}`);
  const label=`d${d} ${theme}`;
  if(theme==='light')await checkPicker(page,round);
  ok(await page.getByTestId('rail-yours-empty').isVisible(),`${label}: Sinun vuorosi empty on its heading row`);
  eq(await page.locator('[data-rsc-mark],[data-rsc-flash],[data-rsc-plus],[data-rsc-ws]').count(),0,`${label}: no effect at start`);
  await next(page);
  eq(await inSection(page,'q1','running'),1,`${label}: q1 started`);
  eq(await attr(page,'q1','data-rsc-mark'),null,`${label}: a start leaves no mark`);
  await next(page);
  eq(await inSection(page,'r1','yours'),1,`${label}: r1 moved to Sinun vuorosi`);
  const flash=await attr(page,'r1','data-rsc-flash');
  const mark=await attr(page,'r1','data-rsc-mark');
  const plus=await page.getByTestId('rail-yours-count').getAttribute('data-rsc-plus');
  const edge=await page.locator('.ah-rail').getAttribute('data-rsc-edge');
  const ws=await page.locator('li.ah-workspace-row[data-rsc-ws]').count();
  eq(flash,[1,5].includes(d)?'fade':null,`${label}: glow`);
  eq(mark,[2,5].includes(d)?'reply':null,`${label}: mark`);
  eq(plus,d===3?'+1':null,`${label}: count +1`);
  eq(edge,d===4?'on':null,`${label}: rail edge`);
  eq(ws,d===4?1:0,`${label}: Työtilat row`);
  if(mark){
   ok((await tagOf(page,'r1')).includes('uusi'),`${label}: the mark says uusi`);
   ok(await row(page,'r1').locator('.ah-nav-label').evaluate(e=>Number(getComputedStyle(e).fontWeight)>=600),`${label}: marked title bold`);
  }
  if(d===4)ok((await page.locator('li.ah-workspace-row[data-rsc-ws]').getAttribute('data-rsc-ws')).includes('1 uusi'),`${label}: Työtilat says 1 uusi`);
  await wait(page,300);
  await shot(page,`d${d}-2-turn-ended-${theme}`);
  await next(page,2);
  eq(await attr(page,'r3','data-rsc-mark'),[2,5].includes(d)?'fail':null,`${label}: failure mark`);
  eq(await attr(page,'r2','data-rsc-mark'),[2,5].includes(d)?'browser':null,`${label}: browser mark`);
  await next(page,2);
  await wait(page,400);
  const r4=await row(page,'r4').boundingBox();
  const reg=await page.getByTestId('rail-conversations').boundingBox();
  ok(r4.y+r4.height<=reg.y+30,`${label}: the question is out of view above`);
  const chip=page.getByTestId('rail-beyond-above-yours');
  ok(await chip.isVisible(),`${label}: production's chip above`);
  eq(await chip.getAttribute('data-rsc-new'),[3,5].includes(d)?'+2':null,`${label}: chip names what is new`);
  await shot(page,`d${d}-6-out-of-view-${theme}`);
  await next(page);
  const burst=['r5','r6','r7','q2','q3'];
  let flashes=0;for(const id of burst)if(await attr(page,id,'data-rsc-flash'))flashes++;
  if(d===1)eq(flashes,5,`${label}: five glows at once`);
  if(d===5){eq(flashes,0,`${label}: no glow in a burst`);eq(await page.locator('li[data-rsc-mark]').count(),7,`${label}: seven marks`);
   ok((await page.getByTestId('rsc-live').innerText()).includes('5 keskustelua'),`${label}: burst announced once`);}
  if(d===3)eq(await page.getByTestId('rail-yours-count').getAttribute('data-rsc-plus'),'+5',`${label}: +5`);
  await shot(page,`d${d}-7-five-${theme}`);
  await next(page);await wait(page,500);
  eq(await attr(page,'r1','data-rsc-mark'),null,`${label}: the opened row has no mark`);
  ok(await row(page,'r1').locator('a[aria-current="page"]').count()===1,`${label}: r1 open`);
  eq(await page.locator('[data-testid^="rail-beyond-above"][data-rsc-new]').count(),0,`${label}: chip above clears once in view`);
  ok(await page.getByTestId('event-next').isDisabled(),`${label}: script ends`);
  await shot(page,`d${d}-8-opened-${theme}`);
  await page.close();
 }
}
// Reduced motion: A and E hold the tint still, nothing animates.
for(const d of [1,5]){
 const page=await open(`?v=${d+1}&auto=0`,true);
 await next(page,2);
 eq(await attr(page,'r1','data-rsc-flash'),'still',`d${d} reduced: still tint`);
 eq(await row(page,'r1').evaluate(e=>e.getAnimations({subtree:true}).filter(a=>a.playState==='running').length),0,`d${d} reduced: no animation`);
 await shot(page,`d${d}-2-turn-ended-light-reduced`);
 await page.close();
}
// Auto-play runs by itself.
{const page=await open('?v=6');
 await wait(page,5500);
 ok(Number(await page.locator('.rsc-shell').getAttribute('data-step'))>=2,'auto-play advances');
 await page.close();}
// English once.
{const page=await open('?v=6&auto=0&lang=en&theme=dark');
 await next(page,2);
 ok((await tagOf(page,'r1')).includes('new'),'English tag');
 await shot(page,'d5-2-turn-ended-dark-en');
 await page.close();}
await browser.close();
const real=errors.filter(e=>!/favicon/.test(e));
eq(real.length,0,`console errors: ${real.join(' | ')}`);
console.log(`ok: ${checks} checks; screenshots in ${out}`);
