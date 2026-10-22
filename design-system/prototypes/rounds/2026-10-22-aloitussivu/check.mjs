// Authored synthetic prototype only, never a real host or browser profile.
// node check.mjs <offline-html|hosted-url> <evidence-directory>
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
const [input,out]=process.argv.slice(2), hosted=/^https:/.test(input);
const html=hosted?null:readFileSync(input,'utf8');
mkdirSync(out,{recursive:true});
const browser=await chromium.launch();
const errors=[], metrics=[]; let checkpoints=0,captures=0;
try {
 for(const width of [1440,1366,390]) for(const theme of ['light','dark']) {
  const page=await browser.newPage({viewport:{width,height:1000}});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  if(!hosted)await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
  await page.goto(hosted?input:'http://prototype.test/');
  const f=hosted?page.frameLocator('iframe').first():page;
  await f.locator('#theme').selectOption(theme);
  const check=async()=>{
   assert.ok(await f.locator('body').evaluate(el=>el.scrollWidth<=innerWidth),'document overflow');
   const demo=f.locator('.s-demo');
   assert.ok(await demo.evaluate(el=>el.scrollWidth<=el.clientWidth),'demo overflow');
   const main=f.locator('.s-main');
   assert.ok(await main.evaluate(el=>el.scrollWidth<=el.clientWidth),'main overflow');
   assert.equal(await f.locator('.s-send').isDisabled(),true);
   assert.equal(await f.locator('.s-compose').isVisible(),true);
   const footer=await f.locator('.s-compose').boundingBox(), picker=await f.locator('.proto-picker').boundingBox();
   assert.ok(footer.y+footer.height<=picker.y,'comparison picker covers composer');
   checkpoints++;
  };
  const capture=async(label)=>{
   if(hosted)return;
   const base=`${out}/${label}-${width}-${theme}`;
   await page.screenshot({path:base+'.png',fullPage:true});
   await f.locator('.s-demo textarea').evaluate(el=>{el.textContent=el.value});
   writeFileSync(base+'.html',(await page.content()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''));captures++;
  };
  for(let d=0;d<3;d++) {
   await f.locator('.proto-picker-item:not(.proto-picker-replay)').nth(d).click();
   const mode=['cards','rows','preview'][d];
   await f.locator(`.s-demo[data-direction=${mode}]`).waitFor();
   await check();
   const h=await f.locator('.ah-start').evaluate(el=>el.scrollHeight);
   metrics.push({width,theme,direction:mode,initialHeight:h});
   assert.equal(await f.locator('.s-more').getAttribute('open'),null);
   if(d===0)assert.equal(await f.locator('.s-reveal[open]').count(),0);
   if(width===1440&&theme==='light')await capture('d'+(d+1)+'-initial');
   if(width===390&&theme==='light'&&d===0)await capture('d1-initial');
   await f.locator('.s-demo textarea').fill('Oma luonnos säilyy.');
   if(d===0) {
    const s=f.locator('.s-reveal').first().locator('summary');
    await s.focus();await page.keyboard.press('Enter');
    assert.equal(await f.locator('.s-reveal').first().getAttribute('open'),'');
   } else if(d===1) {
    const s=f.locator('.s-row').first().locator('summary');
    await s.focus();await page.keyboard.press('Enter');
   } else {
    await f.locator('[data-choice="0"]').focus();await page.keyboard.press('Enter');
    assert.equal(await f.locator('[data-choice="0"]').getAttribute('aria-pressed'),'true');
   }
   await check();
   await f.locator('[data-insert="0"]').click();
   const field=f.locator('.s-demo textarea');
   assert.ok((await field.inputValue()).startsWith('Lue repon ohjeet'));
   assert.ok((await field.inputValue()).endsWith('\n\nOma luonnos säilyy.'));
   assert.equal(await field.evaluate(el=>el===document.activeElement),true);
   assert.ok((await f.locator('[role=status]').textContent()).includes('Mitään ei lähetetty'));
   await check();
   // Stress the long prompt: bounded scroll, full tail retained, no blockquote indent.
   if(d===0)await f.locator('.s-reveal').nth(2).locator('summary').click();
   if(d===1) {
    await f.locator('.s-row').nth(2).locator('summary').click();
    assert.equal(await f.locator('.s-row[open]').count(),1);
   }
   if(d===2)await f.locator('[data-choice="2"]').click();
   const long=f.getByRole('region',{name:'Koko pyyntö: Valmistele seuraava julkaisu',exact:true});
   assert.equal(await long.isVisible(),true);
   assert.ok((await long.textContent()).includes('tarkistuslistan-tiedostonimi.md'));
   assert.ok(await long.evaluate(el=>el.scrollHeight>el.clientHeight),'long prompt not bounded');
   assert.ok(await long.evaluate(el=>el.scrollWidth<=el.clientWidth),'prompt overflows');
   await check();
   if((width===1366||width===390)&&theme==='dark')await capture('d'+(d+1)+'-long-prompt');
   await f.locator('.s-more > summary').click();
   if(d===0)await f.locator('.s-extra .s-reveal').first().locator('summary').click();
   if(d===1)await f.locator('.s-extra .s-row').first().locator('summary').click();
   if(d===2)await f.locator('[data-choice="3"]').click();
   await f.locator('[data-insert="3"]').click();
   assert.ok((await field.inputValue()).startsWith('Tarkista ohjeen [polku]'));
   assert.ok((await field.inputValue()).endsWith('Oma luonnos säilyy.'));
   // Skill action preserves the existing prefix behavior from goalDraft.
   if(d===1)await f.locator('.s-row').nth(1).locator('summary').click();
   if(d===2)await f.locator('[data-choice="1"]').click();
   await f.locator('[data-insert="1"]').click();
   assert.ok((await field.inputValue()).startsWith('/skill:korjaa Selvitä'));
   await check();
  }
  await page.close();
 }
 assert.deepEqual(errors,[]);
 const result={success:true,hosted,checkpoints,captures,errors,metrics};
 writeFileSync(`${out}/checks.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
} finally {await browser.close();}
