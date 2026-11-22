// node check.mjs <offline.html> <out-dir>
// Authored synthetic component lab, not a host-backed acceptance test.
// Walks the three directions at 1440 and 390 px in Päivä, Yö and Kontrasti
// (Finnish) and in Päivä in English, with reduced motion. Default view: the
// agent's sign-in request. In each combination it checks the three places
// (the rail's Oma selain item, conversation A's row, the piece inside the
// conversation), the rail fix (own icon, no card border), the unrelated
// conversation, and, outside Kontrasti-fi, every stepper state, the take →
// give back → done flow through the sheet (Kehys frame), Escape, a stopped
// browser opened from the rail, the opened record and several windows.
// Writes rows of piece heights to <out-dir>/sizes.json. No external
// requests, no horizontal overflow, clean console.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-22-server-browser-places';
const [input,out]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <out-dir>');process.exit(2);}
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['rivi','kortti','ikkuna'];
const forms=['line','card','window'];
let checks=0;const errors=[];const external=[];const sizes=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};

async function open(width,theme,lang){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:1000},deviceScaleFactor:phone?2:1,reducedMotion:'reduce',hasTouch:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/*',r=>{const u=r.request().url();
  if(u.startsWith('http://prototype.test/'))return r.fulfill({contentType:'text/html',body:html});
  if(u.startsWith('data:')||u.startsWith('blob:'))return r.continue();
  external.push(u);return r.abort();});
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 if(lang==='en')await page.locator('#language').selectOption('en');
 await settle(page);
 return page;
}
const settle=page=>page.waitForTimeout(200);
const pick=async(page,d)=>{await page.locator('.proto-picker-item').nth(d).click();await page.locator(`.ra-review[data-direction="${d}"]`).waitFor({state:'attached'});await settle(page);};
const shot=(page,name)=>page.screenshot({path:`${out}/${name}.png`});
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const count=(page,id)=>page.getByTestId(id).count();
const attr=(page,id,a)=>page.getByTestId(id).first().getAttribute(a);
const phoneOf=page=>page.viewportSize().width===390;
const step=async(page,p)=>{await page.locator(`.ra-step[data-phase="${p}"]`).click();await settle(page);};
/** On the phone the rail is behind the menu button. */
async function withRail(page,f){
 const phone=phoneOf(page);
 if(phone){await page.getByTestId('show-rail').click();await settle(page);}
 await f();
 if(phone&&!(await count(page,'browser-sheet'))&&(await page.locator('.ah-shell-body.ah-mobile-open').count())){await page.keyboard.press('Escape');await settle(page);}
}
/** The rail item and the row mark, as one reading of places 1 and 2. */
async function rail(page){
 let item,row;
 await withRail(page,async()=>{
  ok(await page.getByTestId('rail-browser').isVisible(),'rail item visible');
  item=await attr(page,'rail-browser','data-state');
  row=(await count(page,'row-browser'))?await attr(page,'row-browser','data-state'):null;
 });
 return {item,row};
}

async function defaults(page,d,at){
 eq(await page.locator('.ra-lines li[aria-current]').count(),1,`${at}: its line is marked`);
 eq(await attr(page,'browser-piece','data-state'),'ask',`${at}: the piece asks`);
 eq(await attr(page,'browser-piece','data-form'),forms[d],`${at}: the direction's form`);
 ok(await page.getByTestId('browser-piece').isVisible(),`${at}: piece visible on the default view`);
 ok(await page.getByTestId('piece-take').isVisible(),`${at}: take button visible`);
 eq(await rail(page),{item:'ask',row:'ask'},`${at}: rail item and row both say asked`);
 ok(await fits(page),`${at}: no horizontal overflow`);
 if(phoneOf(page))ok((await page.locator('.ah-navigation-open').textContent()).includes('1'),`${at}: phone menu badge`);
 await withRail(page,async()=>{
  const [a,b]=await Promise.all(['rail-shares','rail-browser'].map(id=>page.getByTestId(id).locator('svg').first().innerHTML()));
  ok(a!==b,`${at}: Tuotokset and Oma selain have different icons`);
  const border=await page.getByTestId('rail-browser').evaluate(e=>getComputedStyle(e).borderTopWidth);
  const shares=await page.getByTestId('rail-shares').evaluate(e=>getComputedStyle(e).borderTopWidth);
  eq(border,shares,`${at}: Oma selain has Tuotokset's border, not a card`);
  const [h1,h2]=await Promise.all(['rail-shares','rail-browser'].map(id=>page.getByTestId(id).evaluate(e=>Math.round(e.getBoundingClientRect().height))));
  eq(h1,h2,`${at}: same row height as Tuotokset`);
 });
 const h=await page.getByTestId('browser-piece').evaluate(e=>Math.round(e.getBoundingClientRect().height));
 sizes.push({at,state:'ask',height:h});
 return h;
}

async function other(page,at){
 await page.locator('#conv').selectOption('b');await settle(page);
 eq(await page.getByTestId('conversation').getAttribute('data-conv'),'b',`${at}: other conversation`);
 eq(await count(page,'browser-piece'),0,`${at}: nothing about the browser here`);
 eq((await rail(page)).item,'ask',`${at}: the rail still says asked`);
 ok(await fits(page),`${at}: fits`);
 await page.locator('#conv').selectOption('a');await settle(page);
}

const expect={
 stopped:{item:'stopped',row:null,piece:null},
 idle:{item:'idle',row:null,piece:null},
 working:{item:'agent',row:'working',piece:'working'},
 ask:{item:'ask',row:'ask',piece:'ask'},
 control:{item:'control',row:'control',piece:'control'},
 done:{item:'idle',row:null,piece:'done'},
};
async function states(page,d,at){
 for(const [p,e] of Object.entries(expect)){
  await step(page,p);
  eq(await rail(page),{item:e.item,row:e.row},`${at}/${p}: rail item and row`);
  const piece=(await count(page,'browser-piece'))?await attr(page,'browser-piece','data-state'):null;
  eq(piece,e.piece,`${at}/${p}: piece`);
  if(p==='done')eq(await attr(page,'browser-piece','data-form'),'card',`${at}/done: the accepted record card`);
  else if(e.piece)eq(await attr(page,'browser-piece','data-form'),forms[d],`${at}/${p}: form`);
  if(e.piece){sizes.push({at,state:p,height:await page.getByTestId('browser-piece').evaluate(x=>Math.round(x.getBoundingClientRect().height))});}
  ok(await fits(page),`${at}/${p}: fits`);
 }
 // The opened record says the person's own span too.
 await page.getByTestId('piece-toggle').click();await settle(page);
 ok(await page.getByTestId('visit-detail').isVisible(),`${at}: record opens`);
 eq(await count(page,'visit-you'),1,`${at}: record names your control span`);
 await shot(page,`${at}-done-open`);
}

async function flows(page,d,at){
 await page.getByTestId('event-reset').click();await settle(page);
 await page.getByTestId('piece-take').click();await settle(page);
 eq(await attr(page,'browser-sheet','data-control'),'person',`${at}: sheet in your control`);
 eq(await attr(page,'sheet-frame','data-control'),'person',`${at}: solid frame`);
 eq(await attr(page,'sheet-screen','data-window'),'kirjaudu',`${at}: the asking window`);
 await shot(page,`${at}-control`);
 await page.getByTestId('sheet-done').click();await settle(page);
 eq(await attr(page,'sheet-frame','data-control'),'agent',`${at}: back to the agent`);
 await page.keyboard.press('Escape');await settle(page);
 eq(await count(page,'browser-sheet'),0,`${at}: Escape closes`);
 eq(await attr(page,'browser-piece','data-state'),'working',`${at}: agent carries on`);
 eq((await rail(page)).item,'agent',`${at}: rail says the agent works`);
 await page.getByTestId('step-next').click();await settle(page);
 eq(await attr(page,'browser-piece','data-state'),'done',`${at}: next is done`);
 // Control closed from the conversation: the piece gives back.
 await step(page,'control');
 await page.getByTestId('piece-give-back').click();await settle(page);
 eq(await attr(page,'browser-piece','data-state'),'working',`${at}: given back from the piece`);
 // Looking sends nothing: the sheet opens in the agent's frame.
 await page.getByTestId('piece-look').click();await settle(page);
 eq(await attr(page,'sheet-frame','data-control'),'agent',`${at}: looking keeps the agent in control`);
 await page.getByTestId('sheet-close').click();await settle(page);
 // A stopped browser opens from the rail.
 await step(page,'stopped');
 await withRail(page,async()=>{await page.getByTestId('rail-browser').click();await settle(page);});
 eq(await count(page,'browser-sheet'),1,`${at}: rail opens the sheet`);
 await page.getByTestId('sheet-close').click();await settle(page);
 if(phoneOf(page)&&(await page.locator('.ah-shell-body.ah-mobile-open').count())){await page.keyboard.press('Escape');await settle(page);}
 eq((await rail(page)).item,'idle',`${at}: started`);
 // Several windows.
 await page.locator('#many').check();await settle(page);
 await withRail(page,async()=>ok((await page.getByTestId('rail-browser-state').textContent()).includes('3'),`${at}: three windows counted`));
 await step(page,'working');
 await withRail(page,async()=>ok((await page.getByTestId('rail-browser-state').textContent()).includes('4'),`${at}: four with the agent's tab`));
 await page.locator('#many').uncheck();await settle(page);
 ok(await fits(page),`${at}: fits after flows`);
}

const combos=[];
for(const width of [1440,390])for(const theme of ['light','dark','contrast'])combos.push({width,theme,lang:'fi'});
for(const width of [1440,390])combos.push({width,theme:'light',lang:'en'});
for(const {width,theme,lang} of combos){
 const page=await open(width,theme,lang);
 await checkPicker(page,round);
 const heights=[];
 for(let d=0;d<3;d++){
  const at=`${names[d]}-${width}-${theme}-${lang}`;
  try{
   await pick(page,d);
   await page.getByTestId('event-reset').click();await settle(page);
   heights.push(await defaults(page,d,at));
   await shot(page,at);
   if(phoneOf(page)){await page.getByTestId('show-rail').click();await settle(page);await shot(page,`${at}-rail`);await page.keyboard.press('Escape');await settle(page);}
   await other(page,at);
   if(theme!=='contrast'||lang==='en'){await states(page,d,at);await flows(page,d,at);}
  }catch(e){await shot(page,`${at}-FAILED`);e.message=`${at}: ${e.message}`;throw e;}
 }
 if(width===1440)ok(heights[0]<heights[1]&&heights[1]<heights[2],`${width}-${theme}-${lang}: line < card < window (${heights.join(', ')})`);
 ok(Math.max(...heights)<=(width===1440?90:200),`${width}-${theme}-${lang}: compact piece (${heights.join(', ')})`);
 await page.close();
}
await browser.close();
eq(external,[],'no external requests');
writeFileSync(`${out}/sizes.json`,JSON.stringify(sizes,null,1));
if(errors.length){console.error(errors.join('\n'));process.exit(1);}
console.log(`${checks} checks passed, ${combos.length*3} combinations, console clean`);
