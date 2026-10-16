import {chromium} from '../../web/node_modules/@playwright/test/index.mjs';
import {resolve} from 'node:path';
const browser=await chromium.launch();
try {
for(const width of [1440,390]) for(const theme of ['light','dark']) {
const page=await browser.newPage({viewport:{width,height:900},colorScheme:theme,reducedMotion:"reduce"});
await page.goto('file://'+resolve('.cache/prosessit.html'));
await page.getByRole('button',{name:'Kentän yllä',exact:true}).click();
await page.locator('.pt-bar').waitFor();
await page.screenshot({path:`issues/process-ui-fidelity/prototype-${width}-${theme}-bar.png`,fullPage:true,animations:"disabled"});
await page.locator('.pt-bar').click();
await page.locator('.pr-main').first().click();
await page.screenshot({path:`issues/process-ui-fidelity/prototype-${width}-${theme}-output.png`,fullPage:true,animations:"disabled"});
await page.getByRole('button',{name:'Pysäytä seuraaminen',exact:true}).first().click();
await page.screenshot({path:`issues/process-ui-fidelity/prototype-${width}-${theme}-paused.png`,fullPage:true,animations:'disabled'});
await page.locator('.pr-main').filter({has:page.locator('.pr-name', {hasText:'haku'})}).click();
await page.screenshot({path:`issues/process-ui-fidelity/prototype-${width}-${theme}-finished-output.png`,fullPage:true,animations:'disabled'});
for (const name of ['testit','sivu']) {
 await page.getByRole('button',{name:`Pysäytä ${name}`,exact:true}).first().click();
 await page.waitForFunction(name=>![...document.querySelectorAll('.pr-stop')].some(el=>el.getAttribute('aria-label')===`Pysäytä ${name}`),name);
}
await page.locator('.pt-bar').click();
await page.screenshot({path:`issues/process-ui-fidelity/prototype-${width}-${theme}-finished-bar.png`,fullPage:true,animations:'disabled'});
await page.locator('#pr-scn').selectOption('stuck');
if(await page.locator('.pt-bar').getAttribute('aria-expanded')!=='true') await page.locator('.pt-bar').click();
await page.getByRole('button',{name:'Pysäytä testit',exact:true}).first().click();
await page.getByRole('button',{name:'Pakota lopetus',exact:true}).first().waitFor();
await page.locator('.pr-main').first().click();
await page.getByRole('button',{name:'Pysäytä seuraaminen',exact:true}).first().click();
await page.screenshot({path:`issues/process-ui-fidelity/prototype-${width}-${theme}-stop-timeout.png`,fullPage:true,animations:'disabled'});
await page.goto('file://'+resolve('.cache/prosessilohkot.html'));
await page.locator('.pn-row').first().waitFor({timeout:60000});
await page.locator('.pn-row').first().scrollIntoViewIfNeeded();
await page.screenshot({path:`issues/process-ui-fidelity/prototype-${width}-${theme}-completion.png`,fullPage:true,animations:'disabled'});
if(await page.locator('.pt-bar').getAttribute('aria-expanded')!=='true') await page.locator('.pt-bar').click();
await page.screenshot({path:`issues/process-ui-fidelity/prototype-${width}-${theme}-clear.png`,fullPage:true,animations:'disabled'});
await page.close();
}
} finally {await browser.close()}
