// Authored synthetic prototype, not production or host-backed validation.
// On a disposable browser host: node check.mjs <html-or-hosted-url> <out-dir>
import {chromium} from 'playwright';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const [input,out]=process.argv.slice(2),hosted=input.startsWith('https:');
mkdirSync(out,{recursive:true});
const browser=await chromium.launch();const errors=[];let checks=0;
try{
 for(const width of [1440,1366,390])for(const theme of ['light','dark']){
 const page=await browser.newPage({viewport:{width,height:1100}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 if(!hosted)await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));
 await page.goto(hosted?input:'http://prototype.test/');
 const root=hosted?page.frameLocator('iframe'):page,q=s=>root.locator(s);
 await q('#theme').selectOption(theme);
 for(let d=0;d<3;d++){
 await q('.proto-picker-item:not(.proto-picker-replay)').nth(d).click();await q('.a-demo').waitFor();
 assert.match(await q('.e-titlebar').textContent(),/Aurinkokello/);
 if(!hosted&&((width===1440&&theme==='light')||(width===390&&theme==='dark')))await capture('entry');
 if(d===2){assert.ok(await q('.a-intro').isVisible());assert.equal(await q('.a-intro .a-card').count(),3);}
 await q('[data-act="open"]').first().click();await q('.a-results').waitFor();
 assert.equal(await q('.a-results .a-card').count(),25);checks++;
 if(!hosted&&((width===1440&&theme==='light')||(width===390&&theme==='dark')))await capture('catalogue');
 await q('#a-search').fill('hitaus');assert.equal(await q('.a-results .a-card').count(),1);checks++;
 await q('#a-search').fill('xyz-no-match');assert.ok(await q('.s-empty').isVisible());
 await q('#a-search').fill('');await q('#a-topic').selectOption('Viestintä');assert.equal(await q('.a-results .a-card').count(),5);checks++;
 await q('#a-topic').selectOption('Kaikki');await q('[data-filter="repo"]').click();assert.equal(await q('.a-results .a-card').count(),19);checks++;
 if(d===2){await q('[data-filter="new"]').click();assert.equal(await q('.a-results .a-card').count(),0);}
 else{await q('[data-filter="new"]').click();assert.equal(await q('.a-results .a-card').count(),8);}
 checks++;
 await q('[data-filter="all"]').click();await q('[data-detail="0"]').click();
 assert.ok(await q('.a-dialog').isVisible());assert.match(await q('.a-origin').textContent(),/AI:n ehdottama/);
 await q('.a-metadata summary').click();assert.match(await q('.a-metadata').textContent(),/ei vielä|ehdotus/);
 await q('.a-dialog details').last().locator('summary').click();assert.match(await q('.a-dialog').textContent(),/Aino Esimerkki/);checks++;
 if(!hosted&&width===390&&theme==='dark')await capture('detail');
 await page.keyboard.press('Escape');assert.equal(await q('.a-dialog').isVisible(),false);
 await q('[data-detail="1"]').click();assert.match(await q('.a-origin').textContent(),/omasta metatiedosta/);await q('[data-act="detail-close"]').click();checks++;
 await q('[data-detail="24"]').scrollIntoViewIfNeeded();await q('[data-detail="24"]').click();assert.ok(await q('.a-dialog').isVisible());await q('[data-act="detail-close"]').click();checks++;
 await q('[data-act="close"]').click();
 if(d===1)await q('[data-act="conversation"]').click();
 if(d===2){await q('#a-scenario').selectOption('return');assert.ok(await q('.a-suggestion').isVisible());}
 await q('.a-demo textarea').fill('Oma keskeneräinen pyyntö.');
 if(await q('[data-act="open"]').count()===0)await q('.s-entry [data-act="home"]').click();
 await q('[data-act="open"]').first().click();await q('[data-detail="5"]').click();
 await q('[data-use="5"]').click();assert.match(await q('.a-demo textarea').inputValue(),/^\/skill:slow-tests /);assert.match(await q('.a-demo textarea').inputValue(),/Oma keskeneräinen pyyntö\.$/);assert.ok(await q('.a-notice').isVisible());checks++;
 if(!hosted&&width===390&&theme==='dark')await capture('draft');
 if(await q('[data-act="open"]').count()===0)await q('.s-entry [data-act="home"]').click();
 await q('[data-act="open"]').first().click();await q('[data-act="seen"]').click();await q('[data-filter="new"]').click();assert.equal(await q('.a-results .a-card').count(),0);checks++;
 await q('[data-act="close"]').click();await q('#a-scenario').selectOption('first');await q('[data-act="open"]').first().click();assert.match(await q('.a-catalogue').textContent(),/Ensimmäinen katselu/);checks++;
 const overflow=await q('.a-demo').evaluate(el=>{const b=el.getBoundingClientRect();return [...el.querySelectorAll('button,input,select,textarea')].filter(e=>e.getClientRects().length&&!e.closest('dialog:not([open])')).filter(e=>{const a=e.getBoundingClientRect();return a.left<b.left-1||a.right>b.right+1}).map(e=>e.outerHTML);});assert.deepEqual(overflow,[]);
 assert.equal(await q('body').evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);checks++;
 async function capture(suffix){const base=`${out}/d${d+1}-${width}-${theme}-${suffix}`;await page.screenshot({path:base+'.png',fullPage:true});const html=await q('html').evaluate(el=>{const c=el.cloneNode(true);c.querySelectorAll('script').forEach(e=>e.remove());return '<!doctype html>'+c.outerHTML});writeFileSync(base+'.html',html);}
 }
 await page.close();
 }
 assert.deepEqual(errors,[]);console.log(`${checks} checkpoints passed; 3 directions × 3 widths × 2 themes; zero console/page errors (${hosted?'hosted':'offline'}).`);
}finally{await browser.close();}
