// node check.mjs <offline.html> <out-dir>
// Authored synthetic component lab, not a host-backed acceptance test.
// Walks the three directions at 1440 and 390 px in Päivä, Yö and Kontrasti
// (Finnish) and in Päivä in English, with reduced motion. Default view: the
// conversation whose agent asked for a sign-in confirmation. Checks where
// each direction puts the browser (rail row, attention row, chip, timeline),
// what the unrelated conversation shows, and the flows: take control for the
// request, give it back (the agent carries on), Escape closes the sheet,
// a stopped browser started from the direction's door, and the finished
// conversation. No external requests, no horizontal overflow, clean console.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-22-server-browser-entry-points';
const [input,out]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <out-dir>');process.exit(2);}
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=["siru","rivi","kaksi"];
let checks=0;const errors=[];const external=[];
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
const scene=async(page,s)=>{await page.locator('#scene').selectOption(s);await settle(page);};
const conv=async(page,c)=>{await page.locator('#conv').selectOption(c);await settle(page);};
const phoneOf=page=>page.viewportSize().width===390;
/** On the phone the rail is behind the menu button. */
async function withRail(page,f){
 const phone=phoneOf(page);
 if(phone){await page.locator('.ah-navigation-open').click();await settle(page);}
 await f();
 if(phone&&!(await page.getByTestId('browser-sheet').count()))await closeDrawer(page);
}
async function closeDrawer(page){if(await page.locator('.ah-shell-body.ah-mobile-open').count()){await page.keyboard.press('Escape');await settle(page);}}

async function defaults(page,d,at){
 eq(await page.locator('.ra-lines li[aria-current]').count(),1,`${at}: its line is marked`);
 ok(await fits(page),`${at}: no horizontal overflow`);
 ok((await page.locator('.ah-navigation-open').getAttribute('aria-label')||'x').length>0||!phoneOf(page),`${at}: phone menu labelled`);
 if(d===0){
  eq(await count(page,'browser-rail-row'),0,`${at}: no resting rail row`);
  eq(await count(page,'rail-ask-row'),1,`${at}: attention row while asked`);
  eq(await page.getByTestId('browser-dock').getAttribute('data-scope'),'browser',`${at}: chip is the whole browser`);
  ok(await page.getByTestId('browser-request').isVisible(),`${at}: request open above the field`);
  eq(await page.getByTestId('browser-dock').getByTestId('browser-window').count(),3,`${at}: all three windows`);
 }
 if(d===1){
  eq(await count(page,'browser-rail-row'),1,`${at}: rail row`);
  eq(await count(page,'browser-dock'),0,`${at}: no chip`);
  ok(await page.getByTestId('trace').getByTestId('browser-request').isVisible(),`${at}: request in the timeline`);
  ok((await page.getByTestId('trace-head').textContent()).includes('2'),`${at}: two own windows`);
  eq(await page.getByTestId('trace').getByTestId('browser-window').count(),2,`${at}: only own windows`);
 }
 if(d===2){
  eq(await count(page,'browser-rail-row'),1,`${at}: rail row`);
  eq(await page.getByTestId('browser-dock').getAttribute('data-scope'),'conversation',`${at}: chip is scoped`);
  eq(await page.getByTestId('browser-dock').getByTestId('browser-window').count(),2,`${at}: only own windows`);
  ok(await page.getByTestId('chip-scope').isVisible(),`${at}: scope said`);
 }
 if(d!==0) await withRail(page,async()=>{ok(await page.getByTestId('browser-rail-row').isVisible(),`${at}: rail row visible`);
  eq(await page.getByTestId('browser-rail-row').getAttribute('data-state'),'ask',`${at}: rail row says asked`);});
 else await withRail(page,async()=>ok(await page.getByTestId('rail-ask-row').isVisible(),`${at}: attention row visible`));
}

async function other(page,d,at){
 await conv(page,'b');
 eq(await page.getByTestId('conversation').getAttribute('data-conv'),'b',`${at}: other conversation`);
 eq(await count(page,'trace'),0,`${at}: no trace`);
 if(d===0)ok(await page.getByTestId('browser-request').isVisible(),`${at}: chip brings the request here too`);
 else eq(await count(page,'browser-dock'),0,`${at}: no chip here`);
 ok(await fits(page),`${at}: fits`);
}

async function flows(page,d,at){
 await page.getByTestId('event-reset').click();await settle(page);
 // Take control for the request, then give it back.
 await page.getByTestId('browser-take-request').first().click();await settle(page);
 eq(await page.getByTestId('browser-sheet').getAttribute('data-mode'),'control',`${at}: sheet in control`);
 eq(await page.getByTestId('sheet-screen').getAttribute('data-window'),'9C41',`${at}: the asking window`);
 await shot(page,`${at}-control`);
 await page.getByTestId('browser-sheet').getByTestId('browser-give-back').click();await settle(page);
 eq(await page.getByTestId('browser-sheet').getAttribute('data-mode'),'view',`${at}: back to viewing`);
 await page.keyboard.press('Escape');await settle(page);
 eq(await count(page,'browser-sheet'),0,`${at}: Escape closes`);
 eq(await count(page,'browser-request'),0,`${at}: request done`);
 eq(await count(page,'rail-ask-row'),0,`${at}: no attention row`);
 if(d===1)ok((await page.getByTestId('trace-head').textContent()).includes('1'),`${at}: agent carries on in one window`);
 // A stopped browser from the direction's door.
 await scene(page,'stopped');await conv(page,'b');
 if(d===0){eq(await page.getByTestId('browser-chip').getAttribute('data-state'),'stopped',`${at}: chip offers to open`);
  await page.getByTestId('browser-chip').click();await settle(page);
  eq(await page.getByTestId('browser-chip').getAttribute('data-state'),'idle',`${at}: started`);
 }else{
  eq(await count(page,'browser-dock'),0,`${at}: nothing above the field`);
  await withRail(page,async()=>{eq(await page.getByTestId('browser-rail-row').getAttribute('data-state'),'stopped',`${at}: row offers to open`);
   await page.getByTestId('browser-rail-row').click();await settle(page);});
  eq(await page.getByTestId('browser-sheet').getAttribute('data-mode'),'view',`${at}: opened to view`);
  await page.getByTestId('browser-sheet-close').click();await settle(page);
  await closeDrawer(page);
  eq(await page.locator('#scene').inputValue(),'idle',`${at}: started`);
 }
 // The finished conversation.
 await conv(page,'a');
 if(d===1)ok(await page.getByTestId('trace-done').isVisible(),`${at}: finished work as a line`);
 if(d===2)eq(await count(page,'browser-dock'),0,`${at}: no chip once the agent is done`);
 if(d===0)eq(await page.getByTestId('browser-dock').getAttribute('data-scope'),'browser',`${at}: chip stays`);
 ok(await fits(page),`${at}: fits after flows`);
}

const combos=[];
for(const width of [1440,390])for(const theme of ['light','dark','contrast'])combos.push({width,theme,lang:'fi'});
for(const width of [1440,390])combos.push({width,theme:'light',lang:'en'});
for(const {width,theme,lang} of combos){
 const page=await open(width,theme,lang);

 await checkPicker(page,round);
 for(let d=0;d<3;d++){
  const at=`${names[d]}-${width}-${theme}-${lang}`;
  await pick(page,d);
  await page.getByTestId('event-reset').click();await settle(page);
  await defaults(page,d,at);
  await shot(page,at);
  await other(page,d,at);
  if(theme!=='contrast'||lang==='en'){await shot(page,`${at}-other`);try{await flows(page,d,at);}catch(e){await shot(page,`${at}-FAILED`);e.message=`${at}: ${e.message}`;throw e;}}
 }
 await page.close();
}
await browser.close();
eq(external,[],'no external requests');
if(errors.length){console.error(errors.join('\n'));process.exit(1);}
console.log(`${checks} checks passed, ${combos.length*3} combinations, console clean`);
