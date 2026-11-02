// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. Walks
// every direction light, dark, at 1440 and 390 px; checks the default view
// carries no command or file name, presses Luo aloitussivu, sends where the
// direction lets the person send, and writes screenshots at scale 2.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-02-aloitussivun-painike';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['rivi','kortti','kentta'];
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
 const capture=async name=>{await page.waitForTimeout(150);await page.screenshot({path:`${out}/${name}-${tag}.png`});};
 const fits=async()=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'document overflow');checks++;};
 const id=x=>page.getByTestId(x).first();
 const field=page.locator('.ah-composer textarea');
 for(const d of [0,1,2]){
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.sp-review.variant-${d}`).waitFor({state:'attached'});
  await id('sp-reset').click();
  assert.match(await id('direction-lines').locator('li[aria-current]').innerText(),[/^Rivi ja painike/,/^Kortti, alkaa heti/,/^Kentän yllä/][d]);
  // No command or file name on screen.
  const text=await page.locator('.sp-stage').innerText();
  assert.doesNotMatch(text,/open-habitat-start-page|start-page\.md|\/skill:/);
  const create=id('sp-create');await create.waitFor();
  assert.equal(await create.innerText(),'Luo aloitussivu');
  await fits();await capture(`d${d+1}-${names[d]}-oletus`);
  await create.click();
  if(d===1){
   // The card sends at once: the request and the agent's proposal are in the history.
   await id('sp-reply').waitFor();
   assert.match(await id('skill-chip').innerText(),/Luo aloitussivu/);
  }else{
   // The field gets the goal chip; nothing is sent until the person sends.
   await id('goal-chip').waitFor();
   assert.match(await id('goal-chip').innerText(),/Luo aloitussivu/);
   assert.equal(await field.inputValue(),'');
   await page.waitForFunction(()=>document.activeElement===document.querySelector('.ah-composer textarea'));checks++;
   assert.equal(await page.getByTestId('sp-reply').count(),0);
   if(d===0)await id('sp-filled-note').waitFor();
   if(d===2)assert.equal(await page.getByTestId('sp-suggest').count(),0);
   await fits();await capture(`d${d+1}-${names[d]}-kentassa`);
   await field.fill('Korosta viikkoyhteenvetoja.');
   await id('send').click();
   await id('sp-reply').waitFor();
   assert.match(await page.locator('.ah-feed').innerText(),/Korosta viikkoyhteenvetoja/);
  }
  await page.waitForFunction(()=>document.querySelector('[data-testid="sp-reply"]')?.innerText.includes('Mitään ei ole vielä kirjoitettu'));
  await fits();await capture(`d${d+1}-${names[d]}-lahetetty`);
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
