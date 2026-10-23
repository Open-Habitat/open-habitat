// node check.mjs <offline-html-or-hosted-url> <evidence-dir>
// Fresh synthetic browser per width/theme. No personal profile or real provider.
import {chromium} from '../../../../web/node_modules/playwright/index.mjs';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const [input,out]=process.argv.slice(2);const hosted=input.startsWith('https:');
mkdirSync(out,{recursive:true});const browser=await chromium.launch();const errors=[];let checks=0,captures=0;
try{
 for(const width of [1440,390]) for(const theme of ['light','dark']){
 const page=await browser.newPage({viewport:{width,height:1000}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 if(hosted)await page.goto(input);else{await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));await page.goto('http://prototype.test/')}
 const root=hosted?page.frameLocator('iframe').first():page;
 const id=s=>root.getByTestId(s);
 await id('theme').selectOption(theme);
 const checkpoint=async()=>{assert.equal(await root.locator('body').evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'horizontal overflow');checks++};
 const shot=async name=>{await checkpoint();if(hosted)return;await page.evaluate(()=>document.fonts.ready);const base=`${out}/${width}-${theme}-${name}`;await page.screenshot({path:base+'.png',fullPage:true});writeFileSync(base+'.html',(await page.content()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''));captures++};
 const step=async n=>assert.equal(await id('prototype').getAttribute('data-step'),String(n));
 for(let d=0;d<3;d++){
 await id(`direction-${d}`).click();await shot(`d${d+1}-github`);
 await id('signin').click();await step(1);assert.equal(await id('repo-tuote').isChecked(),true);assert.equal(await id('repo-vanha-pilotti').count(),0);assert.equal(await id('repo-paivays-puuttuu').count(),1);
 await id('stale').check();assert.equal(await id('repo-vanha-pilotti').count(),1);await id('repo-vanha-pilotti').check();await id('stale').uncheck();assert.equal(await id('repo-vanha-pilotti').isChecked(),true);
 await id('repo-vanha-pilotti').click();assert.equal(await id('repo-vanha-pilotti').count(),0);
 await id('search').fill('not-found');assert.equal(await root.locator('.person-repo').count(),0);await id('search').fill('');await shot(`d${d+1}-repos`);
 await id('checkout').click();await step(2);await shot(`d${d+1}-google`);
 await id('integration-connect-open').click();await id('integration-continue').click();await id('simulate-consent').click();await id('integration-sync-start').waitFor();await shot(`d${d+1}-folders`);
 await id('integration-sync-start').click();await id('integration-done').click();assert.equal(await id('integration-account-google').count(),1);await id('next-integration').click();await step(3);await shot(`d${d+1}-ai`);
 await id('finish').click();await step(4);await id('settings-open').click();assert.equal(await id('integration-account-google').count(),1);await id('settings-back').click();await id('restart').click();await step(0);
 // Optional skip remains possible without checkout, integration or AI.
 await id('signin').click();await id('repo-tuote').uncheck();await id('skip-repos').click();await id('skip-google').click();await id('finish').click();await step(4);
 // Auto-checkout bypasses the repo chooser but exposes uncertain outcomes.
 await id('mode').selectOption('auto');await id('fault').selectOption('checkout');await id('signin').click();await step(2);assert.equal(await id('auto-check').count(),1);await id('auto-check').click();assert.equal(await id('auto-check').count(),0);await checkpoint();
 // Required means pause/resume, not a false completed state.
 await id('fault').selectOption('none');await id('integration-mode').selectOption('required');await id('signin').click();await id('pause-required').click();assert.equal(await id('resume').count(),1);await id('resume').click();assert.equal(await id('skip-google').count(),0);
 // Off removes the whole integration step.
 await id('integration-mode').selectOption('off');await id('signin').click();await step(3);
 // A failed catalog and empty permissions have an escape without a write.
 await id('mode').selectOption('preselected');await id('integration-mode').selectOption('optional');
 for(const fault of ['catalog','empty','checkout']){await id('fault').selectOption(fault);await id('signin').click();await step(1);if(fault==='checkout'){await id('checkout').click();assert.equal(await id('check-clone').count(),1)}await id('skip-repos').click();await step(2);await checkpoint()}
 await id('fault').selectOption('google');await id('signin').click();await id('skip-repos').click();await id('integration-connect-open').click();await id('integration-continue').click();await id('dialog-close').first().click();await id('skip-google').click();await step(3);
 await id('fault').selectOption('none');
 }
 await page.close();
 }
 assert.deepEqual(errors,[]);writeFileSync(`${out}/check.json`,JSON.stringify({checks,captures,consoleErrors:errors,source:input,widths:[1440,390],themes:['light','dark']},null,2));console.log(`PASS ${checks} checkpoints, ${captures} paired screenshot/HTML captures; no console errors`);
}finally{await browser.close()}
