import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
// A worker may reuse the source checkout's installed browser tools, read-only.
const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {cwd:root,encoding:'utf8'}).trim();
let require = createRequire(path.join(root, 'web/package.json'));
try { require.resolve('@playwright/test'); } catch { require = createRequire(path.join(path.dirname(common), 'web/package.json')); }
const {chromium, expect} = require('@playwright/test');
const browser = await chromium.launch();
const page = await browser.newPage({viewport:{width:1440,height:1000},colorScheme:'light'});
const errors=[],requests=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
const target='file://'+path.join(here,'index.html');
const evidence=path.join(here,'evidence');await fs.mkdir(evidence,{recursive:true});
async function go(v){await page.goto(target+'?v='+v);await expect(page.locator('.direction-'+(v-1))).toBeVisible();await page.evaluate(()=>document.fonts.ready);}
async function shot(name){await page.screenshot({path:path.join(evidence,name+'.png'),animations:'disabled'});}
async function fit(){expect(await page.evaluate(()=>document.body.scrollWidth>innerWidth)).toBe(false);}
try {
 for(const v of [1,2,3]) {
  for(const [width,height,size] of [[1440,1000,'desktop'],[390,844,'phone']]) {
   await page.setViewportSize({width,height});
   for(const theme of ['light','dark']) {
    await page.emulateMedia({colorScheme:theme});await go(v);
    await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
    await shot(`${v}-${size}-${theme}-offers`);
    await page.locator('#open-0').click();await expect(page.locator('#view-title')).toBeFocused();
    await expect(page.locator('.viewer')).toBeVisible();
    const frame=page.frameLocator('.viewer iframe');
    await expect(frame.getByRole('heading',{name:'Myynti kasvaa verkossa'})).toBeVisible();
    await frame.getByRole('button',{name:'Tilaukset',exact:true}).click();
    await expect(frame.locator('#metric')).toHaveText('1 410 tilausta');
    await frame.getByRole('button',{name:'Eurot',exact:true}).click();
    await page.locator('.view-tabs button').nth(1).click();
    await expect(page.locator('#view-title')).toBeFocused();
    await expect(frame.getByRole('heading',{name:'Mistä kasvu tuli?'})).toBeVisible();
    await page.locator('.view-tabs button').nth(0).click();
    await expect(frame.getByRole('heading',{name:'Myynti kasvaa verkossa'})).toBeVisible();
    await fit();await shot(`${v}-${size}-${theme}`);
    // Return from the real sandbox frame through keyboard traversal to app chrome.
    await frame.getByRole('button',{name:'Eurot',exact:true}).focus();
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('.view-tabs button').nth(1)).toBeFocused();
    await page.getByRole('button',{name:'Sulje näkymä',exact:true}).click();
    await expect(page.locator('#open-0')).toBeFocused();
    await page.locator('#open-1').click();await expect(page.locator('#view-title')).toHaveText('Kanavavertailu.html');
    await page.keyboard.press('Escape');await expect(page.locator('#open-1')).toBeFocused();
   }
  }
  await page.setViewportSize({width:1440,height:1000});await go(v);
  // Every card state, including dismiss/restore, is reachable without a server.
  await page.locator('[data-offer="0"] [data-action="dismiss"]').click();
  await expect(page.locator('[data-offer="0"]')).toContainText('Hylätty');
  await page.getByRole('button',{name:'Palauta tarjous'}).click();await expect(page.locator('#open-0')).toBeFocused();
  for(const state of ['expired','offline']) {
   await page.locator('#offer-state').selectOption(state);await expect(page.locator('#open-0')).toBeDisabled();
   await expect(page.locator('.offer-note').first()).toContainText(state==='expired'?'vanhentui':'ei saada yhteyttä');
   await shot(`${v}-${state}`);
  }
  await page.locator('#offer-state').selectOption('ready');await page.locator('#open-0').click();
  if(v!==2){
   if(v===1)await page.getByRole('button',{name:'Keskustelu',exact:true}).click();
   await expect(page.locator('.conversation')).toHaveAttribute('inert','');
   await page.locator('.conversation-strip').click();await expect(page.locator('#message')).toBeFocused();
  }
  if(v!==3){const splitter=page.locator('.splitter');await splitter.focus();await page.keyboard.press('ArrowRight');await expect(splitter).not.toHaveAttribute('aria-valuenow','52');const r=await splitter.boundingBox();await page.mouse.move(r.x+4,r.y+100);await page.mouse.down();await page.mouse.move(r.x+80,r.y+100);await page.mouse.up();await expect(splitter).not.toHaveAttribute('aria-valuenow','52');await splitter.dblclick();await expect(splitter).toHaveAttribute('aria-valuenow','52');}
  await page.getByRole('button',{name:'Sulje näkymä',exact:true}).click();
  for(const state of ['stopped','unavailable']){await page.locator('#live-state').selectOption(state);await expect(page.locator('#live-link')).toHaveCount(0);await expect(page.locator('.live')).toContainText(state==='stopped'?'Pysähtynyt':'Osoite ei vastaa');await shot(`${v}-live-${state}`);}
  await page.locator('#live-state').selectOption('running');
  const [popup]=await Promise.all([page.waitForEvent('popup'),page.locator('#live-link').click()]);
  await popup.waitForLoadState();expect(popup.url()).toMatch(/^blob:/);expect(await popup.evaluate(()=>window.opener===null)).toBe(true);
  await expect(popup.getByText('Prototyyppi · Vain sinulle',{exact:true})).toBeVisible();
  await expect(popup.locator('code')).toContainText('oh-view-jaana-demo.example.invalid');
  await popup.getByRole('button',{name:'Tilaukset',exact:true}).click();await expect(popup.locator('#metric')).toHaveText('1 410 tilausta');
  if(v===1)await popup.screenshot({path:path.join(evidence,'own-tab.png')});await popup.close();
  await expect(page.locator('.viewer')).toBeHidden();await expect(page.locator('#live-feedback')).toContainText('Avaus pyydetty');
 }
 await go(1);await page.keyboard.press('ArrowRight');await expect(page.locator('.direction-1')).toBeVisible();await page.keyboard.press('3');await expect(page.locator('.direction-2')).toBeVisible();
 await page.locator('#message').fill('1');await page.locator('#message').press('ArrowLeft');await expect(page.locator('.direction-2')).toBeVisible();
 await page.getByRole('button',{name:'Lähetä',exact:true}).click();await expect(page.locator('#send-feedback')).toContainText('ei lähetetä');
 await page.goto(target+'?v=99');await expect(page.locator('.direction-0')).toBeVisible();
 await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#open-0').click();
 expect(await page.locator('.viewer').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
 expect(errors).toEqual([]);expect(requests).toEqual([]);
 console.log('PASS: 3 placements × desktop/phone × light/dark; sandbox interaction; focus in/out; switch/close; dismissal; expired/offline; resize keys/drag; collapse; owner-only simulated tab/no opener; stopped/unavailable; picker; reduced motion; no console errors or network requests.');
} finally {await browser.close();}
