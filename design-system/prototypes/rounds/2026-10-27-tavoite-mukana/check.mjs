// node check.mjs <index.html> <out-dir>
// Walks every direction at 1440 and 390 px in light and dark: goal → Aloita,
// the chip and its card, the guide panel, send, the history chip, a simulated
// reload and "Muokkaa tekstinä". Screenshots at device scale 2 go to out-dir.
// Authored synthetic prototype, not a host-backed acceptance test.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-10-27-tavoite-mukana';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const html=readFileSync(input,'utf8');
const browser=await chromium.launch();
const errors=[],results=[];
const letters=['a','b','c'];
try{
 for(const width of [1440,390])for(const theme of ['light','dark'])for(const dir of [0,1,2]){
  const phone=width<400;
  const ctx=await browser.newContext({viewport:{width,height:phone?844:900},deviceScaleFactor:2,reducedMotion:'reduce'});
  const page=await ctx.newPage();
  page.on('pageerror',e=>errors.push(`${width}/${theme}/${dir}: ${e.message}`));
  page.on('console',m=>{if(m.type()==='error')errors.push(`${width}/${theme}/${dir}: ${m.text()}`);});
  await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
  // The phone is the same page as the review's 390 px frame shows it.
  await page.goto(`http://prototype.test/?v=${dir+1}${phone?`&frame=1&theme=${theme}`:''}`);
  if(!phone){
   await checkPicker(page,round);
   await page.locator('#theme').selectOption(theme);
   assert.equal(await page.locator('.proto-picker-item[data-active]').innerText(),['A Siru ja paneeli','B Siru ja kortti','C Teksti ja paneeli'][dir].replaceAll(' ','\u00a0'));
  }
  const id=x=>page.getByTestId(x);
  const shot=async name=>{await page.waitForTimeout(150);await page.screenshot({path:`${out}/${letters[dir]}-${name}-${width}-${theme}.png`});};
  const field=page.getByTestId('message-input');
  const noOverflow=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'document overflow');
  await id('starting-goal').filter({hasText:'Korjaa havaittu ongelma'}).click();
  await id('guide-start-top').click();
  await page.waitForTimeout(200);
  if(dir===2){
   assert.match(await field.inputValue(),/^\/skill:korjaa Selvitä ongelman syy/);
   assert.equal(await id('goal-chip').count(),0);
  }else{
   await id('goal-chip').waitFor();
   assert.equal(await field.inputValue(),'[kuvaile havainto]');
   assert.equal(await page.evaluate(()=>{const f=document.activeElement;return f?.tagName==='TEXTAREA'&&f.selectionEnd-f.selectionStart;}),'[kuvaile havainto]'.length,'placeholder selected');
  }
  const panelShown=async()=>await id('guide-panel').count()>0&&await id('guide-panel').isVisible();
  if(dir===1)assert.equal(await id('guide-toggle').count(),0,'B has no panel');
  else if(phone)assert.equal(await panelShown(),false,'phone keeps the composer in view after Aloita');
  else assert.ok(await panelShown(),'desktop opens the panel');
  await noOverflow();
  await shot('aloitettu');
  if(dir!==2){
   await id('goal-chip-open').click();await id('goal-card').waitFor();
   if(dir===1)assert.ok(await id('goal-card').getByText('Näin etenet').isVisible());
   else assert.equal(await id('goal-card').getByText('Näin etenet').count(),0);
   await noOverflow();await shot('kortti');
   await page.keyboard.press('Escape');assert.equal(await id('goal-card').count(),0);
  }
  if(dir!==1&&phone){
   await id('guide-toggle').click();assert.ok(await panelShown());await shot('opas');
   await id('guide-panel-close').click();assert.equal(await panelShown(),false);
  }
  await field.click();await field.press('End');
  if(dir!==2)await field.fill('Reitin pituus näkyy kilometreinä mailien sijaan.');
  else await field.evaluate(f=>f.setSelectionRange(f.value.length-'[kuvaile havainto]'.length,f.value.length));
  if(dir===2)await page.keyboard.type('Reitin pituus näkyy kilometreinä mailien sijaan.');
  await id('send').and(page.locator('[data-mode="send"]')).click();
  await page.getByText('Synteettinen vastaus').waitFor();
  assert.equal(await id('goal-chip').count(),0);
  const chip=id('skill-chip').first();
  await chip.waitFor();
  if(dir!==2)assert.match(await chip.innerText(),/Korjaa havaittu ongelma/);
  await noOverflow();await shot('lahetetty');
  await chip.click();await id('skill-panel').waitFor();
  if(dir===1)assert.ok(await id('skill-panel').getByText('Näin etenet').isVisible());
  await shot('historia-siru');
  await id('skill-close').click();
  if(!phone){
   await id('reload').click();await page.waitForTimeout(100);
   assert.equal(await panelShown(),false,'reload closes the panel');
   assert.equal(await id('guide-toggle').count(),dir===1?0:1,'the goal comes back from the native skill call');
   if(dir!==1){await id('guide-toggle').click();assert.ok(await panelShown());}
   await shot('uudelleenladattu');
  }
  results.push({width,theme,direction:letters[dir]});
  await ctx.close();
 }
 // A: "Muokkaa tekstinä" turns the chip back into today's raw text.
 // C: a goal without a skill leaves nothing native, so reload forgets it.
 {
  const ctx=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:2});
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
  await page.goto('http://prototype.test/?v=1');
  const id=x=>page.getByTestId(x);
  await id('starting-goal').filter({hasText:'Valmistele seuraava julkaisu'}).click();await id('guide-start-top').click();
  await id('goal-chip-open').click();await page.screenshot({path:`${out}/a-pitka-pyynto-1440-light.png`});
  await id('goal-edit').click();
  assert.equal(await id('goal-chip').count(),0);
  assert.match(await id('message-input').inputValue(),/^Tarkista seuraavan julkaisun valmius/);
  await page.screenshot({path:`${out}/a-muokkaa-tekstina-1440-light.png`});
  await page.goto('http://prototype.test/?v=3');
  await id('starting-goal').filter({hasText:'Tutustu repoon'}).click();await id('guide-start-top').click();
  await id('send').and(page.locator('[data-mode="send"]')).click();
  await page.getByText('Synteettinen vastaus').waitFor();
  await page.screenshot({path:`${out}/c-ilman-taitoa-lahetetty-1440-light.png`});
  await id('reload').click();
  assert.equal(await id('guide-toggle').count(),0,'C without a skill: nothing native names the goal');
  // The review's phone frame is the same page at 390 px.
  await page.locator('#phone').check();
  await page.frameLocator('iframe').getByTestId('starting-goal').first().waitFor();
  results.push({extra:'unwrap, C without skill, phone frame'});
  await ctx.close();
 }
}finally{await browser.close();}
writeFileSync(`${out}/checks.json`,JSON.stringify({round,results,errors},null,1));
assert.deepEqual(errors,[],'console clean');
console.log(`${results.length} runs passed, console clean`);
