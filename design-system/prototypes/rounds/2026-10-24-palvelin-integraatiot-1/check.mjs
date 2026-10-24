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
const round='2026-10-24-palvelin-integraatiot-1',names=['Oma välilehti','Tilan mukaan','Osana Palvelinta'];
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
 // Picker contract: digits, arrows and R switch and remount.
 const key=async value=>{await f.locator('.axis').click();await page.keyboard.press(value);};
 const variant=d=>f.locator(`.shell.variant-${d}`).waitFor();
 await key('3');await variant(2);
 await key('ArrowRight');await variant(0);
 await key('2');await variant(1);
 assert.equal(await f.locator('.proto-picker-item[data-active]').innerText(),names[1].replaceAll(' ','\u00a0'));
 assert.equal(await f.locator('body').evaluate(()=>new URL(location.href).searchParams.get('v')),'2');
 await id('setup-google').click();await id('simulate-save').click();
 await f.locator('[data-testid=row-google][data-status=ready]').waitFor();
 await key('r');await variant(1);
 assert.equal(await f.locator('[data-testid=row-google]').first().getAttribute('data-status'),'needs_app','R remounts the fixture');
 if(hosted){await f.locator('body').evaluate(()=>{document.body.dataset.old='1';location.reload();});await f.locator('body:not([data-old])').waitFor();}else await page.reload();
 await variant(1);await f.locator('nav.proto-picker[data-ready]').waitFor();
 await f.locator('#theme').selectOption(theme);
 if(width===390)await f.locator('#phone').check();
 await key('1');await variant(0);
 assert.equal(await f.locator('#theme').inputValue(),theme);

 const checkpoint=async()=>{assert.equal(await f.locator('.review').evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'document overflow');for(const el of await f.locator('.s-main button:visible,.ah-dialog button:visible').all()){const b=await el.boundingBox();if(b)assert.ok(b.x>=-1&&b.x+b.width<=width+1,`control overflow ${JSON.stringify(b)}`);}checks++;};
 const capture=async(name,full=true)=>{
  if(hosted)return;
  const base=`${out}/r1-${name}-${width}-${theme}`;
  await page.screenshot({path:`${base}.png`,fullPage:full});
  const html=await page.evaluate(()=>{
   const copy=document.documentElement.cloneNode(true);
   copy.querySelectorAll('script').forEach(e=>e.remove());
   copy.querySelectorAll('style').forEach(e=>e.textContent=e.textContent.replace(/@font-face\s*\{[^}]*\}/g,''));
   return '<!doctype html>'+copy.outerHTML;
  });writeFileSync(`${base}.html`,html);
 };
 const status=async p=>f.locator(`[data-testid=row-${p}]`).first().getAttribute('data-status');
 const tab=async t=>{await id(width===390?`mtab-${t}`:`tab-${t}`).click();};
 const server=async label=>{await id('server').getByRole('button',{name:label,exact:true}).click();};

 // ---- Direction 1: its own tab, one row per provider ----
 await f.locator('[data-testid=ig-rows]').waitFor();
 assert.equal(await f.locator('[data-testid^=row-]').count(),6);
 assert.deepEqual(await f.locator('[data-testid^=row-]').evaluateAll(es=>es.map(e=>e.dataset.testid.slice(4))),['google','microsoft','imap','caldav','carddav','dropbox'],'catalog order');
 for(const p of ['imap','caldav','carddav'])assert.equal(await status(p),'ready');
 for(const p of ['google','microsoft','dropbox'])assert.equal(await status(p),'needs_app');
 assert.match(await id('onb-google').innerText(),/piilossa uusilta/);
 assert.match(await id('people-google').innerText(),/Ei käytettävissä tällä palvelimella/);
 assert.match(await id('onb-imap').innerText(),/Voit lisätä/);
 assert.match(await id('authority').innerText(),/palvelin on vahvistanut/);
 await checkpoint();await capture('overview-1');
 // The person's view: the production IntegrationsOverview with derived availability.
 await id('pv-open').click();await id('person-view').waitFor();
 assert.equal(await f.locator('[data-testid=integration-tile-google] button').isDisabled(),true);
 assert.match(await f.locator('[data-testid=integration-tile-google]').innerText(),/Ei käytettävissä tällä palvelimella/);
 assert.equal(await f.locator('[data-testid=integration-tile-imap] button').isDisabled(),false);
 await checkpoint();if(width===1440&&theme==='light'||width===390&&theme==='dark')await capture('person-1',false);
 await id('pv-close').click();
 // Setting credentials: pending until the server confirms.
 await id('setup-google').click();
 assert.match(await id('act-dialog').innerText(),/Client ID[\s\S]*Client secret/);
 await checkpoint();if(theme==='light')await capture('setup-1',false);
 await id('simulate-save').click();
 assert.equal(await status('google'),'saving');
 await f.locator('[data-testid=row-google][data-status=ready]').waitFor();
 assert.match(await id('app-google').innerText(),/client id …b71c/);
 assert.match(await id('onb-google').innerText(),/voi yhdistää tai ohittaa/);
 await id('pv-open').click();assert.equal(await f.locator('[data-testid=integration-tile-google] button').isDisabled(),false);await id('pv-close').click();
 // Removal names its consequences.
 await id('remove-google').click();
 const removal=await id('act-dialog').innerText();
 assert.match(removal,/eivät voi yhdistää uusia/);assert.match(removal,/kirjautua uudelleen/);assert.match(removal,/vaihe piilotetaan/);
 await checkpoint();if(width===390&&theme==='light')await capture('remove-1',false);
 await id('confirm-remove').click();
 await f.locator('[data-testid=row-google][data-status=needs_app]').waitFor();
 // A broken installation: tools missing.
 await server('Vajaa asennus');
 for(const p of ['google','microsoft','dropbox'])assert.equal(await status(p),'tool_missing');
 assert.equal(await status('imap'),'ready');
 assert.match(await id('people-dropbox').innerText(),/Puuttuu: rclone/);
 await checkpoint();await capture('partial-1');
 await id('tool-google').click();
 assert.match(await id('act-dialog').innerText(),/host apply/);
 await page.keyboard.press('Escape');
 // Käyttöönotto: a step waits for its integration; only ready ones can be added.
 await server('Uusi asennus');await tab('onboarding');
 assert.equal(await id('onb-step-google').getAttribute('data-status'),'needs_app');
 assert.match(await id('onb-step-google').innerText(),/Piilossa uusilta henkilöiltä/);
 await id('onb-add').click();
 assert.match(await id('onb-blocked-microsoft').innerText(),/Tarvitsee sovellustunnukset/);
 await id('onb-add-imap').click();
 assert.equal(await id('onb-step-imap').getAttribute('data-status'),'ready');
 await checkpoint();await capture('onboarding-1');
 await f.locator('[data-testid=onb-step-google] .linkish').click();
 await f.locator('[data-testid=ig-rows]').waitFor();
 assert.match(await id('onb-imap').innerText(),/Käyttöönoton vaihe/);

 // ---- Direction 2: grouped by status ----
 await key('2');await variant(1);
 await server('Google asetettu');
 const sections=await f.locator('[data-testid=ig-groups] > section').evaluateAll(es=>es.map(e=>e.getAttribute('aria-label')));
 assert.deepEqual(sections,['Tarvitsee sovellustunnukset','Valmiina käyttöön']);
 assert.equal(await f.locator('[data-testid=ready-plain] [data-testid^=row-]').count(),3);
 assert.match(await id('row-microsoft').innerText(),/Tarvitaan:[\s\S]*Microsoft Entra/);
 await checkpoint();await capture('overview-2');
 await server('Vajaa asennus');
 assert.equal(await f.locator('[data-testid=ig-groups] > section').first().getAttribute('aria-label'),'Korjattavaa');
 await checkpoint();if(theme==='dark')await capture('partial-2');

 // ---- Direction 3: a section of the Palvelin tab ----
 await key('3');await variant(2);
 assert.equal(await f.getByTestId('tab-integrations').count(),0,'no own tab');
 await id('ig-section').waitFor();
 assert.equal(await status('dropbox'),'tool_missing','the example server carries over between directions');
 await server('Uusi asennus');
 assert.match(await id('onb-google').innerText(),/piilossa/);
 await id('setup-dropbox').click();await id('simulate-save').click();
 await f.locator('[data-testid=row-dropbox][data-status=ready]').waitFor();
 await checkpoint();await capture('overview-3');
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[],'console errors');
writeFileSync(`${out}/${hosted?'r1-hosted-checks':'r1-checks'}.json`,JSON.stringify({round,input:hosted?input:'offline.html',checks,errors},null,1)+'\n');
console.log(`${checks} checkpoints, no console errors`);
