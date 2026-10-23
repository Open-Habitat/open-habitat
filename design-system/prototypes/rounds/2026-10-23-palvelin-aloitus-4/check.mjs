// node check.mjs <html-or-hosted-url> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-10-23-palvelin-aloitus-4',names=['Ikkuna vieressä','Esikatselutila','Merkitty puhelin'];
const [input,out]=process.argv.slice(2),hosted=input.startsWith('https:');
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});let checks=0;const errors=[];
try{
for(const width of [1440,390])for(const theme of ['light','dark']){
 const page=await browser.newPage({viewport:{width,height:1100},reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 if(hosted)await page.goto(input);else{await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));await page.goto('http://prototype.test/');}
 const f=hosted?page.frameLocator('iframe').first():page;
 const id=x=>f.getByTestId(x).first();
 await f.locator('#theme').selectOption(theme);
 await checkPicker(f,round);
 // Picker contract: digits, arrows and R switch; form fields keep their keys.
 const key=async value=>{await f.locator('.axis').click();await page.keyboard.press(value);};
 const variant=d=>f.locator(`.variant-${d}`).waitFor();
 await key('3');await variant(2);
 await key('ArrowRight');await variant(0);
 await key('2');await variant(1);
 assert.equal(await f.locator('.proto-picker-item[data-active]').innerText(),names[1].replaceAll(' ',' '));
 assert.equal(await f.locator('body').evaluate(()=>new URL(location.href).searchParams.get('v')),'2');
 await id('ai-claude').click();
 await key('r');await variant(1);
 assert.equal(await id('step-ai-hint').innerText(),'Oletus: ChatGPT-tilaus','R remounts the fixture');
 await id('ai-claude').locator('input').focus();await page.keyboard.press('3');
 assert.equal(await f.locator('.variant-1').count(),1,'radio must ignore direction keys');
 // Mark the old document: a hosted reload is asynchronous, and the old page must not answer for the new one.
 if(hosted){await f.locator('body').evaluate(()=>{document.body.dataset.old='1';location.reload();});await f.locator('body:not([data-old])').waitFor();}else await page.reload();
 await variant(1);await f.locator('nav.proto-picker[data-ready]').waitFor();
 await f.locator('#theme').selectOption(theme);
 if(width===390)await f.locator('#phone').check();
 await key('1');await variant(0);
 assert.equal(await f.locator('#theme').inputValue(),theme);

 const checkpoint=async()=>{assert.equal(await f.locator('.review').evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'document overflow');for(const el of await f.locator('.s-main button:visible,.s-main input:visible,.s-main select:visible,.pm button:visible,.pm input:visible').all()){if(await el.evaluate(e=>!!e.closest('.dev-box')&&e.closest('.dev-desktop')))continue;const b=await el.boundingBox();if(b)assert.ok(b.x>=-1&&b.x+b.width<=width+1,`control overflow ${JSON.stringify(b)}`);}checks++;};
 const capture=async name=>{
  if(hosted)return;
  const base=`${out}/${name}-${width}-${theme}`;
  await page.screenshot({path:`${base}.png`,fullPage:true});
  const html=await page.evaluate(()=>{
   const copy=document.documentElement.cloneNode(true);
   copy.querySelectorAll('script').forEach(e=>e.remove());
   copy.querySelectorAll('style').forEach(e=>e.textContent=e.textContent.replace(/@font-face\s*\{[^}]*\}/g,''));
   document.querySelectorAll('input').forEach((e,i)=>{const n=copy.querySelectorAll('input')[i];n.setAttribute('value',e.type==='password'?'':e.value);if(e.checked)n.setAttribute('checked','');else n.removeAttribute('checked');});
   return '<!doctype html>'+copy.outerHTML;
  });writeFileSync(`${base}.html`,html);
 };
 const pv=()=>f.getByTestId('person-view');
 const at=async()=>pv().getAttribute('data-at');
 const routeIds=async()=>{await pv().locator('[data-testid^=onboarding-step-]').first().waitFor();return pv().locator('[data-testid^=onboarding-step-]').evaluateAll(n=>n.map(x=>x.dataset.testid.slice(16)));};
 // The fixed review picker can cover a control just scrolled into view; centre it first, as a reader would.
 const tap=async l=>{await l.evaluate(e=>e.scrollIntoView({block:'center'}));await l.click();};
 for(let d=0;d<3;d++)try{
  await f.locator('.proto-picker-item:not(.proto-picker-replay)').nth(d).click();
  await variant(d);process.stderr.write(`case ${width} ${theme} ${d}\n`);
  // Tabs: Käyttöönotto is its own tab, access sits with the users.
  await tap(id(width===390?'mtab-users':'tab-users'));
  await f.getByTestId('allowed').waitFor();assert.equal(await f.getByTestId('person-view').count(),0);
  await tap(id(width===390?'mtab-onboarding':'tab-onboarding'));
  if(d===1){await tap(id('pv-open'));await f.locator('.pm').waitFor();}
  // Default ChatGPT: only that option; the others behind the link.
  assert.deepEqual(await routeIds(),['github','repositories','google','ai']);
  assert.equal(await pv().getByTestId('flow-openai').count(),1);
  assert.equal(await pv().getByTestId('pv-others').count(),0,'a default offers only that option');
  assert.equal(await pv().getByTestId('pv-clones').count()+await pv().locator('.rt-bar').count(),1,'clone progress sits outside the step, once');
  assert.equal(await pv().locator('[data-testid=onboarding-card] .rt-bar, [data-testid=onboarding-card] [data-testid=pv-clones]').count(),0);
  assert.equal(await pv().locator('h1').count(),1,'one step heading');
  await tap(pv().getByTestId('pv-start'));
  if(d!==2){await tap(pv().getByTestId('pv-simulate'));assert.equal(await pv().getByTestId('flow-openai').getAttribute('data-phase'),'done');}
  await tap(pv().getByTestId('pv-other'));await pv().getByTestId('pv-others').waitFor();
  if(d===0){assert.equal(await pv().locator('[data-testid=pv-others] .st-opt.key').count(),3,'three compact key rows');}
  if(d===1){await tap(pv().getByTestId('pv-method').getByText('API-avain'));await tap(pv().getByTestId('pv-provider').getByText('Anthropic'));await pv().getByTestId('key-input-anthropic').fill('sk-ant-api03-person000000000000wxyz');await tap(pv().getByTestId('key-save-anthropic'));assert.match(await pv().getByTestId('flow-key-anthropic').innerText(),/sk-ant-…wxyz/);}
  if(d===2){assert.equal(await pv().locator('[data-testid=pv-others] li').count(),4);await tap(pv().getByTestId('pv-pick-deepseek-key'));await pv().getByTestId('flow-key-deepseek').waitFor();await tap(pv().getByTestId('pv-back'));await pv().getByTestId('flow-openai').waitFor();}
  if(d===0){await tap(pv().getByTestId('opt-deepseek-key').locator('button').first());await pv().getByTestId('key-input-deepseek').fill('sk-0123456789abcdef0123456789abcdef');await tap(pv().getByTestId('key-save-deepseek'));assert.match(await pv().getByTestId('flow-key-deepseek').innerText(),/sk-…cdef/);}
  await checkpoint();await capture(`others-${d+1}`);
  // Device toggle
  await tap(id('pv-device').getByText(width===390?'Tietokone':'Puhelin'));
  assert.equal(await f.getByTestId('device').getAttribute('data-device'),width===390?'desktop':'phone');
  await checkpoint();await capture(`device-${d+1}`);
  await tap(id('pv-device').getByText(width===390?'Puhelin':'Tietokone'));
  // Claude as default: the preview follows.
  await tap(id('ai-claude'));
  assert.equal(await id('step-ai-hint').innerText(),'Oletus: Claude-tilaus');
  await pv().getByTestId('flow-claude').waitFor();
  await tap(pv().getByTestId('pv-start'));await pv().getByTestId('claude-code').fill('code-1234567');await tap(pv().getByTestId('claude-confirm'));
  assert.equal(await pv().getByTestId('flow-claude').getAttribute('data-phase'),'done');
  // Every option.
  await tap(id('ai-way').getByText('Henkilö valitsee'));
  assert.equal(await id('step-ai-hint').innerText(),'Henkilö valitsee');
  assert.equal(await pv().getByTestId('pv-other').count(),0);
  await pv().getByTestId('pv-others').waitFor();
  await checkpoint();await capture(`all-${d+1}`);
  // Site key: the AI step leaves the route.
  await tap(id('ai-way').getByText('Sivuston avain'));
  await id('site-key-input').fill('sk-ant-short');
  assert.match(await id('site-key-error').innerText(),/OpenAI-avaimelta/);
  await id('site-key-provider').selectOption('anthropic');
  await id('site-key-input').fill('sk-ant-api03-prototype0000000000abcd');
  await tap(id('site-key-save'));
  assert.equal(await at(),'google');
  assert.deepEqual(await routeIds(),['github','repositories','google']);
  assert.equal(await pv().getByTestId('pv-last').count(),1);
  assert.match(await id('step-ai-hint').innerText(),/Ohitetaan · sivuston Anthropic-avain/);
  assert.equal(await id('site-key-suffix').innerText(),'sk-ant-…abcd');
  await checkpoint();await capture(`key-${d+1}`);
  // Leaving the key way removes the key after confirmation.
  await tap(id('ai-way').getByText('Oletus'));await tap(f.getByTestId('leave-key-confirm'));
  await f.getByTestId('site-key-suffix').waitFor({state:'detached'});
  assert.equal(await at(),'ai');
  if(d===2){
   // Annotations join the settings with the person's screen.
   assert.ok(await pv().locator('.ann').count()>=2,'annotations in the preview');
   await f.locator('.ann-source').first().hover();
   assert.equal(await pv().locator('.ann-target.hot,.ann.hot').count()>0,true);
  }
  if(d===1){await tap(id('pv-close'));await f.locator('.pm').waitFor({state:'detached'});}
  await tap(id('ai-claude'));await tap(id('save'));
  assert.match(await f.getByRole('status').first().innerText(),/Oikea palvelin ei muuttunut/);
  assert.equal(await id('save').isDisabled(),true);
  await checkpoint();
 }catch(e){await page.screenshot({path:`${out}/failure.png`,fullPage:true});throw e;}
 await page.close();
}
assert.deepEqual(errors,[]);writeFileSync(`${out}/checks.json`,JSON.stringify({success:true,hosted,checks,errors},null,2));console.log(JSON.stringify({success:true,hosted,checks,errors}));
}finally{await browser.close();}
