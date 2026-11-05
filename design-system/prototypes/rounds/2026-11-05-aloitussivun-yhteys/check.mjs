// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. For
// today and every direction: the four situations (connection fails while the
// device says it is online, browser-reported offline, the server answered
// with an error, identity disagreement three times), the connection coming
// back (today waits for the button unless the browser fires `online`; the
// directions recover by their automatic read), the identity case staying
// fail-closed until the person signs in again, and the automatic tries
// ending after 15 minutes. Screenshots at device scale factor 2: everything
// at 1440 and 390 light, the defaults of two situations at 1440 and 390 dark.
// The console must stay clean.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-05-aloitussivun-yhteys';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['nyt','a-neutraali','b-laskuri','c-tarkista'];
const short={network:'verkko',offline:'offline',answer:'vastaus',identity:'kirjautuminen'};
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const runs=[
 {width:1440,theme:'light',full:true},
 {width:390,theme:'light',full:true},
 {width:1440,theme:'dark',full:false},
 {width:390,theme:'dark',full:false},
];
try{
for(const run of runs){
 const {width,theme}=run,mobile=width===390;
 const page=await browser.newPage({viewport:{width,height:mobile?844:900},deviceScaleFactor:2,isMobile:mobile,hasTouch:mobile});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 await checkPicker(page,round);
 const tag=`${width}-${theme}`;
 const capture=async name=>{await page.waitForTimeout(250);await page.screenshot({path:`${out}/${name}-${tag}.png`});};
 const fits=async()=>ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'document overflow');
 const id=x=>page.getByTestId(x).first();
 const phase=()=>page.locator('.cs-review').getAttribute('data-phase');
 const speed=async v=>page.locator('#speed').selectOption(String(v));
 const scenario=async sc=>{await page.locator('#scenario').selectOption(sc);await page.locator(`.cs-review[data-scenario="${sc}"][data-phase="failed"]`).waitFor({state:"attached"});};
 const home=async()=>{await id('cs-home').waitFor({timeout:8000});ok(true);};
 for(const d of [0,1,2,3]){
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.cs-review.variant-${d}`).waitFor({state:'attached'});
  await speed(1);
  assert.match(await id('direction-lines').locator('li[aria-current]').innerText(),d?/^[ABC] /:/^Nyt: /);checks++;
  const n=names[d];
  // The defaults of every situation.
  for(const sc of run.full?['network','offline','answer','identity']:['network','identity']){
   await scenario(sc);
   const title=await id('workspaces-unavailable-title').innerText();
   const text=await page.locator('.cs-stage').innerText();
   if(d===0){assert.equal(title,'Työtiloja ei saatu näkyviin');assert.match(text,/Palvelin ei vastannut/);}
   else{
    assert.doesNotMatch(text,/Palvelin ei vastannut/);
    assert.equal(title,{network:'Yhteyttä ei saatu',offline:'Yhteyttä ei saatu',answer:'Työtiloja ei saatu luettua',identity:'Kirjautumista ei saatu varmistettua'}[sc]);
    if(sc==='offline')await id('cs-offline-hint').waitFor();
    if(sc==='network'){assert.equal(await page.getByTestId('cs-offline-hint').count(),0);}
    if(d===2&&sc==='network')assert.match(await id('cs-auto').innerText(),/Yritetään uudelleen \d+ s kuluttua/);
    if(d===3&&(sc==='network'||sc==='offline'))assert.match(await id('cs-check').innerText(),/VPN/);
    if(sc==='identity'){await id('cs-sign-in').waitFor();assert.match(await id('cs-auto').innerText(),/ei yritä/);}
   }
   checks++;
   // The account is reachable when the session read named a person.
   assert.equal(await page.locator('.ah-fallback-account').count(),sc==='answer'||sc==='identity'?1:0);checks++;
   await fits();
   await capture(`${n}-${short[sc]}-0-oletus`);
  }
  if(!run.full)continue;
  await speed(10);
  // The VPN route comes back without an `online` event.
  await scenario('network');
  await id('cs-net').click();
  if(d===0){
   await page.waitForTimeout(1500);
   assert.equal(await phase(),'failed','today waits for the button');checks++;
   await capture(`${n}-verkko-1-yhteys-palasi`);
   await id('retry').click();
  }
  await home();await fits();await capture(`${n}-verkko-2-palautunut`);
  // A browser-reported offline state ends with `online`: everyone recovers.
  await scenario('offline');
  await id('cs-net').click();
  await home();
  // The identity disagreement stays fail-closed: no automatic try.
  await scenario('identity');
  await page.evaluate(()=>window.__proto.skip(120));await page.waitForTimeout(400);
  assert.equal(await phase(),'failed');checks++;
  if(d===0){
   await id('retry').click();
   await page.waitForTimeout(600);
   assert.equal(await phase(),'failed');checks++;
   await id('cs-net').click();await id('retry').click();
  }else await id('cs-sign-in').click();
  await home();
  // The automatic tries end after 15 minutes; the button still works.
  if(d>0){
   await scenario('network');
   await page.evaluate(()=>window.__proto.skip(15*60));
   await page.waitForFunction(()=>/lopet|ei enää/.test(document.querySelector('[data-testid="cs-auto"]')?.textContent||''),null,{timeout:5000});checks++;
   await fits();await capture(`${n}-verkko-3-lopetettu`);
   await id('cs-net').click();await id('retry').click();await home();
  }
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
