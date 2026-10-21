// Authored synthetic HTML, not a production/host test. Run on browser host:
// node check.mjs <built-html-or-hosted-url> <evidence-dir>
import {chromium} from 'playwright';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const [input,out]=process.argv.slice(2),hosted=input.startsWith('https:');
mkdirSync(out,{recursive:true});
const browser=await chromium.launch();const errors=[];let checks=0;
try {
 for(const width of [1440,1366,390]) for(const theme of ['light','dark']) {
  const page=await browser.newPage({viewport:{width,height:1100}});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  if(!hosted)await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));
  await page.goto(hosted?input:'http://prototype.test/');
  const root=hosted?page.frameLocator('iframe'):page;
  await root.locator('#theme').selectOption(theme);
  for(let d=0;d<3;d++) {
   await root.locator('.proto-picker-item:not(.proto-picker-replay)').nth(d).click();
   const q=s=>root.locator(s);
   await q('.s-skill').first().waitFor();
   assert.equal(await q('.s-skill').count(),4);
   assert.match(await q('.s-rows').textContent(),/Ohitettu tässä työtilassa/);
   assert.match(await q('.e-titlebar').textContent(),/Aurinkokello/);
   await q('.s-skill [data-open="2"]').click();
   assert.ok(await q('.s-editor').isVisible());
   assert.match(await q('.s-editor-path').textContent(),/aurinkokello\/\.pi\/skills\/review/);
   await page.keyboard.press('Escape');assert.equal(await q('.s-editor').isVisible(),false);checks++;
   await q('#s-search').fill('clock-tests');assert.equal(await q('.s-skill').count(),1);
   await q('#s-search').fill('not-a-skill');assert.ok(await q('.s-empty').isVisible());
   await q('#s-search').fill('');checks++;
   await q('#s-scope').selectOption('kuukartta');
   assert.equal(await q('.s-skill').count(),4);assert.doesNotMatch(await q('.s-rows').textContent(),/Ohitettu/);
   assert.match(await q('.s-rows').textContent(),/release-check/);checks++;
   if(d===0){await q('#s-scope').selectOption('all');assert.equal(await q('.s-skill').count(),6);checks++;}
   await q('#s-scope').selectOption('aurinkokello');
   if(!hosted && ((width===1440&&theme==='light')||(width===390&&theme==='dark'))) await capture('catalogue');
   await q('[data-act="close"]').click();
   await q('.s-demo textarea').fill('Tarkista tämä muutos.');
   await q('.s-entry [data-act="open"]').click();
   if(d===2){await q('[data-use="2"]').click();assert.equal(await q('.s-demo textarea').inputValue(),'/skill:review Tarkista tämä muutos.');await q('.s-entry [data-act="open"]').click();}
   else {await page.keyboard.press('Escape');assert.equal(await q('.s-demo textarea').inputValue(),'Tarkista tämä muutos.');await q('.s-entry [data-act="open"]').click();}
   checks++;
   // Scroll each relevant surface: the last skill and its action must remain reachable.
   await q('[data-open="3"]').scrollIntoViewIfNeeded();
   await q('[data-open="3"]').click();
   assert.ok(await q('.s-editor').isVisible());await q('[data-act="editor-close"]').click();checks++;
   const overflow=await q('.s-demo').evaluate(el=>{
    const bounds=el.getBoundingClientRect();return [...el.querySelectorAll('button,input,select')].filter(e=>e.getClientRects().length && !e.closest('dialog:not([open])')).filter(e=>{const b=e.getBoundingClientRect();return b.left<bounds.left-1||b.right>bounds.right+1}).map(e=>e.outerHTML);
   });assert.deepEqual(overflow,[]);
   const docOverflow=await q('body').evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(docOverflow,false);checks++;
   async function capture(suffix){const base=`${out}/d${d+1}-${width}-${theme}-${suffix}`;await page.screenshot({path:base+'.png',fullPage:true});const html=await q('html').evaluate(el=>{const copy=el.cloneNode(true);copy.querySelectorAll('script').forEach(s=>s.remove());return '<!doctype html>'+copy.outerHTML});writeFileSync(base+'.html',html);}
  }
  await page.close();
 }
 assert.deepEqual(errors,[]);console.log(`${checks} checkpoints passed; 3 directions × 3 widths × 2 themes; zero console/page errors (${hosted?'hosted':'offline'}).`);
}finally{await browser.close();}
