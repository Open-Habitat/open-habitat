// node check.mjs <offline.html> <evidence-directory>
// Synthetic component lab only. No host, credentials, remote page or real browser session.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const [input,out]=process.argv.slice(2);
if(!input||!out)throw new Error('Usage: node check.mjs <offline.html> <evidence-directory>');
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const errors=[],requests=[];let checks=0;
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
try{
 for(const width of [1440,390])for(const theme of ['light','dark','contrast'])for(const lang of ['fi','en']){
  const page=await browser.newPage({viewport:{width,height:width===390?844:1050},deviceScaleFactor:1,reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route(/^https?:/,route=>{requests.push(route.request().url());return route.abort();});
  await page.goto(pathToFileURL(resolve(input)).href);
  await page.locator('#theme').selectOption(theme);await page.locator('#language').selectOption(lang);
  await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(100);
  await checkPicker(page,'2026-11-22-server-browser-visit-log');checks++;
  for(let d=0;d<3;d++){
   const tag=`${width}-${theme}-${lang}-${d+1}`;
   await page.locator('.proto-picker-item').nth(d).click();
   await page.locator(`#scenario`).selectOption('done');
   await page.getByTestId('record').waitFor();
   eq(await page.getByTestId('details-toggle').getAttribute('aria-expanded'),'false',`${tag}: closed by default`);
   ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${tag}: fits`);
   await page.screenshot({path:`${out}/${tag}-default.png`,fullPage:true});
   // Keyboard disclosure, completed event counts, nested download list.
   await page.getByTestId('details-toggle').focus();await page.keyboard.press('Enter');
   await page.getByTestId('details').waitFor();
   eq(await page.locator('.events li').count(),10,`${tag}: completed page events`);
   await page.getByTestId('downloads').locator('summary').click();
   eq(await page.getByTestId('downloads').locator('li').count(),13,`${tag}: completed files`);
   ok(await page.getByTestId('downloads').locator('li').first().isVisible(),`${tag}: files disclosed`);
   await page.getByTestId('details-toggle').click();
   eq(await page.getByTestId('details').count(),0,`${tag}: closes`);
   await page.getByTestId('work-toggle').click();
   eq(await page.getByTestId('record').count(),d===2?0:1,`${tag}: placement when work hidden`);
   await page.getByTestId('work-toggle').click();
   // Finished tab disappears, its persistent conversation record does not.
   await page.getByTestId('browser-chip').click();
   eq(await page.getByTestId('browser-window').count(),1,`${tag}: only person's window remains`);
   eq(await page.locator('[data-window="agent"]').count(),0,`${tag}: closed agent tab absent`);
   eq(await page.getByTestId('record').count(),1,`${tag}: record survives`);
   await page.locator('#scenario').selectOption('live');
   eq(await page.getByTestId('browser-window').count(),2,`${tag}: live windows`);
   ok(await page.locator('[data-window="agent"] .sb-who-agent').isVisible(),`${tag}: agent label visible`);
   eq(await page.locator('[data-window="person"] .sb-who-agent').count(),0,`${tag}: own window not marked agent`);
   await page.getByTestId('details-toggle').click();
   eq(await page.locator('.events li').count(),6,`${tag}: only observed live visits`);
   await page.getByTestId('browser-window').last().locator('button').click();
   ok(await page.getByTestId('view-example').isVisible(),`${tag}: look opens example`);
   await page.getByTestId('view-close').click();
   await page.screenshot({path:`${out}/${tag}-live-details.png`,fullPage:true});
   // Completion replaces in-progress data; it does not append a second session.
   await page.locator('#scenario').selectOption('done');
   eq(await page.getByTestId('record').count(),1,`${tag}: same visit record`);
   eq(await page.locator('.events li').count(),10,`${tag}: complete counts updated`);
   await page.locator('#scenario').selectOption('lost');
   eq(await page.getByTestId('record').getAttribute('data-state'),'lost',`${tag}: incomplete state`);
   eq(await page.getByTestId('record').locator('[role="status"]').count(),1,`${tag}: incomplete status announced`);
   eq(await page.getByTestId('browser-chip').count(),0,`${tag}: no misleading live chip`);
   ok(await page.getByTestId('stale-chip').isVisible(),`${tag}: unknown state control`);
   ok(await page.getByTestId('stale-windows').isVisible(),`${tag}: last known list`);
   ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${tag}: expanded fits`);
   await page.screenshot({path:`${out}/${tag}-lost.png`,fullPage:true});
  }
  await page.close();
 }
 eq(errors,[],'clean browser console');eq(requests,[],'standalone page makes no network requests');
 console.log(`${checks} checks passed; 36 direction/theme/language/viewport combinations; offline, disclosure, tab lifetime, unknown state.`);
}finally{await browser.close();}
