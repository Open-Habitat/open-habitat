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
const round='2026-10-23-palvelin-aloitus-5',names=['Tapa ja lista','Repot ensin','Tapa korttina'];
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
 assert.equal(await f.locator('.proto-picker-item[data-active]').innerText(),names[1].replaceAll(' ','\u00a0'));
 assert.equal(await f.locator('body').evaluate(()=>new URL(location.href).searchParams.get('v')),'2');
 await id('mode-skip').locator('input').check();
 await key('r');await variant(1);
 assert.equal(await id('step-repos-hint').innerText(),'3 esivalittuna','R remounts the fixture');
 await id('mode-auto').locator('input').focus();await page.keyboard.press('3');
 assert.equal(await f.locator('.variant-1').count(),1,'radio must ignore direction keys');
 if(hosted){await f.locator('body').evaluate(()=>{document.body.dataset.old='1';location.reload();});await f.locator('body:not([data-old])').waitFor();}else await page.reload();
 await variant(1);await f.locator('nav.proto-picker[data-ready]').waitFor();
 await f.locator('#theme').selectOption(theme);
 if(width===390)await f.locator('#phone').check();
 await key('1');await variant(0);
 assert.equal(await f.locator('#theme').inputValue(),theme);

 const checkpoint=async()=>{assert.equal(await f.locator('.review').evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'document overflow');for(const el of await f.locator('.s-main button:visible,.s-main input:visible,.pm button:visible,.pm input:visible,.rp-dialog button:visible').all()){if(await el.evaluate(e=>!!e.closest('.dev-desktop')))continue;const b=await el.boundingBox();if(b)assert.ok(b.x>=-1&&b.x+b.width<=width+1,`control overflow ${JSON.stringify(b)}`);}checks++;};
 const capture=async(name,full=true)=>{
  if(hosted)return;
  const base=`${out}/${name}-${width}-${theme}`;
  await page.screenshot({path:`${base}.png`,fullPage:full});
  const html=await page.evaluate(()=>{
   const copy=document.documentElement.cloneNode(true);
   copy.querySelectorAll('script').forEach(e=>e.remove());
   copy.querySelectorAll('style').forEach(e=>e.textContent=e.textContent.replace(/@font-face\s*\{[^}]*\}/g,''));
   document.querySelectorAll('input').forEach((e,i)=>{const n=copy.querySelectorAll('input')[i];n.setAttribute('value',e.value);if(e.checked)n.setAttribute('checked','');else n.removeAttribute('checked');});
   return '<!doctype html>'+copy.outerHTML;
  });writeFileSync(`${base}.html`,html);
 };
 const pv=()=>f.getByTestId('person-view');
 const at=()=>pv().getAttribute('data-at');
 const routeIds=async()=>{await pv().locator('[data-testid^=onboarding-step-]').first().waitFor();return pv().locator('[data-testid^=onboarding-step-]').evaluateAll(n=>n.map(x=>x.dataset.testid.slice(16)));};
 const tap=async l=>{await l.evaluate(e=>e.scrollIntoView({block:'center'}));await l.click();};
 const box=n=>pv().getByTestId(`repository-${n}`);
 const setMode=async(d,m)=>{if(d===0)await tap(f.locator('.pm-drawer').getByTestId('repo-mode').getByText({preselected:'Esivalitse',auto:'Hae automaattisesti',skip:'Ohita vaihe'}[m],{exact:true}));else await tap(f.locator('.pm-drawer').getByTestId(`mode-${m}`).locator('input'));};
 // Where the person learns the names of the repositories fetched for them.
 const cueNames=async d=>{
  if(d===0)return pv().getByTestId('route-clone').evaluateAll(n=>n.map(x=>x.title));
  if(d===1)return pv().getByTestId('onboarding-clone').evaluateAll(n=>n.map(x=>x.dataset.name));
  const t=pv().getByTestId('route-clones-toggle');await tap(t);const names=await pv().getByTestId('route-clone').evaluateAll(n=>n.map(x=>x.title));await tap(t);return names;
 };
 for(let d=0;d<3;d++)try{
  await f.locator('.proto-picker-item:not(.proto-picker-replay)').nth(d).click();
  await variant(d);process.stderr.write(`case ${width} ${theme} ${d}\n`);
  // Settled tabs: Käyttöönotto, and access with the users (and the defaults a person missed).
  await tap(id(width===390?'mtab-users':'tab-users'));
  await f.getByTestId('allowed').waitFor();assert.match(await id('user-missing').innerText(),/Ei pääsyä: northstar-demo\/infra/);
  await tap(id(width===390?'mtab-onboarding':'tab-onboarding'));
  // The admin's list: add from the production finder, by exact name too; remove per repo.
  await checkpoint();await capture(`settings-${d+1}`);
  await tap(id('add-repo'));await f.locator('.rp-dialog').waitFor();
  await f.locator('.rp-dialog').getByTestId('repository-search').fill('northstar-labs/research');
  await tap(f.locator('.rp-dialog').getByTestId('repository-option-northstar-labs/research').first());
  await f.getByTestId('picker-count').filter({hasText:'4 oletusrepoa'}).waitFor({timeout:5000});
  await f.locator('.rp-dialog').getByTestId('repository-search').fill('northstar-labs/nothing-here');
  await f.locator('.rp-dialog').getByText(/ei löytynyt|Repoa ei ole|ei ole/i).first().waitFor();
  await checkpoint();await capture(`finder-${d+1}`,false);
  await tap(id('picker-done'));await f.locator('.rp-dialog').waitFor({state:'detached'});
  assert.equal(await f.getByTestId('default-repos').locator('li').count(),4);
  await tap(id('remove-northstar-labs/research'));
  assert.equal(await f.getByTestId('default-repos').locator('li').count(),3);
  assert.equal(await id('step-repos-hint').innerText(),'3 esivalittuna');
  // Preview mode, as settled: the button in the tab head opens the person's view.
  await tap(id('pv-open'));await f.locator('.pm').waitFor();
  // Pre-selected: production chooser, defaults checked; the person goes on with two.
  assert.deepEqual(await routeIds(),['github','repositories','google','ai']);
  assert.equal(await at(),'repositories');
  for(const n of ['northstar-demo/product','northstar-demo/design-system','northstar-demo/infra'])assert.equal(await box(n).isChecked(),true,n);
  assert.equal(await pv().getByTestId('repository-selection').innerText(),'Valittu 3 repoa.');
  await checkpoint();await capture(`pre-${d+1}`,false);
  // A person without access to infra: it is not shown anywhere.
  await tap(f.getByTestId('persona').getByText('Ei pääsyä: infra'));
  assert.equal(await box('northstar-demo/infra').count(),0);
  assert.equal(await pv().getByTestId('repository-selection').innerText(),'Valittu 2 repoa.');
  assert.equal(await pv().getByText('infra').count(),0,'no trace of the unreadable default');
  await tap(box('northstar-demo/design-system'));
  await tap(pv().getByTestId('repository-proceed'));
  assert.equal(await at(),'google');
  assert.equal(await pv().getByTestId('route-note-repositories').innerText(),'Haetaan 1 repo');
  assert.equal(await pv().locator('.rt-bar').count(),1,'progress on the Repot row');
  assert.deepEqual(await cueNames(d),['northstar-demo/product']);
  await tap(pv().getByTestId('pv-skip-google'));
  assert.equal(await at(),'ai');
  assert.equal(await pv().locator('[data-testid=onboarding-card] h1').count(),1,'one step heading');
  assert.equal(await pv().locator('[data-testid=onboarding-card] .rt-bar,[data-testid=onboarding-card] [data-testid=onboarding-clones]').count(),0,'clones stay outside the card');
  await pv().getByTestId('flow-openai').waitFor();
  await checkpoint();await capture(`pre-ai-${d+1}`,false);
  // Automatic: the defaults are already being fetched at the chooser; the person picks more.
  await setMode(d,'auto');
  assert.equal(await at(),'repositories');
  assert.equal(await box('northstar-demo/product').count(),0,'a fetched default is not offered again');
  assert.equal(await pv().getByTestId('repository-selection').innerText(),'Valittu 0 repoa.');
  assert.match(await pv().getByTestId('pv-auto-note').innerText(),/hakee sinulle jo 2 repoa/);
  assert.equal(await pv().getByTestId('route-note-repositories').innerText(),'Nyt · 2 haussa');
  assert.deepEqual((await cueNames(d)).length,2);
  await checkpoint();await capture(`auto-chooser-${d+1}`,false);
  await tap(box('northstar-demo/docs'));
  await tap(pv().getByTestId('repository-proceed'));
  assert.equal(await pv().getByTestId('route-note-repositories').innerText(),'Haetaan 3 repoa');
  await checkpoint();await capture(`auto-${d+1}`,false);
  await tap(f.getByTestId('persona').getByText('Pääsy kaikkiin'));
  assert.match(await pv().getByTestId('pv-auto-note').innerText(),/jo 3 repoa/);
  // Skip with defaults: no repo step; the route says the site fetches them.
  await setMode(d,'skip');
  assert.equal(await at(),'google');
  assert.equal(await pv().getByTestId('onboarding-step-repositories').getAttribute('data-state'),'auto');
  assert.equal(await pv().getByTestId('route-note-repositories').innerText(),'Sivusto hakee 3 repoa');
  assert.equal(await pv().getByTestId('repository-chooser').count(),0);
  assert.equal((await cueNames(d)).length,3);
  assert.equal(await f.locator('.pm-drawer').getByTestId('effect').innerText().then(t=>/Repovaihetta ei näytetä\. 3 oletusrepoa tuodaan/.test(t)),true);
  await checkpoint();await capture(`skip-${d+1}`,false);
  await tap(f.getByTestId('persona').getByText('Ei pääsyä: infra'));
  assert.equal(await pv().getByTestId('route-note-repositories').innerText(),'Sivusto hakee 2 repoa');
  // Device toggle
  await tap(id('pv-device').getByText(width===390?'Tietokone':'Puhelin'));
  assert.equal(await f.getByTestId('device').getAttribute('data-device'),width===390?'desktop':'phone');
  await checkpoint();await capture(`skip-device-${d+1}`,false);
  await tap(id('pv-device').getByText(width===390?'Puhelin':'Tietokone'));
  // Skip without defaults: nothing to say, so the Repot row leaves the route.
  for(const n of ['northstar-demo/product','northstar-demo/design-system','northstar-demo/infra'])await tap(f.locator('.pm-drawer').getByTestId(`remove-${n}`));
  assert.deepEqual(await routeIds(),['github','google','ai']);
  assert.match(await f.locator('.pm-drawer').getByTestId('effect').innerText(),/eikä mitään haeta/);
  await tap(id('pv-close'));await f.locator('.pm').waitFor({state:'detached'});
  assert.equal(await id('step-repos-hint').innerText(),'Ohitetaan');
  await tap(id('discard'));
  assert.equal(await id('step-repos-hint').innerText(),'3 esivalittuna');
  await f.getByTestId('save').waitFor();assert.equal(await id('save').isDisabled(),true);
  if(d===0){await tap(id('repo-mode').getByText('Hae automaattisesti',{exact:true}));}else await tap(id('mode-auto').locator('input'));
  await tap(id('save'));
  assert.match(await f.getByRole('status').first().innerText(),/Oikea palvelin ei muuttunut/);
  assert.equal(await id('save').isDisabled(),true);
  await checkpoint();
 }catch(e){await page.screenshot({path:`${out}/failure.png`,fullPage:true});throw e;}
 await page.close();
}
assert.deepEqual(errors,[]);writeFileSync(`${out}/checks.json`,JSON.stringify({success:true,hosted,checks,errors},null,2));console.log(JSON.stringify({success:true,hosted,checks,errors}));
}finally{await browser.close();}
