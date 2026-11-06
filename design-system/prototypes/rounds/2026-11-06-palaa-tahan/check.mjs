// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. Walks
// every direction light and dark at 1440 and 390 px: the default view (the
// confirmation open with its file part), confirming, the result, the earlier
// continuation and switching back to it, files-only restore and its undo (C),
// the entry from a plain conversation (message ⋯) and the agent still working.
// Writes screenshots at device scale factor 2; the console must stay clean.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-06-palaa-tahan';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['a-vain-keskustelu','b-tiedostot-mukana','c-valitse-mita'];
const U2='Korjaa kesäaika lisäämällä tunti kaikkiin maaliskuun laskuihin.';
const CHANGED='Korjaa kesäaika käyttämällä zoneinfoa, älä lisää tunteja käsin.';
let checks=0;const errors=[];
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
 const scrollTo=async sel=>page.locator(sel).first().evaluate(el=>el.scrollIntoView({block:'center'}));
 const confirm=page.getByTestId('rewind-confirm');
 const goLabel=async()=>(await page.getByTestId('rewind-go').innerText()).trim();
 const marker=async()=>page.getByTestId('branch-marker').innerText();
 const pick=async d=>{
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.rw-review.variant-${d}`).waitFor({state:'attached'});
 };
 const setStep=async v=>{await page.locator('#step').selectOption(v);};
 const setBusy=async v=>{await page.locator('#busy').selectOption(v);};
 // Send the changed message, then open the earlier continuation and switch to it.
 const sendAndSwitch=async(n,restored)=>{
  await field.fill(CHANGED);await field.press('Enter');
  await page.locator('[data-item^="r"]').first().waitFor();
  await fits();await capture(`${n}-4-lahetetty`);
  await page.getByTestId('branch-toggle').click();
  await page.getByTestId('branch-body').waitFor();
  await page.getByTestId('branch-switch').click();
  if(restored){
   await page.getByTestId('swap-confirm').waitFor();await scrollTo('[data-testid="swap-confirm"]');
   ok(await page.getByTestId('swap-files').isChecked(),'swap restores files by default');
   await fits();await capture(`${n}-5-jatkon-vaihto`);
   await page.getByTestId('swap-go').click();
  }
  ok((await marker()).includes('1 viestisi ja 1 vastaus'),'switched branch counts the sent message');
  ok(await page.locator('[data-item="a3"]').count()===1,'earlier continuation active again');
 };
 for(const d of [0,1,2]){
  await pick(d);await setStep('choose');await setBusy('idle');
  assert.match(await page.getByTestId('direction-lines').locator('li[aria-current]').innerText(),/^[ABC] /);checks++;
  const n=names[d];
  await confirm.waitFor();await scrollTo('[data-testid="rewind-confirm"]');
  ok(await page.locator('.rw-msg[data-left]').count()>=5,'later part dimmed');
  if(d===0){
   ok((await page.getByTestId('files-stay').innerText()).includes('tests/test_shadow.py'),'A: files named');
   ok(await page.getByTestId('restore-list').count()===0,'A: no restore offered');
   await fits();await capture(`${n}-1-vahvistus`);
   await page.getByTestId('rewind-go').click();
   await page.getByTestId('branch-marker').waitFor();
   assert.equal(await field.inputValue(),U2);checks++;
   ok(!(await marker()).includes('palautettu'),'A: nothing restored');
   await fits();await capture(`${n}-2-tulos`);
   await page.getByTestId('branch-toggle').click();
   await page.getByTestId('branch-body').waitFor();await scrollTo('[data-testid="branch-body"]');
   await fits();await capture(`${n}-3-aiempi-jatko`);
   await page.getByTestId('branch-toggle').click();
   await sendAndSwitch(n,false);
  }
  if(d===1){
   ok(await page.getByTestId('restore-files').locator('input').isChecked(),'B: restore on by default');
   ok((await page.getByTestId('restore-list').innerText()).includes('src/timezones.py'),'B: files listed');
   ok((await page.getByTestId('coverage').innerText()).includes('python scripts/taulukko.py'),'B: command not covered');
   assert.equal(await goLabel(),'Palaa ja palauta tiedostot');checks++;
   await fits();await capture(`${n}-1-vahvistus`);
   await page.getByTestId('restore-files').click();
   await page.getByTestId('files-stay').waitFor();
   assert.equal(await goLabel(),'Palaa tähän');checks++;
   await capture(`${n}-1b-ilman-tiedostoja`);
   await page.getByTestId('restore-files').click();
   await page.getByTestId('restore-list').waitFor();
   await page.getByTestId('rewind-go').click();
   await page.getByTestId('branch-marker').waitFor();
   assert.equal(await field.inputValue(),U2);checks++;
   ok((await marker()).includes('3 tiedostoa palautettu'),'B: marker tells the restore');
   await fits();await capture(`${n}-2-tulos`);
   await page.getByTestId('branch-toggle').click();
   await page.getByTestId('branch-body').waitFor();await scrollTo('[data-testid="branch-body"]');
   await fits();await capture(`${n}-3-aiempi-jatko`);
   await page.getByTestId('branch-toggle').click();
   await sendAndSwitch(n,true);
  }
  if(d===2){
   ok((await page.getByTestId('restore-list').innerText()).includes('src/shadow.py'),'C: both by default');
   await fits();await capture(`${n}-1-vahvistus`);
   await confirm.locator('label',{hasText:'Vain tiedostot'}).click();
   ok((await confirm.innerText()).includes('Palautetaanko tiedostot'),'C: files-only heading');
   assert.equal(await goLabel(),'Palauta tiedostot');checks++;
   await capture(`${n}-1b-vain-tiedostot`);
   await page.getByTestId('rewind-go').click();
   await page.getByTestId('files-restored').waitFor();await scrollTo('[data-testid="files-restored"]');
   ok(await page.locator('[data-item="a3"]').count()===1,'C: conversation unchanged');
   assert.equal(await field.inputValue(),'');checks++;
   await fits();await capture(`${n}-2-tulos-vain-tiedostot`);
   await page.getByTestId('undo-restore').click();
   ok((await page.getByTestId('files-restored').innerText()).includes('peruttu'),'C: restore undone');
   await capture(`${n}-3-palautus-peruttu`);
   // Both: the same result as B.
   await page.getByTestId('rw-reset').click();
   await confirm.waitFor();
   await page.getByTestId('rewind-go').click();
   await page.getByTestId('branch-marker').waitFor();
   ok((await marker()).includes('3 tiedostoa palautettu'),'C: both restores files');
   await sendAndSwitch(n,true);
  }
  // Entry from a plain conversation: the message's own ⋯.
  await setStep('view');
  await page.locator('[data-item="u3"]').hover();
  await page.getByTestId('msg-menu-u3').click();
  await page.getByRole('menuitem').first().waitFor();
  await capture(`${n}-0-viestin-valikko`);
  await page.getByRole('menuitem').first().click();
  await confirm.waitFor();
  ok((await confirm.innerText()).includes('1 viestisi ja 1 vastaus'),'counts from u3');
  if(d>0)ok(!(await page.getByTestId('restore-list').innerText()).includes('timezones'),'u3 restore lists only later files');
  await page.getByTestId('rewind-cancel').click();
  await confirm.waitFor({state:'detached'});checks++;
  // The agent still working: confirming stops it first.
  await setStep('choose');await setBusy('busy');
  await confirm.waitFor();
  ok(/^Pysäytä/.test(await goLabel()),`busy label d${d}`);
  await scrollTo('[data-testid="rewind-go"]');
  await fits();await capture(`${n}-6-agentti-tyossa`);
  await page.getByTestId('rewind-go').click();
  await page.waitForTimeout(100);
  ok(await page.locator('.ah-agent-header [data-activity="working"], .ah-agent-header[data-activity="working"]').count()===0,`stopped d${d}`);
  await setBusy('idle');
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
