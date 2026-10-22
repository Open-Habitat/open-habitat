// node check.mjs <offline-html-or-hosted-url> <evidence-dir>
// Authored synthetic prototype only, with a fresh context per width/theme.
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const [input,out]=process.argv.slice(2), hosted=input.startsWith('https:');
mkdirSync(out,{recursive:true});
const browser=await chromium.launch();
const errors=[];let checks=0;
try {
 for(const width of [1440,1366,390])for(const theme of ['light','dark']) {
  const page=await browser.newPage({viewport:{width,height:1000}});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  if(hosted)await page.goto(input);
  else {await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));await page.goto('http://prototype.test/');}
  const root=hosted?page.frameLocator('iframe').first():page;
  await root.locator('#theme').selectOption(theme);
  for(let d=0;d<3;d++){
   await root.locator('.proto-picker-item:not(.proto-picker-replay)').nth(d).click();
   await root.locator('.sf-demo[data-view="editor"]').waitFor();
   await root.locator('.surface-choice [data-view="settings"]').click();
   const checkpoint=async()=>{
    assert.equal(await root.locator('body').evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'document overflow');
    const controls=root.locator('.sf-demo button:visible');
    for(let i=0;i<await controls.count();i++){
     const b=await controls.nth(i).boundingBox();assert.ok(b.x>=-1&&b.x+b.width<=width+1,`control overflow ${JSON.stringify(b)}`);
    }
    checks++;
   };
   const capture=async suffix=>{
    if(hosted)return;
    const base=`${out}/d${d+1}-${width}-${theme}-${suffix}`;
    await page.evaluate(()=>document.fonts.ready);
    await root.locator('.document textarea').evaluateAll(els=>els.forEach(el=>el.textContent=el.value));
    await page.screenshot({path:base+'.png',fullPage:true});
    writeFileSync(base+'.html',(await page.content()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''));
   };
   await checkpoint();
   await root.locator('[data-engine="vs"]').click();
   assert.equal(await root.locator('[data-engine="vs"]').getAttribute('aria-pressed'),'true');
   assert.match(await root.locator('#engine-info').innerText(),/vasta avattaessa/);
   await checkpoint();
   if(d===0&&((width===1440&&theme==='light')||(width===390&&theme==='dark')))await capture('settings');
   await root.locator('[data-engine="cm"]').focus();await page.keyboard.press('Enter');
   assert.equal(await root.locator('[data-engine="cm"]').getAttribute('aria-pressed'),'true');
   await root.locator('.surface-choice [data-view="editor"]').click();
   await root.locator('.document textarea').waitFor();await checkpoint();
   const picker=root.locator('.file-browser');
   const openPicker=async()=>{if(!await picker.isVisible())await root.locator('.browser-toolbar [data-action="picker"]').click();};
   await openPicker();await checkpoint();
   const filter=root.getByRole('searchbox',{name:'Suodata ladattuja nimiä'});
   await filter.fill('does-not-exist');assert.equal(await root.getByText('Ei osumia ladatuissa nimissä.').count(),1);await checkpoint();
   await filter.fill('status.test');assert.equal(await root.locator('.file-row').count(),1);
   await filter.fill('');
   await root.locator('[data-folder="src"]').click();assert.equal(await root.locator('[data-file="src/status.ts"]').count(),0);await root.locator('[data-folder="src"]').click();
   assert.equal(await root.locator('[data-file="src/components/StatusSummaryWithLastObservation.tsx"]').count(),1);
   assert.equal(await root.locator('[data-folder="src/lib"]').count(),d===2?0:1);
   assert.equal(await root.locator('[data-file="src/lib/status/format.ts"]').count(),1);
   const current=root.locator('.file-row[aria-current]');
   await current.focus();await page.keyboard.press('ArrowDown');
   assert.equal(await root.locator('[data-file="src/status.test.ts"]').evaluate(el=>el===document.activeElement),true);
   assert.equal(await current.getAttribute('data-file'),'src/status.ts','moving focus must not open a file');
   await root.locator('[data-folder="src"]').focus();await page.keyboard.press('ArrowLeft');
   assert.equal(await root.locator('[data-folder="src"]').getAttribute('aria-expanded'),'false');
   await page.keyboard.press('ArrowRight');
   assert.equal(await root.locator('[data-folder="src"]').getAttribute('aria-expanded'),'true');
   assert.equal(await current.evaluate(el=>getComputedStyle(el).boxShadow),'none','no selection edge');
   await checkpoint();
   if((width===1440&&theme==='light')||(width===390&&theme==='dark')){
    await capture('files');
    if(width===390){await current.evaluate(el=>el.scrollIntoView({block:'nearest'}));await capture('files-scrolled');}
   }
   await root.locator('[data-file="src/status.test.ts"]').click();
   assert.match(await root.locator('.browser-toolbar>code').innerText(),/status.test.ts/);
   await root.locator('.document textarea').fill('// Säilytä muokkaus');
   await openPicker();await root.locator('[data-file="src/status.ts"]').click();
   await root.locator('dialog[open]').waitFor();await checkpoint();
   await root.locator('dialog button[value="cancel"]').click();
   assert.equal(await root.locator('.document textarea').inputValue(),'// Säilytä muokkaus');
   await openPicker();await root.locator('[data-file="src/status.ts"]').click();
   await root.locator('dialog button[value="discard"]').click();
   await root.locator('.browser-toolbar>code').filter({hasText:'src/status.ts'}).waitFor();
   assert.match(await root.locator('.browser-toolbar>code').innerText(),/src\/status.ts/);
   await root.locator('.document textarea').fill('// Uusi muutos');await checkpoint();
   if((width===1440&&theme==='light')||(width===390&&theme==='dark')){
    await capture('dirty');await openPicker();
    await root.locator('.file-row[aria-current]').evaluate(el=>el.scrollIntoView({block:'nearest'}));
    assert.match(await root.locator('.file-state').innerText(),/Muokattu/);await capture('dirty-tree');
    if(width===390)await root.locator('.file-browser [data-action="picker"]').click();
   }
   await root.locator('[data-action="save"]').click();
   assert.equal(await root.locator('.dirty').innerText(),'Tallennettu');await checkpoint();
   await root.locator('.surface-choice [data-view="settings"]').click();
   await root.locator('[data-engine="vs"]').click();
   await root.locator('.surface-choice [data-view="editor"]').click();
   assert.equal(await root.locator('.document textarea').inputValue(),'// Uusi muutos');
   // Preference selection never starts an engine; this is still an explicit CM preview.
   assert.match(await root.locator('.editor-head').innerText(),/CodeMirror 6/);await checkpoint();
  }
  await page.close();
 }
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({hosted,checkpoints:checks,consoleErrors:errors.length,widths:[1440,1366,390],themes:['light','dark'],directions:3}));
} finally {await browser.close();}
