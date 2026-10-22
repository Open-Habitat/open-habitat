// Synthetic authored prototype, not product/lab integration evidence.
// Copy alongside a Playwright installation: node check.mjs <html|https-url> <out>
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
const [input,out]=process.argv.slice(2),hosted=/^https:/.test(input);
const html=hosted?null:readFileSync(input,'utf8');mkdirSync(out,{recursive:true});
const browser=await chromium.launch();const errors=[],metrics=[];let checkpoints=0,captures=0;
const ids=['tutustu','korjaa','julkaise','ohje','arvioi','suunnittele'];
try {
 for(const width of [1440,1366,390]) for(const theme of ['light','dark']) {
  const page=await browser.newPage({viewport:{width,height:1000}});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  if(!hosted)await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
  await page.goto(hosted?input:'http://prototype.test/');
  const f=hosted?page.frameLocator('iframe').first():page;
  await f.locator('#theme').selectOption(theme);
  const field=f.locator('.s-demo textarea');
  const check=async()=>{
   for(const sel of ['body','.s-demo','.s-main','.s-scroll','.ah-start'])assert.ok(await f.locator(sel).evaluate(el=>el.scrollWidth<=el.clientWidth),`overflow ${sel} ${width}`);
   const footer=await f.locator('.s-compose').boundingBox(),picker=await f.locator('.proto-picker').boundingBox();assert.ok(footer.y+footer.height<=picker.y,'picker covers composer');
   assert.ok(await f.locator('.s-send').isDisabled());checkpoints++;
  };
  const capture=async(label)=>{
   if(hosted)return;const base=`${out}/${label}-${width}-${theme}`;
   await page.screenshot({path:base+'.png',fullPage:true});
   await field.evaluate(el=>el.textContent=el.value);
   writeFileSync(base+'.html',(await page.content()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''));captures++;
  };
  for(const [d,mode] of ['read','steps','index'].entries()) {
   await f.locator('.proto-picker-item:not(.proto-picker-replay)').nth(d).click();
   await f.locator(`.s-demo[data-direction=${mode}]`).waitFor();
   // A previous direction's fragment must not choose a guide in another direction.
   await f.locator('.s-home').waitFor();
   assert.equal(await f.locator('.s-home [data-goal]').count(),6);
   assert.equal(await f.locator('.s-home details').count(),0);
   await check();
   metrics.push({width,theme,direction:mode,homeHeight:await f.locator('.ah-start').evaluate(el=>el.scrollHeight)});
   if(d===0&&((width===1440&&theme==='light')||(width===390&&theme==='light')))await capture('home');
   for(const [i,id] of ids.entries()) {
    await field.fill('Oma luonnos säilyy.');
    const link=f.locator(`.s-home [data-goal=${id}]`);await link.focus();await page.keyboard.press('Enter');
    await f.locator(`.s-guide[data-id=${id}]`).waitFor();
    assert.ok(await f.locator('.s-guide h2').evaluate(el=>el===document.activeElement),'guide focus');
    assert.equal(await f.locator('.s-home').count(),0,'guide is a separate view');
    assert.equal(await field.inputValue(),'Oma luonnos säilyy.');
    if(mode==='steps') {
     assert.equal(await f.locator('[data-start]').count(),0);
     await f.getByRole('button',{name:'Seuraava',exact:true}).click();
     assert.equal(await f.locator('.s-guide').getAttribute('data-step'),'1');
     await f.getByRole('button',{name:'Edellinen',exact:true}).click();
     assert.equal(await f.locator('.s-guide').getAttribute('data-step'),'0');
     await f.getByRole('button',{name:'3. Eteneminen',exact:true}).click();
     assert.equal(await f.locator('.s-guide').getAttribute('data-step'),'2');
    } else assert.equal(await f.locator('.s-guide-body section').count(),3);
    if(mode==='index')assert.equal(await f.locator('.s-guide-index [aria-current=page]').getAttribute('data-goal'),id);
    await check();
    if(i===0&&((width===1440&&theme==='light')||(width===390&&theme==='dark')))await capture(mode+'-guide');
    await f.locator('.s-reveal summary').click();
    const prompt=await f.locator('.s-prompt').textContent();assert.ok(prompt.length>40);
    if(i===2) {
     assert.ok(prompt.includes('tarkistuslistan-tiedostonimi.md'));
     assert.ok(await f.locator('.s-prompt').evaluate(el=>el.scrollHeight>el.clientHeight));
     assert.ok(await f.locator('.s-prompt').evaluate(el=>el.scrollWidth<=el.clientWidth));
     if((width===1366||width===390)&&theme==='dark') {
      await f.locator('.s-prompt').scrollIntoViewIfNeeded();
      await capture(mode+'-long');
     }
    }
    await f.locator('[data-start]').click();
    await f.locator('.s-home').waitFor();
    assert.equal(await field.inputValue(),prompt+'\n\nOma luonnos säilyy.');
    if(i===1)assert.ok((await field.inputValue()).startsWith('/skill:korjaa '));
    assert.ok(await field.evaluate(el=>el===document.activeElement));
    assert.ok((await f.locator('.s-feedback').textContent()).includes('Mitään ei lähetetty'));
    await check();
   }
   // Back is a reading operation; must not modify the draft, and restores goal focus.
   const draft=await field.inputValue();await f.locator('.s-home [data-goal=tutustu]').click();
   await f.locator('.s-guide[data-id=tutustu]').waitFor();
   await f.locator('[data-back]').click();await f.locator('.s-home').waitFor();
   assert.equal(await field.inputValue(),draft);
   assert.ok(await f.locator('.s-home [data-goal=tutustu]').evaluate(el=>el===document.activeElement));
   if(mode==='index') {
    await f.locator('.s-home [data-goal=tutustu]').click();
    await f.locator('.s-guide-index [data-goal=ohje]').click();
    await f.locator('.s-guide[data-id=ohje]').waitFor();
    assert.equal(await field.inputValue(),draft);
    await f.locator('[data-back]').click();await f.locator('.s-home').waitFor();
   }
   // Native browser history returns from a guide without losing the draft.
   await f.locator('.s-home [data-goal=tutustu]').click();
   await f.locator('.s-guide[data-id=tutustu]').waitFor();
   await f.locator('body').evaluate(()=>history.back());await f.locator('.s-home').waitFor();
   assert.equal(await field.inputValue(),draft);
   await f.locator('body').evaluate(()=>history.forward());await f.locator('.s-guide[data-id=tutustu]').waitFor();
   await f.locator('[data-back]').click();await f.locator('.s-home').waitFor();
   // Empty draft has no extra separator. Start works without revealing the prompt.
   await field.fill('');await f.locator('.s-home [data-goal=tutustu]').click();
   if(mode==='steps')await f.getByRole('button',{name:'3. Eteneminen',exact:true}).click();
   await f.locator('[data-start]').click();assert.ok((await field.inputValue()).endsWith('Älä muuta tiedostoja.'));
   assert.ok(!(await field.inputValue()).endsWith('\n'));await check();
  }
  await page.close();
 }
 assert.deepEqual(errors,[]);
 const result={success:true,hosted,checkpoints,captures,errors,metrics};writeFileSync(`${out}/checks.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
} finally {await browser.close();}
