// Run against the library-built offline artifact or a published Glasspad URL.
// Remote execution on Cedar uses the same relative disposable tree.
import {chromium} from '../../../../web/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const source=process.argv[2], out=resolve(process.argv[3]);
await mkdir(out,{recursive:true});
const browser=await chromium.launch(); const errors=[]; let cases=0;
try{
for(const width of [1440,390]) for(const theme of ['light','dark']) for(let v=1;v<=3;v++){
 const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>m.type()==='error'&&errors.push(m.text()));
 await page.goto(source.startsWith('http')?source:'file://'+resolve(source));
 const p=source.startsWith('http')?page.frameLocator('iframe').first():page;
 const id=x=>p.locator(`[data-testid="${x}"]`);
 const click=async x=>{await id(x).click();cases++};
 const step=async n=>{await p.locator(`[data-step="${n}"]`).waitFor();};
 const configure=async(key,value)=>{await p.locator('.r-scenarios').evaluate(n=>n.open=true);await id(key).selectOption(value);await step(0)};
 await p.locator('.proto-picker-item:not(.proto-picker-replay)').nth(v-1).click();
 await step(0);
 if(!source.startsWith('http')){await page.reload();await step(0);if(await p.locator('.proto-picker-item[data-active]').innerText()!==['Kartta','Kompassi','Reittitasku'][v-1])throw Error('Variant did not survive reload')}
 await p.locator('#theme').selectOption(theme);
 if(await p.locator('html').getAttribute('data-theme')!==theme)throw Error('Requested theme not active');
 if(width===390)await p.locator('#phone').check();
 await click('signin');await step(1);
 await id('stale').check();await id('repo-pilotti').check();await id('stale').uncheck();
 if(!await id('repo-pilotti').isVisible()||!await id('repo-pilotti').isChecked())throw Error('Selected stale repository was lost');
 await id('repo-tuote').uncheck();await click('checkout');await step(2);
 if(v===3){await click('route-toggle');await p.locator('.r-pocket').waitFor();await click('route-toggle')}
 await capture('integration');
 await click('connect-google');await click('approve');
 await p.locator('[data-testid=integration-dialog]').waitFor();
 // Production folder chooser is real; callback only updates the synthetic state.
 await p.locator('[data-testid=integration-dialog] button[type=submit]').count().then(async n=>{
  if(n)await p.locator('[data-testid=integration-dialog] button[type=submit]').click();
  else await p.locator('[data-testid=integration-sync-start]').click();
 });
 await click('next-google');await step(3);await click('connect-ai');await click('finish');await step(4);
 await click('settings');await p.locator('.ig-main').waitFor();
 await capture('settings');
 // Fresh picker mount must reset both synthetic state and all dialogs.
 await p.locator('.proto-picker-replay').click();await step(0);
 await configure('mode','auto');await configure('fault','checkout');await click('signin');await step(2);
 await click('skip-google');await step(3);await click('finish');await step(4);
 // An unavailable catalog must retain a route forward, not strand onboarding.
 await p.locator('.proto-picker-replay').click();await step(0);await configure('fault','catalog');
 await click('signin');await step(1);await click('skip-repos');await step(2);
 // Required integration pauses instead of silently marking it complete.
 await p.locator('.proto-picker-replay').click();await step(0);await configure('rule','required');
 await click('signin');await click('skip-repos');await click('pause-required');await click('resume');await step(2);
 await configure('fault','denied');await click('signin');await click('skip-repos');await click('connect-google');await click('cancel-google');
 if(await id('next-google').count())throw Error('Denied Google grant became connected');
 await p.locator('.proto-picker-replay').click();await step(0);await configure('rule','off');await click('signin');await click('skip-repos');await step(3);
 // Picker keyboard contract: input focus does not switch; arrow keys do.
 await p.locator('.proto-picker-replay').click();await step(0);await click('signin');
 await id('search').focus();await page.keyboard.press('2');
 if(await p.locator('.proto-picker-item[data-active]').innerText()!==['Kartta','Kompassi','Reittitasku'][v-1])throw Error('Picker intercepted input');
 await id('search').evaluate(n=>n.blur());await page.keyboard.press('ArrowRight');await step(0);
 await page.close();
 async function capture(name){
  const base=resolve(out,`${width}-${theme}-v${v}-${name}`);
  // Save a static inert twin, synthetic data only. No external assets.
  const frame=source.startsWith('http')?await (await page.locator('iframe').first().elementHandle()).contentFrame():page;
  await page.screenshot({path:base+'.png',fullPage:true});
  const html=await frame.evaluate(()=>{const n=document.documentElement.cloneNode(true);n.querySelectorAll('script').forEach(s=>s.remove());return '<!doctype html>'+n.outerHTML});
  await writeFile(base+'.html',html);
  const overflow=await frame.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1||document.querySelector('.r-demo').scrollWidth>document.querySelector('.r-demo').clientWidth+1);
  if(overflow)throw Error('Horizontal overflow '+base);
 }
}
if(errors.length)throw Error(errors.join('\n'));
console.log(JSON.stringify({cases,errors,matrix:'3 variants × 2 widths × 2 themes',source},null,2));
await writeFile(resolve(out,'result.json'),JSON.stringify({cases,errors,matrix:'3 variants × 2 widths × 2 themes',source},null,2));
}finally{await browser.close()}
