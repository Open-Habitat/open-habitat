// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. Walks
// every direction light and dark at 1440 and 390 px. Default view: tall draft
// with Tiedosto open from its button inside the field and AGENTS typed in its
// search, the preview beside the list on a desktop and none on a phone. Then,
// in each in-field direction: how the five AGENTS.md files show (the pruned
// tree with the root's first, the flat list ranked changed or shallow first
// and → into the tree, the name row that marks all five); marking two files
// (keys, or taps on a phone) and Enter adding both; browsing without a search
// as round 3's Puu; Esc back to the text at its caret; Komennot adding at the
// start; a typed @AGENTS and Tab completing the top file; a mid-line / with
// nothing selected; a press in the text and outside closing the list; the
// short draft; a ! command getting a plain path; the slow, failed and empty
// list. Screenshots at scale 2; light at both widths, dark at 1440.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-06-kentan-listat-4';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['nyt','puussa','lista','nimi'];
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
  await search.press('Tab');if(d===1)await search.press('ArrowDown');await search.press('Tab');
 };
 const fileRows=()=>page.locator('.ah-choice-pop [data-testid="composer-file-choice"]');
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
  ok((await page.getByTestId('direction-lines').locator('li[aria-current]').innerText()).startsWith(['Nyt','Puussa','Lista','Nimi'][n]),'direction line');
  await focusIn('[data-testid="command-search"]');checks++;
  await page.waitForFunction(()=>document.querySelector('[data-testid="command-search"]')?.value==='AGENTS');checks++;
  await page.locator('.ah-choice-pop [data-path$="AGENTS.md"]').first().waitFor();
  await fits();await capture('pitka-agents');
  if(n===0){
   // Today: a flat list of whole paths, the changed one first.
   ok(await options.count()===5,'five AGENTS.md today');
   ok(await options.first().getAttribute('data-path')==='AGENTS.md'&&await options.nth(1).getAttribute('data-path')==='src/AGENTS.md','today the shortest path first');
   await search.press('Escape');await pop.waitFor({state:'detached'});
   await focusIn('.ah-cbox-field');
   await field.press('Control+End');await field.pressSequentially(' ja @AGENTS');
   await options.first().waitFor();await capture('pitka-kirjoitettu');
   await field.press('Escape');await pop.waitFor({state:'detached'});
   await draft('short');await capture('lyhyt-agents');
   continue;
  }
  await inside();await preview();
  ok(await page.locator('.ah-choice-pop [role="tab"]').count()===0,'no tabs');
  ok(await page.getByTestId('kl-note').innerText()==='5 osumaa','five hits');
  if(n===1){
   ok(await fileRows().count()===5,'five files in the tree');
   ok(await selPath()==='AGENTS.md'&&await fileRows().first().getAttribute('data-path')==='AGENTS.md',"the root's file first and in hand");
   for(const p of ['docs/','src/','src/astro/','tests/'])ok(await page.locator(`[data-testid="kl-dir"][data-path="${p}"]`).getAttribute('data-open')==='true',`${p} open`);
   ok(await page.locator('[data-testid="kl-dir"][data-path="notes/"]').count()===0,'folders without a hit are left out');
   // ← closes a folder within the search, → opens it again.
   await search.press('ArrowDown');
   ok(await selPath()==='docs/','down to docs/');
   await search.press('Home');await search.press('ArrowLeft');
   ok(await page.locator('[data-testid="kl-dir"][data-path="docs/"]').getAttribute('data-open')==='false','← closes docs/');
   await search.press('End');await search.press('ArrowRight');
   ok(await page.locator('[data-testid="kl-dir"][data-path="docs/"]').getAttribute('data-open')==='true','→ opens docs/');
  }
  if(n===2){
   ok(await page.locator('.ah-choice-pop [data-testid="kl-dir"]').count()===0,'no folder rows in the flat list');
   ok(await selPath()==='src/AGENTS.md','changed first');
   ok(await options.nth(1).getAttribute('data-path')==='AGENTS.md','then the shallowest');
   ok(await options.nth(1).locator('.kl-where').innerText()==='aurinkokello/','the root shows as the workspace');
   await page.locator('#rank').selectOption('shallow');
   await page.waitForFunction(()=>document.querySelector('.ah-choice-pop [role="option"]')?.getAttribute('data-path')==='AGENTS.md');checks++;
   await preview();await only1440light('matalimmat');
   await page.locator('#rank').selectOption('changed');
   await page.waitForFunction(()=>document.querySelector('.ah-choice-pop [role="option"]')?.getAttribute('data-path')==='src/AGENTS.md');checks++;
   // → shows the file in its folder: the search clears and the tree opens to it.
   await search.press('ArrowDown');await search.press('ArrowDown');
   ok(await selPath()==='docs/AGENTS.md','docs/AGENTS.md in hand');
   await search.press('ArrowRight');
   await page.waitForFunction(()=>document.querySelector('[data-testid="command-search"]').value==='');checks++;
   ok(await selPath()==='docs/AGENTS.md','still in hand in the tree');
   ok(await page.locator('[data-testid="kl-dir"][data-path="docs/"]').getAttribute('data-open')==='true','its folder opened');
   await preview();await fits();await capture('kansiossa');
   await search.fill('AGENTS');
  }
  if(n===3){
   const nameRow=page.getByTestId('kl-name');
   ok(await nameRow.count()===1&&await nameRow.getAttribute('data-name')==='AGENTS.md','one name row');
   ok(await nameRow.locator('.kl-name-n').innerText()==='5 kansiossa','in five folders');
   ok(await selPath()==='src/AGENTS.md','the changed one in hand under the name');
   // ← to the name, ← closes it, → opens it again.
   await search.press('Home');await search.press('ArrowLeft');
   ok(await nameRow.getAttribute('aria-selected')==='true','← to the name row');
   if(!phone)await capture('nimirivi');
   await search.press('ArrowLeft');
   ok(await nameRow.getAttribute('data-open')==='false'&&await fileRows().count()===0,'← closes the name');
   await search.press('End');await search.press('ArrowRight');
   ok(await fileRows().count()===5,'→ opens it');
   // Marking the name marks all five.
   if(phone)await nameRow.locator('[data-testid="kl-mark"]').tap();else{ok(await nameRow.getAttribute('aria-selected')==='true','the name row still in hand');await search.press('Tab');}
   ok(await page.getByTestId('kl-marked').innerText().then(t=>t.startsWith('5 valittu')),'five marked');
   await fits();await capture('kaikki');
   if(phone)await page.getByTestId('kl-add').tap();else await search.press('Enter');
   await pop.waitFor({state:'detached'});
   ok(/Katso myös @src\/AGENTS\.md @AGENTS\.md @docs\/AGENTS\.md @tests\/AGENTS\.md @src\/astro\/AGENTS\.md $/.test(await field.inputValue()),'five paths: '+await field.inputValue());
   await page.getByTestId('cl-reset').click();
   await page.waitForFunction(()=>document.querySelector('[data-testid="command-search"]')?.value==='AGENTS');
  }
  // Several files: search, mark two, Enter adds both at the caret.
  await search.fill('shadow');
  await page.waitForFunction(n=>document.querySelectorAll('.ah-choice-pop [role="option"]').length===(n===1?4:2),n);
  await markTwo();
  ok(await page.getByTestId('kl-marked').innerText().then(t=>t.startsWith('2 valittu')),'two marked');
  await fits();await capture('useampi');
  if(phone)await page.getByTestId('kl-add').tap();else await search.press('Enter');
  await pop.waitFor({state:'detached'});
  ok(/Katso myös @src\/shadow\.py @tests\/test_shadow\.py $/.test(await field.inputValue()),`two paths d${n}: ${await field.inputValue()}`);
  await focusIn('.ah-cbox-field');checks++;
  // Browsing without a search is round 3's Puu.
  await page.getByTestId('file-picker').click();await options.first().waitFor();
  ok(await search.inputValue()==='','the button opens with an empty search');
  ok(await selPath()==='notes/2026-11-02-ajo.md','starts on the first changed file');
  ok(await page.locator('[data-testid="kl-dir"][data-path="src/astro/"]').getAttribute('data-open')==='true','a folder with changes is open');
  ok(await page.locator('[data-testid="kl-dir"][data-path="docs/"]').getAttribute('data-open')==='false','a folder without changes is closed');
  await only1440light('selaus');
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
  await field.press('Control+End');await field.pressSequentially(' ja @AGENTS');
  await options.first().waitFor();
  await focusIn('.ah-cbox-field');checks++;
  await inside();await fits();await capture('pitka-kirjoitettu');
  ok(await page.locator('.ah-choice-pop [role="option"][aria-selected="true"]').getAttribute('data-testid')==='composer-file-choice','a file in hand, not a folder or a name');
  await field.press('Tab');await pop.waitFor({state:'detached'});
  const top=n===1?'AGENTS.md':'src/AGENTS.md';
  ok((await field.inputValue()).endsWith(` ja @${top} `),'Tab completes the top file: '+await field.inputValue());
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
  await draft('short');await inside();await fits();await capture('lyhyt-agents');
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
