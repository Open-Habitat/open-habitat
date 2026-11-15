// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. Walks
// the three directions light and dark at 1440 and 390 px: the sheet as it
// opens, the file list, C's third choice, the branch-changed and no-snapshot
// situations and the result row. The sheet must stay above the composer and
// the console clean. Screenshots at device scale factor 2.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-15-rewind-all-changes';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['a-kaikki-takaisin','b-agentin-vuorot','c-valitse-itse'];
// Files that go back as the sheet opens, per direction.
const going=[8,6,6];
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
 const sheet=page.getByTestId('rewind-sheet');
 const text=async()=>sheet.innerText();
 const visible=async()=>{
  const c=await sheet.boundingBox(),k=await page.locator('.ah-composer').boundingBox(),b=await page.locator('.rac-bar').boundingBox();
  ok(c.y>=b.y+b.height-1&&c.y+c.height<=k.y+1,`sheet not fully visible (${Math.round(c.y)}..${Math.round(c.y+c.height)}, bar ${Math.round(b.y+b.height)}, composer ${Math.round(k.y)})`);
 };
 for(const d of [0,1,2]){
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.rac-review.variant-${d}`).waitFor({state:'attached'});
  await page.locator('#case').selectOption('normal');
  await sheet.waitFor();await page.waitForTimeout(100);
  const n=names[d];
  assert.equal(await sheet.getAttribute('data-what'),'both');checks++;
  ok((await text()).includes(`${going[d]} tiedostoa palautuu`),`d${d}: count`);
  ok((await text()).includes('Ei palaudu: agentin 1 commit'),'not-restored line');
  assert.equal(await page.getByTestId('staying').count(),d===0?0:1);checks++;
  assert.equal(await page.getByTestId('rewind-between').count(),d===2?1:0);checks++;
  ok(await page.locator('.rac-msg[data-left]').count()>=5,'later part dimmed');
  await visible();await fits();await capture(`${n}-1-arkki`);
  // The list: commands' files are tagged; between-turn files go back (A) or stay (B, C).
  await page.getByTestId('rewind-files-toggle').click();
  const list=page.getByTestId('rewind-file-list');
  assert.equal(await list.locator('li[data-by="command"]').count(),3);checks++;
  assert.equal(await list.locator('li').count(),8);checks++;
  assert.equal(await list.locator('li.ah-rewind-quiet').count(),d===0?0:2);checks++;
  await visible();await fits();await capture(`${n}-2-tiedostot`);
  if(d===2){
   await page.getByTestId('rewind-between').click();
   ok((await text()).includes('8 tiedostoa palautuu'),'C: between included');
   assert.equal(await page.getByTestId('staying').count(),0);checks++;
   await visible();await fits();await capture(`${n}-3-valissa-mukana`);
   await page.getByTestId('rewind-between').click();
  }
  // Confirm: the result row names how many files went back.
  await page.getByTestId('rewind-go').click();
  ok((await page.getByTestId('branch-marker').innerText()).includes(`${going[d]} tiedostoa palautettu`),'result row');
  await fits();await capture(`${n}-4-tulos`);
  // The agent changed branch: files start unchecked, with the reason.
  await page.locator('#case').selectOption('branch');
  await sheet.waitFor();await page.waitForTimeout(100);
  assert.equal(await sheet.getAttribute('data-what'),'conversation');checks++;
  ok((await page.getByTestId('branch-note').innerText()).includes('main → korjaus/kesaaika'),'branch note');
  assert.equal((await page.getByTestId('rewind-go').innerText()).trim(),'Palaa tähän');checks++;
  await visible();await fits();await capture(`${n}-5-haara-vaihtui`);
  await page.getByTestId('rewind-files').click();
  assert.equal(await sheet.getAttribute('data-what'),'both');checks++;
  await visible();
  // An older message without a snapshot: today's behaviour, said plainly.
  await page.locator('#case').selectOption('none');
  await sheet.waitFor();await page.waitForTimeout(100);
  ok((await text()).includes('3 tiedostoa palautuu')&&(await text()).includes('komennoilla muutetut tiedostot jäävät'),'no snapshot');
  assert.equal(await page.getByTestId('rewind-between').count(),0);checks++;
  await visible();await fits();await capture(`${n}-6-ei-tilannekuvaa`);
  // Neither chosen disables the button.
  await page.getByTestId('rewind-files').click();await page.getByTestId('rewind-conversation').click();
  ok(await page.getByTestId('rewind-go').isDisabled(),'nothing chosen disables');
  await page.locator('#case').selectOption('normal');
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
