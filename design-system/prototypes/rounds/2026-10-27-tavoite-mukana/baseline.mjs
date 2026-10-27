// Current production after Aloita, captured from the synthetic lab only:
// scripts/lab.sh start, then node baseline.mjs <out-dir>. Device scale 2.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdirSync} from 'node:fs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const {origin}=await import('../../../../web/lab/session.mjs');
const out=resolve(process.argv[2]);mkdirSync(out,{recursive:true});
const browser=await chromium.launch();
try{
 for(const [width,theme] of [[1440,'light'],[390,'dark']]){
  const ctx=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:width>400?900:844},deviceScaleFactor:2});
  const page=await ctx.newPage();
  await page.goto(`${origin}/workspaces`);
  await page.getByTestId('github-sign-in').click();
  await page.locator('a[href*="code=42"]').click();
  await page.evaluate(v=>{document.documentElement.dataset.theme=v;},theme);
  if(width===390)await page.getByTestId('navigation-open').click();
  await page.getByRole('navigation').getByTestId('workspace-start-aurinkokello').click();
  await page.getByTestId('starting-goal').first().waitFor();
  const shot=n=>page.screenshot({path:`${out}/nyt-${n}-${width}-${theme}.png`});
  await page.getByTestId('starting-goal').filter({hasText:'Korjaa havaittu ongelma'}).click();
  await page.getByTestId('guide-start-top').click();
  await page.waitForFunction(()=>document.querySelector('[data-testid="message-input"]')?.value.length>40);
  await shot('aloitettu');
  await page.keyboard.type('Reitin pituus näkyy kilometreinä mailien sijaan.');
  await page.getByTestId('send').and(page.locator('[data-mode="send"]')).click();
  await page.getByTestId('message').first().waitFor({timeout:20000});
  await page.waitForTimeout(2500);
  await shot('lahetetty');
  await ctx.close();
 }
}finally{await browser.close();}
