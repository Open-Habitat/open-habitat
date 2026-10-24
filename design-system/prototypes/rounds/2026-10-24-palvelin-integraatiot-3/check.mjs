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
const round='2026-10-24-palvelin-integraatiot-3',names=['Tarkistuslista','Vaiheittain','Sivupaneeli'];
const [input,out]=process.argv.slice(2),hosted=input.startsWith('https:');
mkdirSync(out,{recursive:true});
// What google_linux.go requests; the guide must say exactly these.
const SCOPES=['openid','email','https://www.googleapis.com/auth/drive','https://www.googleapis.com/auth/gmail.modify','https://www.googleapis.com/auth/calendar','https://www.googleapis.com/auth/contacts'];
const APIS=['gmail.googleapis.com','calendar-json.googleapis.com','drive.googleapis.com','people.googleapis.com'];
const ID='915508263417-a8d2kq0zr7m3vh1ts9pe5wybc6lfnjxu.apps.googleusercontent.com',SECRET='GOCSPX-synthetic_Value-0123';
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
 await key('3');await variant(2);
 await key('ArrowRight');await variant(0);
 await key('2');await variant(1);
 assert.equal(await f.locator('.proto-picker-item[data-active]').innerText(),names[1].replaceAll(' ',' '));
 assert.equal(await f.locator('body').evaluate(()=>new URL(location.href).searchParams.get('v')),'2');
 await id('setup-google').click();await id('skip').click();
 await id('client-id').fill(ID);await id('client-secret').fill(SECRET);await id('save').click();
 await f.locator('[data-testid=row-google][data-status=ready]').waitFor();
 await key('r');await variant(1);
 assert.equal(await f.locator('[data-testid=row-google]').first().getAttribute('data-status'),'needs_app','R remounts the fixture');
 if(hosted){await f.locator('body').evaluate(()=>{document.body.dataset.old='1';location.reload();});await f.locator('body:not([data-old])').waitFor();}else await page.reload();
 await variant(1);await f.locator('nav.proto-picker[data-ready]').waitFor();
 await f.locator('#theme').selectOption(theme);
 if(width===390)await f.locator('#phone').check();
 await key('1');await variant(0);

 const checkpoint=async()=>{assert.equal(await f.locator('.review').evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'document overflow');for(const el of await f.locator('.s-main button:visible,.ah-dialog button:visible,.ah-popover [role=menuitem]:visible').all()){const b=await el.boundingBox();if(b)assert.ok(b.x>=-1&&b.x+b.width<=width+1,`control overflow ${JSON.stringify(b)}`);}checks++;};
 const capture=async(name,full=true)=>{
  if(hosted)return;
  const base=`${out}/r3-${name}-${width}-${theme}`;
  await page.screenshot({path:`${base}.png`,fullPage:full});
  const html=await page.evaluate(()=>{const copy=document.documentElement.cloneNode(true);copy.querySelectorAll('script').forEach(e=>e.remove());copy.querySelectorAll('style').forEach(e=>e.textContent=e.textContent.replace(/@font-face\s*\{[^}]*\}/g,''));return '<!doctype html>'+copy.outerHTML;});
  writeFileSync(`${base}.html`,html);
 };
 const status=async p=>f.locator(`[data-testid=row-${p}]`).first().getAttribute('data-status');
 const server=async label=>{await id('server').getByRole('button',{name:label,exact:true}).click();};
 const guide=()=>id('guide');
 // The content every direction carries, read from the code.
 const content=async scope=>{
  const t=await scope.innerText();
  for(const a of ['Gmail API','Google Calendar API','Google Drive API','People API'])assert.match(t,new RegExp(a));
  const href=await scope.getByTestId('enable-link').getAttribute('href');
  assert.equal(href,'https://console.cloud.google.com/apis/enableflow?apiid='+APIS.join(','));
  assert.deepEqual((await scope.getByTestId('scopes').locator('pre').innerText()).split('\n'),SCOPES);
  assert.match(await scope.getByTestId('redirect').innerText(),/Ei uudelleenohjausosoitetta[\s\S]*http:\/\/localhost/);
  assert.match(t,/Desktop app/);assert.match(t,/Google Auth platform › Clients › Create Client/);
  assert.match(await scope.getByTestId('secret-once').innerText(),/vain kerran/);
 };
 const audience=async scope=>{
  assert.match(await scope.getByTestId('audience-effect').innerText(),/Workspace[\s\S]*Ei Googlen vahvistusta/);
  await scope.getByTestId('audience').getByRole('button',{name:'External',exact:true}).click();
  const t=await scope.getByTestId('audience-effect').innerText();
  assert.match(t,/Test users[\s\S]*100[\s\S]*7 päivässä/);assert.match(t,/Gmail ja Drive[\s\S]*vahvistuksen/);
 };
 const finish=async()=>{
  await id('client-id').fill('abc');await id('client-secret').fill('has space');await id('save').click();
  assert.match(await guide().innerText(),/Tarkista Client ID[\s\S]*Tarkista Client secret/);
  assert.equal(await status('google'),'needs_app','nothing is sent until both values are well formed');
  await id('client-id').fill(` ${ID} `);await id('client-secret').fill(SECRET);await id('save').click();
  assert.equal(await status('google'),'saving');
  assert.match(await id('save').innerText(),/Odottaa palvelinta/);
  assert.equal(await id('save').isDisabled(),true);
  await f.locator('[data-testid=row-google][data-status=ready]').waitFor();
  await f.getByTestId('guide').waitFor({state:'detached'});
  assert.match(await id('notice').innerText(),/Google: tunnukset tallennettu/);
  assert.equal(await id('onb-google').getAttribute('data-hidden'),null);
 };
 const menuHeading=async expect=>{
  await id('menu-wrap-google').getByRole('button').click();await f.getByTestId('menu-replace').waitFor();
  const t=await f.locator('.ah-popover').innerText();assert.match(t,new RegExp(`client id ${expect}-…`));assert.doesNotMatch(t,/\.com/,'no meaningless suffix');
 };

 // ---- Direction 1: one checklist ----
 await f.locator('[data-testid=ig-rows]').waitFor();
 assert.deepEqual(await f.locator('[data-testid^=row-]').evaluateAll(es=>es.map(e=>e.dataset.testid.slice(4))),['google','microsoft','imap','caldav','carddav','dropbox'],'catalog order');
 assert.equal(await status('google'),'needs_app');
 await id('setup-google').click();
 assert.equal(await guide().getAttribute('data-direction'),'checklist');
 assert.deepEqual(await guide().locator('[data-testid^=step-]').evaluateAll(es=>es.map(e=>e.dataset.testid.slice(5))),['apis','audience','scopes','client','enter']);
 await content(guide());
 await checkpoint();await capture('guide-1');
 await audience(guide());
 await checkpoint();if(theme==='dark')await capture('external-1',false);
 await finish();
 await menuHeading('915508263417');
 await checkpoint();if(theme==='light'&&width===1440)await capture('menu-1',false);
 // Replace: a new secret on the same client by default; another client shows every step.
 await f.getByTestId('menu-replace').click();
 assert.match(await guide().innerText(),/vaihda tunnukset/);
 assert.equal(await guide().locator('[data-testid=step-apis]').count(),0,'a new secret needs no console steps');
 assert.match(await guide().innerText(),new RegExp(ID.replaceAll('.','\\.')));
 assert.equal(await f.getByTestId('client-id').count(),0,'the client id is kept');
 assert.match(await id('change-effect').innerText(),/vanhaa salaisuutta[\s\S]*kirjautua uudelleen/);
 await checkpoint();await capture('replace-1',false);
 await id('change').getByText('Uusi asiakas').first().click();
 assert.equal(await guide().locator('[data-testid=step-apis]').count(),1);
 assert.match(await id('change-effect').innerText(),/vanhaa asiakasta/);
 await id('client-id').fill(ID);await id('client-secret').fill(SECRET);await id('save').click();
 await f.locator('[data-testid=row-google][data-status=ready]').waitFor();
 // Removal and the missing tool are round 2's, unchanged.
 await id('menu-wrap-google').getByRole('button').click();await f.getByTestId('menu-remove').click();
 assert.match(await id('act-dialog').innerText(),/Uusia tilejä ei voi yhdistää/);
 await id('confirm-remove').click();await f.locator('[data-testid=row-google][data-status=needs_app]').waitFor();
 await server('Vajaa asennus');assert.equal(await status('google'),'tool_missing');
 await id('tool-google').click();assert.match(await id('act-dialog').innerText(),/host apply/);await page.keyboard.press('Escape');

 // ---- Direction 2: one step at a time ----
 await key('2');await variant(1);await server('Uusi asennus');
 await id('setup-google').click();
 assert.equal(await guide().getAttribute('data-direction'),'stepper');
 const seen=[];
 for(;;){seen.push(await id('stepname').innerText());if(await f.getByTestId('next').count()===0)break;await id('next').click();}
 assert.deepEqual(seen.map(s=>s.replace(/\s+/g,' ')),['1/5 API:t','2/5 Kohdeyleisö','3/5 Käyttöoikeudet','4/5 OAuth-asiakas','5/5 Tunnukset']);
 await checkpoint();if(theme==='light')await capture('enter-2',false);
 await id('back');await id('back').click();
 assert.match(await guide().innerText(),/vain kerran/);
 await id('back').click();await id('back').click();await id('back').click();
 assert.match(await id('stepname').innerText(),/1\/5/);
 await id('enable-link').waitFor();
 await checkpoint();await capture('guide-2',false);
 await id('next').click();await audience(guide());
 await id('back').click();await id('skip').click();
 assert.match(await id('stepname').innerText(),/5\/5 Tunnukset/,'an administrator with a client goes straight to the fields');
 await finish();
 await menuHeading('915508263417');await f.getByTestId('menu-replace').click();
 assert.match(await id('stepname').innerText(),/1\/1 Tunnukset/);
 await page.keyboard.press('Escape');await f.getByTestId('guide').waitFor({state:'detached'});

 // ---- Direction 3: side panel, fields first ----
 await key('3');await variant(2);await server('Uusi asennus');
 await id('setup-google').click();
 assert.equal(await guide().getAttribute('data-direction'),'panel');
 const order=await guide().evaluate(g=>[...g.querySelectorAll('[data-testid=fields],[data-testid=panel-guide]')].map(e=>e.dataset.testid));
 assert.deepEqual(order,['fields','panel-guide'],'fields come before the guide');
 const rowsVisible=await f.locator('[data-testid=ig-rows]').isVisible();
 assert.equal(rowsVisible,width>1100,'rows stay beside the panel on a wide screen; the panel takes the tab on a phone');
 assert.equal(await id('panel-back').isVisible(),width<=1100);
 for(const s of ['audience','scopes','client'])await id(`open-${s}`).click();
 await content(guide());
 await checkpoint();await capture('guide-3');
 await audience(guide());
 await finish();
 assert.equal(await f.locator('[data-testid=ig-rows]').isVisible(),true,'the row is in view after saving');
 await checkpoint();if(theme==='dark')await capture('saved-3');
 await menuHeading('915508263417');await f.getByTestId('menu-replace').click();
 await id('change').waitFor();
 assert.equal(await f.getByTestId('panel-guide').count(),0,'a new secret: just the field');
 await checkpoint();if(width===390)await capture('replace-3');
 await id(width>1100?'panel-close':'panel-back').click();
 await f.getByTestId('guide').waitFor({state:'detached'});
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[],'console errors');
writeFileSync(`${out}/${hosted?'r3-hosted-checks':'r3-checks'}.json`,JSON.stringify({round,input:hosted?input:'offline.html',checks,errors},null,1)+'\n');
console.log(`${checks} checkpoints, no console errors`);
