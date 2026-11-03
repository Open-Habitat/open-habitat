// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. Walks
// every direction light and dark at 1440 and 390 px. Default view: tall draft
// with Tiedosto open from its button inside the field. Then, in each in-field
// direction: search and marking two files (keys, or taps on a phone), Enter
// adding both; a folder (Hakulista's scope, Kansiopuu's path, Välilehdet's
// tabs); Esc back to the text at its caret; Komennot adding at the start; a
// typed @ at the caret; a mid-line / with nothing selected; a press in the
// text and outside closing the list; the short draft; a ! command getting a
// plain path; the slow and failed list. Screenshots at scale 2; light at both
// widths, dark at 1440.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-03-kentan-listat-2';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['nyt','hakulista','kansiopuu','valilehdet'];
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
try{
for(const width of [1440,390])for(const theme of ['light','dark']){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:900},deviceScaleFactor:2,reducedMotion:'reduce',hasTouch:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 await checkPicker(page,round);
 const tag=`${width}-${theme}`;
 const shots=theme==='light'||!phone;
 let d=0;
 const capture=async name=>{if(!shots)return;await page.waitForTimeout(160);await page.screenshot({path:`${out}/d${d}-${names[d]}-${name}-${tag}.png`});};
 const only1440light=async name=>{if(width===1440&&theme==='light')await capture(name);};
 const fits=async()=>ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'document overflow');
 const field=page.locator('.ah-cbox-field');
 const pop=page.locator('.ah-choice-pop');
 const search=page.getByTestId('command-search');
 const options=page.locator('.ah-choice-pop [role="option"]');
 const focusIn=async sel=>page.waitForFunction(s=>document.activeElement?.matches(s),sel);
 // The list sits inside the box: below the text's caret line and above the
 // button row, and the whole list is on screen.
 const inside=async()=>{
  const r=await page.evaluate(()=>{
   const p=document.querySelector('.ah-choice-pop').getBoundingClientRect();
   const f=document.querySelector('.ah-cbox-field').getBoundingClientRect();
   const row=document.querySelector('.ah-crow').getBoundingClientRect();
   const bar=document.querySelector('.cl-bar').getBoundingClientRect().bottom;
   return {below:p.top>=f.bottom-1,above:p.bottom<=row.top+1,visible:p.top>=bar-1&&p.bottom<=innerHeight};
  });
  ok(r.below&&r.above&&r.visible,`list not inside the box d${d} ${tag} ${JSON.stringify(r)}`);
 };
 const choose=async n=>{
  await page.locator('.proto-picker-item').nth(n).click();d=n;
  await page.locator(`.cl-review.variant-${n}`).waitFor({state:'attached'});
 };
 const draft=async v=>{await page.locator('#draft').selectOption(v);await options.first().waitFor();};
 const mark=async()=>{ if(phone){await page.locator('.ah-choice-pop [aria-selected="true"] [data-testid="kl-mark"]').tap();await search.press('ArrowDown');} else await search.press('Tab'); };

 for(const n of [0,1,2,3]){
  await choose(n);
  await draft('tall');
  ok((await page.getByTestId('direction-lines').locator('li[aria-current]').innerText()).startsWith(['Nyt','Hakulista','Kansiopuu','Välilehdet'][n]),'direction line');
  await focusIn('[data-testid="command-search"]');checks++;
  await fits();await capture('pitka-tiedosto');
  if(n===0){
   // Today: several files only in the Ctrl/⌘+P dialog over the page.
   await search.press('Escape');await pop.waitFor({state:'detached'});
   await focusIn('.ah-cbox-field');
   await field.press('ControlOrMeta+KeyP');
   await page.getByTestId('composer-palette').waitFor();
   await page.getByTestId('composer-palette').locator('[role="option"]').first().waitFor();
   await page.waitForTimeout(400);await capture('valitsin');
   await page.getByTestId('file-search').press('Escape');
   await page.getByTestId('composer-palette').waitFor({state:'detached'});
   await field.press('Control+End');await field.pressSequentially(' ja @tes');
   await options.first().waitFor();await capture('pitka-kirjoitettu');
   await field.press('Escape');await pop.waitFor({state:'detached'});
   await draft('short');await capture('lyhyt-tiedosto');
   continue;
  }
  await inside();
  // Several files: search, mark two, Enter adds both at the caret.
  await search.fill('shadow');
  await page.waitForFunction(()=>document.querySelectorAll('.ah-choice-pop [role="option"]').length===2);
  await mark();await mark();
  ok(await page.getByTestId('kl-marked').innerText().then(t=>t.startsWith('2 valittu')),'two marked');
  await fits();await capture('useampi');
  if(phone)await page.getByTestId('kl-add').tap();else await search.press('Enter');
  await pop.waitFor({state:'detached'});
  ok(/Katso myös @src\/shadow\.py @tests\/test_shadow\.py $/.test(await field.inputValue()),`two paths d${n}: ${await field.inputValue()}`);
  await focusIn('.ah-cbox-field');checks++;
  // Folders.
  await page.getByTestId('file-picker').click();await options.first().waitFor();
  if(n===1){
   await search.fill('astro');
   await page.locator('[data-testid="kl-dir"][data-path="src/astro/"]').click();
   await page.getByTestId('kl-scope').waitFor();
   ok(await search.inputValue()==='', 'scope clears the search');
   ok(await options.count()===4,'four files in src/astro/');
   await fits();await capture('kansio');
   await search.press('Backspace');await page.getByTestId('kl-scope').waitFor({state:'detached'});checks++;
  }
  if(n===2){
   await search.fill('src/');
   await page.locator('[data-testid="kl-dir"][data-path="src/astro/"]').waitFor();
   await search.press('ArrowRight');
   ok(await page.getByTestId('kl-crumb').count()===3,'crumbs aurinkokello › src › astro');
   await fits();await capture('kansio');
   await search.press('ArrowLeft');
   ok(await page.getByTestId('kl-crumb').count()===2,'up to src');
   await page.getByTestId('kl-crumb').first().click();
   ok(await page.getByTestId('kl-crumb').count()===1,'back to the workspace');
   // Today's changed files are the first folder.
   await search.press('Enter');
   ok(await page.getByTestId('kl-crumb').count()===2&&await options.count()===4,'Muutetut lists the four changed files');
   await only1440light('muutetut');
   await search.press('Backspace');
   ok(await page.getByTestId('kl-crumb').count()===1,'back from Muutetut');
  }
  if(n===3){
   await search.fill('astro');
   await page.locator('[data-testid="kl-dir"][data-path="src/astro/"]').click();
   ok(await search.inputValue()==='src/astro/','folder narrows the search');
   await page.locator('.ah-pal-prev h2').waitFor({state:'attached'});
   await fits();await capture('kansio');
   await search.press('ControlOrMeta+KeyP');
   ok(await page.locator('[data-testid="kl-tab-Muutetut"][aria-selected="true"]').count()===1,'next tab: Muutetut');
   await search.press('ControlOrMeta+KeyP');
   ok(await page.locator('[data-testid="kl-tab-Komennot"][aria-selected="true"]').count()===1,'next tab: Komennot');
   await fits();await only1440light('komennot-valilehti');
  }
  // Esc returns to the text at the same caret.
  const before=await field.inputValue();
  await search.press('Escape');await pop.waitFor({state:'detached'});
  await focusIn('.ah-cbox-field');
  ok(await field.evaluate(el=>el.selectionStart===el.value.length),'caret where it was');
  ok(await field.inputValue()===before,'text unchanged');
  // Komennot from its button: Enter adds the command at the message's start.
  await page.getByTestId('command-palette').click();await options.first().waitFor();
  await focusIn('[data-testid="command-search"]');
  await inside();await fits();await capture('pitka-komennot');
  await search.press('Enter');await pop.waitFor({state:'detached'});
  ok((await field.inputValue()).startsWith('/skill:git-commit Katsoin'),'command at the start');
  // A typed @ opens at the same place; focus stays in the text. (The pointer
  // leaves the list first: Chromium hovers rows that appear under it.)
  await page.mouse.move(2,2);
  await field.press('Control+End');await field.pressSequentially(n===2?' ja @tests/test_s':' ja @tes');
  await options.first().waitFor();
  await focusIn('.ah-cbox-field');checks++;
  await inside();await fits();await capture('pitka-kirjoitettu');
  if(n===2)ok(await page.getByTestId('kl-crumb').count()===2,'typed path shows its folder');
  await field.press('Tab');await pop.waitFor({state:'detached'});
  ok(/ja @tests\/\S+ $/.test(await field.inputValue()),'Tab completes the top file: '+await field.inputValue());
  // A mid-line / is a mention with nothing selected, so Enter would send.
  await field.pressSequentially('/rev');await options.first().waitFor();
  await page.waitForTimeout(300);
  ok(await page.evaluate(()=>[...document.querySelectorAll('.ah-choice-pop [role="option"]')].map(o=>o.getAttribute('aria-selected')).join()).then(v=>!v.includes('true')),'mid-line / selects nothing d'+d+' '+tag);
  await field.press('Escape');await pop.waitFor({state:'detached'});
  // A press in the text closes a button's list; so does one outside.
  await page.getByTestId('file-picker').click();await options.first().waitFor();
  await field.click({position:{x:40,y:14}});await pop.waitFor({state:'detached'});checks++;
  await page.getByTestId('file-picker').click();await options.first().waitFor();
  await page.mouse.click(phone?200:900,phone?200:260);
  await pop.waitFor({state:'detached'});checks++;
  // Short draft.
  await draft('short');await inside();await fits();await capture('lyhyt-tiedosto');
  // A ! command gets the path as the shell's word.
  await draft('shell');
  ok(await page.getByTestId('command-palette').count()===0,'no Komennot in a command');
  await only1440light('komento-tiedosto');
  await search.fill('src/shadow');
  await page.locator('.ah-choice-pop [aria-selected="true"][data-path="src/shadow.py"]').waitFor();
  await search.press('Enter');await pop.waitFor({state:'detached'});
  ok(await field.inputValue()==='!pytest -q src/shadow.py ','plain path in a command');
  // Loading and failure.
  await page.locator('#draft').selectOption('tall');
  await page.locator('#load').selectOption('slow');
  await page.locator('.ah-choice-pop .ah-choice-loading').waitFor();checks++;
  await only1440light('haetaan');
  await options.first().waitFor();
  await page.locator('#load').selectOption('failed');
  await page.getByText('Tiedostolistaa ei saatu juuri nyt.').waitFor();checks++;
  await only1440light('ei-saatu');
  await page.locator('#load').selectOption('ready');
  await options.first().waitFor();
  await search.fill('zzz');
  await page.getByText('Ei osumia haulle “zzz”.').waitFor();checks++;
  await only1440light('ei-osumia');
  await search.press('Escape');
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
