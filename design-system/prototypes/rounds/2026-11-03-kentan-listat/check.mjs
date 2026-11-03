// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. Walks
// every direction light, dark, at 1440 and 390 px. Default view: tall draft
// with Komennot open from its button; then search, arrows, Esc back to the
// field at its caret, Tiedosto from its button, a typed @ at the caret, Enter
// inserting the file, and the short draft. Measures how far each list's
// bottom edge is from its button and writes screenshots at scale 2.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-03-kentan-listat';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['nyt','napin-luona','kentan-sisalla','napit-ylhaalla'];
const gaps={};
let checks=0;const errors=[];
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
 const capture=async name=>{if(!shots)return;await page.waitForTimeout(200);await page.screenshot({path:`${out}/${name}-${tag}.png`});};
 const fits=async()=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'document overflow');checks++;};
 const field=page.locator('.ah-cbox-field');
 const pop=page.locator('.ah-choice-pop');
 // Distance from the list's bottom edge to the top of its button, and whether
 // the whole list is on screen below the review bar.
 const gap=async sel=>page.evaluate(sel=>{
  const p=document.querySelector('.ah-choice-pop').getBoundingClientRect();
  const b=document.querySelector(sel).getBoundingClientRect();
  const bar=document.querySelector('.cl-bar').getBoundingClientRect().bottom;
  return {gap:Math.round(b.top-p.bottom),visible:p.top>=bar-1&&p.bottom<=innerHeight};
 },sel);
 for(const d of [0,1,2,3]){
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.cl-review.variant-${d}`).waitFor({state:'attached'});
  await page.locator('#draft').selectOption('tall');
  assert.match(await page.getByTestId('direction-lines').locator('li[aria-current]').innerText(),new RegExp('^'+['Nyt','Napin luona','Kentän sisällä','Napit ylhäällä'][d]));
  // Default: Komennot open from its button, search focused.
  await page.locator('.ah-choice-pop [role="option"]').first().waitFor();
  const search=page.getByTestId('command-search');
  await page.waitForFunction(()=>document.activeElement?.matches('[data-testid="command-search"]'));checks++;
  const g=await gap('[data-testid="command-palette"]');
  assert.ok(g.visible,`list off screen d${d} ${tag}`);checks++;
  (gaps[`${width}`] ??= {})[names[d]]=g.gap;
  if(d>0)assert.ok(g.gap<60,`list far from its button d${d}: ${g.gap}`),checks++;
  await fits();await capture(`d${d}-${names[d]}-pitka-komennot`);
  // Typing filters; arrows move; Esc closes and returns to the text.
  await search.fill('rev');
  await page.waitForFunction(()=>document.querySelectorAll('.ah-choice-pop [role="option"]').length>=1);
  await search.press('ArrowDown');
  assert.equal(await page.locator('.ah-choice-pop [role="option"][aria-selected="true"]').count(),1);checks++;
  await search.press('Escape');
  await pop.waitFor({state:'detached'});
  await page.waitForFunction(()=>document.activeElement?.classList.contains('ah-cbox-field'));checks++;
  // Tiedosto from its button; Enter inserts the path at the caret.
  await page.getByTestId('file-picker').click();
  await page.locator('.ah-choice-pop [role="option"]').first().waitFor();
  await fits();await capture(`d${d}-${names[d]}-pitka-tiedosto`);
  await page.getByTestId('command-search').press('Enter');
  await pop.waitFor({state:'detached'});
  assert.match(await field.inputValue(),/Katso myös @src\/shadow\.py ?$/);checks++;
  // A typed @ at the caret opens the caret list; Esc closes it, text stays.
  await field.press('End');await field.pressSequentially(' ja @tes');
  await page.locator('.ah-choice-pop [role="option"]').first().waitFor();
  await fits();await capture(`d${d}-${names[d]}-pitka-kirjoitettu`);
  await field.press('Escape');
  await pop.waitFor({state:'detached'});
  assert.match(await field.inputValue(),/ja @tes$/);checks++;
  // Napin luona: a press in the text still showing above the list closes it
  // (desktop; on a phone the list covers the whole field).
  if(d===1&&width===1440){
   await page.getByTestId('file-picker').click();
   await page.locator('.ah-choice-pop [role="option"]').first().waitFor();
   await field.click({position:{x:30,y:12}});
   await pop.waitFor({state:'detached'});checks++;
  }
  // Short draft: the default list again.
  await page.locator('#draft').selectOption('short');
  await page.locator('.ah-choice-pop [role="option"]').first().waitFor();
  await fits();await capture(`d${d}-${names[d]}-lyhyt-komennot`);
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
writeFileSync(`${out}/gaps.json`,JSON.stringify(gaps,null,1));
console.log(`ok: ${checks} checkpoints`,JSON.stringify(gaps));
