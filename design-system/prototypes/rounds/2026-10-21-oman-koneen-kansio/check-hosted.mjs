// Hosted CSP smoke; synthetic-only published round, no product host.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch();
const errors = [];
try {
 const page = await browser.newPage({viewport:{width:1366,height:1000}});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error') errors.push(m.text());});
 await page.goto(process.argv[2]);
 const frame=page.frameLocator('iframe');
 for(let d=0;d<3;d++) {
  await frame.locator('.proto-picker-item:not(.proto-picker-replay)').nth(d).click();
  await frame.locator('#f-scenario').selectOption('ready');
  const act=a=>frame.locator(`.f-demo [data-act="${a}"]:visible`);
  if(d===0){await act('attachments').click();await act('folder').click();}
  else await act(d===1?'settings':'folder').first().click();
  await act('choose').click();await act('grant').click();
  assert.ok((await frame.locator('.f-panel').textContent()).includes('Jaettu kansio'));
  await act('close').click();
  assert.equal(await frame.locator('.f-panel').count(),0);
 }
 assert.deepEqual(errors,[]);
 console.log('Hosted smoke passed: all three directions, select/grant/close under Glasspad CSP; zero console/page errors.');
} finally {await browser.close();}
