// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. Walks
// every riff light and dark at 1440 and 390 px: the default view (the compact
// confirmation open, files restored by default), the file list behind Näytä,
// the choice of what to restore, files only and its undo, conversation and
// files, the same with file restore off by default, the entry from the
// message's ⋯ and the agent still working. Screenshots at device scale
// factor 2; the console must stay clean. Prints each confirmation's height.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-06-palaa-tahan-vahvistus';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['r3-a-ponnahdus','r3-b-ohut-palkki','r3-c-pieni-arkki'];
const U2='Korjaa kesäaika lisäämällä tunti kaikkiin maaliskuun laskuihin.';
let checks=0;const errors=[];const heights={};
const ok=(v,m)=>{assert.ok(v,m);checks++;};
try{
for(const width of [1440,390])for(const theme of ['light','dark']){
 const page=await browser.newPage({viewport:{width,height:width===390?844:900},deviceScaleFactor:2,reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 await checkPicker(page,round);
 const tag=`${width}-${theme}`;
 const capture=async name=>{await page.waitForTimeout(150);await page.screenshot({path:`${out}/${name}-${tag}.png`});};
 const fits=async()=>ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'document overflow');
 const field=page.locator('.ah-cbox-field');
 const confirm=page.getByTestId('rewind-confirm');
 const what=async()=>confirm.getAttribute('data-what');
 const goLabel=async()=>(await page.getByTestId('rewind-go').innerText()).trim();
 const marker=async()=>page.getByTestId('branch-marker').innerText();
 // The confirmation is fully visible above the composer.
 const visible=async()=>{
  const c=await confirm.boundingBox(),k=await page.locator('.ah-composer').boundingBox();
  ok(c.y>=0&&c.y+c.height<=k.y+1,`confirmation hidden behind the composer (${Math.round(c.y+c.height)} > ${Math.round(k.y)})`);
  return Math.round(c.height);
 };
 const pick=async d=>{
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.rw-review.variant-${d}`).waitFor({state:'attached'});
 };
 const sel=async(id,v)=>{await page.locator(id).selectOption(v);};
 for(const d of [0,1,2]){
  await pick(d);await sel('#step','choose');await sel('#busy','idle');await sel('#files','on');
  assert.match(await page.getByTestId('direction-lines').locator('li[aria-current]').innerText(),/^[ABC] /);checks++;
  const n=names[d];
  await confirm.waitFor();await page.waitForTimeout(100);
  // Default view: files restored by default.
  assert.equal(await what(),'both');checks++;
  assert.equal(await goLabel(),'Palaa ja palauta');checks++;
  ok(await page.locator('.rw-msg[data-left]').count()>=5,'later part dimmed');
  heights[`${n} ${width}`]=await visible();
  await fits();await capture(`${n}-1-oletus-mukana`);
  // The list behind Näytä names the files and the command that stays.
  await page.getByTestId('files-toggle').click();
  const list=await page.getByTestId('file-list').innerText();
  ok(list.includes('src/timezones.py')&&list.includes('python scripts/taulukko.py'),'file list');
  await confirm.evaluate(el=>el.scrollIntoView({block:'nearest'}));
  await fits();await capture(`${n}-1c-tiedostot-auki`);
  await page.getByTestId('files-toggle').click();
  // Files only.
  if(d===0)await confirm.locator('label',{hasText:'Vain tiedostot'}).click();
  if(d===1){
   await page.getByTestId('rewind-what').click();
   await page.getByTestId('choice-files').waitFor();
   await capture(`${n}-1d-valikko-auki`);
   await page.getByTestId('choice-files').click();
  }
  if(d===2){
   await page.getByTestId('sheet-conversation').click();
  }
  assert.equal(await what(),'files');checks++;
  assert.equal(await goLabel(),'Palauta tiedostot');checks++;
  await fits();await capture(`${n}-1e-vain-tiedostot`);
  if(d===2){
   await page.getByTestId('sheet-files').click();
   assert.equal(await what(),'none');checks++;
   ok(await page.getByTestId('rewind-go').isDisabled(),'C: nothing chosen disables');
   await page.getByTestId('sheet-files').click();
  }
  await page.getByTestId('rewind-go').click();
  await page.getByTestId('files-restored').waitFor();
  ok(await page.locator('[data-item="a3"]').count()===1,'files only: conversation unchanged');
  assert.equal(await field.inputValue(),'');checks++;
  await page.getByTestId('undo-restore').click();
  ok((await page.getByTestId('files-restored').innerText()).includes('peruttu'),'restore undone');
  // Conversation and files.
  await page.getByTestId('rw-reset').click();
  await confirm.waitFor();
  await page.getByTestId('rewind-go').click();
  await page.getByTestId('branch-marker').waitFor();
  assert.equal(await field.inputValue(),U2);checks++;
  ok((await marker()).includes('3 tiedostoa palautettu'),'both restores files');
  await fits();await capture(`${n}-2-tulos`);
  // File restore off by default.
  await sel('#files','off');
  await confirm.waitFor();await page.waitForTimeout(100);
  assert.equal(await what(),'conversation');checks++;
  assert.equal(await goLabel(),'Palaa tähän');checks++;
  ok((await page.getByTestId('file-line').innerText()).includes(d===2?'Näytä tiedostot':'jää agentin muuttamiksi'),'files stay named');
  await visible();
  await fits();await capture(`${n}-1b-oletus-pois`);
  await page.getByTestId('rewind-go').click();
  ok((await marker()).includes('tiedostot jäivät'),'off: files stayed');
  await sel('#files','on');
  // Entry from a plain conversation: the message's own ⋯.
  await sel('#step','view');
  await page.locator('[data-item="u3"]').hover();
  await page.getByTestId('msg-menu-u3').click();
  await page.getByRole('menuitem').first().waitFor();
  await capture(`${n}-0-viestin-valikko`);
  await page.getByRole('menuitem').first().click();
  await confirm.waitFor();
  ok((await confirm.innerText()).includes('1 viestisi ja 1 vastaus'),'counts from u3');
  await page.getByTestId('rewind-cancel').click();
  await confirm.waitFor({state:'detached'});checks++;
  // The agent still working: confirming stops it first.
  await sel('#step','choose');await sel('#busy','busy');
  await confirm.waitFor();await page.waitForTimeout(100);
  ok(/^Pysäytä/.test(await goLabel()),`busy label d${d}`);
  await visible();
  await fits();await capture(`${n}-6-agentti-tyossa`);
  await page.getByTestId('rewind-go').click();
  await page.waitForTimeout(100);
  await sel('#busy','idle');
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(JSON.stringify(heights));
console.log(`ok: ${checks} checkpoints`);
