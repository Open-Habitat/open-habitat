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
const round='2026-10-23-palvelin-aloitus-3',names=['Avain erikseen','Kolme tapaa','Muut listana'];
const [input,out]=process.argv.slice(2),hosted=input.startsWith('https:');
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});let checks=0;const errors=[];
try{
for(const width of [1440,390])for(const theme of ['light','dark']){
 const page=await browser.newPage({viewport:{width,height:1100},reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 if(hosted)await page.goto(input);else{await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));await page.goto('http://prototype.test/');}
 const f=hosted?page.frameLocator('iframe').first():page;
 const id=x=>f.getByTestId(x);
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
 assert.equal(await id('step-ai-hint').innerText(),'Oletus: ChatGPT / OpenAI','R remounts the fixture');
 await id('ai-claude').locator('input').focus();await page.keyboard.press('3');
 assert.equal(await f.locator('.variant-1').count(),1,'radio must ignore direction keys');
 if(hosted)await f.locator('body').evaluate(()=>location.reload());else await page.reload();
 await variant(1);
 await f.locator('#theme').selectOption(theme);
 if(width===390)await f.locator('#phone').check();
 await key('1');await variant(0);
 assert.equal(await f.locator('#theme').inputValue(),theme);
 if(hosted)await page.screenshot({path:`${out}/picker-${width}-${theme}.png`});

 const checkpoint=async()=>{assert.equal(await f.locator('.review').evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'document overflow');for(const el of await f.locator('button:visible,input:visible,select:visible').all()){const b=await el.boundingBox();if(b)assert.ok(b.x>=-1&&b.x+b.width<=width+1,`control overflow ${JSON.stringify(b)}`);}checks++;};
 const capture=async name=>{
  if(hosted)return;
  const base=`${out}/${name}-${width}-${theme}`;
  await page.screenshot({path:`${base}.png`,fullPage:true});
  const html=await page.evaluate(()=>{
   const copy=document.documentElement.cloneNode(true);
   copy.querySelectorAll('script').forEach(e=>e.remove());
   // Remove embedded fonts only to avoid duplicating binaries in every snapshot.
   copy.querySelectorAll('style').forEach(e=>e.textContent=e.textContent.replace(/@font-face\s*\{[^}]*\}/g,''));
   document.querySelectorAll('input').forEach((e,i)=>{const n=copy.querySelectorAll('input')[i];n.setAttribute('value',e.type==='password'?'':e.value);if(e.checked)n.setAttribute('checked','');else n.removeAttribute('checked');});
   document.querySelectorAll('select').forEach((e,i)=>{const n=copy.querySelectorAll('select')[i];[...n.options].forEach(o=>o.toggleAttribute('selected',o.value===e.value));});
   return '<!doctype html>'+copy.outerHTML;
  });writeFileSync(`${base}.html`,html);
 };
 const at=async()=>id('person-view').getAttribute('data-at');
 const routeIds=async()=>(await f.locator('[data-testid=person-view] [data-testid^=onboarding-step-]').evaluateAll(n=>n.map(x=>x.dataset.testid.slice(16))));
 const pickDefault=async(d,o)=>{if(d>0&&!(await id(`ai-${o}`).count()))await id('segment-default').click();await id(`ai-${o}`).click();};
 for(let d=0;d<3;d++)try{
  await f.locator('.proto-picker-item:not(.proto-picker-replay)').nth(d).click();
  await variant(d);process.stderr.write(`case ${width} ${theme} ${d}\n`);
  // Default ChatGPT / OpenAI: only that sign-in, the others behind the link.
  assert.deepEqual(await routeIds(),['github','repositories','google','ai']);
  assert.equal(await id('flow-openai').count(),1);
  assert.equal(await id('segment-claude-bridge').count(),0,'a default offers only that option');
  assert.equal(await id('pv-others').count(),0);
  assert.equal(await id('pv-other').getAttribute('aria-expanded'),'false');
  await id('pi-attempt-start').click();await id('pv-ai-simulate').click();
  await f.getByTestId('pi-sign-in-card').waitFor();
  await id('pv-other').click();await id('pv-others').waitFor();
  if(d===2){
   assert.equal(await id('pv-others').locator('li').count(),4);
   await id('pv-pick-claude').click();await f.locator('[data-testid=claude-login-state]').waitFor();
   assert.equal(await id('flow-openai').count(),0);
   await id('pv-back-offer').click();assert.equal(await id('flow-openai').count(),1);
   await id('pv-other').click();
  }else{
   await f.locator('[data-testid=pv-others] [data-testid=claude-login-state]').waitFor();
   await id('pv-api-keys').locator('summary').click();
   assert.equal(await id('pv-api-keys').locator('.s-row').count(),3,'OpenAI, Anthropic and DeepSeek keys');
  }
  await checkpoint();await capture(`offer-${d+1}`);
  // Claude as the default.
  await pickDefault(d,'claude');
  assert.equal(await id('step-ai-hint').innerText(),'Oletus: Claude-tilaus');
  await f.locator('[data-testid=person-view] [data-testid=claude-login-state]').first().waitFor();
  assert.equal(await id('flow-openai').count(),0);
  // A key provider the product does not store yet, shown as the same row.
  await pickDefault(d,'deepseek-key');
  await id('flow-deepseek-key').waitFor();
  await id('key-add-deepseek').click();await id('key-input-deepseek').fill('sk-0123456789abcdef0123456789abcdef');
  await id('flow-deepseek-key').getByRole('button',{name:'Tallenna avain',exact:true}).click();
  assert.match(await id('key-row-deepseek').innerText(),/sk-…cdef/);
  await checkpoint();
  // No default: every option, as production now does.
  if(d===0)await id('ai-all').click();else await id('segment-all').click();
  assert.equal(await id('step-ai-hint').innerText(),'Henkilö valitsee');
  assert.equal(await id('segment-claude-bridge').count(),1);assert.equal(await id('pv-other').count(),0);
  if(d===0)await capture('all-1');
  assert.equal(await id('save').isDisabled(),false);await id('discard').click();
  assert.equal(await id('step-ai-hint').innerText(),'Oletus: ChatGPT / OpenAI');
  // The administrator provides a key: the AI step leaves the route.
  if(d===0)await id('site-key-add').click();else{await id('segment-key').click();}
  await id('site-key-input').fill('sk-ant-short');
  assert.match(await id('site-key-error').innerText(),/OpenAI-avaimelta/);
  assert.equal(await id('site-key-save').isDisabled(),true);
  await id('site-key-provider').selectOption('anthropic');
  await id('site-key-input').fill('sk-ant-api03-prototype0000000000abcd');
  await id('site-key-save').click();
  assert.equal(await at(),'google');
  assert.deepEqual(await routeIds(),['github','repositories','google']);
  assert.equal(await id('pv-last').count(),1);
  assert.match(await id('step-ai-hint').innerText(),/Ohitetaan · sivuston Anthropic-avain/);
  assert.equal(await id('site-key-suffix').innerText(),'sk-ant-…abcd');
  assert.equal(await f.locator('[data-testid=site-key-input]').count(),0,'the key is not kept in a field');
  if(d===0)assert.equal(await id('offer-overridden').count(),1);
  await checkpoint();await capture(`key-${d+1}`);
  // Replace.
  await id('site-key-replace').click();await id('site-key-provider').selectOption('deepseek');
  await id('site-key-input').fill('sk-fedcba9876543210fedcba98765432wxyz');await id('site-key-save').click();
  assert.equal(await id('site-key-suffix').innerText(),'sk-…wxyz');
  assert.match(await id('step-ai-hint').innerText(),/DeepSeek/);
  // Remove, with confirmation; the step comes back with the default.
  if(d===0){await id('site-key-remove-open').click();await id('site-key-remove-confirm').click();}
  else{await id('segment-default').click();await id('leave-key-confirm').click();}
  await id('site-key-suffix').waitFor({state:'detached'});
  assert.equal(await at(),'ai');
  assert.deepEqual(await routeIds(),['github','repositories','google','ai']);
  assert.equal(await id('step-ai-hint').innerText(),'Oletus: ChatGPT / OpenAI');
  if(d>0){
   // Choosing the key way and cancelling leaves the step as it was.
   await id('segment-key').click();await id('site-key-cancel').click();
   assert.equal(await id('ai-openai').count(),1);assert.equal(await at(),'ai');
  }
  await pickDefault(d,'claude');await id('save').click();
  assert.match(await f.getByRole('status').first().innerText(),/Oikea palvelin ei muuttunut/);
  assert.equal(await id('save').isDisabled(),true);
  await checkpoint();
 }catch(e){await page.screenshot({path:`${out}/failure.png`,fullPage:true});throw e;}
 await page.close();
}
assert.deepEqual(errors,[]);writeFileSync(`${out}/checks.json`,JSON.stringify({success:true,hosted,checks,errors},null,2));console.log(JSON.stringify({success:true,hosted,checks,errors}));
}finally{await browser.close();}
