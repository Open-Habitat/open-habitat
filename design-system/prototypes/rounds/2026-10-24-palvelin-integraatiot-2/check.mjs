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
const round='2026-10-24-palvelin-integraatiot-2',names=['Tila ja lause','Käytössä vai ei','Avattava rivi'];
const [input,out]=process.argv.slice(2),hosted=input.startsWith('https:');
mkdirSync(out,{recursive:true});
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
 // Picker contract: digits, arrows and R switch and remount.
 const key=async value=>{await f.locator('.axis').click();await page.keyboard.press(value);};
 const variant=d=>f.locator(`.shell.variant-${d}`).waitFor();
 await key('3');await variant(2);
 await key('ArrowRight');await variant(0);
 await key('2');await variant(1);
 assert.equal(await f.locator('.proto-picker-item[data-active]').innerText(),names[1].replaceAll(' ',' '));
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

 const checkpoint=async()=>{assert.equal(await f.locator('.review').evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'document overflow');for(const el of await f.locator('.s-main button:visible,.ah-dialog button:visible,.ah-popover [role=menuitem]:visible').all()){const b=await el.boundingBox();if(b)assert.ok(b.x>=-1&&b.x+b.width<=width+1,`control overflow ${JSON.stringify(b)}`);}checks++;};
 const capture=async(name,full=true)=>{
  if(hosted)return;
  const base=`${out}/r2-${name}-${width}-${theme}`;
  await page.screenshot({path:`${base}.png`,fullPage:full});
  const html=await page.evaluate(()=>{
   const copy=document.documentElement.cloneNode(true);
   copy.querySelectorAll('script').forEach(e=>e.remove());
   copy.querySelectorAll('style').forEach(e=>e.textContent=e.textContent.replace(/@font-face\s*\{[^}]*\}/g,''));
   return '<!doctype html>'+copy.outerHTML;
  });writeFileSync(`${base}.html`,html);
 };
 const status=async p=>f.locator(`[data-testid=row-${p}]`).first().getAttribute('data-status');
 const text=async p=>id(`row-${p}`).innerText();
 const server=async label=>{await id('server').getByRole('button',{name:label,exact:true}).click();};
 const order=async()=>assert.deepEqual(await f.locator('[data-testid^=row-]').evaluateAll(es=>es.map(e=>e.dataset.testid.slice(4))),['google','microsoft','imap','caldav','carddav','dropbox'],'catalog order');
 // Jari's round 1 removals stay removed in every direction.
 const trimmed=async()=>{const t=await f.locator('.s-main').innerText();for(const gone of [/Näytä henkilön näkymä/,/Mitkä palvelut/,/Palvelin tallentaa/,/Valmiina käyttöön \d/])assert.doesNotMatch(t,gone);};

 // ---- Direction 1: status and one sentence, buttons on the row ----
 await f.locator('[data-testid=ig-rows]').waitFor();
 await order();await trimmed();
 for(const p of ['imap','caldav','carddav'])assert.equal(await status(p),'ready');
 for(const p of ['google','microsoft','dropbox'])assert.equal(await status(p),'needs_app');
 assert.match(await id('people-google').innerText(),/eivät voi vielä yhdistää/);
 assert.equal(await f.locator('[data-testid=people-imap]').count(),0,'ready DAV rows carry no sentence');
 assert.equal(await id('onb-google').getAttribute('data-hidden'),'true');
 assert.equal(await f.locator('[data-testid=onb-imap]').count(),0,'no onboarding text without a step');
 await checkpoint();await capture('overview-1');
 await id('setup-google').click();
 assert.match(await id('act-dialog').innerText(),/Client ID ja Client secret/);
 await checkpoint();if(theme==='light')await capture('setup-1',false);
 await id('simulate-save').click();
 assert.equal(await status('google'),'saving');
 await f.locator('[data-testid=row-google][data-status=ready]').waitFor();
 assert.match(await id('app-google').innerText(),/client id …b71c/);
 assert.equal(await id('onb-google').getAttribute('data-hidden'),null);
 assert.match(await id('notice').innerText(),/tunnukset tallennettu/);
 await id('remove-google').click();
 const removal=await id('act-dialog').innerText();
 assert.match(removal,/Uusia tilejä ei voi yhdistää/);assert.match(removal,/kirjautua uudelleen/);assert.match(removal,/vaihe piilotetaan/);
 await checkpoint();if(width===390&&theme==='light')await capture('remove-1',false);
 await id('confirm-remove').click();
 await f.locator('[data-testid=row-google][data-status=needs_app]').waitFor();
 await server('Vajaa asennus');
 for(const p of ['google','microsoft','dropbox'])assert.equal(await status(p),'tool_missing');
 assert.equal(await status('imap'),'ready');
 assert.match(await id('row-dropbox').innerText(),/Puuttuu rclone/);
 assert.equal(await f.locator('[data-testid=fix-command]').count(),1,'the fix is said once');
 assert.match(await id('fix-banner').innerText(),/rclone[\s\S]*host apply/);
 await checkpoint();await capture('partial-1');
 // The step badge leads to Käyttöönotto; rules from round 1 still hold.
 await server('Uusi asennus');await id('onb-google').click();
 assert.match(await id('onb-step-google').innerText(),/Piilossa uusilta henkilöiltä/);
 await id('onb-add').click();
 assert.match(await id('onb-blocked-microsoft').innerText(),/Tarvitsee sovellustunnukset/);
 await id('onb-add-imap').click();
 await f.locator('[data-testid=onb-step-google] .linkish').click();
 await f.locator('[data-testid=ig-rows]').waitFor();
 assert.match(await id('onb-imap').innerText(),/Käyttöönotossa/);

 // ---- Direction 2: the status is the consequence, rare actions in a menu ----
 await key('2');await variant(1);
 await server('Google asetettu');
 await order();await trimmed();
 assert.match(await text('google'),/Käytössä/);
 assert.match(await text('microsoft'),/Ei käytössä/);
 {const t=await text('imap');assert.match(t,/Käytössä/);assert.doesNotMatch(t,/Ei käytössä/);}
 assert.equal(await f.locator('[data-testid=row-imap] button').count(),0,'ready DAV rows have no action');
 await checkpoint();await capture('overview-2');
 await id('menu-wrap-google').getByRole('button').click();
 await f.getByTestId('menu-remove').waitFor();
 assert.match(await f.locator('.ah-popover').innerText(),/client id …3f9a/);
 await checkpoint();await capture('menu-2',false);
 await f.getByTestId('menu-remove').click();
 assert.equal(await id('act-dialog').getAttribute('data-kind'),'remove');
 await page.keyboard.press('Escape');await f.getByTestId('act-dialog').waitFor({state:'detached'});
 await id('menu-wrap-google').getByRole('button').click();await f.getByTestId('menu-replace').click();
 assert.match(await id('act-dialog').innerText(),/vaihda tunnukset[\s\S]*kirjautua uudelleen/);
 await id('simulate-save').click();
 await f.locator('[data-testid=row-google][data-status=ready]').waitFor();
 await server('Vajaa asennus');
 assert.match(await text('dropbox'),/Ei käytössä · rclone puuttuu/);
 await id('tool-dropbox').click();
 assert.match(await id('act-dialog').innerText(),/host apply/);
 await checkpoint();if(theme==='dark')await capture('fix-2',false);
 await page.keyboard.press('Escape');
 await checkpoint();if(theme==='dark')await capture('partial-2');

 // ---- Direction 3: one quiet line per service, details open in place ----
 await key('3');await variant(2);
 await order();await trimmed();
 assert.equal(await status('dropbox'),'tool_missing','the example server carries over between directions');
 assert.equal(await f.locator('[data-testid=fix-command]').count(),0,'closed rows hide the fix');
 await id('open-dropbox').click();
 assert.match(await text('dropbox'),/rclone[\s\S]*host apply/);
 await checkpoint();if(theme==='light')await capture('partial-3');
 await server('Uusi asennus');
 assert.equal(await f.locator('[data-testid=open-imap]').count(),0,'ready DAV rows do not open');
 assert.equal(await f.locator('[data-testid=people-google]').count(),0,'closed by default');
 await id('open-google').click();
 assert.match(await id('people-google').innerText(),/eivät voi vielä yhdistää/);
 assert.match(await text('google'),/Käyttöönoton vaihe, piilossa/);
 await checkpoint();await capture('overview-3');
 await id('setup-google').click();await id('simulate-save').click();
 await f.locator('[data-testid=row-google][data-status=ready]').waitFor();
 assert.match(await id('app-google').innerText(),/…b71c/);
 assert.ok(await id('remove-google').isVisible());
 await checkpoint();
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[],'console errors');
writeFileSync(`${out}/${hosted?'r2-hosted-checks':'r2-checks'}.json`,JSON.stringify({round,input:hosted?input:'offline.html',checks,errors},null,1)+'\n');
console.log(`${checks} checkpoints, no console errors`);
