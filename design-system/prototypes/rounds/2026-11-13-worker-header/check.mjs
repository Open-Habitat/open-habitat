// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Walks the two directions at 1440 and 390 px, light and dark, in every
// case: the buttons are where the direction says (header row or band), every case has Git, context and model, and the unreadable worker
// says "?" with a sentence rather than leaving a gap. Then at 1440 light:
// the Git layer with the worker's files, the model and the ring opening the
// worker's details, the read-only model (no picker), Ask, and English. At
// 390: the phone header's facts. Screenshots at device scale 2 named
// v<n>-<direction>-<case>-<width>-<theme>.png; --quick takes only 1440 light.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-13-worker-header';
const [input,out,flag]=process.argv.slice(2);
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['otsikkorivi','nauha'];
const cases=['pr','alussa','lukematon'];
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};

async function open(width,theme){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:900},deviceScaleFactor:2,reducedMotion:'reduce',hasTouch:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 return page;
}
const pick=async(page,d)=>{await page.locator('.proto-picker-item').nth(d).click();await page.locator(`.wh-review[data-direction="${d}"]`).waitFor({state:'attached'});await page.waitForTimeout(200);};
const setCase=async(page,c)=>{await page.locator('#case').selectOption(c);await page.waitForTimeout(150);};
const shot=(page,d,c,tag)=>page.screenshot({path:`${out}/v${d+1}-${names[d]}-${c}-${tag}.png`});
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);

try{
for(const width of quick?[1440]:[1440,390])for(const theme of quick?['light']:['light','dark']){
 const tag=`${width}-${theme}`;
 const page=await open(width,theme);
 await checkPicker(page,round);
 eq(await page.getByTestId('recommendation').count(),1,'the recommendation is on the page');
 for(let d=0;d<2;d++){
  await pick(page,d);
  for(const c of cases){
   await setCase(page,c);
   const at=`${names[d]} ${c} ${tag}`;
   ok(await fits(page),`${at}: document overflow`);
   eq(await page.locator('.wh-lines li[aria-current]').count(),1,`${at}: its line is marked`);
   // Where the buttons sit is the direction.
   eq(await page.getByTestId('worker-band').count(),1,`${at}: the band`);
   const where=d===1?'.ah-worker-band':'.ah-agent-header';
   const other=d===1?'.ah-agent-header':'.ah-worker-band';
   for(const id of ['git-chip','context-ring','worker-model']){
    eq(await page.locator(`${where} [data-testid="${id}"]`).count(),1,`${at}: ${id} in ${where}`);
    eq(await page.locator(`${other} [data-testid="${id}"]`).count(),0,`${at}: ${id} not in ${other}`);
   }
   eq(await page.getByTestId('worker-ask').count(),1,`${at}: Ask once`);
   eq(await page.getByTestId('read-only-indicator').count(),0,`${at}: Ask says read-only, no second mark`);
   eq(await page.getByTestId('worker-pr').count(),c==='pr'?1:0,`${at}: PR only when gh found one`);
   // Unknown is said, not left out.
   eq(await page.locator('[data-unknown]').count(),c==='lukematon'?3:0,`${at}: unknown chips`);
   if(width===1440){
    for(const id of ['git-chip','context-ring','worker-model'])
     ok(await page.getByTestId(id).isVisible(),`${at}: ${id} visible`);
    ok(await page.getByTestId('parent-top').isVisible(),`${at}: the parent link visible`);
   }
   if(c==='lukematon'){
    for(const id of ['git-chip','context-ring','worker-model'])
     ok((await page.getByTestId(id).getAttribute('aria-label')).length>20,`${at}: ${id} says why it is unknown`);
   }
   if(c==='pr'||width===1440&&theme==='light')await shot(page,d,c,tag);
  }
 }
 if(width===390&&theme==='light'){
  // The phone header's facts read the same buttons (production PhoneHeaderFacts).
  await setCase(page,'pr');
  for(const d of [0]){
   await pick(page,d);
   const facts=page.locator('.ah-phone-facts');
   ok(await facts.count()>=1,`phone ${names[d]}: header facts`);
   const title=await page.getByTestId('workspace-title').boundingBox();
   ok(title.width>150,`phone ${names[d]}: the title keeps its room (${title.width})`);
   ok(await page.locator('.ah-agent-header .ah-phone-facts').isVisible(),`phone ${names[d]}: the facts line shows`);
  }
  await pick(page,1);
  const band=await page.getByTestId('worker-band').boundingBox();
  ok(band.height<160,`phone nauha: the band wraps to at most three lines (${band.height})`);
 }
 await page.close();
}

{
 const tag='1440-light';
 const page=await open(1440,'light');
 await pick(page,0);
 await setCase(page,'pr');
 // Git opens production's layer with the worker's files and commits.
 const git=page.getByTestId('git-chip');
 eq(await git.getAttribute('data-changes'),'2','git: two changed files on the chip');
 eq(await git.getAttribute('data-base-ahead'),'3','git: three commits ahead of main');
 await git.click();
 await page.getByTestId('git-dialog').waitFor();
 eq(await page.locator('.ah-gs-file').count(),2,'git: the files in the layer');
 ok((await page.getByTestId('git-dialog').textContent()).includes('wt/q8n-elevation'),'git: the worker\'s branch');
 await page.screenshot({path:`${out}/v1-otsikkorivi-git-${tag}.png`});
 await page.keyboard.press('Escape');
 // The model is read-only: it opens the worker's details, not a picker.
 eq(await page.locator('.md-chip-picker').count(),0,'model: no picker');
 await page.getByTestId('worker-model').click();
 await page.waitForTimeout(150);
 const details=await page.locator('.ah-agent-header').textContent();
 ok(details.includes('GPT-5.5 · High'),'details: the model and its level');
 ok(details.includes('Konteksti 88'),'details: the context sentence');
 await page.screenshot({path:`${out}/v1-otsikkorivi-tiedot-${tag}.png`});
 await page.getByTestId('worker-model').click();
 // The ring says near full in its name and opens the same details.
 eq(await page.getByTestId('context-ring').getAttribute('data-level'),'near','ring: near full');
 await page.getByTestId('context-ring').click();
 eq(await page.getByTestId('context-ring').getAttribute('aria-pressed'),'true','ring: pressed while details show');
 await page.getByTestId('context-ring').click();
 await setCase(page,'alussa');
 eq(await page.getByTestId('context-ring').getAttribute('data-level'),'ok','ring: low');
 eq(await page.getByTestId('git-chip').getAttribute('data-changes'),'0','git: no changes yet');
 // Ask goes to the parent conversation.
 await page.getByTestId('worker-ask').click();
 ok((await page.getByTestId('parent-toast').textContent()).includes('Retkioppaan'),'ask: to the parent');
 // The unreadable worker's details say what is unknown.
 await setCase(page,'lukematon');
 await page.getByTestId('worker-model').click();
 await page.waitForTimeout(150);
 ok((await page.locator('.ah-agent-header').textContent()).includes('istuntoa ei ole vielä löytynyt'),'unknown: details say why');
 await page.screenshot({path:`${out}/v1-otsikkorivi-lukematon-tiedot-${tag}.png`});
 await page.close();

 // English.
 const en=await open(1440,'light');
 await en.locator('#language').selectOption('en');
 for(let d=0;d<2;d++){
  await pick(en,d);
  await setCase(en,'lukematon');
  ok((await en.getByTestId('worker-model').textContent()).includes('Model ?'),`${names[d]}: English`);
  await setCase(en,'pr');
  await shot(en,d,'pr-en',tag);
 }
 await en.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[],'console errors');
console.log(`${checks} checks passed`);
