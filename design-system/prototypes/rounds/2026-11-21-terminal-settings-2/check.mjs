// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic walkthrough check, not a host-backed acceptance test.
// First the round directory: no image or HTML file, nothing over 100 KB.
// Default view of every variant at 1440 and 390 px in Päivä, Yö and
// Kontrasti: the picker, one marked line, the recommendation, no document
// overflow, Settings › Pääte as the section with the live preview and the
// variant's own text-size control (A slider, B stepper with ruler, C four
// presets), copy on select Pois, text size at the device default, cursor
// Laatikko, paste Kysy ensin, three rows marked Ehdotus, four facts, and the
// column count shown. The column count must equal what the workspace's
// terminal panel actually fits at that size.
// Flows at 1440 Päivä, per variant: 16 px reaches the preview at once
// (headless Linux hints the mono font to whole pixels, so 12.5 to 14 px can
// keep the same columns), fewer columns are announced, and the panel in the workspace is at
// the same size with exactly the announced columns. B: the ruler stays and the 80 line shows only while the preview is wider,
// Oletus returns; C: the chosen preset is checked. Then the gear: it opens
// Settings › Pääte with Takaisin päätteeseen, which returns to the
// workspace. Copy on select off copies nothing in the preview, on copies
// once; paste asks first. Phone: under 80 columns is said in B. English
// last. Screenshots at device scale 2; console clean.
import {createRequire} from 'node:module';
import {dirname,resolve,join,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync,readdirSync,statSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-21-terminal-settings-2';
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
const names=['liukusaadin','askelin','valmiit'];
const tid=(page,id)=>page.getByTestId(id);
const settle=(page,ms=300)=>page.waitForTimeout(ms);
async function open(width,theme,q=''){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:900},deviceScaleFactor:2,hasTouch:phone,reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto('http://prototype.test/'+q);
 await page.locator('#theme').selectOption(theme);
 await settle(page,600);
 return page;
}
const pick=async(page,d)=>{await page.keyboard.press('Escape');await page.locator('.proto-picker-item').nth(d).click();await page.locator(`.ts-review[data-variant="${d}"]`).waitFor({state:'attached'});await settle(page,700);};
const view=async(page,v)=>{await page.keyboard.press('Escape');await page.locator('#view').selectOption(v);await settle(page,700);};
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const shot=(page,name)=>page.screenshot({path:`${out}/${name}.png`});
const pressed=async(page,group,id)=>eq(await tid(page,group).first().locator(`[data-testid="segment-${id}"]`).getAttribute('aria-pressed'),'true',`${group} is ${id}`);
const fontPx=(page,surface)=>tid(page,surface).locator('.xterm-rows').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
const readCols=async page=>Number(await tid(page,'cols-readout').getAttribute('data-cols'));
const panelCols=async page=>Number(await tid(page,'panel-surface').getAttribute('data-cols'));
const copies=page=>page.evaluate(()=>window.__copies.length);
async function drag(page,surface){
 const box=await tid(page,surface).locator('.xterm-screen').boundingBox();
 await page.mouse.move(box.x+4,box.y+6);await page.mouse.down();
 await page.mouse.move(box.x+120,box.y+6,{steps:6});await page.mouse.move(box.x+220,box.y+6,{steps:6});await page.mouse.up();
 await settle(page,300);
}
// Set the size through each variant's own control.
async function grow(page,d){
 if(d===0){await tid(page,'size-slider').focus();for(let i=0;i<7;i++)await page.keyboard.press('ArrowRight');}
 else if(d===1){for(let i=0;i<7;i++){await tid(page,'size-up').click();}}
 else await tid(page,'preset-largest').click();
 await settle(page,400);
}
async function colsOf(page,d){
 if(d===2){const on=page.locator('.ts-preset[aria-checked="true"]');return Number(await on.getAttribute('data-cols'));}
 return readCols(page);
}

try{
for(const width of quick?[1440]:[1440,390])for(const theme of quick?['light']:['light','dark','contrast']){
 const tag=`${width}-${theme}`;
 const page=await open(width,theme);
 const dflt=width===390?12:12.5;
 await checkPicker(page,round);
 eq(await tid(page,'recommendation').count(),1,'recommendation on the page');
 for(let d=0;d<3;d++){
  await pick(page,d);
  const at=`${names[d]} ${tag}`;
  eq(await page.locator('.ts-lines li[aria-current]').count(),1,`${at}: its line is marked`);
  eq(await page.locator('.ts-review').getAttribute('data-view'),'settings',`${at}: default view is Settings`);
  eq(await page.locator('.s-nav-i[aria-current="page"]').first().innerText().then(s=>s.trim()),'Pääte',`${at}: Pääte is the section`);
  eq(await tid(page,'preview').count(),1,`${at}: one live preview`);
  eq(await tid(page,'size-slider').count(),d===0?1:0,`${at}: slider only in A`);
  eq(await tid(page,'size-stepper').count(),d===1?1:0,`${at}: stepper only in B`);
  eq(await tid(page,'ruler').count(),d===1?1:0,`${at}: ruler only in B`);
  eq(await page.locator('.ts-preset').count(),d===2?4:0,`${at}: four presets only in C`);
  eq(await tid(page,'back-to-terminal').count(),0,`${at}: no back button when not arrived from the terminal`);
  ok(await tid(page,'preview-surface').isVisible(),`${at}: preview visible`);
  if(width===1440){const box=await tid(page,'preview-surface').boundingBox();ok(box.y+box.height<=900,`${at}: preview on the first screen`);}
  eq(await fontPx(page,'preview-surface'),dflt,`${at}: preview at the device default`);
  eq(await page.locator('[data-testid="terminal-rows"] [data-testid="proposal-tag"]').count(),3,`${at}: three proposals`);
  eq(await tid(page,'row-terminal-copy-on-select').locator('[data-testid="proposal-tag"]').count(),0,`${at}: copy on select exists today`);
  await pressed(page,'copy-choice','off');await pressed(page,'cursor-choice','block');await pressed(page,'paste-choice','ask');
  eq(await page.locator('[data-testid^="fact-"]').count(),4,`${at}: four facts`);
  const c=await colsOf(page,d);
  ok(c>20,`${at}: column count shown (${c})`);
  if(d===2)eq(await page.locator('.ts-preset[aria-checked="true"]').getAttribute('data-testid'),'preset-normal',`${at}: Normaali checked`);
  if(d===1)eq(await tid(page,'mark-80').count(),Number(await tid(page,'preview-surface').getAttribute('data-cols'))>80?1:0,`${at}: 80-column line when the preview is wider than 80`);
  ok(await fits(page),`${at}: document overflow`);
  await shot(page,`v${d+1}-${names[d]}-oletus-${tag}`);
  if(d===1){
   await view(page,'workspace');
   eq(await panelCols(page),c,`${tag}: announced columns equal the panel's (${c})`);
   eq(await tid(page,'terminal-gear').count(),1,`${tag}: gear in the panel`);
   ok(await fits(page),`${tag}: workspace overflow`);
   await shot(page,`tyotila-${tag}`);
   await view(page,'settings');
  }
 }
 if(width===390&&theme==='light'){
  await pick(page,1);
  ok((await tid(page,'cols-readout').innerText()).includes('Alle 80'),'phone B: says under 80 wraps');
 }
 await page.close();
}

// Flows, 1440 Päivä.
{
 const page=await open(1440,'light');
 for(let d=0;d<3;d++){
  await pick(page,d);
  const at=`flow ${names[d]}`;
  const before=await colsOf(page,d);
  await grow(page,d);
  eq(await fontPx(page,'preview-surface'),16,`${at}: preview at 16 px at once`);
  eq(await page.evaluate(()=>window.__prefs().font),16,`${at}: setting is 16 px`);
  const after=await colsOf(page,d);
  ok(after<before,`${at}: fewer columns announced (${before} → ${after})`);
  if(d!==2)ok((await tid(page,'size-value').innerText()).includes('16'),`${at}: value reads 16 px`);
  if(d===1){eq(await tid(page,'mark-80').count(),Number(await tid(page,'preview-surface').getAttribute('data-cols'))>80?1:0,`${at}: 80-column line only when the preview is wider`);ok(await tid(page,'ruler').isVisible(),`${at}: ruler`);}
  if(d===2)eq(await page.locator('.ts-preset[aria-checked="true"]').getAttribute('data-testid'),'preset-largest',`${at}: Suurin checked`);
  await shot(page,`flow-${names[d]}-16px`);
  await view(page,'workspace');
  eq(await fontPx(page,'panel-surface'),16,`${at}: panel at 16 px`);
  eq(await panelCols(page),after,`${at}: panel fits the announced ${after} columns`);
  await view(page,'settings');
  if(d===1){
   await tid(page,'size-reset').click();await settle(page,400);
   eq(await page.evaluate(()=>window.__prefs().font),12.5,`${at}: Oletus returns to 12.5`);
   ok(await tid(page,'size-reset').isDisabled(),`${at}: Oletus disabled at the default`);
  }
 }
 // The gear opens the page and comes back.
 await pick(page,1);
 await view(page,'workspace');
 await tid(page,'terminal-gear').click();await settle(page,700);
 eq(await page.locator('.ts-review').getAttribute('data-view'),'settings','gear: opens Settings');
 eq(await tid(page,'terminal-section').count(),1,'gear: Pääte');
 ok(await tid(page,'back-to-terminal').isVisible(),'gear: Takaisin päätteeseen');
 await shot(page,'flow-ratas-asetuksiin');
 await tid(page,'size-up').click();await settle(page,300);
 await tid(page,'back-to-terminal').click();await settle(page,700);
 eq(await page.locator('.ts-review').getAttribute('data-view'),'workspace','gear: back returns to the workspace');
 eq(await fontPx(page,'panel-surface'),13,'gear: the panel took the new size');
 await shot(page,'flow-ratas-takaisin');
 // Copy on select in the preview.
 await view(page,'settings');
 await drag(page,'preview-surface');
 eq(await copies(page),0,'preview: copy off copies nothing');
 await tid(page,'copy-choice').locator('[data-testid="segment-on"]').click();await settle(page);
 await drag(page,'preview-surface');
 eq(await copies(page),1,'preview: copy on select copies once');
 ok((await tid(page,'preview-state').innerText()).includes('kopioitu'),'preview: says copied');
 // Paste asks first.
 await view(page,'workspace');
 await tid(page,'event-paste').click();await settle(page);
 ok(await tid(page,'terminal-paste').isVisible(),'paste: asks first');
 await tid(page,'confirm-paste').click();await settle(page);
 eq(await page.evaluate(()=>window.__pastes.length),1,'paste: pasted once confirmed');
 // Search finds the rows.
 await view(page,'settings');
 await page.locator('.ah-account-settings input[type="search"], .ah-account-settings input').first().fill('tekstin koko');await settle(page,500);
 ok((await page.locator('.ah-account-settings').innerText()).includes('Tekstin koko'),'search finds text size');
 await page.close();
}
// English.
{
 const page=await open(1440,'light','?lang=en');
 for(let d=0;d<3;d++){
  await pick(page,d);
  const txt=await page.locator('body').innerText();
  ok(txt.includes('Copy on select')&&txt.includes('Text size')&&txt.includes('Proposal')&&txt.includes('columns'),`English ${names[d]}`);
  ok(await fits(page),`English ${names[d]}: overflow`);
  await shot(page,`v${d+1}-${names[d]}-en`);
 }
 await page.close();
}
if(!quick){
 const page=await open(390,'dark');
 await pick(page,2);
 await tid(page,'preset-small').click();await settle(page,400);
 eq(await fontPx(page,'preview-surface'),10.5,'phone C: Pieni is 10.5 px');
 await view(page,'workspace');
 eq(await panelCols(page),Number(await page.evaluate(()=>window.__panelCols(10.5))),'phone C: panel fits what Pieni announced');
 await shot(page,'phone-c-pieni-tyotila');
 await page.close();
}
eq(errors.length,0,`console errors: ${errors.join(' | ')}`);
console.log(`${checks} checks passed`);
}finally{await browser.close();}
