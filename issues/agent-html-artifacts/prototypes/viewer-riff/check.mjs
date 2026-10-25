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
async function go(v){await page.goto(target+'?v='+v);await expect(page.locator('.riff-'+(v-1))).toBeVisible();await page.evaluate(()=>document.fonts.ready);}
async function shot(name){await page.screenshot({path:path.join(evidence,name+'.png'),animations:'disabled'});}
async function fit(){expect(await page.evaluate(()=>document.body.scrollWidth>innerWidth)).toBe(false);}
async function choose(i,dest,v){
 if(v===1){await page.locator(`[data-offer="${i}"] [data-action="${dest==='panel'?'open':'tab'}"]`).click();return;}
 await page.locator(`[data-offer="${i}"] summary`).click();
 await page.locator(`[data-offer="${i}"] [data-action="choose-${dest}"]`).click();
}
async function tab(i,v,popout=false){
 const [popup]=await Promise.all([page.waitForEvent('popup'),popout?page.locator('[data-action="popout"]').click():choose(i,'tab',v)]);
 await popup.waitForLoadState();expect(popup.url()).toMatch(/^blob:/);
 expect(await popup.evaluate(()=>window.opener===null)).toBe(true);
 await expect(popup.locator('code')).toContainText(i?'oh-view-jaana-live':'oh-view-jaana-frozen');
 await expect(popup.getByText(/· Vain sinulle/).first()).toBeVisible();
 await popup.getByRole('button',{name:'Tilaukset',exact:true}).click();
 await expect(popup.locator('#metric')).toHaveText('1 410 tilausta');
 await popup.screenshot({path:path.join(evidence,`${v}-tab-${i}${popout?'-popout':''}.png`)});
 await popup.close();
}
try {
 for(const v of [1,2,3]){
  for(const [width,height,size] of [[1440,1000,'desktop'],[390,844,'phone']]){
   await page.setViewportSize({width,height});
   for(const theme of ['light','dark']){
    await page.emulateMedia({colorScheme:theme});await go(v);
    await page.evaluate(()=>sessionStorage.clear());await page.reload();
    await expect(page.locator('.riff-'+(v-1))).toBeVisible();
    await page.locator('[data-offer="0"]').scrollIntoViewIfNeeded();await shot(`${v}-${size}-${theme}-offers`);
    await page.locator('[data-offer="1"]').scrollIntoViewIfNeeded();await shot(`${v}-${size}-${theme}-live-offer`);
    if(v>1){await page.locator('[data-offer="0"] summary').click();await page.locator('[data-offer="0"] .open-options').scrollIntoViewIfNeeded();await shot(`${v}-${size}-${theme}-choice`);await page.locator('[data-offer="0"] summary').click();}
    await page.locator('#open-0').click();await expect(page.locator('#view-title')).toBeFocused();
    const frame=page.frameLocator('.viewer iframe');
    await expect(frame.getByRole('heading',{name:'Myynti kasvaa verkossa'})).toBeVisible();
    await frame.getByRole('button',{name:'Tilaukset',exact:true}).click();await expect(frame.locator('#metric')).toHaveText('1 410 tilausta');
    await fit();await shot(`${v}-${size}-${theme}-panel`);
    await frame.getByRole('button',{name:'Eurot',exact:true}).focus();await page.keyboard.press('Shift+Tab');await expect(page.locator('.view-tabs button').nth(1)).toBeFocused();
    await page.locator('.view-tabs button').nth(1).click();await expect(frame.getByRole('heading',{name:'Myynnin tilannekuva',exact:true})).toBeVisible();
    await page.locator('.view-tabs button').nth(0).click();await expect(frame.getByRole('heading',{name:'Myynti kasvaa verkossa'})).toBeVisible();
    await page.locator('[data-action="expand"]').first().click();
    await expect(page.locator('.conversation')).toHaveAttribute('inert','');
    await expect(page.locator('.conversation-strip')).toBeVisible();
    await shot(`${v}-${size}-${theme}-expanded`);
    await page.locator('.conversation-strip').click();await expect(page.locator('.workbench')).not.toHaveClass(/collapsed/);
    await page.getByRole('button',{name:'Sulje näkymä',exact:true}).click();await expect(page.locator('#open-0')).toBeFocused();
    await tab(0,v);await expect(page.locator('.viewer')).toBeHidden();
    // Both kinds must support both placements, including on a phone.
    await choose(1,'panel',v);await expect(frame.getByRole('heading',{name:'Myynnin tilannekuva',exact:true})).toBeVisible();
    await tab(1,v,true);await expect(page.locator('.viewer')).toBeVisible();
    await expect(page.locator('#panel-feedback')).toContainText('Paneeli jää auki');
    await page.getByRole('button',{name:'Sulje näkymä',exact:true}).click();await expect(page.locator('#open-1')).toBeFocused();
    await tab(1,v);await expect(page.locator('.viewer')).toBeHidden();
    await choose(0,'panel',v);await tab(0,v,true);await page.keyboard.press('Escape');await expect(page.locator('#open-0')).toBeFocused();
   }
  }
  await page.setViewportSize({width:1440,height:1000});await go(v);
  await page.evaluate(()=>sessionStorage.clear());await page.reload();
  for(const state of ['expired','offline']){
   await page.locator('#offer-state').selectOption(state);await expect(page.locator('#open-0')).toBeDisabled();await expect(page.locator('#open-1')).toBeDisabled();
   await shot(`${v}-${state}`);
  }
  await page.locator('#offer-state').selectOption('ready');
  for(const state of ['stopped','unavailable']){
   await page.locator('#live-state').selectOption(state);await expect(page.locator('#open-1')).toBeDisabled();await expect(page.locator('#open-0')).toBeEnabled();
   await page.locator('#open-0').click();await expect(page.locator('.view-tabs button').nth(1)).toBeDisabled();await page.keyboard.press('Escape');
   await shot(`${v}-${state}`);
  }
  await page.locator('#live-state').selectOption('running');
  if(v===2){
   await tab(0,v);await expect(page.locator('#open-1')).toHaveText('Avaa välilehdelle');await page.reload();await expect(page.locator('#open-0')).toHaveText('Avaa välilehdelle');
   const [popup]=await Promise.all([page.waitForEvent('popup'),page.locator('#open-1').click()]);await popup.close();
   await choose(1,'panel',v);await page.keyboard.press('Escape');await expect(page.locator('#open-0')).toHaveText('Avaa paneeliin');
  }
  if(v===3){
   await page.locator('#default-place').selectOption('tab');await expect(page.locator('#open-0')).toHaveText('Avaa välilehdelle');
   await choose(0,'panel',v);await page.keyboard.press('Escape');await expect(page.locator('#open-0')).toHaveText('Avaa välilehdelle');
   await page.reload();await expect(page.locator('#default-place')).toHaveValue('tab');await page.locator('#default-place').selectOption('panel');
  }
  await page.evaluate(()=>sessionStorage.clear());await page.reload();await page.locator('#open-0').click();
  const splitter=page.locator('.splitter');await splitter.focus();await page.keyboard.press('ArrowRight');await expect(splitter).toHaveAttribute('aria-valuenow','48');
  await page.getByRole('button',{name:'Sulje näkymä',exact:true}).click();
 }
 await go(1);await page.keyboard.press('ArrowRight');await expect(page.locator('.riff-1')).toBeVisible();await page.keyboard.press('3');await expect(page.locator('.riff-2')).toBeVisible();
 await page.locator('#message').fill('1');await page.locator('#message').press('ArrowLeft');await expect(page.locator('.riff-2')).toBeVisible();
 await page.getByRole('button',{name:'Lähetä',exact:true}).click();await expect(page.locator('#send-feedback')).toContainText('ei lähetetä');
 await page.goto(target+'?v=99');await expect(page.locator('.riff-0')).toBeVisible();
 await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#open-0').click();expect(await page.locator('.viewer').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
 expect(errors).toEqual([]);expect(requests).toEqual([]);
 console.log('PASS: 3 opening models × desktop/phone × light/dark; same card for frozen/live; both placements for both kinds; owner-only tab/no opener; pop-out keeps panel; expand/back; focus return; expired/offline/stopped/unavailable; remembered choice across kinds/reload; default/one-shot override; keyboard picker; reduced motion; zero console errors/network requests.');
} finally {await browser.close();}
