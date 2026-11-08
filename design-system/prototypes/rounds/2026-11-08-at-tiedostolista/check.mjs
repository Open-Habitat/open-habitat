// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Walks every direction at 1440 and 390 px, light and dark. Default view:
// on the left the file button pressed, on the right @ typed, and `sha`
// typed after each; then the same after Esc and after Enter. Asserts what
// each direction promises about where the typing went, what Esc leaves in
// the text and what Enter writes, plus the keys only some lists have (Tab
// marking, → into the folder, Backspace taking the @ away). Screenshots at
// device scale 2 named r1-d<n>-<direction>-<state>-<width>-<theme>.png;
// --quick takes only 1440 light.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-08-at-tiedostolista';
const [input,out,flag]=process.argv.slice(2);
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['nyt','vanha','hakuun','kenttaan','yhteinen'];
const DRAFT='Varjon kulma heittää tunnin kesäajan vaihtuessa. Korjaa se ja lisää testi maaliskuun lopulle. Katso ';
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};
try{
for(const width of quick?[1440]:[1440,390])for(const theme of quick?['light']:['light','dark']){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:1000},deviceScaleFactor:2,reducedMotion:'reduce',hasTouch:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 await checkPicker(page,round);
 const tag=`${width}-${theme}`;
 const played=()=>page.waitForFunction(()=>document.documentElement.dataset.played==='yes',null,{timeout:8000});
 const shot=async(d,name,full=true)=>{await page.waitForTimeout(200);await page.screenshot({path:`${out}/r1-d${d}-${names[d]}-${name}-${tag}.png`,fullPage:full});};
 const L=page.locator('.at-panel[data-side="button"]'),Rt=page.locator('.at-panel[data-side="typed"]');
 const text=p=>p.locator('.ah-cbox-field').inputValue();
 const list=p=>p.locator('.ah-choice-pop');
 const search=p=>p.getByTestId('command-search');
 for(let d=0;d<names.length;d++){
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator('#shown').selectOption('typed');
  await played();
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${names[d]}: document overflow`);
  const off=d===1,inSearch=d<=2;
  // Left: the file button. Where did `sha` go?
  eq(await list(L).count(),1,`${names[d]}: left list open`);
  eq(await list(Rt).count(),1,`${names[d]}: right list open`);
  if(d<=2){eq(await search(L).inputValue(),'sha',`${names[d]}: button list searches in its own line`);eq(await text(L),DRAFT,`${names[d]}: text untouched by the button`);}
  else{eq(await search(L).count(),0,`${names[d]}: no search line input`);eq(await text(L),DRAFT+'@sha',`${names[d]}: the button wrote @ and sha went to the text`);}
  // Right: typed @.
  if(d===2){eq(await search(Rt).inputValue(),'sha',`hakuun: typing moved into the search`);eq(await text(Rt),DRAFT+'@',`hakuun: @ waits in the text`);}
  else{eq(await text(Rt),DRAFT+'@sha',`${names[d]}: typed into the text`);eq(await search(Rt).count(),0,`${names[d]}: typed list has no search input`);}
  if(d===4){eq(await L.getByTestId('at-mirror').textContent(),'sha','yhteinen: mirror shows the token');eq(await Rt.getByTestId('at-mirror').textContent(),'sha','yhteinen: same on the right');}
  if(!off){ok(await L.locator('[data-testid="composer-field-list"]').count()===1,'in-field list');}
  // The two lists of a unifying direction are the same list.
  if(d>=2){eq(await list(L).locator('[role="option"]').allTextContents().then(String),await list(Rt).locator('[role="option"]').allTextContents().then(String),`${names[d]}: the same rows on both sides`);
   eq(await list(L).locator('.ah-choice-keys').textContent(),await list(Rt).locator('.ah-choice-keys').textContent(),`${names[d]}: the same keys on both sides`);}
  await shot(d,'kirjoitettu');
  // Esc in both.
  await page.locator('#shown').selectOption('esc');await played();
  eq(await list(L).count(),0,`${names[d]}: Esc closed left`);eq(await list(Rt).count(),0,`${names[d]}: Esc closed right`);
  eq(await text(L),d<=2?DRAFT:DRAFT+'@sha',`${names[d]}: left text after Esc`);
  eq(await text(Rt),d===2?DRAFT+'@':DRAFT+'@sha',`${names[d]}: right text after Esc`);
  if(theme==='light')await shot(d,'esc',false);
  // Enter in both: the top match goes in.
  await page.locator('#shown').selectOption('picked');await played();
  const lt=await text(L),rt=await text(Rt);
  ok(/@\S+\.py $/.test(lt),`${names[d]}: left inserted a path (${lt.slice(-30)})`);
  ok(/@\S+\.py $/.test(rt),`${names[d]}: right inserted a path (${rt.slice(-30)})`);
  ok(!/@@|@sha/.test(lt+rt),`${names[d]}: no leftover token`);
  if(d>=2)eq(lt.slice(DRAFT.length),rt.slice(DRAFT.length),`${names[d]}: both openings insert the same`);
  if(theme==='light')await shot(d,'valittu',false);
  await page.locator('#shown').selectOption('typed');await played();
  // Keys only some lists have, on the right (typed) side.
  if(width===1440&&theme==='light'){
   const keysEl=d===2?search(Rt):Rt.locator('.ah-cbox-field');
   if(d===2||d===4||d===0){
    // Tab marks in the button list and in Yhteinen; completes in the typed lists.
    const target=d===0?search(L):keysEl;
    await target.press('Tab');
    const panel=d===0?L:Rt;
    eq(await panel.getByTestId('composer-marked').count(),1,`${names[d]}: Tab marks`);
    await shot(d,'tab-merkitsee',false);
    await target.press('End');await target.press('ArrowRight');
    await page.waitForTimeout(250);
    eq(await panel.locator('.ah-choice-pop').getAttribute('data-searching'),null,`${names[d]}: → shows the file in its folder`);
    await shot(d,'kansiossa',false);
    await page.locator('#shown').selectOption('esc');await played();
    await page.locator('#shown').selectOption('typed');await played();
   }
   if(d===3||d===1){
    await Rt.locator('.ah-cbox-field').press('Tab');
    await page.waitForTimeout(160);
    ok(/@\S+ $/.test(await text(Rt)),`${names[d]}: Tab completes the top one`);
    await page.locator('#shown').selectOption('esc');await played();
    await page.locator('#shown').selectOption('typed');await played();
   }
   if(d===2){
    // Backspace in the empty search takes the @ away.
    await search(Rt).fill('');
    await search(Rt).press('Backspace');
    await page.waitForTimeout(160);
    eq(await text(Rt),DRAFT,'hakuun: Backspace in the empty search removes the @');
    eq(await list(Rt).count(),0,'hakuun: and closes the list');
    // Typing on after Esc is plain text.
    await page.locator('#shown').selectOption('esc');await played();
    await Rt.locator('.ah-cbox-field').press('x');
    await page.waitForTimeout(160);
    eq(await list(Rt).count(),0,'hakuun: @x after Esc is plain text');
    await page.locator('#shown').selectOption('typed');await played();
   }
   if(d>=3){
    // The button pressed again with nothing after the @ takes it away.
    await page.getByTestId('at-reset').click();await played();
    await page.locator('#shown').selectOption('esc');await played();
    const field=L.locator('.ah-cbox-field');await field.click();await field.press('Control+End');await field.press(' ');
    await L.getByTestId('file-picker').click();await page.waitForTimeout(160);
    eq(await text(L),DRAFT+'@sha @',`${names[d]}: the button writes @ after a space`);
    await L.getByTestId('file-picker').click();await page.waitForTimeout(160);
    eq(await text(L),DRAFT+'@sha ',`${names[d]}: pressed again it takes the @ away`);
    await page.locator('#shown').selectOption('typed');await played();
   }
  }
 }
 if(!quick&&width===1440&&theme==='light'){
  // Vanha: Ctrl+P from the typed list opens the old picker.
  await page.locator('.proto-picker-item').nth(1).click();await played();
  await Rt.locator('.ah-cbox-field').press('Control+p');await page.waitForTimeout(250);
  ok(await page.locator('.ah-palette').count()===1,'vanha: Ctrl+P opens the picker');
  await page.screenshot({path:`${out}/r1-d1-vanha-valitsin-${tag}.png`});
  await page.keyboard.press('Escape');
  // Nyt: Ctrl+P from the typed list moves it into the button's list.
  await page.locator('.proto-picker-item').nth(0).click();await played();
  await page.getByTestId('at-reset').click();await played();
  await Rt.locator('.ah-cbox-field').press('Control+p');await page.waitForTimeout(250);
  eq(await search(Rt).inputValue(),'sha','nyt: Ctrl+P carries the typed word into the search');
  await shot(0,'ctrl-p');
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[],'console errors');
console.log(`${checks} checks passed`);
