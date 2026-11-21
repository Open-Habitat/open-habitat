// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic walkthrough check, not a host-backed acceptance test.
// First the round directory: no image or HTML file, nothing over 100 KB.
// Default view of every direction at 1440 and 390 px in Päivä, Yö and
// Kontrasti: the picker, one marked line, the recommendation, no document
// overflow, and the direction's own default view: A Settings › Pääte with the
// four rows and no preview (and no gear in the panel), B the workspace with
// the gear's settings open over the terminal (Settings only points there),
// C Settings › Pääte opening with the live preview. In every place copy on
// select is Pois, text size Normaali, cursor Laatikko, paste Kysy ensin, the
// three new rows are marked Ehdotus, and the four facts are listed.
// Flows at 1440 Päivä: a drag in the terminal with copy off copies nothing
// and offers Kopioi; turned on, the same drag copies once and says so; text
// size and cursor reach the live terminal; three pasted lines ask first and
// paste once confirmed, or at once with Liitä heti; the Ulkoasu link opens
// Ulkoasu. B changes the settings with the dialog open over the terminal;
// C's preview copies on select and the panel's gear leads to Settings ›
// Pääte. English last. Screenshots at device scale 2; console clean.
import {createRequire} from 'node:module';
import {dirname,resolve,join,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync,readdirSync,statSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-21-terminal-settings';
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
const names=['osio','ratas','esikatselu'];
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
const pick=async(page,d)=>{await page.keyboard.press('Escape');await page.locator('.proto-picker-item').nth(d).click();await page.locator(`.ts-review[data-direction="${d}"]`).waitFor({state:'attached'});await settle(page,600);};
const view=async(page,v)=>{await page.keyboard.press('Escape');await page.locator('#view').selectOption(v);await settle(page,600);};
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const shot=(page,name)=>page.screenshot({path:`${out}/${name}.png`});
const pressed=async(page,group,id)=>eq(await tid(page,group).first().locator(`[data-testid="segment-${id}"]`).getAttribute('aria-pressed'),'true',`${group} is ${id}`);
async function rowsAreDefault(page,at){
 const rows=tid(page,'terminal-rows').first();
 eq(await rows.locator('.ts-row').count(),4,`${at}: four rows`);
 eq(await rows.locator('[data-testid="proposal-tag"]').count(),3,`${at}: three rows marked as proposals`);
 eq(await tid(page,'row-terminal-copy-on-select').first().locator('[data-testid="proposal-tag"]').count(),0,`${at}: copy on select exists today`);
 await pressed(page,'copy-choice','off');await pressed(page,'font-choice','normal');await pressed(page,'cursor-choice','block');await pressed(page,'paste-choice','ask');
}
const copies=page=>page.evaluate(()=>window.__copies.length);
const pastes=page=>page.evaluate(()=>window.__pastes.length);
async function drag(page,surface){
 const box=await tid(page,surface).locator('.xterm-screen').boundingBox();
 await page.mouse.move(box.x+4,box.y+6);await page.mouse.down();
 await page.mouse.move(box.x+120,box.y+6,{steps:6});await page.mouse.move(box.x+220,box.y+6,{steps:6});await page.mouse.up();
 await settle(page,300);
}
const fontPx=(page,surface)=>tid(page,surface).locator('.xterm-rows').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));

try{
for(const width of quick?[1440]:[1440,390])for(const theme of quick?['light']:['light','dark','contrast']){
 const tag=`${width}-${theme}`;
 const page=await open(width,theme);
 await checkPicker(page,round);
 eq(await tid(page,'recommendation').count(),1,'recommendation on the page');
 for(let d=0;d<3;d++){
  await pick(page,d);
  const at=`${names[d]} ${tag}`;
  eq(await page.locator('.ts-lines li[aria-current]').count(),1,`${at}: its line is marked`);
  eq(await page.locator('.ts-review').getAttribute('data-view'),d===1?'workspace':'settings',`${at}: default view`);
  if(d===1){
   ok(await tid(page,'gear-dialog').isVisible(),`${at}: the gear's settings are open`);
   eq(await tid(page,'panel-surface').count(),1,`${at}: over the live terminal`);
   const pop=await page.locator('.ts-popover').boundingBox();
   ok(pop.x>=0&&pop.x+pop.width<=width+1,`${at}: dialog inside the viewport`);
   eq(await tid(page,'terminal-section').count(),0,`${at}: no settings section`);
  }else{
   eq(await tid(page,'terminal-section').count(),1,`${at}: Settings › Pääte`);
   eq(await page.locator('.s-nav-i[aria-current="page"]').first().innerText().then(s=>s.trim()),'Pääte',`${at}: Pääte is the section`);
   eq(await tid(page,'preview').count(),d===2?1:0,`${at}: preview only in C`);
   eq(await page.locator('[data-testid^="fact-"]').count(),4,`${at}: four facts`);
  }
  await rowsAreDefault(page,at);
  ok(await fits(page),`${at}: document overflow`);
  await shot(page,`v${d+1}-${names[d]}-oletus-${tag}`);
  if(d!==1){
   await view(page,'workspace');
   eq(await tid(page,'terminal-gear').count(),d===0?0:1,`${at}: gear in the panel only in C`);
   ok(await fits(page),`${at}: workspace overflow`);
   await shot(page,`v${d+1}-${names[d]}-tyotila-${tag}`);
  }else{
   await view(page,'settings');
   eq(await tid(page,'settings-pointer').count(),1,`${at}: Settings points to the gear`);
   await shot(page,`v2-ratas-asetukset-${tag}`);
  }
 }
 await page.close();
}

// Flows, 1440 Päivä.
{
 const page=await open(1440,'light');
 // A
 await pick(page,0);
 await view(page,'workspace');
 await drag(page,'panel-surface');
 eq(await copies(page),0,'A: copy off copies nothing');
 eq(await tid(page,'copy-selection').count(),1,'A: the selection offers Kopioi');
 await tid(page,'copy-selection').click();await settle(page);
 eq(await copies(page),1,'A: Kopioi copies');
 await view(page,'settings');
 await tid(page,'copy-choice').locator('[data-testid="segment-on"]').click();
 await tid(page,'font-choice').locator('[data-testid="segment-large"]').click();
 await tid(page,'cursor-choice').locator('[data-testid="segment-bar"]').click();
 await settle(page);
 await view(page,'workspace');
 eq(await fontPx(page,'panel-surface'),14,'A: text size reaches the terminal');
 eq(await tid(page,'panel-surface').getAttribute('data-cursor'),'bar','A: cursor reaches the terminal');
 await drag(page,'panel-surface');
 eq(await copies(page),2,'A: copy on select copies on release');
 ok(await tid(page,'copied-feedback').isVisible(),'A: says it copied');
 await shot(page,'flow-a-kopioitu');
 await tid(page,'event-paste').click();await settle(page);
 ok(await tid(page,'terminal-paste').isVisible(),'A: three lines ask first');
 eq(await tid(page,'terminal-paste').getAttribute('data-lines'),'3','A: the three lines');
 await shot(page,'flow-a-liita-kysy');
 await tid(page,'confirm-paste').click();await settle(page);
 eq(await pastes(page),1,'A: pasted once confirmed');
 await view(page,'settings');
 await tid(page,'paste-choice').locator('[data-testid="segment-direct"]').click();await settle(page);
 await view(page,'workspace');
 await tid(page,'event-paste').click();await settle(page);
 eq(await tid(page,'terminal-paste').count(),0,'A: Liitä heti does not ask');
 eq(await pastes(page),2,'A: and pastes');
 await view(page,'settings');
 await tid(page,'to-appearance').click();await settle(page,500);
 eq(await page.getByTestId('theme-choice').count(),1,'A: the Ulkoasu link opens Ulkoasu');
 // B
 await pick(page,1);
 await tid(page,'copy-choice').locator('[data-testid="segment-on"]').click();
 await tid(page,'font-choice').locator('[data-testid="segment-small"]').click();await settle(page);
 ok(await tid(page,'gear-dialog').isVisible(),'B: dialog stays open while choosing');
 eq(await fontPx(page,'panel-surface'),11,'B: the terminal behind changes at once');
 await shot(page,'flow-b-pieni');
 await tid(page,'gear-done').click();await settle(page);
 eq(await tid(page,'gear-dialog').count(),0,'B: Valmis closes');
 const c0=await copies(page);
 await drag(page,'panel-surface');
 eq(await copies(page),c0+1,'B: copy on select');
 await tid(page,'terminal-gear').click();await settle(page);
 ok(await tid(page,'gear-dialog').isVisible(),'B: the gear opens the settings');
 await page.keyboard.press('Escape');await settle(page);
 eq(await tid(page,'gear-dialog').count(),0,'B: Esc closes');
 ok(await tid(page,'terminal-gear').evaluate(el=>el===document.activeElement),'B: focus back on the gear');
 await view(page,'settings');
 await tid(page,'open-terminal').click();await settle(page,500);
 eq(await page.locator('.ts-review').getAttribute('data-view'),'workspace','B: the pointer opens the terminal');
 // C
 await pick(page,2);
 await drag(page,'preview-surface');
 eq(await copies(page),0,'C: preview with copy off copies nothing');
 await tid(page,'copy-choice').locator('[data-testid="segment-on"]').click();await settle(page);
 await drag(page,'preview-surface');
 eq(await copies(page),1,'C: preview copies on select');
 ok((await tid(page,'preview-state').innerText()).includes('kopioitu'),'C: preview says copied');
 await tid(page,'font-choice').locator('[data-testid="segment-large"]').click();await settle(page);
 eq(await fontPx(page,'preview-surface'),14,'C: preview follows text size');
 await shot(page,'flow-c-esikatselu');
 await view(page,'workspace');
 eq(await fontPx(page,'panel-surface'),14,'C: so does the panel');
 await tid(page,'terminal-gear').click();await settle(page,600);
 eq(await page.locator('.ts-review').getAttribute('data-view'),'settings','C: the gear leads to Settings');
 eq(await tid(page,'terminal-section').count(),1,'C: to Pääte');
 // Settings search finds the section's rows, not Kokeelliset.
 await page.locator('.ah-account-settings input[type="search"], .ah-account-settings input').first().fill('kopioi valitsemalla');await settle(page,500);
 ok((await page.locator('.ah-account-settings').innerText()).includes('Kopioi valitsemalla'),'C: search finds copy on select');
 // English
 await page.locator('#language').selectOption('en');await settle(page,600);
 for(let d=0;d<3;d++){
  await pick(page,d);
  const txt=await page.locator('body').innerText();
  ok(txt.includes('Copy on select')&&txt.includes('Text size')&&txt.includes('Proposal'),`English ${names[d]}`);
  ok(await fits(page),`English ${names[d]}: overflow`);
  await shot(page,`v${d+1}-${names[d]}-en`);
 }
 await page.close();
}
if(!quick){
 const page=await open(390,'dark');
 await pick(page,1);
 const pop=await page.locator('.ts-popover').boundingBox();
 ok(pop.width>=388,'phone B: a sheet across the screen');
 await tid(page,'cursor-choice').locator('[data-testid="segment-underline"]').click();await settle(page);
 eq(await tid(page,'panel-surface').getAttribute('data-cursor'),'underline','phone B: cursor changes');
 await tid(page,'gear-done').click();await settle(page);
 eq(await tid(page,'gear-dialog').count(),0,'phone B: Valmis closes');
 await shot(page,'phone-b-suljettu');
 await page.close();
}
eq(errors.length,0,`console errors: ${errors.join(' | ')}`);
console.log(`${checks} checks passed`);
}finally{await browser.close();}
