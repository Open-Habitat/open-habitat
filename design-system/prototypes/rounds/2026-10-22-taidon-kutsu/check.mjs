// Disposable Chromium only; synthetic authored artifact, never a product host.
// node check.mjs <offline-html-or-hosted-url> <evidence-dir>
import { chromium } from 'playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const [input,out]=process.argv.slice(2);
const hosted=input.startsWith('https:');
const html=hosted?null:readFileSync(input,'utf8');
if(out) mkdirSync(out,{recursive:true});
const browser=await chromium.launch();
const errors=[]; let states=0;
try {
 for(const width of [1440,1366,390]) for(const theme of ['light','dark']) {
  const page=await browser.newPage({viewport:{width,height:1000}});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error') errors.push(m.text());});
  if(!hosted) await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
  await page.goto(hosted?input:'http://prototype.test/');
  const f=hosted?page.frameLocator('iframe').first():page;
  await f.locator('.s-demo').waitFor();
  await f.locator('#theme').selectOption(theme);
  for(let d=0;d<3;d++) {
   await f.locator('.proto-picker-item:not(.proto-picker-replay)').nth(d).click();
   await f.locator(`.s-demo[data-direction="${['chip','card','command'][d]}"]`).waitFor();
   await f.locator('.s-demo textarea').fill('Säilytä oma luonnos.');
   for(const scene of ['extra','only','long','plain']) {
    await f.locator(`button[data-scene="${scene}"]`).click();
    const demo=f.locator('.s-demo');
    assert.equal(await demo.getAttribute('data-scene'),scene);
    assert.equal(await f.locator('.s-demo textarea').inputValue(),'Säilytä oma luonnos.');
    const check=async()=>{
     assert.ok(await demo.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'document overflow');
     for(const sel of ['.s-user','.s-compose','.s-skill summary']) {
      const el=f.locator(sel); if(!await el.count()) continue;
      const box=await el.boundingBox();
      assert.ok(box.x>=0&&box.x+box.width<=width+1,`${sel} viewport overflow`);
     }
     if(width>800) assert.equal(Math.round((await f.locator('.e-rail').boundingBox()).width),296);
     assert.equal(await f.locator('.e-title h1').textContent(),'Ensimmäinen tehtävä');
     assert.equal(await f.locator('.e-titlebar .e-icon').count(),5);
     states++;
    };
    await check();
    if(scene==='plain') {
     assert.equal(await f.locator('.s-skill').count(),0);
     assert.match(await f.locator('.s-args').textContent(),/<skill name="esimerkki">/);
     continue;
    }
    assert.equal(await f.locator('.s-source').isVisible(),false);
    assert.equal(await f.locator('.s-args').count(),scene==='only'?0:1);
    if(scene!=='only') assert.match(await f.locator('.s-args').textContent(),/Älä kirjoita tiedostoa vielä/);
    const capture=async suffix=>{
     if(hosted||!out) return;
     await f.locator('.s-user').scrollIntoViewIfNeeded();
     const base=`${out}/d${d+1}-${width}-${theme}-${suffix}`;
     await page.screenshot({path:`${base}.png`,fullPage:true});
     await f.locator('.s-demo textarea').evaluate(e=>e.textContent=e.value);
     writeFileSync(`${base}.html`,(await page.content()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''));
    };
    if(scene==='extra'&&((width===1440&&theme==='light')||(width===390&&theme==='dark'))) await capture('collapsed');
    await f.locator('.s-skill summary').focus();
    await page.keyboard.press('Enter');
    await f.locator('.s-skill[open]').waitFor();
    assert.match(await f.locator('.s-source pre').textContent(),/^<skill name=".+" location="\/example\/skills\//);
    assert.match(await f.locator('.s-source pre').textContent(),/Do not commit or push/);
    await check();
    if(scene==='extra'&&width===390&&theme==='dark') await capture('expanded');
    await f.locator('.s-skill summary').focus(); await page.keyboard.press('Enter');
    assert.equal(await f.locator('.s-source').isVisible(),false);
    await check();
   }
   // Phone preview affordance, independent of actual viewport coverage.
   await f.locator('#phone').check();
   assert.ok(await f.locator('#wrap').evaluate(e=>e.classList.contains('phone')));
   await f.locator('#phone').uncheck();
  }
  await page.close();
 }
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({success:true,hosted,states,errors}));
} finally {await browser.close();}
