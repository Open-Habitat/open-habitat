// Synthetic authored HTML only. Run on a browser-capable host:
// node check.mjs <built-html> <evidence-dir>
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const [input,out] = process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser = await chromium.launch();
const errors = [];
let checks = 0;
try {
 for (const width of [1440,1366,390]) for (const theme of ['light','dark']) {
  const page = await browser.newPage({viewport:{width,height:1000}});
  page.on('pageerror',e => errors.push(e.message));
  page.on('console',m => {if(m.type()==='error') errors.push(m.text());});
  await page.route('http://prototype.test/**',r => r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));
  await page.goto('http://prototype.test/');
  await page.locator('#theme').selectOption(theme);
  for(let d=0;d<3;d++) {
   await page.locator('.proto-picker-item:not(.proto-picker-replay)').nth(d).click();
   const act = a => page.locator(`.f-demo [data-act="${a}"]:visible`);
   const open = async () => {
    if(d===0){await act('attachments').click();await act('folder').click();}
    else await act(d===1?'settings':'folder').first().click();
    await page.locator('.f-panel').waitFor();
   };
   const check = async () => {
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'document overflow');
    const controls=page.locator('.f-demo button:visible, .f-demo select:visible');
    for(let i=0;i<await controls.count();i++) {
     const box=await controls.nth(i).boundingBox();
     assert.ok(box.x>=0 && box.x+box.width<=width+1,'control overflow');
    }
    checks++;
   };
   await page.locator('.f-demo textarea').fill('Säilytä luonnos.');
   await page.locator('#f-scenario').selectOption('brave');
   await open();
   await page.locator('.f-panel summary').click();
   assert.ok(await page.locator('.f-address').isVisible());
   await check();
   if(width===1440&&theme==='light') await capture('brave');
   await page.keyboard.press('Escape');
   assert.equal(await page.locator('.f-panel').count(),0);
   assert.equal(await page.locator(':focus').getAttribute('data-act'),d===0?'attachments':d===1?'settings':'folder');
   await check();
   await open();
   for(const scenario of ['unsupported','ready','permission','refused','granted']) {
    await page.locator('#f-scenario').selectOption(scenario);
    await check();
   }
   if(width===390&&theme==='dark') await capture('shared');
   await act('revoke').click();
   assert.equal(await page.locator('#f-scenario').inputValue(),'ready');
   await act('choose').click();
   await page.keyboard.press('Tab');
   assert.equal(await page.locator(':focus').getAttribute('data-act'),'grant');
   await page.keyboard.press('Shift+Tab');
   assert.equal(await page.locator(':focus').getAttribute('data-act'),'cancel');
   await act('cancel').click();
   assert.equal(await page.locator('#f-scenario').inputValue(),'refused');
   await check();
   for(const [outcome,expected] of [['deny','refused'],['refuse','refused'],['grant','granted']]) {
    await act('choose').click();await act(outcome).click();
    assert.equal(await page.locator('#f-scenario').inputValue(),expected);
    await check();
   }
   await act('choose').click();
   await act('refuse').click();
   assert.equal(await page.locator('#f-scenario').inputValue(),'granted');
   assert.ok((await page.locator('.f-panel').textContent()).includes('Aiempi kansio'));
   await check();
   await act('close').click();
   assert.equal(await page.locator('.f-demo textarea').inputValue(),'Säilytä luonnos.');
   await open();
   await page.locator('#f-scenario').selectOption('unsupported');
   await act('attach').click();
   assert.ok(await page.locator('.f-attachment').isVisible());
   assert.equal(await page.locator('.f-panel').count(),0);
   await act('remove').click();
   assert.equal(await page.locator('.f-attachment').count(),0);
   await check();
   async function capture(suffix) {
    const base=`${out}/d${d+1}-${width}-${theme}-${suffix}`;
    await page.screenshot({path:`${base}.png`,fullPage:true});
    const html=await page.evaluate(()=>{
     const root=document.documentElement.cloneNode(true);
     root.querySelectorAll('script').forEach(s=>s.remove());
     root.querySelectorAll('textarea').forEach((t,i)=>t.textContent=document.querySelectorAll('textarea')[i].value);
     return '<!doctype html>'+root.outerHTML;
    });
    writeFileSync(`${base}.html`,html);
   }
  }
  await page.close();
 }
 assert.deepEqual(errors,[]);
 console.log(`${checks} state/geometry checks passed; 3 directions × 3 widths × 2 themes, all scenarios and permission outcomes; zero console/page errors.`);
} finally {await browser.close();}
