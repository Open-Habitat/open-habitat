// Synthetic authored prototype only. node check.mjs <html-or-https-url> [evidence-dir]
import {chromium} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const [input,out]=process.argv.slice(2), hosted=input.startsWith('https:');
if(out) mkdirSync(out,{recursive:true});
const browser=await chromium.launch();
const errors=[]; let states=0;
try {
 for(const width of [1440,1366,390]) for(const theme of ['light','dark']) {
  const page=await browser.newPage({viewport:{width,height:1000}});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error') errors.push(m.text());});
  if(!hosted) await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));
  await page.goto(hosted?input:'http://prototype.test/');
  const f=hosted?page.frameLocator('iframe').first():page;
  await f.locator('.s-demo').waitFor();
  await f.locator('#theme').selectOption(theme);
  for(let d=0;d<3;d++) {
   await f.locator('.proto-picker-item:not(.proto-picker-replay)').nth(d).click();
   await f.locator(`.s-demo[data-direction="${['sheet','dialog','view'][d]}"]`).waitFor();
   await f.locator('.s-demo textarea').fill('Säilytä oma luonnos.');
   for(const scene of ['extra','only','long','missing','plain']) {
    await f.locator(`button[data-scene="${scene}"]`).click();
    assert.equal(await f.locator('.s-demo textarea').inputValue(),'Säilytä oma luonnos.');
    const check=async()=>{
     assert.ok(await f.locator('.s-demo').evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'document overflow');
     for(const sel of ['.s-user','.s-compose','.s-open','.s-reader:visible']) {
      const el=f.locator(sel); if(!await el.count()||!await el.isVisible()) continue;
      const box=await el.boundingBox();
      assert.ok(box.x>=-1&&box.x+box.width<=width+1,`${sel} viewport overflow`);
     }
     if(width>800) assert.equal(Math.round((await f.locator('.e-rail').boundingBox()).width),296);
     assert.equal(await f.locator('.e-title h1').textContent(),'Ensimmäinen tehtävä');
     assert.equal(await f.locator('.e-titlebar .e-icon').count(),5);
     states++;
    };
    await check();
    if(scene==='plain') {
     assert.equal(await f.locator('.s-open').count(),0);
     assert.match(await f.locator('.s-args').textContent(),/<skill name="esimerkki">/);
     continue;
    }
    const trigger=f.locator('.s-open');
    const description=scene==='missing'?'Näytä taidon ohje':'Ehdota repolle aloitussivu ja ensimmäiset hyödylliset tehtävät.';
    assert.equal((await trigger.textContent()).trim(),description);
    assert.equal(await trigger.locator('svg path').getAttribute('d'),'m9 5 7 7-7 7');
    assert.equal(await trigger.locator('code,pre,summary').count(),0);
    assert.equal(await f.locator('.s-args').count(),scene==='only'?0:1);
    const capture=async suffix=>{
     if(hosted||!out||scene!=='extra'||!((width===1440&&theme==='light')||(width===390&&theme==='dark'))) return;
     const base=`${out}/d${d+1}-${width}-${theme}-${suffix}`;
     await page.screenshot({path:`${base}.png`,fullPage:true});
     await f.locator('.s-demo textarea').evaluate(e=>e.textContent=e.value);
     writeFileSync(`${base}.html`,(await page.content()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''));
    };
    await trigger.scrollIntoViewIfNeeded();
    const scroll=await f.locator('.s-stream').evaluate(e=>e.scrollTop);
    await capture('collapsed');
    await trigger.focus(); await page.keyboard.press('Enter');
    const reader=f.locator('.s-reader:visible'); await reader.waitFor();
    assert.equal(await reader.locator('.s-close').evaluate(e=>document.activeElement===e),true);
    assert.match(await reader.locator('h2').textContent(),/open-habitat-start-page|repository-first-conversation/);
    assert.match(await reader.locator('.s-instructions').textContent(),/Do not commit or push/);
    assert.equal(await reader.locator('.s-raw').getAttribute('open'),null);
    // Native modal contains Tab focus; view deliberately remains a normal region.
    if(d<2) {
     await page.keyboard.press('Tab');
     assert.equal(await reader.evaluate(e=>e.contains(document.activeElement)),true);
    }
    await check(); await capture('open');
    await reader.locator('.s-raw summary').click();
    assert.match(await reader.locator('.s-raw pre').textContent(),/^<skill name=".+" location="\/example\/skills\//);
    await page.keyboard.press('Escape');
    assert.equal(await f.locator('.s-reader:visible').count(),0);
    assert.equal(await trigger.evaluate(e=>document.activeElement===e),true);
    assert.equal(await f.locator('.s-stream').evaluate(e=>e.scrollTop),scroll);
    assert.equal(await f.locator('.s-demo textarea').inputValue(),'Säilytä oma luonnos.');
    await check();
    // Also exercise the explicit close/back control, not just Escape.
    await trigger.click(); await f.locator('.s-reader:visible .s-close').click();
    assert.equal(await f.locator('.s-reader:visible').count(),0);
   }
   await f.locator('#phone').check();
   assert.ok(await f.locator('#wrap').evaluate(e=>e.classList.contains('phone')));
   await f.locator('#phone').uncheck();
  }
  await page.close();
 }
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({success:true,hosted,states,errors}));
} finally {await browser.close();}
