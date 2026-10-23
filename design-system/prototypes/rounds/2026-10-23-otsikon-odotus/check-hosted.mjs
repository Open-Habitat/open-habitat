import {chromium} from '../../../../web/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch();
try {
 const page=await browser.newPage({viewport:{width:1280,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error') errors.push(m.text());});
 await page.goto('https://glasspad.example.test/p/mqp4jiyirvqpczpen7bmej722a/');
 const app=page.frameLocator('iframe');
 await app.locator('#title-pace').selectOption('slow');
 for(let i=0;i<3;i++) {
  await app.locator('.proto-picker-item:not(.proto-picker-replay)').nth(i).click();
  await app.locator('.title-name[data-busy="true"]').waitFor();
  assert.equal(await app.locator('.title-name h1').textContent(),'Status-skripti');
  await app.locator('#theme').selectOption('dark');
  await app.locator('#phone').check();
  assert(await app.locator('.topbar').evaluate(n=>n.scrollWidth<=n.clientWidth+1));
 }
 await page.screenshot({path:'design-system/prototypes/dist/title-evidence/hosted.png'});
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({hostedDirections:3,errors}));
} finally {await browser.close();}
