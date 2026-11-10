// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Every direction in every situation at 1440 light, with reduced motion:
// asserts where the search capability shows (nothing in Nyt), that it is in
// view on the default page, and what it says about the key's source. Then
// dark and 390 px for two situations, the key flows (refused at save,
// saved, removed with and without the administrator's key behind it, the
// administrator's key taken back), English, and no running animation with
// reduced motion. Screenshots at device scale 2 named
// r1-<d>-<direction>-<case>-<width>-<theme>.png; --quick takes only the
// 1440 light situations.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-10-hakuavain';
const [input,out,flag]=process.argv.slice(2);
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['nyt','osio','avaimet','rivi'];
const scenarios=['natiivi','ei-avainta','oma','yllapitaja','molemmat','torjuttu'];
// The key's source marker each situation starts from.
const source={natiivi:'none','ei-avainta':'none',oma:'own',yllapitaja:'site',molemmat:'own',torjuttu:'own'};
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};

async function open(width,theme,d,s,motion='reduce'){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:900},deviceScaleFactor:2,reducedMotion:motion,hasTouch:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto(`http://prototype.test/?v=${d+1}&s=${s}&theme=${theme}`);
 await page.locator(`.rq-review[data-direction="${d}"]`).waitFor({state:'attached'});
 await settle(page,d);
 return page;
}
/** The row the direction lands on, in place and scrolled to. */
const anchor=d=>d===0?'[data-settings-row="api-keys"]':d===1?'[data-testid="search-section"]':d===2?'[data-testid="search-key"]':'[data-testid="search-row"]';
async function settle(page,d){
 await page.locator(anchor(d)).first().waitFor({state:'visible',timeout:8000});
 await page.waitForTimeout(700);
}
const shot=(page,d,c,tag)=>page.screenshot({path:`${out}/r1-${d}-${names[d]}-${c}-${tag}.png`});
const inView=async(page,sel)=>page.locator(sel).first().evaluate(el=>{const r=el.getBoundingClientRect();const top=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--review-h'))||0;return r.top>=top-1&&r.top<innerHeight-80;});
const noOverflow=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);

async function assertDefault(page,d,s,tag){
 ok(await noOverflow(page),`${names[d]} ${s} ${tag}: document overflow`);
 eq(await page.locator('.rq-lines li[aria-current]').count(),1,`${names[d]}: its line is marked`);
 if(d===0){
  eq(await page.locator('[data-testid^="search-"]').count(),0,`nyt ${s}: no search rows`);
  return;
 }
 ok(await inView(page,anchor(d)),`${names[d]} ${s} ${tag}: the difference is in view on the default page`);
 if(d===1){
  ok(await page.getByTestId('search-native').isVisible(),`osio ${s}: provider search row`);
  eq(await page.getByTestId('search-key').getAttribute('data-source'),source[s],`osio ${s}: key source`);
 }
 if(d===2){
  eq(await page.getByTestId('search-key').getAttribute('data-source'),source[s],`avaimet ${s}: key source`);
  // Every signed-in subscription and the DeepSeek row say how they search.
  const expected=({natiivi:2,'ei-avainta':1,oma:2,yllapitaja:2,molemmat:2,torjuttu:1})[s];
  eq(await page.getByTestId('search-chip').count(),expected,`avaimet ${s}: one search chip per provider row`);
 }
 if(d===3){
  eq(await page.getByTestId('search-row').getAttribute('data-source'),source[s],`rivi ${s}: key source`);
  ok(await page.locator('[data-testid="search-row"]').evaluate(el=>!!el.closest('.s-card')?.querySelector('[data-settings-row="agent-work"]')),`rivi ${s}: in the top card`);
 }
 const text=d===0?'':await page.locator(anchor(d)).first().innerText();
 if(s==='natiivi')ok(/ChatGPT/.test(text)&&/Claude/.test(text)||d===2,`${names[d]} natiivi: names the native providers`);
 if(s==='yllapitaja'&&d!==3)ok(/Ylläpitäjän antama/.test(text),`${names[d]} yllapitaja: marks the administrator's key`);
 if(s==='molemmat')ok(/Ylläpitäjälläkin on Brave-avain/.test(text),`${names[d]} molemmat: says the administrator's key waits behind`);
 if(s==='torjuttu')ok(/torjui avaimen/.test(text),`${names[d]} torjuttu: says Brave refused`);
 if(s==='ei-avainta')ok(/DeepSeek/.test(text),`${names[d]} ei-avainta: names who cannot search`);
}

/** Open the key form: inline in A, a window in B and C. */
async function openForm(page,d){
 const add=page.getByTestId('search-key-add'),change=page.getByTestId('search-key-change');
 await ((await add.count())?add:change).first().click();
 await page.getByTestId('search-key-form').waitFor();
 if(d!==1)ok(await page.getByTestId('search-key-dialog').isVisible(),`${names[d]}: the form is a window`);
 else eq(await page.getByTestId('search-key-dialog').count(),0,'osio: the form is inline');
}
async function openRemove(page,d){
 if(d===3){await page.getByTestId('search-key-change').click();await page.getByTestId('search-key-dialog').waitFor();}
 await page.getByTestId('search-key-remove').first().click();
 await page.getByTestId('search-remove-dialog').waitFor();
 await page.waitForTimeout(150);
}
const keySource=(page,d)=>page.locator(d===3?'[data-testid="search-row"]':'[data-testid="search-key"]').getAttribute('data-source');

try{
 // Every direction, every situation, 1440 light.
 for(let d=0;d<4;d++)for(const s of scenarios){
  const page=await open(1440,'light',d,s);
  if(d===0&&s==='natiivi')await checkPicker(page,round);
  await assertDefault(page,d,s,'1440-light');
  await shot(page,d,s,'1440-light');
  await page.close();
 }
 if(!quick){
  for(const [width,theme] of [[1440,'dark'],[390,'light'],[390,'dark']])for(const s of ['oma','ei-avainta'])for(let d=0;d<4;d++){
   const tag=`${width}-${theme}`;
   const page=await open(width,theme,d,s);
   await assertDefault(page,d,s,tag);
   await shot(page,d,s,tag);
   await page.close();
  }
  for(let d=1;d<4;d++){
   // Adding: the form, a key the service refuses, then one it takes.
   let page=await open(1440,'light',d,'ei-avainta');
   await openForm(page,d);
   eq(await page.locator('[data-testid="search-backend-brave"][aria-pressed="true"]').count(),1,`${names[d]}: Brave is the default`);
   await shot(page,d,'lomake','1440-light');
   await page.getByTestId('search-key-input').fill('huono-avain-1234567890');
   await page.getByTestId('search-key-save').click();
   await page.getByTestId('search-key-rejected').waitFor();
   eq(await keySource(page,d),'none',`${names[d]}: a refused key is not saved`);
   await shot(page,d,'torjuttu-tallennus','1440-light');
   await page.getByTestId('search-backend-staan').click();
   await page.getByTestId('search-key-input').fill('STn7Hk2pQ9mN4vR8tY3wZ6c');
   await page.getByTestId('search-key-save').click();
   await page.getByTestId('search-said').waitFor();
   eq(await keySource(page,d),'own',`${names[d]}: the saved key is own`);
   ok(/Staan/.test(await page.getByTestId('search-said').innerText()),`${names[d]}: says which key was saved`);
   eq(await page.getByTestId('search-key-dialog').count(),0,`${names[d]}: the window closed`);
   await page.waitForTimeout(200);
   await shot(page,d,'tallennettu','1440-light');
   await page.close();
   // Removing an own key with the administrator's behind it.
   page=await open(1440,'light',d,'molemmat');
   await openRemove(page,d);
   ok(/Ylläpitäjän Brave-avain tulee tilalle/.test(await page.getByTestId('search-remove-dialog').innerText()),`${names[d]}: the question says the administrator's key follows`);
   await shot(page,d,'poisto','1440-light');
   await page.getByTestId('search-remove-confirm').click();
   await page.getByTestId('search-said').waitFor();
   eq(await keySource(page,d),'site',`${names[d]}: the administrator's key took over`);
   await shot(page,d,'poistettu','1440-light');
   await page.close();
   // Removing the administrator's copy, then taking it back.
   page=await open(1440,'light',d,'yllapitaja');
   await openRemove(page,d);
   ok(/voit ottaa ylläpitäjän avaimen myöhemmin uudelleen/.test(await page.getByTestId('search-remove-dialog').innerText()),`${names[d]}: removing the copy says it can be taken back`);
   await page.getByTestId('search-remove-confirm').click();
   await page.getByTestId('search-use-site').waitFor();
   eq(await keySource(page,d),'none',`${names[d]}: the copy is gone`);
   await shot(page,d,'kopio-poistettu','1440-light');
   await page.getByTestId('search-use-site').click();
   await page.getByTestId('search-said').waitFor();
   eq(await keySource(page,d),'site',`${names[d]}: the administrator's key is back`);
   await page.close();
   // Nothing animates with reduced motion, the form open.
   page=await open(1440,'light',d,'oma');
   await openForm(page,d);
   await page.waitForTimeout(400);
   eq(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length),0,`${names[d]}: no running animation with reduced motion`);
   await page.close();
  }
  // English.
  for(let d=0;d<4;d++){
   const page=await open(1440,'light',d,'molemmat');
   await page.locator('#language').selectOption('en');
   await settle(page,d);
   if(d)ok(/Web search|Search key|Opens:/.test(await page.locator(anchor(d)).first().innerText()),`${names[d]}: English`);
   ok(/API keys/i.test(await page.locator('.ah-account-settings').innerText()),`${names[d]}: production rows follow the language`);
   await shot(page,d,'molemmat-en','1440-light');
   await page.close();
  }
 }
 eq(errors.length,0,`console clean: ${errors.join(' | ')}`);
 console.log(`${checks} checks, console clean`);
}finally{await browser.close();}
