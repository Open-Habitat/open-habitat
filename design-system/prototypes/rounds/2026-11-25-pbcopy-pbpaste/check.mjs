// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. Serves
// the page under the Habitat view's sandbox CSP (opaque origin, scripts, no
// connect, no frames) and fails on any request besides the page itself, any
// iframe, or any change of address. Walks every direction (Now, A Card,
// B By the field, C Notice) at 1440 and 390 px in Päivä, Yö and Korkea
// kontrasti with reduced motion, in Finnish, and in English twice, through
// the story: the copy and its one press (B: direct in Chromium, a press in
// Safari/Firefox), the request, the preview that shows what would be given,
// giving, the key warning and not giving, and the expired request. Checks
// that reading never happens without a press (nothing given before Give),
// what the agent gets at each step (exit codes 0, 1, 4; Now 127), the
// header's waiting state, and no overflow. Screenshots at DPR 2; console
// clean.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-25-pbcopy-pbpaste';
const [input,out]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <evidence-dir>');process.exit(2);}
mkdirSync(out,{recursive:true});
const html=readFileSync(input,'utf8');
const origin='https://view.test';
const csp=`sandbox allow-scripts; default-src 'none'; script-src ${origin} 'unsafe-inline' 'unsafe-eval'; style-src ${origin} 'unsafe-inline'; img-src ${origin} data: blob:; font-src ${origin} data:; media-src ${origin} data: blob:; connect-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none'; object-src 'none'; manifest-src 'none'; form-action 'none'; base-uri 'none'`;
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
let checks=0;const errors=[];const stray=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const names=['nyt','a','b','c'];
const ask=['', 'ask-card','ask-dock','ask-notice'];
const runs=[];
for(const width of [1440,390])for(const theme of ['light','dark','contrast'])runs.push({width,theme,lang:'fi'});
runs.push({width:1440,theme:'light',lang:'en'},{width:390,theme:'dark',lang:'en'});
try{
for(const {width,theme,lang} of runs){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:1000},deviceScaleFactor:2,reducedMotion:'reduce',hasTouch:phone,isMobile:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 let served=0;
 await page.route('**/*',r=>{
  const u=r.request().url();
  if(u===`${origin}/view`&&served++===0)return r.fulfill({contentType:'text/html',headers:{'content-security-policy':csp},body:html});
  stray.push(u);return r.abort();
 });
 await page.goto(`${origin}/view`);
 await page.locator('#theme').selectOption(theme);
 await page.locator('#lang').selectOption(lang);
 await checkPicker(page,round);
 const tag=`${width}-${theme}-${lang}`;
 const full=theme==='light'||lang==='en';
 const shot=async(name,always=false)=>{if(!full&&!always)return;await page.waitForTimeout(120);await page.screenshot({path:`${out}/${name}-${tag}.png`,fullPage:true});};
 const fits=async(m)=>ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${tag} ${m}: document overflow`);
 ok(await page.evaluate(()=>origin==='null'),`${tag}: opaque-origin sandbox`);
 ok(await page.locator('iframe, frame, object, embed').count()===0,`${tag}: no frames`);
 ok(await page.evaluate(()=>document.documentElement.lang)===lang,`${tag}: document language`);
 const en=lang==='en';
 const native=()=>page.getByTestId('native-text').innerText();
 const step=async s=>{await page.locator('#step').selectOption(s);await page.waitForTimeout(60);};
 const tool=n=>page.locator(`[data-testid="tool-row"][data-tool-target="${n}"]`);
 const waitWord=en?'Waiting for you':'Odottaa sinua';
 for(const d of [0,1,2,3]){
  const n=names[d];
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.pbc-review.variant-${d}`).waitFor({state:'attached'});
  await page.locator('#browser').selectOption('chromium');
  await page.getByTestId('reset').click();
  await page.evaluate(()=>scrollTo(0,0));
  ok(await page.getByTestId('lines').locator('li').nth(d).getAttribute('aria-current')==='true',`${n}: current line`);
  const pbcopy=page.locator('[data-testid="tool-row"][data-tool-target^="pbcopy"]');
  // 1–2: the copy.
  if(d===0){
   ok(await pbcopy.getAttribute('data-state')==='failed'&&(await native()).includes('[exit 127]'),`${n}: pbcopy is missing today`);
   ok(await page.locator('[data-testid="copy-card"],[data-testid="copy-line"],[data-testid="copy-notice"]').count()===0,`${n}: nothing to press today`);
   await fits(`${n} copy`);await shot(`${n}-1-copy`,true);
  }else{
   ok(await pbcopy.getAttribute('data-state')==='succeeded',`${n}: pbcopy succeeded`);
   if(d===2){
    ok(await page.getByTestId('copy-line').getAttribute('data-direct')==='true'&&await page.getByTestId('copy').count()===0,`${n}: Chromium copies directly`);
    ok((await native()).match(/copied \d+ lines/)&&(await native()).includes('[exit 0]'),`${n}: agent told it is copied`);
    await shot(`${n}-1-copy-chromium`);
    await page.locator('#browser').selectOption('gesture');
   }
   ok((await native()).match(/offered \d+ lines/)&&(await native()).includes('Do not tell them it is already copied'),`${n}: agent told it is only offered`);
   const pv=page.getByTestId('copy-preview');
   if(d!==2)ok((await pv.innerText()).includes(en?'Hi Aino':'Hei Aino'),`${n}: copy shows its text`);
   await fits(`${n} copy`);await shot(`${n}-1-copy`,true);
   await page.getByTestId('copy').click();await page.waitForTimeout(60);
   ok(await page.locator('#step').inputValue()==='copied',`${n}: one press copies`);
   const doneText=await page.locator('[data-testid="copy-card"],[data-testid="copy-line"],[data-testid="copy-notice"]').first().innerText();
   ok(doneText.includes(en?'opied to your clipboard':'opioitu leikepöydällesi'),`${n}: says it is copied`);
   if(d===2){await page.getByTestId('copy-show').click();ok((await page.getByTestId('copy-preview').innerText()).includes(en?'Hi Aino':'Hei Aino'),`${n}: line opens to the text`);}
   await shot(`${n}-2-copied`);
   await page.locator('#browser').selectOption('chromium');
  }
  // 3: the request.
  await step('ask');
  if(d===0){
   ok(await tool('pbpaste').getAttribute('data-state')==='failed',`${n}: pbpaste missing today`);
   await step('preview');
   ok((await page.locator('textarea').last().inputValue()).includes('line 118'),`${n}: today the person pastes it as a message`);
   await step('given');
   ok(await page.getByTestId('user-content').filter({hasText:'line 118'}).count()===1,`${n}: today it is the person's message`);
   await step('secret');await step('declined');
   ok(await page.getByTestId('user-content').filter({hasText:'OH_DEMO_TOKEN'}).count()===1&&await page.getByTestId('secret-warn').count()===0,`${n}: today nothing warns about a key`);
   await fits(`${n} paste`);await shot(`${n}-3-paste`,true);
   continue;
  }
  const req=page.getByTestId(ask[d]);
  ok(await req.count()===1,`${n}: the request shows`);
  ok(await tool('pbpaste').getAttribute('data-state')==='running',`${n}: pbpaste waits`);
  ok((await page.getByTestId('waiting').innerText()).includes('10.26'),`${n}: says until when it waits`);
  ok((await page.locator('header').filter({hasText:waitWord}).count())>=1,`${n}: header says it waits for you`);
  ok(!(await req.innerText()).includes('line 118'),`${n}: nothing read before a press`);
  ok((await native()).includes('still running'),`${n}: agent has nothing yet`);
  await fits(`${n} ask`);await shot(`${n}-3-ask`,true);
  // 4: a press reads; the text is shown, not yet given.
  await page.getByTestId('paste').click();await page.waitForTimeout(60);
  ok(await page.locator('#step').inputValue()==='preview',`${n}: paste shows the preview`);
  const shown=d===2?await page.getByTestId('paste-field').inputValue():await page.getByTestId('paste-preview').innerText();
  ok(shown.includes('line 118'),`${n}: preview shows the clipboard`);
  ok((await page.getByTestId('paste-size').innerText()).includes(en?'not yet given':'ei vielä annettu'),`${n}: says not yet given`);
  ok((await native()).includes('still running'),`${n}: still nothing for the agent`);
  ok(await page.getByTestId('secret-warn').count()===0,`${n}: no key warning on a traceback`);
  await fits(`${n} preview`);await shot(`${n}-4-preview`,true);
  // 5: given.
  await page.getByTestId('give').click();await page.waitForTimeout(60);
  ok(await page.getByTestId('settled').getAttribute('data-outcome')==='given',`${n}: given line`);
  ok(await tool('pbpaste').getAttribute('data-state')==='succeeded'&&(await native()).includes('[exit 0'),`${n}: agent gets stdout, exit 0`);
  ok(await page.getByTestId('user-content').filter({hasText:'line 118'}).count()===0,`${n}: not drawn as the person's message`);
  await fits(`${n} given`);await shot(`${n}-5-given`);
  // 6–7: a key on the clipboard; not given.
  await step('secret');
  ok(await page.getByTestId('secret-warn').count()===1,`${n}: key warning`);
  await fits(`${n} secret`);await shot(`${n}-6-secret`,true);
  await page.getByTestId('cancel').click();await page.waitForTimeout(60);
  ok(await page.locator('#step').inputValue()==='declined'&&await page.getByTestId('settled').getAttribute('data-outcome')==='declined',`${n}: not given`);
  ok((await native()).includes('[exit 1]')&&(await native()).includes('clipboard_declined'),`${n}: agent gets exit 1`);
  ok(!(await native()).includes('OH_DEMO_TOKEN'),`${n}: the key never reaches the agent`);
  await shot(`${n}-7-declined`);
  // Not giving from the request itself.
  await step('ask');await page.getByTestId('dont-give').click();await page.waitForTimeout(60);
  ok(await page.locator('#step').inputValue()==='declined',`${n}: Don't give from the request`);
  // 8: nobody answered.
  await step('away');
  ok(await page.getByTestId('settled').getAttribute('data-outcome')==='expired'&&(await native()).includes('[exit 4]'),`${n}: expired, exit 4`);
  ok(await page.getByTestId(ask[d]).count()===0,`${n}: no open request after expiry`);
  await fits(`${n} away`);await shot(`${n}-8-away`);
 }
 await page.getByTestId('reset').click();
 ok(served===1,`${tag}: one document load`);
 ok(page.url()===`${origin}/view`,`${tag}: address unchanged`);
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(stray,[],`requests besides the view:\n${stray.join('\n')}`);
assert.deepEqual(errors,[],`console errors:\n${errors.join('\n')}`);
console.log(`${checks} checks passed; screenshots in ${out}`);
