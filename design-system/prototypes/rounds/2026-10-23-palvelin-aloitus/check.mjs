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
const [input,out]=process.argv.slice(2),hosted=input.startsWith('https:');
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});let checks=0;const errors=[];
try{
for(const width of [1440,390])for(const theme of ['light','dark']){
 const page=await browser.newPage({viewport:{width,height:1100}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 if(hosted)await page.goto(input);else{await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));await page.goto('http://prototype.test/');}
 const f=hosted?page.frameLocator('iframe').first():page;
 await f.locator('#theme').selectOption(theme);
 await checkPicker(f,'2026-10-23-palvelin-aloitus');
 const key=async value=>{await f.locator('.axis').click();await page.keyboard.press(value);};
 await key('3');await f.locator('.direction-2').waitFor();
 await key('ArrowRight');await f.locator('.direction-0').waitFor();
 await key('ArrowLeft');await f.locator('.direction-2').waitFor();
 await key('2');await f.locator('.direction-1').waitFor();
 assert.equal(await f.locator('.proto-picker-item[data-active]').innerText(),'Vaihelista');
 assert.equal(await f.locator('body').evaluate(()=>new URL(location.href).searchParams.get('v')),'2');
 await f.getByTestId('step-order').selectOption('google-first');
 await key('r');await f.locator('.direction-1').waitFor();
 assert.equal(await f.getByTestId('step-order').inputValue(),'repos-first');
 await f.getByTestId('step-order').focus();await page.keyboard.press('3');
 assert.equal(await f.locator('.direction-1').count(),1,'select must ignore direction keys');
 await key('Control+3');assert.equal(await f.locator('.direction-1').count(),1);
 // Reload restores the URL selection, then normal switching preserves review controls.
 if(hosted)await f.locator('body').evaluate(()=>location.reload());else await page.reload();
 await f.locator('.direction-1').waitFor();
 await f.locator('#theme').selectOption(theme);
 await f.locator('#phone').check();
 await key('1');await f.locator('.direction-0').waitFor();
 assert.equal(await f.locator('#theme').inputValue(),theme);
 assert.equal(await f.locator('#phone').isChecked(),true);
 await f.locator('#phone').uncheck();
 await checkPicker(f,'2026-10-23-palvelin-aloitus');
 if(hosted)await page.screenshot({path:`${out}/picker-${width}-${theme}.png`});

 const btn=name=>f.getByRole('button',{name,exact:true});
 const checkpoint=async()=>{assert.equal(await f.locator('.review').evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'document overflow');for(const el of await f.locator('button:visible,input:visible,select:visible').all()){const b=await el.boundingBox();assert.ok(b.x>=-1&&b.x+b.width<=width+1,`control overflow ${JSON.stringify(b)}`);}checks++;};
 const capture=async(name)=>{
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
 for(let d=0;d<3;d++){
  await f.locator('.proto-picker-item:not(.proto-picker-replay)').nth(d).click();
  if(d===1)await btn('Repot').click();
  await checkpoint();await capture(`direction-${d+1}`);
  await f.getByTestId('repo-mode').selectOption('auto');
  assert.match(await f.locator('.preview').innerText(),/automaattisesti/);
  await f.getByTestId('repo-mode').selectOption('skip');
  assert.equal(await f.getByTestId('default-repo').count(),0);
  assert.match(await f.locator('.preview').innerText(),/Repoja ei haeta/);
  await f.getByTestId('repo-mode').selectOption('preselected');
  await f.getByTestId('stale-days').fill('21');
  assert.match(await f.locator('.preview').innerText(),/21 päivää/);
  await f.getByTestId('default-repo').fill('not-a-repository');
  assert.equal(await f.getByTestId('save').isDisabled(),true);
  await f.getByTestId('default-repo').fill('northstar-demo/another');
  if(d===1)await btn('Integraatiot').click();
  await f.getByTestId('google-mode').selectOption('required');
  assert.match(await f.locator('.preview').innerText(),/pakollinen, ei ohitusta/);
  await f.getByTestId('google-mode').selectOption('off');
  assert.match(await f.locator('.preview').innerText(),/ei näytetä/);
  await f.getByTestId('google-mode').selectOption('optional');
  await f.getByTestId('step-order').selectOption('google-first');
  assert.match(await f.locator('.preview li').nth(1).innerText(),/Integraatiot/);
  await checkpoint();await f.getByTestId('save').click();
  assert.match(await f.getByRole('status').innerText(),/Oikea palvelin ei muuttunut/);
  // Unpublished edits survive tab switches; invite is a separate operation.
  await f.getByTestId('step-order').selectOption('repos-first');
  await btn('Kutsut ja pääsy (2)').click();
  await f.getByTestId('invite-name').fill('bad@example.test');await f.getByTestId('invite').click();assert.match(await f.getByRole('alert').innerText(),/GitHub-käyttäjänimi/);
  await f.getByTestId('invite-name').fill('sara-demo');await f.getByTestId('invite').click();
  assert.equal(await f.locator('.people li').count(),3);
  assert.match(await f.getByRole('status').innerText(),/viestiä ei lähetetty/);
  await f.getByTestId('invite-name').fill('SARA-DEMO');await f.getByTestId('invite').click();assert.match(await f.getByRole('alert').innerText(),/jo listalla/);
  const sara=f.locator('.people li').filter({hasText:'sara-demo'});
  await sara.getByRole('button',{name:'Peru kutsu',exact:true}).click();
  await btn('Säilytä kutsu').click();assert.equal(await f.locator('.people li').count(),3);
  await sara.getByRole('button',{name:'Peru kutsu',exact:true}).click();await f.getByTestId('confirm-revoke').click();assert.equal(await f.locator('.people li').count(),2);
  assert.equal(await f.locator('.people li').filter({hasText:'leo-demo'}).getByRole('button').count(),0);
  await checkpoint();await capture(`invitations-${d+1}`);
  await btn('Käyttöönotto').click();assert.equal(await f.getByTestId('discard').isDisabled(),false);await f.getByTestId('discard').click();
  // Restore comparable initial fixture before moving to another direction.
  await f.getByTestId('step-order').selectOption('repos-first');
  if(d===1)await btn('Repot').click();
  await f.getByTestId('default-repo').fill('northstar-demo/product');await f.getByTestId('stale-days').fill('14');
  await f.getByTestId('save').click();
 }
 // Actual imported production chooser renders and toggles against invented input.
 await f.getByText('Nykyinen tuotantokomponentti vertailuksi',{exact:true}).click();
 await btn('Näytä repovalitsin').click();
 await f.getByTestId('repository-chooser').waitFor();
 assert.equal(await f.getByTestId('repository-selection').getAttribute('data-count'),'1');
 await f.getByTestId('repository-northstar-demo/product').uncheck();
 assert.equal(await f.getByTestId('repository-selection').getAttribute('data-count'),'0');
 await checkpoint();await capture('production-context');
 // Simulated accepted invitation has no revoke control.
 await btn('Kutsut ja pääsy (2)').click();await f.locator('.people li').filter({hasText:'aino-demo'}).getByRole('button',{name:'Simuloi liittyminen'}).click();
 assert.equal(await f.locator('.people li').filter({hasText:'aino-demo'}).getByRole('button').count(),0);
 await f.locator('#phone').check();await checkpoint();
 await page.close();
}
assert.deepEqual(errors,[]);writeFileSync(`${out}/checks.json`,JSON.stringify({success:true,hosted,checks,errors},null,2));console.log(JSON.stringify({success:true,hosted,checks,errors}));
}finally{await browser.close();}
