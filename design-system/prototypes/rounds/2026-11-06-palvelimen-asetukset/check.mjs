// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. For
// today and every direction, opens the default view (the administrator has
// just chosen Palvelimen ylläpito), walks to the server's integrations and
// back the way the direction offers, and prints where today's integrations
// entry falls. Screenshots at device scale factor 2 at 1440×900 and 390×844
// (touch), light and dark. The console must stay clean.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-06-palvelimen-asetukset';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['nyt','a-yleiskuva','b-oma-alue','c-ryhmat'];
let checks=0;const errors=[];const facts=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const runs=[{width:1440,theme:'light'},{width:1440,theme:'dark'},{width:390,theme:'light'},{width:390,theme:'dark'}];
try{
for(const {width,theme} of runs){
 const mobile=width===390;
 const page=await browser.newPage({viewport:{width,height:mobile?844:900},deviceScaleFactor:2,reducedMotion:'reduce',isMobile:mobile,hasTouch:mobile});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 await checkPicker(page,round);
 const tag=`${width}-${theme}`;
 const layer=()=>page.locator('.ah-settings-layer');
 const top=()=>layer().evaluate(el=>{el.scrollTop=0;});
 const fits=async()=>ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'document overflow');
 const pick=async d=>{
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.rq-review.variant-${d}`).waitFor({state:'attached'});
 };
 /** How far below the layer's top an element is, against the real app's
  * window (the review bar and picker take space here, not in the app). */
 const below=loc=>loc.evaluate(el=>{const l=el.closest('.ah-settings-layer').getBoundingClientRect();return Math.round(el.getBoundingClientRect().bottom-l.top);});
 for(const d of [0,1,2,3]){
  await pick(d);
  const say=async name=>{await page.waitForTimeout(300);await fits();await page.screenshot({path:`${out}/${names[d]}-${name}-${tag}.png`});};
  assert.match(await page.getByTestId('direction-lines').locator('li[aria-current]').innerText(),d?/^[ABC] /:/^Nyt: /);checks++;
  if(d===0){
   await page.getByTestId('settings-section-palvelin').waitFor();
   await page.getByTestId('server-name-input').waitFor();checks++;
   await say('0-oletus');
   if(!mobile){
    const item=page.getByTestId('settings-palvelinintegraatiot');
    facts.push(`${tag} nyt: Palvelinintegraatiot-rivin alareuna ${await below(item)} px asetuskerroksen yläreunasta (ikkuna 900 px), Levytila ${await below(page.getByTestId('settings-levy'))} px`);
    await item.scrollIntoViewIfNeeded();
    await say('1-lista-vieritetty');
    await item.click();
    await page.getByTestId('settings-section-palvelinintegraatiot').waitFor();checks++;
    await say('2-integraatiot');
    await top();
    await page.getByTestId('settings-palvelin').click();
    await page.getByTestId('settings-section-palvelin').waitFor();checks++;
   }else{
    await page.getByTestId('settings-list-back').click();
    const item=page.getByTestId('settings-palvelinintegraatiot');
    await item.waitFor();
    facts.push(`${tag} nyt: puhelimen listassa Palvelinintegraatiot-rivin alareuna ${await below(item)} px kerroksen yläreunasta (ikkuna 844 px)`);
    await say('1-lista');
    await item.scrollIntoViewIfNeeded();
    await say('2-lista-vieritetty');
    await item.click();
    await page.getByTestId('settings-section-palvelinintegraatiot').waitFor();checks++;
    await say('3-integraatiot');
    await page.getByTestId('settings-list-back').click();
    await page.getByTestId('settings-palvelin').click();
    await page.getByTestId('settings-section-palvelin').waitFor();checks++;
   }
  }
  if(d===1){
   await page.getByTestId('server-overview').waitFor();
   ok(await page.getByTestId('overview-levy').isVisible(),'A: the whole overview fits');
   ok(await page.getByTestId('overview-palvelinintegraatiot').isVisible(),'A: integrations on the overview');
   await say('0-oletus');
   await page.getByTestId('overview-palvelinintegraatiot').click();
   await page.getByTestId('settings-section-palvelinintegraatiot').waitFor();checks++;
   await say('1-integraatiot');
   await page.getByTestId('overview-back').click();
   await page.getByTestId('server-overview').waitFor();checks++;
   if(mobile){
    await page.getByTestId('list-back').click();
    await page.getByTestId('nav-admin').waitFor();
    ok(await page.getByTestId('nav-admin').evaluate(el=>el.getBoundingClientRect().bottom<innerHeight),'A: the server entry on the first screen of the list');
    await say('2-lista');
   }else{
    await page.getByTestId('nav-tekoaly').click();
    await page.getByTestId('settings-section-tekoaly').waitFor();checks++;
    await say('2-oma-osio');
   }
  }
  if(d===2){
   await page.getByTestId('settings-section-palvelin').waitFor();
   if(!mobile){
    ok(await page.getByTestId('nav-levy').isVisible(),'B: the whole area list fits');
    await say('0-oletus');
    await page.getByTestId('nav-palvelinintegraatiot').click();
   }else{
    ok(await page.getByTestId('area-tabs').isVisible(),'B: area tabs on the phone');
    await say('0-oletus');
    await page.getByTestId('tab-palvelinintegraatiot').click();
   }
   await page.getByTestId('settings-section-palvelinintegraatiot').waitFor();checks++;
   await say('1-integraatiot');
   await page.getByTestId(mobile?'own-settings-phone':'own-settings').click();
   await page.getByTestId('to-admin').waitFor();checks++;
   if(!mobile)await page.getByTestId('settings-section-tili').waitFor();
   await say('2-omat');
   if(mobile)await page.getByTestId('to-admin').scrollIntoViewIfNeeded();
   await page.getByTestId('to-admin').click();
   await page.getByTestId('settings-section-palvelin').waitFor();checks++;
  }
  if(d===3){
   await page.getByTestId('stack-palvelin').waitFor();
   await page.locator('[data-stack="levy"] [data-testid="settings-section-levy"]').waitFor();checks++;
   await page.waitForTimeout(400);await top();
   await say('0-oletus');
   await page.getByTestId('jump-palvelinintegraatiot').click();
   await page.waitForTimeout(200);
   const sec=page.locator('[data-stack="palvelinintegraatiot"] h2');
   ok(await sec.isVisible(),'C: integrations in view after the jump');
   ok(await page.getByTestId('jumps').isVisible(),'C: jump links stay in view');
   await say('1-integraatiot');
   await page.getByTestId('jump-palvelin').click();
   await page.waitForTimeout(200);
   ok(await page.getByTestId('group-title').isVisible(),'C: back at the top');
   if(!mobile){
    await page.getByTestId('group-tekoaly').click();
    await page.getByTestId('stack-tekoaly').waitFor();checks++;
    await page.waitForTimeout(400);await top();
    await say('2-oma-ryhma');
   }else{
    await page.getByTestId('list-back').click();
    await page.getByTestId('group-palvelin').waitFor();
    ok(await page.getByTestId('group-palvelin').evaluate(el=>el.getBoundingClientRect().bottom<innerHeight-70),'C: all groups on the first screen of the list');
    await say('2-lista');
   }
  }
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
for(const f of facts)console.log(f);
console.log(`ok: ${checks} checkpoints`);
