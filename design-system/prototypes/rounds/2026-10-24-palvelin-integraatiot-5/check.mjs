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
const round='2026-10-24-palvelin-integraatiot-5',names=['Käyttäjävaihe','Sivu kerrallaan'];
const [input,out]=process.argv.slice(2),hosted=input.startsWith('https:');
mkdirSync(out,{recursive:true});
// What dropbox_linux.go requests and registers.
const go=readFileSync(resolve(here,'../../../../internal/daemon/integrations/dropbox_linux.go'),'utf8');
const SCOPES=go.match(/const dropboxScopes = "([^"]+)"/)[1].split(' ');
const REDIRECT=go.match(/const dropboxRedirect = "([^"]+)"/)[1];
assert.equal(SCOPES.length,7,'the daemon still requests the seven scopes this round shows');
assert.ok(go.includes('"code_challenge_method": {"S256"}')&&go.includes('"client_secret": {l.app.ClientSecret}'),'PKCE plus the app secret');
assert.ok(go.includes('"dropbox:"'),'the sync covers the Dropbox root, so the app needs Full Dropbox');
const KEY='p3n8vq1zt6ka0rw',SECRET='h2m5c9xj4ub7ye1';
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
 assert.equal(await f.locator('.proto-picker-item[data-active]').innerText(),names[1].replaceAll(' ',' '));
 assert.equal(await f.locator('body').evaluate(()=>new URL(location.href).searchParams.get('v')),'2');
 await id('setup-dropbox').click();await id('skip').click();
 await id('app-key').fill(KEY);await id('app-secret').fill(SECRET);await id('save').click();
 await f.locator('[data-testid=row-dropbox][data-status=ready]').waitFor();
 await key('r');await variant(1);
 assert.equal(await f.locator('[data-testid=row-dropbox]').first().getAttribute('data-status'),'needs_app','R remounts the fixture');
 if(hosted){await f.locator('body').evaluate(()=>{document.body.dataset.old='1';location.reload();});await f.locator('body:not([data-old])').waitFor();}else await page.reload();
 await variant(1);await f.locator('nav.proto-picker[data-ready]').waitFor();
 await f.locator('#theme').selectOption(theme);
 if(width===390)await f.locator('#phone').check();
 await key('1');await variant(0);

 const checkpoint=async()=>{assert.equal(await f.locator('.review').evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'document overflow');for(const el of await f.locator('.s-main button:visible,.ah-dialog button:visible,.ah-dialog a:visible,.ah-popover [role=menuitem]:visible').all()){const b=await el.boundingBox();if(b)assert.ok(b.x>=-1&&b.x+b.width<=width+1,`control overflow ${JSON.stringify(b)}`);}checks++;};
 const capture=async(name,full=true)=>{
  if(hosted)return;
  const base=`${out}/r5-${name}-${width}-${theme}`;
  await page.screenshot({path:`${base}.png`,fullPage:full});
  const html=await page.evaluate(()=>{const copy=document.documentElement.cloneNode(true);copy.querySelectorAll('script').forEach(e=>e.remove());copy.querySelectorAll('style').forEach(e=>e.textContent=e.textContent.replace(/@font-face\s*\{[^}]*\}/g,''));return '<!doctype html>'+copy.outerHTML;});
  writeFileSync(`${base}.html`,html);
 };
 const status=async p=>f.locator(`[data-testid=row-${p}]`).first().getAttribute('data-status');
 const server=async label=>{await id('server').getByRole('button',{name:label,exact:true}).click();};
 const guide=()=>id('guide');
 const walk=async()=>{const seen=[];for(;;){seen.push((await id('stepname').innerText()).replace(/\s+/g,' '));
  const step=await guide().locator('[data-testid^=step-]').getAttribute('data-testid');
  if(step==='step-create'){assert.equal(await id('console-link').getAttribute('href'),'https://www.dropbox.com/developers/apps/create');assert.equal(await id('console-link').getAttribute('target'),'_blank');assert.match(await id('api').innerText(),/Choose an API[\s\S]*Scoped access/);assert.match(await id('access').innerText(),/Full Dropbox/);assert.match(await id('full-why').innerText(),/App folder ei riitä/);assert.match(await guide().innerText(),/sanaa Dropbox[\s\S]*Create app/);assert.match(await id('role').innerText(),/organisaation Dropbox-tiliä/);}
  if(step==='step-redirect'||step==='step-settings'){assert.equal((await id('redirect').locator('code').innerText()),REDIRECT);assert.match(await guide().innerText(),/Settings › OAuth 2 › Redirect URIs[\s\S]*Add/);}
  if(step==='step-settings'||step==='step-users'){assert.match(await id('enable-users').innerText(),/Development users › Enable additional users/);assert.match(await id('owner-only').innerText(),/vain sovelluksen omistaja/);}
  if(step==='step-users'){assert.match(await id('limit').innerText(),/500[\s\S]*50[\s\S]*kahden viikon/);}
  if(step==='step-permissions'){assert.deepEqual((await id('permissions').locator('pre').innerText()).split('\n'),SCOPES);assert.match(await id('find').innerText(),/Ctrl\+F[\s\S]*Submit/);}
  if(step==='step-enter'){assert.match(await guide().innerText(),/App key ja App secret/);assert.equal(await id('app-secret').getAttribute('type'),'password');}
  if(await f.getByTestId('next').count()===0)break;
  await id('next').click();}
  return seen;};
 const malformed=async()=>{
  await id('app-key').fill('');await id('app-secret').fill('salainen avain');await id('save').click();
  assert.match(await guide().innerText(),/Tarkista App key[\s\S]*Tarkista App secret/);
  await id('app-key').fill(KEY);await id('app-secret').fill(KEY);await id('save').click();
  assert.match(await guide().innerText(),/sama kuin App key/,'pasting the key twice is caught');
  assert.equal(await status('dropbox'),'needs_app','nothing is sent until both values are well formed');
  await id('app-key').fill(` ${KEY} `);await id('app-secret').fill(SECRET);
  assert.doesNotMatch(await guide().innerText(),/Tarkista|sama kuin App key/,'a corrected field drops its error');
 };
 const saved=async()=>{
  assert.equal(await status('dropbox'),'saving');
  assert.match(await id('save').innerText(),/Odottaa palvelinta/);assert.equal(await id('save').isDisabled(),true);
  await f.locator('[data-testid=row-dropbox][data-status=ready]').waitFor();
  await f.getByTestId('guide').waitFor({state:'detached'});
  assert.match(await id('notice').innerText(),/Dropbox: tunnukset tallennettu/);
  assert.equal(await id('onb-dropbox').getAttribute('data-hidden'),null);
 };
 const menu=async(expect,note)=>{
  await id('menu-wrap-dropbox').getByRole('button').click();await f.getByTestId('menu-remove').waitFor();
  assert.match(await f.locator('.ah-popover').innerText(),new RegExp(`Dropbox App Console · app key ${expect}…`));
  assert.equal(await f.getByTestId('menu-replace').count(),0,'no self-service secret renewal: removal only');
  assert.equal(await f.getByTestId('limit-note').count(),note?1:0);
 };

 // ---- Direction 1: development users as their own step ----
 await f.locator('[data-testid=ig-rows]').waitFor();
 assert.deepEqual(await f.locator('[data-testid^=row-]').evaluateAll(es=>es.map(e=>e.dataset.testid.slice(4))),['google','microsoft','imap','caldav','carddav','dropbox'],'catalog order');
 assert.equal(await status('dropbox'),'needs_app');
 assert.equal(await id('onb-dropbox').getAttribute('data-hidden'),'true');
 await id('setup-dropbox').click();
 assert.equal(await guide().getAttribute('data-direction'),'users-step');
 await checkpoint();await capture('create-1',false);
 const seen1=await walk();
 assert.deepEqual(seen1,['1/5 Luo sovellus','2/5 Uudelleenohjaus','3/5 Käyttöoikeudet','4/5 Käyttäjät','5/5 Tunnukset']);
 await checkpoint();if(theme==='light')await capture('enter-1',false);
 await id('back').click();
 await checkpoint();await capture('users-1',false);
 await id('back').click();
 await checkpoint();if(width===1440)await capture('permissions-1',false);
 await id('next').click();await id('next').click();
 await malformed();await id('save').click();await saved();
 await menu('p3n8',false);
 await checkpoint();if(theme==='light'&&width===1440)await capture('menu-1',false);
 await f.getByTestId('menu-remove').click();
 assert.match(await id('act-dialog').innerText(),/Uusia tilejä ei voi yhdistää[\s\S]*synkronointi pysähtyy[\s\S]*Toisen sovelluksen voi asettaa poiston jälkeen/);
 await checkpoint();if(width===390&&theme==='light')await capture('remove-1',false);
 await id('confirm-remove').click();await f.locator('[data-testid=row-dropbox][data-status=needs_app]').waitFor();
 await id('setup-dropbox').click();await id('skip').click();
 assert.match(await id('stepname').innerText(),/1\/1 Tunnukset/);
 await id('back').click();assert.match(await id('stepname').innerText(),/1\/5 Luo sovellus/);
 await page.keyboard.press('Escape');await f.getByTestId('guide').waitFor({state:'detached'});
 await server('Kaikki asetettu');assert.equal(await status('dropbox'),'ready');await menu('k7q2',false);await page.keyboard.press('Escape');
 await server('Vajaa asennus');for(const p of ['google','microsoft','dropbox'])assert.equal(await status(p),'tool_missing');
 await id('tool-dropbox').click();assert.match(await id('act-dialog').innerText(),/rclone puuttuu[\s\S]*host apply/);
 await checkpoint();if(theme==='dark'&&width===1440)await capture('partial-1');
 await page.keyboard.press('Escape');

 // ---- Direction 2: one console page per step, the 50-user rule in the menu ----
 await key('2');await variant(1);await server('Microsoft asetettu');
 await id('setup-dropbox').click();
 assert.equal(await guide().getAttribute('data-direction'),'per-page');
 await id('next').click();
 await checkpoint();await capture('settings-2',false);
 await id('back').click();
 const seen2=await walk();
 assert.deepEqual(seen2,['1/4 Luo sovellus','2/4 Asetukset','3/4 Käyttöoikeudet','4/4 Tunnukset']);
 assert.equal(await f.getByTestId('limit').count(),0,'no limits step in direction 2');
 await malformed();
 await checkpoint();if(theme==='dark')await capture('enter-2',false);
 await id('save').click();await saved();
 await checkpoint();if(theme==='dark')await capture('saved-2');
 await menu('p3n8',true);
 await checkpoint();await capture('menu-2',false);
 await f.getByTestId('menu-remove').click();await id('confirm-remove').click();
 await f.locator('[data-testid=row-dropbox][data-status=needs_app]').waitFor();
 await id('setup-dropbox').click();await id('skip').click();
 assert.match(await id('stepname').innerText(),/1\/1 Tunnukset/);
 await id('app-key').fill(KEY);await id('app-secret').fill(SECRET);await id('save').click();await saved();
 // Google and Microsoft stay rounds 3–4's.
 await id('menu-wrap-google').getByRole('button').click();await f.getByTestId('menu-replace').click();
 assert.match(await id('act-dialog').innerText(),/Kierroksen 3/);await page.keyboard.press('Escape');
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[],'console errors');
writeFileSync(`${out}/${hosted?'r5-hosted-checks':'r5-checks'}.json`,JSON.stringify({round,input:hosted?input:'offline.html',checks,errors},null,1)+'\n');
console.log(`${checks} checkpoints, no console errors`);
