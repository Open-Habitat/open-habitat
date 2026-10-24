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
const round='2026-10-24-palvelin-integraatiot-4',names=['Tunnukset lopussa','Tunnukset heti'];
const [input,out]=process.argv.slice(2),hosted=input.startsWith('https:');
mkdirSync(out,{recursive:true});
// What microsoft_linux.go requests (microsoftScopes + microsoftMCPScopes, deduplicated).
const go=readFileSync(resolve(here,'../../../../internal/daemon/integrations/microsoft_linux.go'),'utf8');
const scopes=[...go.matchAll(/const microsoft(?:MCP)?Scopes = "([^"]+)"/g)].flatMap(m=>m[1].split(' '));
const PERMS=[...new Set(scopes)];
assert.equal(PERMS.length,10,'the daemon still requests the ten delegated permissions this round shows');
const NATIVE='https://login.microsoftonline.com/common/oauth2/nativeclient';
assert.ok(go.includes(`"redirect_uri": {"${NATIVE}"}`),'microsoftConsent still names the native redirect');
const CLIENT='5b7e0d3a-91c2-4f68-a4d1-2c9e8f60b7a3',TENANT='e04c61f9-3b8d-4a27-9f5e-7d1a2c48b903';
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});let checks=0;const errors=[];
try{
for(const width of [1440,390])for(const theme of ['light','dark']){
 const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 if(hosted)await page.goto(input);else{await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));await page.goto('http://prototype.test/');}
 const f=hosted?page.frameLocator('iframe').first():page;
 const id=x=>f.getByTestId(x).first();
 await f.locator('#theme').selectOption(theme);
 await checkPicker(f,round);
 const key=async value=>{await f.locator('.axis').click();await page.keyboard.press(value);};
 const variant=d=>f.locator(`.shell.variant-${d}`).waitFor();
 await key('2');await variant(1);
 await key('ArrowRight');await variant(0);
 await key('2');await variant(1);
 assert.equal(await f.locator('.proto-picker-item[data-active]').innerText(),names[1].replaceAll(' ','\u00a0'));
 assert.equal(await f.locator('body').evaluate(()=>new URL(location.href).searchParams.get('v')),'2');
 await id('setup-microsoft').click();await id('skip').click();
 await id('client-id').fill(CLIENT);await id('tenant-id').fill(TENANT);await id('save').click();
 await f.locator('[data-testid=row-microsoft][data-status=ready]').waitFor();
 await key('r');await variant(1);
 assert.equal(await f.locator('[data-testid=row-microsoft]').first().getAttribute('data-status'),'needs_app','R remounts the fixture');
 if(hosted){await f.locator('body').evaluate(()=>{document.body.dataset.old='1';location.reload();});await f.locator('body:not([data-old])').waitFor();}else await page.reload();
 await variant(1);await f.locator('nav.proto-picker[data-ready]').waitFor();
 await f.locator('#theme').selectOption(theme);
 if(width===390)await f.locator('#phone').check();
 await key('1');await variant(0);

 const checkpoint=async()=>{assert.equal(await f.locator('.review').evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'document overflow');for(const el of await f.locator('.s-main button:visible,.ah-dialog button:visible,.ah-popover [role=menuitem]:visible').all()){const b=await el.boundingBox();if(b)assert.ok(b.x>=-1&&b.x+b.width<=width+1,`control overflow ${JSON.stringify(b)}`);}checks++;};
 const capture=async(name,full=true)=>{
  if(hosted)return;
  const base=`${out}/r4-${name}-${width}-${theme}`;
  await page.screenshot({path:`${base}.png`,fullPage:full});
  const html=await page.evaluate(()=>{const copy=document.documentElement.cloneNode(true);copy.querySelectorAll('script').forEach(e=>e.remove());copy.querySelectorAll('style').forEach(e=>e.textContent=e.textContent.replace(/@font-face\s*\{[^}]*\}/g,''));return '<!doctype html>'+copy.outerHTML;});
  writeFileSync(`${base}.html`,html);
 };
 const status=async p=>f.locator(`[data-testid=row-${p}]`).first().getAttribute('data-status');
 const server=async label=>{await id('server').getByRole('button',{name:label,exact:true}).click();};
 const guide=()=>id('guide');
 const walk=async()=>{const seen=[];for(;;){seen.push((await id('stepname').innerText()).replace(/\s+/g,' '));
  const step=await guide().locator('[data-testid^=step-]').getAttribute('data-testid');
  if(step==='step-register'){const t=await guide().innerText();assert.match(t,/Entra ID › App registrations › New registration/);assert.match(await id('account-type').innerText(),/Single tenant only/);assert.match(await id('single-tenant').innerText(),/Henkilökohtaiset Microsoft-tilit eivät/);assert.match(await id('role').innerText(),/Application Developer/);}
  if(step==='step-public'){assert.match(await id('public-flows').innerText(),/Allow public client flows[\s\S]*Enabled/);assert.match(await guide().innerText(),/Authentication › Settings[\s\S]*client secretiä ei luoda/);assert.match(await id('redirect').innerText(),new RegExp(NATIVE.replaceAll('/','\\/')));assert.match(await guide().innerText(),/Mobile and desktop applications/);}
  if(step==='step-permissions'){assert.deepEqual((await id('permissions').locator('pre').innerText()).split('\n'),PERMS);assert.match(await guide().innerText(),/Microsoft Graph › Delegated permissions/);}
  if(step==='step-consent'){assert.match(await guide().innerText(),/Grant admin consent for <organisaatio>/);assert.match(await id('role').innerText(),/Cloud Application Administrator/);}
  if(step==='step-enter'){assert.match(await id('no-secret').innerText(),/Salaisuutta ei tarvita/);assert.equal(await guide().locator('input[type=password]').count(),0,'no secret field');}
  if(await f.getByTestId('next').count()===0)break;
  if(step==='step-enter'){await id('client-id').fill(CLIENT);await id('tenant-id').fill(TENANT);}
  await id('next').click();}
  return seen;};
 const malformed=async()=>{
  await id('client-id').fill('abc');await id('tenant-id').fill('contoso.onmicrosoft.com');
  await id(await f.getByTestId('save').count()?'save':'next').click();
  assert.match(await guide().innerText(),/Tarkista Application \(client\) ID[\s\S]*Tarkista Directory \(tenant\) ID/);
  await id('client-id').fill(CLIENT);await id('tenant-id').fill(CLIENT);
  await id(await f.getByTestId('save').count()?'save':'next').click();
  assert.match(await guide().innerText(),/sama kuin client id/,'pasting the client id twice is caught');
  assert.equal(await status('microsoft'),'needs_app','nothing is sent until both values are well formed');
  await id('client-id').fill(` ${CLIENT} `);await id('tenant-id').fill(TENANT);
  assert.doesNotMatch(await guide().innerText(),/Tarkista|sama kuin client id/,'a corrected field drops its error');
 };
 const saved=async()=>{
  assert.equal(await status('microsoft'),'saving');
  assert.match(await id('save').innerText(),/Odottaa palvelinta/);assert.equal(await id('save').isDisabled(),true);
  await f.locator('[data-testid=row-microsoft][data-status=ready]').waitFor();
  await f.getByTestId('guide').waitFor({state:'detached'});
  assert.match(await id('notice').innerText(),/Microsoft 365: tunnukset tallennettu/);
  assert.equal(await id('onb-microsoft').getAttribute('data-hidden'),null);
 };
 const menu=async expect=>{
  await id('menu-wrap-microsoft').getByRole('button').click();await f.getByTestId('menu-remove').waitFor();
  assert.match(await f.locator('.ah-popover').innerText(),new RegExp(`Microsoft Entra · client id ${expect}-…`));
  assert.equal(await f.getByTestId('menu-replace').count(),0,'no secret to replace: removal only');
 };

 // ---- Direction 1: IDs last ----
 await f.locator('[data-testid=ig-rows]').waitFor();
 assert.deepEqual(await f.locator('[data-testid^=row-]').evaluateAll(es=>es.map(e=>e.dataset.testid.slice(4))),['google','microsoft','imap','caldav','carddav','dropbox'],'catalog order');
 assert.equal(await status('microsoft'),'needs_app');
 assert.equal(await id('onb-microsoft').getAttribute('data-hidden'),'true');
 await id('setup-microsoft').click();
 assert.equal(await guide().getAttribute('data-direction'),'late');
 await checkpoint();await capture('register-1',false);
 const seen1=await walk();
 assert.deepEqual(seen1,['1/5 Rekisteröi sovellus','2/5 Julkinen asiakas','3/5 Käyttöoikeudet','4/5 Hyväksyntä','5/5 Tunnukset']);
 await checkpoint();if(theme==='light')await capture('enter-1',false);
 await id('back').click();
 assert.equal(await id('handoff').getAttribute('data-exact'),null,'without the IDs the hand-off link is a template');
 assert.match(await id('handoff').innerText(),/\{Directory \(tenant\) ID\}\/adminconsent\?client_id=\{Application \(client\) ID\}/);
 await checkpoint();await capture('consent-1',false);
 await id('next').click();
 await malformed();await id('save').click();await saved();
 await menu('5b7e0d3a');
 await checkpoint();if(theme==='light'&&width===1440)await capture('menu-1',false);
 await f.getByTestId('menu-remove').click();
 assert.match(await id('act-dialog').innerText(),/Uusia tilejä ei voi yhdistää[\s\S]*Toisen sovelluksen voi asettaa poiston jälkeen/);
 await checkpoint();if(width===390&&theme==='light')await capture('remove-1',false);
 await id('confirm-remove').click();await f.locator('[data-testid=row-microsoft][data-status=needs_app]').waitFor();
 // Existing app: straight to the fields; back returns to the first step.
 await id('setup-microsoft').click();await id('skip').click();
 assert.match(await id('stepname').innerText(),/1\/1 Tunnukset/);
 await id('back').click();assert.match(await id('stepname').innerText(),/1\/5 Rekisteröi sovellus/);
 await page.keyboard.press('Escape');await f.getByTestId('guide').waitFor({state:'detached'});
 await server('Microsoft asetettu');assert.equal(await status('microsoft'),'ready');await menu('3f2a91c4');await page.keyboard.press('Escape');
 await server('Vajaa asennus');assert.equal(await status('microsoft'),'tool_missing');
 await id('tool-microsoft').click();assert.match(await id('act-dialog').innerText(),/ms-365-mcp-server puuttuu[\s\S]*host apply/);await page.keyboard.press('Escape');

 // ---- Direction 2: IDs right after registration ----
 await key('2');await variant(1);await server('Google asetettu');
 await id('setup-microsoft').click();
 assert.equal(await guide().getAttribute('data-direction'),'early');
 await id('next').click();
 assert.match(await id('stepname').innerText(),/2\/5 Tunnukset/);
 assert.match(await guide().innerText(),/Overview/);
 await malformed();
 await id('back').click();
 assert.equal(await f.getByTestId('client-id').count(),0);await id('next').click();
 assert.equal((await id('client-id').inputValue()).trim(),CLIENT,'values survive going back');
 await checkpoint();await capture('enter-2',false);
 await id('back').click();
 const seen2=await walk();
 assert.deepEqual(seen2,['1/5 Rekisteröi sovellus','2/5 Tunnukset','3/5 Julkinen asiakas','4/5 Käyttöoikeudet','5/5 Hyväksyntä']);
 assert.equal(await id('handoff').getAttribute('data-exact'),'true','the hand-off link is exact');
 assert.match(await id('handoff').innerText(),new RegExp(`login\\.microsoftonline\\.com/${TENANT}/adminconsent\\?client_id=${CLIENT}`));
 await checkpoint();await capture('consent-2',false);
 await id('save').click();await saved();
 await checkpoint();if(theme==='dark')await capture('saved-2');
 await id('menu-wrap-microsoft').getByRole('button').click();await f.getByTestId('menu-remove').click();await id('confirm-remove').click();
 await f.locator('[data-testid=row-microsoft][data-status=needs_app]').waitFor();
 await id('setup-microsoft').click();await id('skip').click();
 assert.match(await id('stepname').innerText(),/1\/1 Tunnukset/);
 await id('client-id').fill(CLIENT);await id('tenant-id').fill(TENANT);await id('save').click();await saved();
 // Google stays round 3's; this round does not reopen it.
 await id('menu-wrap-google').getByRole('button').click();await f.getByTestId('menu-replace').click();
 assert.match(await id('act-dialog').innerText(),/Kierroksen 3/);await page.keyboard.press('Escape');
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[],'console errors');
writeFileSync(`${out}/${hosted?'r4-hosted-checks':'r4-checks'}.json`,JSON.stringify({round,input:hosted?input:'offline.html',checks,errors},null,1)+'\n');
console.log(`${checks} checkpoints, no console errors`);
