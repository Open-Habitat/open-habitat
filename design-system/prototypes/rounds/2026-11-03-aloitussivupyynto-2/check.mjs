// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. Walks
// the three directions light and dark at 1440 and 390 px, create and update,
// and once in English; checks what each field holds and that its placeholder
// shows as selected, how the sent request reads, presses both start buttons,
// types over one placeholder and sends, sends the other untouched, opens the
// chip's instruction, and writes screenshots at scale 2.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-03-aloitussivupyynto-2';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['nimi','siru','komento'];
const SKILL='open-habitat-start-page';
const words={
 fi:{absent:'Luo aloitussivu',update:'Päivitä aloitussivu',ph:['[anna lisäohjeita]','[anna lisäohjeita]','[lisäohjeet, jos on]'],
  sentence:{absent:[`Luodaan aloitussivu käyttäen ${SKILL}-taitoa.`,'Luodaan tälle työtilalle aloitussivu.','Luo tälle työtilalle aloitussivu.'],
   update:[`Päivitetään aloitussivu käyttäen ${SKILL}-taitoa.`,'Päivitetään aloitussivu vastaamaan työtilaa.','Päivitä aloitussivu vastaamaan työtilaa.']},extra:'Korosta viikkoyhteenvetoja.'},
 en:{absent:'Create start page',ph:['[add instructions]','[add instructions]','[further instructions, if any]'],
  sentence:{absent:[`Let's create the start page using the ${SKILL} skill.`,'Create a start page for this workspace.','Create a start page for this workspace.']},extra:'Highlight the weekly summaries.'},
};
let checks=0;const errors=[];
try{
for(const width of [1440,390])for(const theme of ['light','dark']){
 const page=await browser.newPage({viewport:{width,height:width===390?844:900},deviceScaleFactor:2,reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 await checkPicker(page,round);
 const tag=`${width}-${theme}`;
 const ok=()=>{checks++;};
 const screen=id=>page.getByTestId(id);
 const field=id=>screen(id).locator('.ah-composer textarea');
 const combos=theme==='light'?[['fi','absent'],['fi','update'],...(width===1440?[['en','absent']]:[])]:[['fi','absent']];
 for(const d of [0,1,2])for(const [lang,mode] of combos){
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.rq-review.variant-${d}`).waitFor({state:'attached'});
  await page.locator('#lang').selectOption(lang);
  await page.locator('#mode').selectOption(mode);
  const w=words[lang],ph=w.ph[d],sentence=w.sentence[mode][d],title=w[mode];
  assert.match(await page.getByTestId('direction-lines').locator('li[aria-current]').innerText(),[/^Nimi lauseessa:/,/^Siru ja lause:/,/^Komento näkyvissä:/][d]);
  assert.equal((await screen('page-a').getByTestId('landing-create').innerText()).trim(),title);
  assert.equal((await screen('empty-a').getByTestId('empty-create').innerText()).trim(),title);ok();
  // b: the same template in both fields, its placeholder shown selected.
  for(const id of ['page-b','empty-b']){
   const value=await field(id).inputValue();
   assert.equal(value,[`${sentence}\n${ph}`,`${sentence}\n${ph}`,`/skill:${SKILL} ${sentence}\n${ph}`][d],`${id} draft`);
   assert.equal(await screen(id).getByTestId('goal-chip').count(),d===1?1:0);
   if(d===1)assert.match(await screen(id).getByTestId('goal-chip').innerText(),new RegExp(title));
   assert.equal(await screen(id).locator('.rq-selection mark').innerText(),ph);
   assert.ok(await screen(id).locator('.rq-selection mark').isVisible());
   assert.equal(await screen(id).getByTestId('placeholder-hint').count(),d===1?1:0);ok();
  }
  // c: one typed wish from the workspace page, one untouched placeholder.
  const pageC=await screen('page-c').innerText(), emptyC=await screen('empty-c').innerText();
  assert.match(pageC,new RegExp(w.extra.replace('.','\\.')));
  assert.equal(pageC.includes(ph),false);
  assert.equal(emptyC.includes(ph),d===2,'untouched placeholder');
  for(const id of ['page-c','empty-c']){
   const chip=screen(id).getByTestId('skill-chip');
   assert.equal(await chip.count(),d===0?0:1);
   if(d===1)assert.match(await chip.innerText(),new RegExp(title));
   if(d===2)assert.match(await chip.innerText(),new RegExp(SKILL));
   const text=await screen(id).innerText();
   assert.equal(text.includes('/skill:'),false,'history shows no /skill: text');
   if(d!==2)assert.match(text,new RegExp(sentence.replace(/[.']/g,'.')));
  }
  ok();
  // Pressing a start button points at its result.
  await screen('page-a').getByTestId('landing-create').click();
  await page.waitForFunction(()=>document.querySelector('[data-testid="page-b"]')?.hasAttribute('data-flash'));
  await screen('empty-a').getByTestId('empty-create').click();
  await page.waitForFunction(()=>document.querySelector('[data-testid="empty-b"]')?.hasAttribute('data-flash'));ok();
  await page.waitForTimeout(1400);
  await page.evaluate(()=>scrollTo(0,0));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'document overflow');ok();
  const suffix=(mode==='update'?'-paivita':'')+(lang==='en'?'-en':'');
  // The floating picker would land mid-page in a full-page capture.
  await page.locator('nav.proto-picker').evaluate(el=>{el.style.visibility='hidden';});
  await page.screenshot({path:`${out}/${d+1}-${names[d]}${suffix}-${tag}.png`,fullPage:true});
  await page.locator('nav.proto-picker').evaluate(el=>{el.style.visibility='';});
  if(theme!=='light'||lang!=='fi'||mode!=='absent')continue;
  // Typing replaces the selected placeholder; sending updates c.
  await field('page-b').click();
  await page.waitForTimeout(50);
  await page.keyboard.type('Testi');
  const typed=await field('page-b').inputValue();
  assert.ok(typed.endsWith(`\nTesti`)&&!typed.includes(ph),`typed over placeholder: ${typed}`);ok();
  await screen('page-b').getByTestId('send').click();
  await page.waitForFunction(()=>/Testi/.test(document.querySelector('[data-testid="page-c"]')?.textContent||''));ok();
  // Sending untouched: the field focused, the placeholder still selected.
  await field('empty-b').click();
  await page.waitForTimeout(50);
  await screen('empty-b').getByTestId('send').click();
  await page.waitForTimeout(100);
  assert.equal((await screen('empty-c').innerText()).includes(ph),d===2);ok();
  // The chip's instruction opens from the history.
  if(d===1){
   await screen('empty-c').getByTestId('skill-chip').click();
   const panel=page.getByTestId('skill-panel');await panel.waitFor();
   assert.match(await panel.innerText(),/A useful first conversation/);ok();
   await page.waitForTimeout(200);
   await page.screenshot({path:`${out}/${d+1}-${names[d]}-ohje-${tag}.png`});
   await page.getByTestId('skill-close').click();
   await panel.waitFor({state:'detached'});
  }
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
