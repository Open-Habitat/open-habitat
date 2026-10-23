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
const round='2026-10-23-palvelin-aloitus-2',names=['Kartta vieressä','Lista reittinä','Erillinen kokeilu'];
const [input,out]=process.argv.slice(2),hosted=input.startsWith('https:');
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});let checks=0;const errors=[];
try{
for(const width of [1440,390])for(const theme of ['light','dark']){
 const page=await browser.newPage({viewport:{width,height:1100},reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 if(hosted)await page.goto(input);else{await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));await page.goto('http://prototype.test/');}
 const f=hosted?page.frameLocator('iframe').first():page;
 const id=x=>f.getByTestId(x),btn=name=>f.getByRole('button',{name,exact:true});
 await f.locator('#theme').selectOption(theme);
 await checkPicker(f,round);
 // Picker contract: digits, arrows and R switch; form fields keep their keys.
 const key=async value=>{await f.locator('.axis').click();await page.keyboard.press(value);};
 await key('3');await f.locator('.direction-2').waitFor();
 await key('ArrowRight');await f.locator('.direction-0').waitFor();
 await key('2');await f.locator('.direction-1').waitFor();
 assert.equal(await f.locator('.proto-picker-item[data-active]').innerText(),names[1].replaceAll(' ',' '));
 assert.equal(await f.locator('body').evaluate(()=>new URL(location.href).searchParams.get('v')),'2');
 await id('repo-mode').selectOption('auto');
 await key('r');await f.locator('.direction-1').waitFor();
 assert.equal(await id('repo-mode').inputValue(),'preselected','R remounts the fixture');
 await id('repo-mode').focus();await page.keyboard.press('3');
 assert.equal(await f.locator('.direction-1').count(),1,'select must ignore direction keys');
 if(hosted)await f.locator('body').evaluate(()=>location.reload());else await page.reload();
 await f.locator('.direction-1').waitFor();
 await f.locator('#theme').selectOption(theme);
 if(width===390)await f.locator('#phone').check();
 await key('1');await f.locator('.direction-0').waitFor();
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
   document.querySelectorAll('input').forEach((e,i)=>{const n=copy.querySelectorAll('input')[i];n.setAttribute('value',e.value);if(e.checked)n.setAttribute('checked','');else n.removeAttribute('checked');});
   document.querySelectorAll('select').forEach((e,i)=>{const n=copy.querySelectorAll('select')[i];[...n.options].forEach(o=>o.toggleAttribute('selected',o.value===e.value));});
   return '<!doctype html>'+copy.outerHTML;
  });writeFileSync(`${base}.html`,html);
 };
 // The person view: inline (d0, d1) or in the trial dialog (d2).
 const person=async d=>{if(d===2&&!await id('person-view').count())await id('open-trial').click();return id('person-view');};
 const closePerson=async d=>{if(d===2){await id('close-trial').click();await id('person-view').waitFor({state:'detached'});}};
 const route=async()=>(await f.locator('.pv-route li strong').allInnerTexts());
 for(let d=0;d<3;d++)try{
  await f.locator('.proto-picker-item:not(.proto-picker-replay)').nth(d).click();
  await f.locator(`.direction-${d}`).waitFor();process.stderr.write(`case ${width} ${theme} ${d}\n`);
  await checkpoint();await capture(`direction-${d+1}`);
  // Repositories: several defaults through the production finder; no stale setting.
  assert.equal(await f.getByText('päivää sitten',{exact:false}).count(),0);
  await id('add-repo').click();
  await f.getByTestId('repository-option-northstar-demo/infra').first().click();
  await id('picker-count').filter({hasText:'3 oletusrepoa'}).waitFor({timeout:5000});
  await f.locator('.rp-dialog [data-testid=repository-search]').fill('northstar-labs/research');
  await f.getByTestId('repository-option-northstar-labs/research').first().click();
  await f.locator('.rp-dialog [data-testid=repository-search]').fill('northstar-demo/nothing');
  assert.equal(await f.locator('[data-testid=repository-lookup]').getAttribute('data-state'),'not_found');
  await checkpoint();if(d===0)await capture('repo-picker');
  await id('picker-done').click();
  assert.equal(await f.locator('[data-testid=default-repos] li').count(),4);
  await id('remove-northstar-demo/infra').click();
  assert.equal(await f.locator('[data-testid=default-repos] li').count(),3);
  if(d===2){await id('open-trial').click();}
  assert.equal(await f.getByTestId('repository-chooser').locator('[data-testid=repository-selection]').getAttribute('data-count'),'3','defaults are preselected for the person');
  await closePerson(d);
  await id('repo-mode').selectOption('auto');
  assert.match(await id('effect').innerText(),/3 repoa haetaan/);
  if(d===2)await id('open-trial').click();
  assert.equal(await f.locator('[data-testid=onboarding-clone]').count(),3);
  await closePerson(d);
  await id('repo-mode').selectOption('skip');
  assert.equal(await id('add-repo').count(),0);
  if(d!==1){await person(d);assert.deepEqual(await route(),['GitHub','Google','AI-tili']);await closePerson(d);}
  else assert.equal(await id('step-repos').locator('small').innerText(),'Ohitettu');
  await id('repo-mode').selectOption('preselected');
  // Integrations: added ones become their own steps, in the fixed order.
  await id(d===1?'step-add-int':'step-integrations').click();
  await id('int-add-dropbox').click();
  if(d===1)await id('step-add-int').click();
  await id('int-add-microsoft').click();
  if(d!==1){await person(d);assert.deepEqual(await route(),['GitHub','Repot','Google','Microsoft 365','Dropbox','AI-tili']);await closePerson(d);}
  else assert.deepEqual(await f.locator('.steplist strong').allInnerTexts(),['GitHub','Repot','Google','Microsoft 365','Dropbox','Lisää integraatio','AI-tili']);
  await f.getByTestId('int-rule-microsoft').getByRole('button',{name:'Pakollinen'}).click();
  if(d===2)await id('open-trial').click();else if(d===0)await id('route-int:microsoft').click();
  assert.equal(await f.locator('[data-testid=person-view]').getAttribute('data-at'),'int:microsoft');
  assert.equal(await id('pv-required').count(),1,'required integration has no skip');
  await id('pv-connect').click();await f.getByTestId('integration-continue').click();
  await id('pv-int-next').click();
  assert.equal(await f.locator('[data-testid=person-view]').getAttribute('data-at'),'int:dropbox');
  await checkpoint();await capture(`integrations-${d+1}`);
  await closePerson(d);
  if(d===1)await id('step-int:dropbox').click();
  await id('int-remove-dropbox').click();
  if(d!==1){await person(d);assert.deepEqual(await route(),['GitHub','Repot','Google','Microsoft 365','AI-tili']);await closePerson(d);}
  // AI account: the administrator picks which production option opens first.
  await id('step-ai').click();
  await id('ai-claude').click();
  if(d===2)await id('open-trial').click();
  assert.equal(await f.getByTestId('segment-claude-bridge').getAttribute('aria-pressed'),'true');
  await f.locator('[data-testid=claude-login-state]').waitFor();
  await closePerson(d);
  await id('ai-api-key').click();
  if(d===2)await id('open-trial').click();
  assert.equal(await id('pv-api-key').evaluate(n=>n.open),true);
  await id('pi-attempt-start').click();await id('pv-ai-simulate').click();
  await f.getByTestId('pi-sign-in-card').waitFor();
  await checkpoint();await capture(`ai-${d+1}`);
  await closePerson(d);
  await id('save').click();
  assert.match(await f.getByRole('status').first().innerText(),/Oikea palvelin ei muuttunut/);
  // Invitations unchanged from round 1; drafts survive a tab switch.
  await id('ai-openai').click();
  await btn('Kutsut ja pääsy (2)').click();
  await id('invite-name').fill('bad@example.test');await id('invite').click();assert.match(await f.getByRole('alert').innerText(),/GitHub-käyttäjänimi/);
  await id('invite-name').fill('sara-demo');await id('invite').click();
  assert.equal(await f.locator('.people li').count(),3);
  await id('invite-name').fill('SARA-DEMO');await id('invite').click();assert.match(await f.getByRole('alert').innerText(),/jo listalla/);
  const sara=f.locator('.people li').filter({hasText:'sara-demo'});
  await sara.getByRole('button',{name:'Peru kutsu',exact:true}).click();await id('confirm-revoke').click();
  assert.equal(await f.locator('.people li').count(),2);
  await checkpoint();if(d===0)await capture('invitations');
  await btn('Käyttöönotto').click();assert.equal(await id('discard').isDisabled(),false);await id('discard').click();
  assert.equal(await id('save').isDisabled(),true);
 }catch(e){await page.screenshot({path:`${out}/failure.png`,fullPage:true});throw e;}
 await page.close();
}
assert.deepEqual(errors,[]);writeFileSync(`${out}/checks.json`,JSON.stringify({success:true,hosted,checks,errors},null,2));console.log(JSON.stringify({success:true,hosted,checks,errors}));
}finally{await browser.close();}
