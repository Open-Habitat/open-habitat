// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. For
// today and every direction, walks the scenario: the named prototyper
// delivered round 2 and waits; it gets "riffaa A1:tä oikeilla
// kuvakaappauksilla" and works; its round 3 report arrives in the parent;
// it is stopped and its work merged. Today the same request starts a new
// one-shot worker (the production strip shows it) that merges by itself.
// A writes from the panel row; B from the worker's own conversation, then
// stops it from there; C first answers the worker from the parent, then on
// a reset asks the main agent to pass the message on. Screenshots at device
// scale factor 2 at 1440 px and 390 px (touch), light and dark. The console
// must stay clean.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-06-nimetyt-workerit';
const RIFF='riffaa A1:tä oikeilla kuvakaappauksilla';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['nyt','a-rivit','b-keskustelut','c-keskustelussa'];
let checks=0;const errors=[];
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
 const fits=async()=>ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'document overflow');
 const drawer=async open=>{if(!mobile)return;
  if(open){if(!(await page.locator('.ah-mobile-open').count())){await page.getByTestId('navigation-open').click();await page.locator('.ah-mobile-open').waitFor();}}
  else if(await page.locator('.ah-mobile-open').count()){await page.keyboard.press('Escape');await page.locator('.ah-mobile-open').waitFor({state:'detached'});}
 };
 const field=()=>page.locator('.ah-composer textarea').first();
 const send=async text=>{await field().fill(text);await page.getByTestId('send').click();};
 const pick=async d=>{
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.rq-review.variant-${d}`).waitFor({state:'attached'});
 };
 for(const d of [0,1,2,3]){
  await pick(d);
  const say=async name=>{await page.waitForTimeout(250);await fits();await page.screenshot({path:`${out}/${names[d]}-${name}-${tag}.png`});};
  assert.match(await page.getByTestId('direction-lines').locator('li[aria-current]').innerText(),d?/^[ABC] /:/^Nyt: /);checks++;
  await say('0-oletus');
  if(d===0){
   ok(!(await page.getByTestId('background-badges').count()),'today: no worker left after round 2');
   ok(await page.getByTestId('process-completion').count()===1,'today: the wait completion');
   await send(RIFF);
   await page.getByText('käynnistän uuden workerin',{exact:false}).waitFor();checks++;
   await page.getByTestId('background-spinoffs').waitFor();checks++;
   await say('1-uusi-worker');
   await page.getByTestId('background-spinoffs').click();
   await page.getByTestId('spinoff-proto-m365-setup-flow: kierros 3').waitFor();checks++;
   await say('2-paneeli');
   await page.keyboard.press('Escape');
   await page.getByText('Kierros 3 on valmis ja laskeutui',{exact:false}).waitFor({timeout:8000});checks++;
   ok(await page.getByTestId('process-completion').count()===2,'today: second completion');
   await page.getByTestId('background-badges').waitFor({state:'detached'});checks++;
   await say('3-laskeutui');
  }
  if(d===1){
   const row=page.getByTestId('worker-row');
   ok(await row.getAttribute('data-phase')==='waiting','A: waits');
   await page.getByTestId('worker-messages').click();
   await page.getByTestId('worker-exchange').waitFor();checks++;
   await say('1-viestit');
   await page.getByTestId('worker-messages').click();
   await page.getByTestId('worker-write-open').click();
   await page.getByTestId('worker-write-input').fill(RIFF);
   await say('2-kirjoita');
   await page.getByTestId('worker-write-send').click();
   await row.and(page.locator('[data-phase="working"]')).waitFor();checks++;
   ok((await page.getByTestId('worker-last').innerText()).includes('riffaa'),'A: last message is the request');
   await page.locator('[data-testid="sent-line"][data-by="person"]').waitFor();checks++;
   await say('3-tyoskentelee');
   await page.getByTestId('report-3').waitFor({timeout:8000});checks++;
   await row.and(page.locator('[data-phase="waiting"]')).waitFor();checks++;
   await page.getByText('toimitti kierroksen 3',{exact:false}).waitFor();checks++;
   await say('4-raportti');
   await page.getByTestId('report-toggle-3').click();
   await say('5-raportti-auki');
   await page.getByTestId('stop-worker').click();
   await page.getByTestId('stopped-line').waitFor();checks++;
   await row.and(page.locator('[data-phase="merged"]')).waitFor();checks++;
   await say('6-yhdistetty');
  }
  if(d===2){
   await drawer(true);
   ok(await page.getByTestId('agent-item-worker').isVisible(),'B: worker under the parent in the rail');
   if(mobile)await page.screenshot({path:`${out}/${names[d]}-0b-sivupalkki-${tag}.png`});
   await drawer(false);
   await page.getByTestId('report-open-2').click();
   await page.getByTestId('worker-band').waitFor();checks++;
   await say('1-workerin-keskustelu');
   await send(RIFF);
   await page.locator('.ww-working').waitFor();checks++;
   await say('2-tyoskentelee');
   await drawer(true);
   if(mobile)await page.screenshot({path:`${out}/${names[d]}-2b-sivupalkki-${tag}.png`});
   await drawer(false);
   await page.getByText('Kierros 3 valmis',{exact:false}).first().waitFor({timeout:8000});checks++;
   await say('3-vastaus');
   await page.getByTestId('back-to-parent').click();
   await page.getByTestId('report-3').waitFor();checks++;
   await page.getByText('toimitti kierroksen 3',{exact:false}).waitFor();checks++;
   await say('4-paakeskustelu');
   await drawer(true);
   await page.getByTestId('agent-item-worker').locator('a').first().click();
   await drawer(false);
   await page.getByTestId('worker-band').waitFor();
   await page.getByTestId('stop-worker').click();
   await page.getByTestId('stopped-line').waitFor();checks++;
   await say('5-yhdistetty');
  }
  if(d===3){
   ok(await page.getByTestId('worker-chips').isVisible(),'C: chips under the header');
   await page.getByTestId('reply-worker').click();
   ok(await page.getByTestId('to-worker').getAttribute('aria-checked')==='true','C: reply addresses the worker');
   await field().fill(RIFF);
   await say('1-vastaa');
   await page.getByTestId('send').click();
   await page.locator('[data-testid="sent-line"][data-by="person"]').waitFor();checks++;
   await page.getByTestId('worker-working').waitFor();checks++;
   await say('2-tyoskentelee');
   await page.getByTestId('report-3').waitFor({timeout:8000});checks++;
   await page.getByText('toimitti kierroksen 3',{exact:false}).waitFor();checks++;
   await say('3-raportti');
   await page.getByTestId('stop-worker').click();
   await page.getByTestId('stopped-line').waitFor();checks++;
   await say('4-yhdistetty');
   // The other route: the person asks the main agent, which passes it on.
   await page.getByTestId('rq-reset').click();
   await page.getByTestId('report-2').waitFor();
   ok(await page.getByTestId('to-parent').getAttribute('aria-checked')==='true','C: the parent by default');
   await send(RIFF);
   await page.locator('[data-testid="sent-line"][data-by="parent"]').nth(1).waitFor();checks++;
   await say('5-paaagentin-kautta');
  }
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
