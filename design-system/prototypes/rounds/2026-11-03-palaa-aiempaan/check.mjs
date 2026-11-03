// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. Walks
// every direction light and dark at 1440 and 390 px: the default view (the
// choice open before confirming), confirming, the result, seeing the left
// part again and sending the changed message; then the entry from a plain
// conversation (message ⋯, header ⋯, pencil) and the agent-working variant.
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
const round='2026-11-03-palaa-aiempaan';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['a-palaa-tahan','b-uusi-keskustelu','c-muokkaa-viestia'];
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
 const shots=theme==='light'||width===1440;
 const capture=async name=>{if(!shots)return;await page.waitForTimeout(150);await page.screenshot({path:`${out}/${name}-${tag}.png`});};
 const fits=async()=>ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'document overflow');
 const field=page.locator('.ah-cbox-field');
 const scrollTo=async sel=>page.locator(sel).first().evaluate(el=>el.scrollIntoView({block:'center'}));
 const pick=async d=>{
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.rw-review.variant-${d}`).waitFor({state:'attached'});
 };
 const setStep=async v=>{await page.locator('#step').selectOption(v);};
 const setBusy=async v=>{await page.locator('#busy').selectOption(v);};
 for(const d of [0,1,2]){
  await pick(d);await setStep('choose');await setBusy('idle');
  assert.match(await page.getByTestId('direction-lines').locator('li[aria-current]').innerText(),/^[ABC] /);checks++;
  const n=names[d];
  if(d===0){
   // Default: the inline confirmation under the second message, later part dimmed.
   const confirm=page.getByTestId('rewind-confirm');
   await confirm.waitFor();await scrollTo('[data-testid="rewind-confirm"]');
   ok((await confirm.innerText()).includes('src/shadow.py'),'A: files listed');
   ok(await page.locator('.rw-msg[data-left]').count()>=5,'A: later part dimmed');
   await fits();await capture(`${n}-1-valinta`);
   await page.getByTestId('rewind-go').click();
   await page.getByTestId('branch-marker').waitFor();
   assert.equal(await field.inputValue(),U2);checks++;
   await fits();await capture(`${n}-2-tulos`);
   await page.getByTestId('branch-toggle').click();
   await page.getByTestId('branch-body').waitFor();await scrollTo('[data-testid="branch-body"]');
   await fits();await capture(`${n}-3-aiempi-jatko`);
   await page.getByTestId('branch-toggle').click();
   await field.fill(CHANGED);await field.press('Enter');
   await page.locator('[data-item^="r"]').first().waitFor();
   await fits();await capture(`${n}-4-lahetetty`);
   // The left part can be taken back: swap continuations.
   await page.getByTestId('branch-toggle').click();
   await page.getByTestId('branch-switch').click();
   ok((await page.getByTestId('branch-marker').innerText()).includes('1 viestisi'),'A: swapped branch counts the sent message');
   // Entry from a plain conversation: the message's own ⋯.
   await setStep('view');
   await page.locator('[data-item="u3"]').hover();
   await page.getByTestId('msg-menu-u3').click();
   await page.getByTestId('menu-back').waitFor();
   await capture(`${n}-0-viestin-valikko`);
   await page.getByTestId('menu-back').click();
   await page.getByTestId('rewind-confirm').waitFor();
   ok((await page.getByTestId('rewind-confirm').innerText()).includes('1 viestisi ja 1 vastaus'),'A: counts from u3');
   await page.getByTestId('rewind-cancel').click();
   await page.getByTestId('rewind-confirm').waitFor({state:'detached'});checks++;
  }
  if(d===1){
   const dialog=page.getByTestId('fork-dialog');
   await dialog.waitFor();
   ok((await page.getByTestId('fork-preview').innerText()).includes('src/timezones.py'),'B: files listed');
   await fits();await capture(`${n}-1-valinta`);
   await dialog.getByText('Korjaa myös lokakuu samalla tavalla.').click();
   ok(!(await page.getByTestId('fork-preview').innerText()).includes('src/timezones.py'),'B: preview follows the choice');
   await dialog.getByText(U2).click();
   await page.getByTestId('fork-go').click();
   await page.getByTestId('fork-origin').waitFor();
   assert.equal(await field.inputValue(),U2);checks++;
   ok(await page.getByTestId('workspace-title').innerText()==='Kesäajan virhe (uusi alku)','B: new conversation open');
   if(width===1440)ok(await page.locator('.ah-rail').getByText('Kesäajan virhe (uusi alku)').isVisible(),'B: new conversation in the rail');
   await fits();await capture(`${n}-2-tulos`);
   await field.fill(CHANGED);await field.press('Enter');
   await page.locator('[data-item^="r"]').first().waitFor();
   await fits();await capture(`${n}-4-lahetetty`);
   await page.getByTestId('open-original').click();
   await page.getByTestId('fork-child').waitFor();await scrollTo('[data-testid="fork-child"]');
   ok(await page.locator('[data-item="a3"]').count()===1,'B: original keeps everything');
   await fits();await capture(`${n}-3-alkuperainen`);
   // Entry: the conversation's ⋯ › Palaa aiempaan.
   await setStep('view');
   await page.getByTestId('rw-conversation-menu').click();
   await page.getByTestId('menu-rewind').waitFor();
   await capture(`${n}-0-otsakkeen-valikko`);
   await page.getByTestId('menu-rewind').click();
   await dialog.waitFor();checks++;
   await page.getByTestId('fork-cancel').click();
   await dialog.waitFor({state:'detached'});checks++;
  }
  if(d===2){
   const edit=page.getByTestId('edit-message');
   await edit.waitFor();await scrollTo('[data-testid="edit-message"]');
   ok((await edit.innerText()).includes('versioksi 1'),'C: tells where the old part goes');
   await fits();await capture(`${n}-1-valinta`);
   await page.getByTestId('edit-send').click();
   await page.getByTestId('version-pager').waitFor();
   await page.locator('[data-item="r-c"]').waitFor();
   await fits();await capture(`${n}-2-tulos`);
   await page.getByTestId('version-prev').click();
   await page.getByTestId('old-version').waitFor();await scrollTo('[data-testid="version-pager"]');
   ok(await page.locator('[data-item="a3"]').count()===1,'C: version 1 shows the old continuation');
   await fits();await capture(`${n}-3-aiempi-versio`);
   await page.getByTestId('version-back').click();
   await page.locator('[data-item="r-c"]').waitFor();checks++;
   // Entry: the pencil on an own message.
   await setStep('view');
   await page.locator('[data-item="u3"]').hover();
   await page.getByTestId('msg-edit-u3').click();
   await page.getByTestId('edit-field').waitFor();
   assert.equal(await page.getByTestId('edit-field').inputValue(),'Korjaa myös lokakuu samalla tavalla.');checks++;
   await capture(`${n}-0-kyna`);
   await page.getByTestId('edit-cancel').click();
  }
  // The agent still working: confirming stops it first.
  await setStep('choose');await setBusy('busy');
  const go=[ 'rewind-go','fork-go','edit-send'][d];
  await page.getByTestId(go).waitFor();
  ok(/^Pysäytä ja/.test((await page.getByTestId(go).innerText()).trim()),`busy label d${d}`);
  if(d!==1)await scrollTo(`[data-testid="${go}"]`);
  await fits();await capture(`${n}-5-agentti-tyossa`);
  await page.getByTestId(go).click();
  await page.waitForTimeout(100);
  ok(await page.locator('.ah-agent-header [data-activity="working"], .ah-agent-header[data-activity="working"]').count()===0,`stopped d${d}`);
  await setBusy('idle');
  // B's dialog opens again with the reset; close it before the next direction.
  if(d===1){await page.keyboard.press('Escape');await page.getByTestId('fork-dialog').waitFor({state:'detached'});}
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
