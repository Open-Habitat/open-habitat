// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. For
// "Nyt" (production unchanged) and each direction, at 1440 px and 390 px
// (touch), light and dark, device scale factor 2, named
// r1-<direction>-<step>-<width>-<theme>:
//   0-oletus     the default view, the newest cards at the bottom;
//   0-kortit     a tall window with all six cards in the conversation;
//   1-nakyma     the summary view opened from its card;
//   2-taulukko   the CSV opened from its card;
//   3-kuva       the image opened from its card;
//   4-asiakirja  the PDF opened from its card;
//   5-kansio     the folder opened from its card;
//   6-lista      (directions) the conversation's list behind the header chip;
//   7-valikko    (2 Rivi) the row's ⋯ menu.
// It asserts where each press opens: today a panel, a dialog or the file
// panel by kind; in every direction the same right-hand panel. The console
// must stay clean and nothing may overflow sideways.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-08-tarjouskortit';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['0-nyt','1-kortti','2-rivi','3-otsake'];
const steps=[['1-nakyma','view'],['2-taulukko','csv'],['3-kuva','image'],['4-asiakirja','pdf'],['5-kansio','folder']];
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const runs=[{width:1440,theme:'light'},{width:1440,theme:'dark'},{width:390,theme:'light'},{width:390,theme:'dark'}];
try{
for(const {width,theme} of runs){
 const mobile=width===390,H=mobile?844:900;
 const page=await browser.newPage({viewport:{width,height:H},deviceScaleFactor:2,reducedMotion:'reduce',isMobile:mobile,hasTouch:mobile});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 await checkPicker(page,round);
 const tag=`${width}-${theme}`;
 const fits=async()=>ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'document overflow');
 const press=async(loc)=>{await loc.scrollIntoViewIfNeeded();await (mobile?loc.tap():loc.click());};
 for(const d of [0,1,2,3]){
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.rq-review.variant-${d}`).waitFor({state:'attached'});
  const shot=async(step)=>{await page.waitForTimeout(350);await fits();await page.screenshot({path:`${out}/r1-${names[d]}-${step}-${tag}.png`});};
  assert.match(await page.getByTestId('direction-lines').locator('li[aria-current]').innerText(),new RegExp(`^${d?d+' ':'Nyt'}`));checks++;
  if(d===0){
   ok(await page.getByTestId('view-offer').count()===2,'two view cards');
   ok(await page.getByTestId('file-offer').count()===4,'four file cards');
  }else ok(await page.getByTestId('oc-card').count()===6,'six cards of one shape');
  await shot('0-oletus');
  await page.setViewportSize({width,height:mobile?3000:2300});
  await page.waitForTimeout(200);
  await page.locator('.ah-conversation-stream, [data-testid="conversation-stream"]').first().evaluate(el=>{el.scrollTop=0;}).catch(()=>{});
  await shot('0-kortit');
  await page.setViewportSize({width,height:H});
  for(const [step,kind] of steps){
   if(d===0){
    const card=kind==='view'?page.getByTestId('view-offer').first():page.locator(`[data-testid="file-offer"][data-kind="${kind==='folder'?'package':kind}"]`);
    if(kind==='view'){
     await press(card.getByTestId('view-open'));
     await page.getByTestId('view-panel').waitFor();checks++;
    }else if(kind==='folder'){
     await press(card.getByTestId('file-offer-show-files'));
     await page.getByTestId('file-shelf').waitFor();checks++;
    }else{
     await press(card.getByTestId('file-offer-preview'));
     await page.getByTestId('attachment-preview').waitFor();checks++;
     ok(await page.locator('[role="dialog"]').count()>=1,'today: a file opens in a dialog');
    }
    await shot(step);
    if(kind==='view') await press(page.getByTestId('close-view'));
    else if(kind==='folder') await press(page.getByTestId('close-file-shelf'));
    else {await press(page.getByTestId('attachment-preview-close'));await page.getByTestId('attachment-preview').waitFor({state:'detached'});}
    continue;
   }
   const card=page.locator(`[data-testid="oc-card"][data-kind="${kind}"]`).first();
   await press(d===1?card:card.getByTestId('oc-open'));
   const panel=page.getByTestId('oc-panel');
   await panel.waitFor();checks++;
   ok(await panel.getAttribute('data-kind')===kind,`${kind} opens in the panel`);
   ok(await page.locator('[role="dialog"]').count()===0,'no dialog in a direction');
   if(!mobile) ok(await card.getAttribute('data-open')==='true','the open card is marked');
   if(kind==='csv') ok(await page.getByTestId('oc-table').isVisible(),'table');
   if(kind==='pdf') ok(await page.getByTestId('oc-doc').isVisible(),'document');
   if(kind==='folder') ok(await page.getByTestId('oc-folder-row').count()===5,'five files in the folder');
   await shot(step);
   if(kind==='folder'){
    await press(page.getByTestId('oc-folder-row').nth(1));
    ok(/tyytyvaisyys/.test(await page.getByTestId('oc-panel-title').innerText()),'a file of the folder opens in place');
    await press(page.getByTestId('oc-back'));
    await page.getByTestId('oc-folder').waitFor();checks++;
   }
   await press(page.getByTestId('oc-panel-close'));
   await panel.waitFor({state:'detached'});
  }
  if(d>0){
   await press(page.getByTestId('oc-chip'));
   await page.getByTestId('oc-list').waitFor();checks++;
   ok(await page.getByTestId('oc-list-row').count()===6,'six entries in the list');
   ok(/Kaaviot/.test(await page.getByTestId('oc-list-row').first().innerText()),'newest first');
   await shot('6-lista');
   await press(page.getByTestId('oc-list-row').nth(2));
   await page.getByTestId('oc-panel').waitFor();checks++;
   await press(page.getByTestId('oc-back'));
   await page.getByTestId('oc-list').waitFor();checks++;
   await press(page.locator('[data-testid="oc-list"] [aria-label="Sulje"]'));
  }
  if(d===2){
   await press(page.locator('[data-testid="oc-card"][data-kind="view"]').last().getByTestId('oc-more'));
   await page.getByRole('menu').waitFor();checks++;
   ok(await page.getByRole('menuitem').count()===3,'download, tab, public');
   await shot('7-valikko');
   await page.keyboard.press('Escape');
  }
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
