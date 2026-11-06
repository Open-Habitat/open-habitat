// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. Walks
// every direction light and dark at 1440 and 390 px. Default view: tall draft
// with Tiedosto open from its button inside the field, the preview beside the
// list on a desktop and none on a phone, and the changed files shown as a
// state in the list (lifted first, the tree open to them, or first in the
// column's folder). Then, in each in-field direction: marking two files
// (keys, or taps on a phone) and Enter adding both; folders (the path row,
// the tree opening and closing, the column); Esc back to the text at its
// caret; Komennot adding at the start; a typed @ at the caret and Tab
// completing a file; a mid-line / with nothing selected; a press in the text
// and outside closing the list; the short draft; a ! command getting a plain
// path; the slow, failed and empty list. Screenshots at scale 2; light at
// both widths, dark at 1440.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-06-kentan-listat-3';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['nyt','ylhaalla','puu','sarake'];
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
 const markTwo=async()=>{
  if(phone){for(const p of ['src/shadow.py','tests/test_shadow.py'])await page.locator(`.ah-choice-pop [role="option"][data-path="${p}"] [data-testid="kl-mark"]`).tap();return;}
  // The tree shows tests/ between the two files: step over it.
  await search.press('Tab');if(d===2)await search.press('ArrowDown');await search.press('Tab');
 };
 const selPath=()=>page.locator('.ah-choice-pop [role="option"][aria-selected="true"]').getAttribute('data-path');
 // The preview beside the list follows the row in hand; a phone has none.
 const preview=async()=>{
  const prev=page.locator('.ah-choice-pop .ah-pal-prev');
  if(phone){ok(!(await prev.isVisible()),'no preview on a phone');return;}
  const p=await selPath()??'/'+(await page.locator('.ah-choice-pop [role="option"][aria-selected="true"]').getAttribute('data-testid')).replace('composer-command-','');
  await page.waitForFunction(p=>document.querySelector('.ah-choice-pop .ah-pal-prev h2')?.textContent.startsWith(p),p);checks++;
 };

 for(const n of [0,1,2,3]){
  await choose(n);
  await draft('tall');
  ok((await page.getByTestId('direction-lines').locator('li[aria-current]').innerText()).startsWith(['Nyt','Ylhäällä','Puu','Sarake'][n]),'direction line');
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
  await inside();await preview();
  // Changed files are a state in the list, not a tab or a folder.
  ok(await page.locator('.ah-choice-pop [role="tab"]').count()===0,'no tabs');
  if(n===1){
   ok(await options.first().getAttribute('data-path')==='src/shadow.py','changed files first');
   ok(await page.locator('.ah-choice-pop .kl-sep').count()===1,'a line under the changed files');
  }
  if(n===2){
   ok(await selPath()==='notes/2026-11-02-ajo.md','starts on the first changed file');
   ok(await page.locator('[data-testid="kl-dir"][data-path="src/astro/"]').getAttribute('data-open')==='true','a folder with changes is open');
   ok(await page.locator('[data-testid="kl-dir"][data-path="docs/"]').getAttribute('data-open')==='false','a folder without changes is closed');
  }
  if(n===3){
   ok(await page.locator('.kl-col-row[aria-current]').getAttribute('data-path')==='','the column starts at the workspace');
   ok(await options.first().getAttribute('data-path')==='src/shadow.py','changed files first in the folder');
  }
  // Several files: search, mark two, Enter adds both at the caret.
  await search.fill('shadow');
  await page.waitForFunction(n=>document.querySelectorAll('.ah-choice-pop [role="option"]').length===(n===2?4:2),n);
  await markTwo();
  ok(await page.getByTestId('kl-marked').innerText().then(t=>t.startsWith('2 valittu')),'two marked');
  await fits();await capture('useampi');
  if(phone)await page.getByTestId('kl-add').tap();else await search.press('Enter');
  await pop.waitFor({state:'detached'});
  ok(/Katso myös @src\/shadow\.py @tests\/test_shadow\.py $/.test(await field.inputValue()),`two paths d${n}: ${await field.inputValue()}`);
  await focusIn('.ah-cbox-field');checks++;
  // Folders.
  await page.getByTestId('file-picker').click();await options.first().waitFor();
  if(n===1){
   await search.fill('src/');
   ok(await page.getByTestId('kl-crumb').count()===2,'a typed path shows its folder');
   ok(await options.first().getAttribute('data-path')==='src/shadow.py',"the folder's changed files first");
   await page.locator('[data-testid="kl-dir"][data-path="src/astro/"]').click();
   ok(await page.getByTestId('kl-crumb').count()===3,'crumbs aurinkokello › src › astro');
   ok(await search.inputValue()==='','the folder clears the search');
   await preview();await fits();await capture('kansio');
   await search.press('ArrowLeft');
   ok(await page.getByTestId('kl-crumb').count()===2,'up to src');
   await page.getByTestId('kl-crumb').first().click();
   ok(await page.getByTestId('kl-crumb').count()===1,'back to the workspace');
  }
  if(n===2){
   const fx=page.locator('[data-testid="kl-dir"][data-path="tests/fixtures/"]');
   ok(await fx.getAttribute('data-open')==='false','fixtures starts closed');
   await fx.click();
   ok(await fx.getAttribute('data-open')==='true','a press opens the folder in place');
   await page.locator('[data-path="tests/fixtures/helsinki.json"]').waitFor();checks++;
   await preview();await fits();await capture('kansio');
   ok(await selPath()==='tests/fixtures/','the opened folder is in hand');
   await search.press('ArrowLeft');
   ok(await fx.getAttribute('data-open')==='false','← closes it');
   await search.press('ArrowLeft');
   ok(await selPath()==='tests/','← again steps out to the parent');
   await search.press('ArrowLeft');
   ok(await page.locator('[data-testid="kl-dir"][data-path="tests/"]').getAttribute('data-open')==='false','a folder with changes can be closed');
   await search.press('ArrowRight');
   ok(await page.locator('[data-testid="kl-dir"][data-path="tests/"]').getAttribute('data-open')==='true','→ opens it');
  }
  if(n===3){
   await page.locator('.kl-col-row[data-path="src/"]').click();
   ok(await options.count()===9,'everything under src/');
   ok(await options.first().getAttribute('data-path')==='src/shadow.py','changed first in src/');
   await preview();await fits();await capture('kansio');
   await search.press('ArrowRight');
   ok(await page.locator('.kl-col-row[aria-current]').getAttribute('data-path')==='src/astro/'&&await options.count()===4,'→ to the next folder');
   await search.press('ArrowLeft');
   ok(await page.locator('.kl-col-row[aria-current]').getAttribute('data-path')==='src/','← back');
   await page.locator('.kl-col-row[data-path=""]').click();
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
  await inside();await preview();await fits();await capture('pitka-komennot');
  await search.press('Enter');await pop.waitFor({state:'detached'});
  ok((await field.inputValue()).startsWith('/skill:git-commit Katsoin'),'command at the start');
  // A typed @ opens at the same place; focus stays in the text. (The pointer
  // leaves the list first: Chromium hovers rows that appear under it.)
  await page.mouse.move(2,2);
  await field.press('Control+End');await field.pressSequentially(n===1?' ja @tests/test_s':' ja @tes');
  await options.first().waitFor();
  await focusIn('.ah-cbox-field');checks++;
  await inside();await fits();await capture('pitka-kirjoitettu');
  if(n===1)ok(await page.getByTestId('kl-crumb').count()===2,'typed path shows its folder');
  if(n===2)ok(await page.locator('.ah-choice-pop [role="option"][aria-selected="true"]').getAttribute('data-testid')==='composer-file-choice','a file in hand, not a folder');
  await field.press('Tab');await pop.waitFor({state:'detached'});
  ok(/ja @\S+[^/] $/.test(await field.inputValue()),'Tab completes a file: '+await field.inputValue());
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
