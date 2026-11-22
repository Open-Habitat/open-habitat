// node check.mjs [built HTML] [evidence dir]. PLAYWRIGHT_MODULE may name an installed playwright entrypoint.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html=resolve(process.argv[2]||resolve(here,'../../dist/2026-11-22-server-browser-control.html'));
const out=resolve(process.argv[3]||resolve(here,'../../dist/check-server-browser-control'));
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const errors=[];let screenshots=0;
try {
 for(const width of [1280,390])for(const theme of ['light','dark'])for(const lang of ['fi','en'])for(let v=1;v<=3;v++){
  const page=await browser.newPage({viewport:{width,height:1100},reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route(/^https?:/,route=>{errors.push('unexpected network '+route.request().url());return route.abort();});
  await page.goto(pathToFileURL(html).href+'?v='+v);
  await page.locator('.sb').waitFor();
  await page.selectOption('#theme',theme);
  if(lang==='en')await page.locator('[data-action=lang]').click();
  await checkPicker(page,'2026-11-22-server-browser-control');
  assert.equal(await page.locator('.sb').getAttribute('data-mode'),String(v-1));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow');
  await page.screenshot({path:resolve(out,`${v}-${lang}-${theme}-${width}.png`),fullPage:true});screenshots++;
  // First click only claims ownership; no click/keystroke reaches the remote field.
  await page.locator('[data-action=give]').click();
  await page.locator('.canvas').click({position:{x:10,y:10}});
  assert.equal(await page.locator('.sb').getAttribute('data-owner'),'person');
  assert.equal(await page.locator('#remote-field').inputValue(),'');
  await page.locator('[data-action=give]').click();
  await page.locator('.canvas').focus();await page.keyboard.press('x');
  assert.equal(await page.locator('.sb').getAttribute('data-owner'),'person');
  assert.equal(await page.locator('#remote-field').inputValue(),'');
  await page.locator('[data-action=busy]').click();await page.locator('[data-action=take]').click();
  assert.equal(await page.locator('.sb').getAttribute('data-owner'),'agent');
  assert.ok(await page.locator('.warning').isVisible());
  await page.locator('[data-action=finish]').click();
  assert.equal(await page.locator('.sb').getAttribute('data-owner'),'person');
  await page.locator('[data-action=tray]').click();
  await page.locator('#paste-text').fill('ää 漢字\ntext');await page.locator('[data-action=paste]').click();
  // Input type=text removes newline; a real remote target owns its own semantics.
  assert.equal(await page.locator('#remote-field').inputValue(),'ää 漢字text');
  assert.equal(await page.locator('#paste-text').inputValue(),'');
  await page.locator('#paste-text').fill(' more');await page.locator('[data-action=type]').click();
  assert.equal(await page.locator('#remote-field').inputValue(),'ää 漢字text more');
  // Synthetic event only checks UI routing, not OS clipboard permission.
  await page.locator('#remote-field').evaluate(el=>{const data=new DataTransfer();data.setData('text/plain','!');el.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}));});
  assert.equal(await page.locator('#remote-field').inputValue(),'ää 漢字text more!');
  await page.locator('[data-action=remote]').click();
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('denied')}}}));
  await page.locator('[data-action=copy]').click();
  assert.ok(await page.locator('#copy-text').isVisible());
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copied=text}}}));
  await page.locator('[data-action=copy]').click();assert.equal(await page.evaluate(()=>window.copied),'DEMO-4821');
  await page.locator('[data-action=idle]').click();assert.equal(await page.locator('.sb').getAttribute('data-owner'),'person');
  if(v===2){assert.ok(await page.locator('[data-action=stay]').isVisible());await page.locator('[data-action=stay]').click();}
  await page.locator('[data-action=request]').click();assert.equal(await page.locator('.sb').getAttribute('data-owner'),'person');
  if(v===3){await page.locator('[data-action=later]').click();assert.equal(await page.locator('.sb').getAttribute('data-owner'),'person');}
  await page.locator('[data-action=give]').click();
  assert.equal(await page.locator('#copy-text').count(),0);
  await page.close();
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,screenshots,checks:'picker, layouts, ownership, warning, paste, type, copy denial/success, idle, request; synthetic only'}));
} finally {await browser.close();}
