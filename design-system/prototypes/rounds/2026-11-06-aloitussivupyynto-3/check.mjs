// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. Walks
// the three riffs light and dark at 1440 and 390 px, and once in English;
// checks both rows' fields (chip, placeholder shown selected), what the
// untouched send left in the history and in the agent's text under each
// rule, presses the start button and the goal card, types over the goal's
// placeholder and sends, resets, and writes screenshots at scale 2.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-06-aloitussivupyynto-3';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['aina-pois','aina-mukaan','eri-saanto'];
const SKILL='open-habitat-start-page',GOAL='kysy-muistiinpanoista';
const drops=[{page:true,goal:true},{page:false,goal:false},{page:true,goal:false}];
const words={
 fi:{title:'Luo aloitussivu',goal:'Kysy muistiinpanoista',sentence:'Luodaan tälle työtilalle aloitussivu.',ph:{page:'[anna lisäohjeita]',goal:'[kysymys]'}},
 en:{title:'Create start page',goal:'Ask the notes',sentence:'Create a start page for this workspace.',ph:{page:'[add instructions]',goal:'[question]'}},
};
let checks=0;const errors=[];
const ok=()=>{checks++;};
try{
for(const width of [1440,390])for(const theme of ['light','dark']){
 const page=await browser.newPage({viewport:{width,height:width===390?844:900},deviceScaleFactor:2,reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 await checkPicker(page,round);
 const tag=`${width}-${theme}`;
 const screen=id=>page.getByTestId(id);
 const field=id=>screen(id).locator('.ah-composer textarea');
 const langs=theme==='light'&&width===1440?['fi','en']:['fi'];
 for(const d of [0,1,2])for(const lang of langs){
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.rq-review.variant-${d}`).waitFor({state:'attached'});
  await page.locator('#lang').selectOption(lang);
  const w=words[lang];
  assert.match(await page.getByTestId('direction-lines').locator('li[aria-current]').innerText(),[/^Aina pois:/,/^Aina mukaan:/,/^Eri sääntö:/][d]);
  assert.equal((await screen('page-a').getByTestId('landing-create').innerText()).trim(),w.title);
  assert.equal(await screen('goal-a').getByTestId('starting-goal').count(),3);ok();
  // b: each field holds its skill as the chip and the placeholder selected; no hint.
  const draft={page:`${w.sentence}\n${w.ph.page}`,goal:w.ph.goal};
  for(const row of ['page','goal']){
   assert.equal(await field(`${row}-b`).inputValue(),draft[row],`${row}-b draft`);
   assert.match(await screen(`${row}-b`).getByTestId('goal-chip').innerText(),new RegExp(row==='page'?w.title:w.goal));
   assert.equal(await screen(`${row}-b`).locator('.rq-selection mark').innerText(),w.ph[row]);
   assert.ok(await screen(`${row}-b`).locator('.rq-selection mark').isVisible());
   assert.equal(await screen(`${row}-b`).getByTestId('placeholder-hint').count(),0);ok();
  }
  // c: the untouched send under the riff's rule, in the history and in the aid.
  for(const row of ['page','goal']){
   const dropped=drops[d][row],ph=w.ph[row];
   const history=await screen(`${row}-c`).locator('.rq-frame').innerText();
   assert.equal(history.includes(ph),!dropped,`${row}-c history placeholder`);
   assert.equal(history.includes('/skill:'),false);
   assert.equal(await screen(`${row}-c`).getByTestId('skill-chip').count(),1);
   const sent=await screen(`${row}-c`).getByTestId('sent-text').innerText();
   const invoke=row==='page'?`/skill:${SKILL} ${w.sentence}`:`/skill:${GOAL}`;
   assert.ok(sent.startsWith(invoke),`${row} sent: ${sent}`);
   assert.equal(await screen(`${row}-c`).getByTestId('sent-dropped').count(),dropped?1:0);
   if(!dropped)assert.ok(sent.endsWith(ph));ok();
  }
  // Pressing a start point flashes its field.
  await screen('page-a').getByTestId('landing-create').click();
  await page.waitForFunction(()=>document.querySelector('[data-testid="page-b"]')?.hasAttribute('data-flash'));
  await screen('goal-a').getByTestId('starting-goal').first().click();
  await page.waitForFunction(()=>document.querySelector('[data-testid="goal-b"]')?.hasAttribute('data-flash'));ok();
  await page.waitForTimeout(1400);
  await page.evaluate(()=>scrollTo(0,0));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'document overflow');ok();
  // The floating picker would land mid-page in a full-page capture.
  await page.locator('nav.proto-picker').evaluate(el=>{el.style.visibility='hidden';});
  await page.screenshot({path:`${out}/r3-${d+1}-${names[d]}${lang==='en'?'-en':''}-${tag}.png`,fullPage:true});
  await page.locator('nav.proto-picker').evaluate(el=>{el.style.visibility='';});
  if(theme!=='light'||lang!=='fi'||width!==1440)continue;
  // Typing replaces the goal's placeholder; the typed question is sent under every rule.
  await field('goal-b').click();
  await page.waitForTimeout(50);
  await page.keyboard.type('Missä on saunaremontti?');
  assert.equal(await field('goal-b').inputValue(),'Missä on saunaremontti?');ok();
  await screen('goal-b').getByTestId('send').click();
  await page.waitForFunction(()=>/saunaremontti/.test(document.querySelector('[data-testid="goal-c"]')?.textContent||''));
  assert.equal(await screen('goal-c').getByTestId('sent-text').innerText(),`/skill:${GOAL} Missä on saunaremontti?`);
  assert.equal(await screen('goal-c').getByTestId('sent-dropped').count(),0);ok();
  await page.locator('#reset').click();
  await page.waitForFunction(()=>!/saunaremontti/.test(document.querySelector('[data-testid="goal-c"]')?.textContent||''));ok();
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
