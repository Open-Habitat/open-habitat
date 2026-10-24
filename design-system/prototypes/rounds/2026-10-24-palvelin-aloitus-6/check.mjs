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
const round='2026-10-24-palvelin-aloitus-6',names=['Yksi lista','Kaksi listaa','Henkilö auki'];
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
 const variant=d=>f.locator(`.users.variant-${d}`).waitFor();
 await key('3');await variant(2);
 await key('ArrowRight');await variant(0);
 await key('2');await variant(1);
 assert.equal(await f.locator('.proto-picker-item[data-active]').innerText(),names[1].replaceAll(' ',' '));
 assert.equal(await f.locator('body').evaluate(()=>new URL(location.href).searchParams.get('v')),'2');
 await id('login-input').fill('lauri-k');await id('login-add').click();
 await id('person-lauri-k').waitFor();
 await key('r');await variant(1);
 assert.equal(await f.getByTestId('person-lauri-k').count(),0,'R remounts the fixture');
 await id('login-input').focus();await page.keyboard.press('3');
 assert.equal(await f.locator('.variant-1').count(),1,'a text field must ignore direction keys');
 assert.equal(await id('login-input').inputValue(),'3');
 if(hosted){await f.locator('body').evaluate(()=>{document.body.dataset.old='1';location.reload();});await f.locator('body:not([data-old])').waitFor();}else await page.reload();
 await variant(1);await f.locator('nav.proto-picker[data-ready]').waitFor();
 await f.locator('#theme').selectOption(theme);
 if(width===390)await f.locator('#phone').check();
 await key('1');await variant(0);
 assert.equal(await f.locator('#theme').inputValue(),theme);

 const checkpoint=async()=>{assert.equal(await f.locator('.review').evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'document overflow');for(const el of await f.locator('.s-main button:visible,.s-main input:visible,.pm button:visible,.pm input:visible,.rp-dialog button:visible,.rp-dialog textarea:visible').all()){if(await el.evaluate(e=>!!e.closest('.dev-desktop')))continue;const b=await el.boundingBox();if(b)assert.ok(b.x>=-1&&b.x+b.width<=width+1,`control overflow ${JSON.stringify(b)}`);}checks++;};
 const capture=async(name,full=true)=>{
  if(hosted)return;
  const base=`${out}/r6-${name}-${width}-${theme}`;
  await page.screenshot({path:`${base}.png`,fullPage:full});
  const html=await page.evaluate(()=>{
   const copy=document.documentElement.cloneNode(true);
   copy.querySelectorAll('script').forEach(e=>e.remove());
   copy.querySelectorAll('style').forEach(e=>e.textContent=e.textContent.replace(/@font-face\s*\{[^}]*\}/g,''));
   document.querySelectorAll('input,textarea').forEach((e,i)=>{const n=copy.querySelectorAll('input,textarea')[i];if(e.tagName==='TEXTAREA')n.textContent=e.value;else n.setAttribute('value',e.value);if(e.checked)n.setAttribute('checked','');else n.removeAttribute('checked');});
   return '<!doctype html>'+copy.outerHTML;
  });writeFileSync(`${base}.html`,html);
 };
 const tap=async l=>{await l.evaluate(e=>e.scrollIntoView({block:'center'}));await l.click();};
 const person=l=>f.getByTestId(`person-${l}`);
 const state=l=>f.getByTestId(`person-state-${l}`).first();
 const kind=()=>id('login-check').getAttribute('data-kind');
 const typed=async(v,k,re)=>{await id('login-input').fill(v);assert.equal(await kind(),k,v);if(re)assert.match(await id('login-check').innerText(),re);};
 // Direction 3 shows actions in the opened person; the others on the row.
 const act=async(d,login,testid)=>{if(d===2)await tap(id(`open-${login}`));await tap(d===2?f.getByTestId('detail').getByTestId(testid):person(login).getByTestId(testid));};
 const back=async d=>{if(d===2&&width===390&&await f.getByTestId('detail-back').count())await tap(id('detail-back'));};
 for(let d=0;d<3;d++)try{
  await f.locator('.proto-picker-item:not(.proto-picker-replay)').nth(d).click();
  await variant(d);process.stderr.write(`case ${width} ${theme} ${d}\n`);
  // The browser asks; the server confirms.
  assert.match(await id('authority').innerText(),/Palvelin tekee pääsymuutokset/);
  for(const l of ['kaisa-admin','maija-esim','teppo-esim','aino-demo','northstar-ops','ville-vanha'])await person(l).waitFor();
  assert.equal(await person('northstar-ops').getAttribute('data-state'),'allowed');
  assert.equal(await state('northstar-ops').innerText(),'Ei vielä kirjautunut');
  if(d<2)assert.match(await id('outcome-teppo-esim').innerText(),/2\/3 oletusrepoa haettu · ei pääsyä: northstar-demo\/infra/);
  if(d===1){for(const s of ['allowed','joined','removed'])await id(`section-${s}`).waitFor();
   assert.equal(await f.getByTestId('people-allowed').getByTestId('person-northstar-ops').count(),1);}
  await checkpoint();await capture(`users-${d+1}`);
  // Adding: validation, duplicates, a joined person, an organisation, a pasted profile URL.
  if(d<2){
   await typed('-bad-','invalid',/yksittäisiä yhdysmerkkejä/);
   assert.equal(await id('login-add').isDisabled(),true);
   await typed('MAIJA-esim','dup',/on jo käyttäjä \(Unix: maija\)/);
   await typed('@northstar-ops','dup',/on jo sallittu/);
   await typed('northstar-demo','org',/organisaatio/);
   await typed('nobody-here','not-found',/ei löydy/);
   await typed('ville-vanha','restore',/Unix-tililleen ville/);
   assert.equal(await id('login-add').innerText(),'Palauta pääsy');
   await typed('https://github.com/lauri-k','ok',/Lauri Koskinen/);
   assert.match(await id('login-check').innerText(),/GitHub-id 51234006/);
   await checkpoint();await capture(`add-${d+1}`,false);
   await tap(id('login-add'));
  }else{
   await tap(id('add-open'));
   await f.getByTestId('add-lines').fill('lauri-k\n@sanna-s, MAIJA-esim\nlauri-k\n-bad-\nnorthstar-demo');
   const kinds=await f.getByTestId('add-results').locator('li').evaluateAll(n=>n.map(x=>x.dataset.kind));
   assert.deepEqual(kinds,['ok','ok','dup','dup','invalid','org']);
   assert.equal(await id('add-submit').innerText(),'Salli 2 tunnusta');
   await checkpoint();await capture(`add-${d+1}`,false);
   await tap(id('add-submit'));
  }
  // Not in force until the server confirms.
  await person('lauri-k').waitFor();
  assert.match(await state('lauri-k').innerText(),/odottaa palvelinta/);
  await state('lauri-k').filter({hasText:'Ei vielä kirjautunut'}).waitFor({state:'attached',timeout:5000});
  if(d===2)assert.equal(await person('sanna-s').count(),1);
  // The administrator's own access is the server's configuration.
  if(d===2)await tap(id('open-kaisa-admin'));
  assert.equal(await f.getByTestId('remove-kaisa-admin').count(),0,'admin access is not removable here');
  await back(d);
  // Removing a person who never signed in: nothing else to undo.
  await act(d,'northstar-ops','remove-northstar-ops');
  assert.match(await id('remove-dialog').innerText(),/Unix-käyttäjää ei ole luotu/);
  await tap(id('confirm-remove'));
  assert.match(await state('northstar-ops').innerText(),/Poistetaan · odottaa palvelinta/);
  await person('northstar-ops').waitFor({state:'detached',timeout:5000});
  await back(d);
  // Removing a joined person: the browser ends access; the Unix account stays for the CLI.
  await act(d,'teppo-esim','remove-teppo-esim');
  const consequences=await id('remove-consequences').innerText();
  assert.match(consequences,/ei voi enää kirjautua/);assert.match(consequences,/Unix-käyttäjä teppo, kotihakemisto/);assert.match(consequences,/komentorivillä/);
  await checkpoint();await capture(`remove-${d+1}`,false);
  await tap(id('confirm-remove'));
  await f.locator('[data-testid=person-teppo-esim][data-state=removed]').waitFor({state:'attached',timeout:5000});
  if(d<2)assert.match(await id('outcome-teppo-esim').innerText(),/Unix-tili teppo ja sen tiedostot ovat yhä palvelimella/);
  else{assert.match(await id('detail').innerText(),/Pääsy poistettu/);assert.match(await id('detail-cli').innerText(),/komentorivillä/);}
  if(d===1)assert.equal(await f.getByTestId('people-removed').getByTestId('person-teppo-esim').count(),1);
  await checkpoint();await capture(`removed-${d+1}`);
  await back(d);
  // Restoring returns the same Unix account.
  await act(d,'ville-vanha','restore-ville-vanha');
  await f.locator('[data-testid=person-ville-vanha][data-state=joined]').waitFor({state:'attached',timeout:5000});
  await back(d);
  if(d===0){
   await tap(id('filter').getByText(/^Poistetut/));
   assert.deepEqual(await f.getByTestId('people').locator('li[data-testid^=person-]').evaluateAll(n=>n.map(x=>x.dataset.testid)),['person-teppo-esim']);
   await tap(id('filter').getByText('Kaikki'));
  }
  if(d===2&&width===390){await tap(id('open-maija-esim'));assert.equal(await f.getByTestId('people').isVisible(),false,'phone: the opened person replaces the list');await checkpoint();await capture('detail-3',false);await tap(id('detail-back'));assert.equal(await f.getByTestId('people').isVisible(),true);}
  await checkpoint();
 }catch(e){await page.screenshot({path:`${out}/failure.png`,fullPage:true});throw e;}

 // Carry-over from round 5: automatic checkout keeps the fetched defaults in
 // the chooser as locked forced selections.
 try{
  await f.locator('.proto-picker-item:not(.proto-picker-replay)').nth(0).click();await variant(0);
  await tap(id(width===390?'mtab-onboarding':'tab-onboarding'));
  assert.equal(await id('step-repos-hint').innerText(),'3 haetaan automaattisesti');
  await tap(id('pv-open'));await f.locator('.pm').waitFor();
  const pv=()=>f.getByTestId('person-view');
  const box=n=>pv().getByTestId(`repository-${n}`);
  const locked=()=>pv().locator('[data-testid^=repository-locked-]:not([data-testid=repository-locked-status])').evaluateAll(n=>n.map(x=>x.dataset.testid.slice(18)));
  assert.deepEqual(await locked(),['northstar-demo/product','northstar-demo/design-system','northstar-demo/infra']);
  for(const n of ['northstar-demo/product','northstar-demo/design-system','northstar-demo/infra']){assert.equal(await box(n).isChecked(),true,n);assert.equal(await box(n).isDisabled(),true,n);}
  assert.deepEqual(await pv().getByTestId('repository-locked-status').allInnerTexts(),['Sivusto hakee · 42 %','Sivusto hakee · jonossa','Sivusto hakee · jonossa']);
  assert.equal(await pv().getByTestId('repository-selection').innerText(),'Valittu 0 repoa. Sivusto hakee lisäksi 3.');
  assert.equal(await pv().getByTestId('repository-proceed').innerText(),'Jatka');
  assert.equal(await pv().getByTestId('route-note-repositories').innerText(),'Nyt · 3 haussa');
  await checkpoint();await capture('locked-1',false);
  // The search never hides a forced selection; select-all leaves them alone.
  await pv().getByTestId('repository-search').fill('docs');
  assert.equal((await locked()).length,3);
  await tap(pv().getByTestId('repository-toggle-visible'));
  assert.equal(await box('northstar-demo/docs').isChecked(),true);
  assert.equal(await pv().getByTestId('repository-proceed').innerText(),'Hae 1 repo lisää ja jatka');
  await checkpoint();await capture('locked-more-1',false);
  // A default the person cannot read is not a locked row either.
  await tap(f.getByTestId('persona').getByText('Ei pääsyä: infra'));
  assert.deepEqual(await locked(),['northstar-demo/product','northstar-demo/design-system']);
  assert.equal(await pv().getByText('infra').count(),0,'no trace of the unreadable default');
  await tap(box('northstar-demo/mobile-app'));
  await tap(pv().getByTestId('repository-proceed'));
  assert.equal(await pv().getByTestId('route-note-repositories').innerText(),'Haetaan 3 repoa');
  // Pre-selection is unchanged: ordinary checked rows the person can uncheck.
  await tap(f.locator('.pm-drawer').getByTestId('repo-mode').getByText('Esivalitse',{exact:true}));
  assert.equal((await locked()).length,0);
  assert.equal(await box('northstar-demo/product').isDisabled(),false);
  assert.equal(await pv().getByTestId('repository-proceed').innerText(),'Hae 2 repoa taustalla ja jatka');
  await tap(id('pv-close'));await f.locator('.pm').waitFor({state:'detached'});
  await tap(id('discard'));
  assert.equal(await id('step-repos-hint').innerText(),'3 haetaan automaattisesti');
  await checkpoint();
 }catch(e){await page.screenshot({path:`${out}/failure.png`,fullPage:true});throw e;}
 await page.close();
}
assert.deepEqual(errors,[]);writeFileSync(`${out}/checks.json`,JSON.stringify({success:true,hosted,checks,errors},null,2));console.log(JSON.stringify({success:true,hosted,checks,errors}));
}finally{await browser.close();}
