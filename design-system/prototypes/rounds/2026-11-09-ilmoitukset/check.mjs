// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. For
// each direction (Nyt, A, B, C), at 1440 px and 390 px (touch), light and
// dark, device scale factor 2, named r1-<direction>-<case>[-<step>]-<width>-<theme>:
//   kaikki          the default view: the 9.11. morning at once;
//   kaikki-auki     A and C opened to every notice;
//   epavarma-ping   "ping" sent while the earlier send is uncertain;
//   <case>          every other case, at 1440 light only.
// It asserts what each direction promises on its default view: Nyt shows
// today's competing pieces, A a page strip and two notices above the field
// with "1 muu", B the notice under the message and the attachment notice in
// the composer, C no strip and one line counting the rest. In every
// direction the uncertain message has exactly one notice; a refused "ping"
// extends it, where today it is a line that vanishes after six seconds.
// The console must stay clean and nothing may overflow sideways.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-09-ilmoitukset';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['d0-nyt','d1-kentan-ylla','d2-asian-luona','d3-yksi-rivi'];
const CASES=['epavarma','torjuttu','liite','tallennus','tila','kirjautuminen','historia','worker'];
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const runs=[{width:1440,theme:'light'},{width:1440,theme:'dark'},{width:390,theme:'light'},{width:390,theme:'dark'}];
try{
for(const {width,theme} of runs){
 const mobile=width===390,H=mobile?844:900,full=width===1440&&theme==='light';
 const context=await browser.newContext({viewport:{width,height:H},deviceScaleFactor:2,reducedMotion:'reduce',isMobile:mobile,hasTouch:mobile});
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('https://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));
 await page.goto('https://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 await checkPicker(page,round);
 const tag=`${width}-${theme}`;
 const fits=async()=>ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'document overflow');
 const press=async(loc)=>{await loc.scrollIntoViewIfNeeded();await (mobile?loc.tap():loc.click());};
 const pick=async(c)=>{await page.locator('#case').selectOption(c);await page.locator(`.rq-review[data-case="${c}"]`).waitFor({state:'attached'});await page.waitForTimeout(200);};
 const about=(re)=>page.locator('.ah-warning, .ah-notice, [data-testid=waiting-message] .ah-status, .ah-composer-notice').filter({hasText:re});
 for(const d of [0,1,2,3]){
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.rq-review.variant-${d}`).waitFor({state:'attached'});
  const shot=async(step)=>{await page.waitForTimeout(250);await fits();await page.screenshot({path:`${out}/r1-${names[d]}-${step}-${tag}.png`});};
  await pick('kaikki');
  assert.match(await page.getByTestId('direction-lines').locator('li[aria-current]').innerText(),new RegExp(`^${['Nyt:','A ','B ','C '][d]}`));checks++;
  const stream=page.locator('.ah-conversation-stream');
  const composer=page.locator('.ah-composer');
  if(d===0){
   ok(await page.getByTestId('waiting-message').count()===1,'today: the dashed bubble');
   ok(await page.getByTestId('history-unavailable').count()===1,'today: the history warning above the field');
   ok(await page.getByTestId('history-stale').count()===1,'today: a second history box in the timeline');
   ok(await page.getByTestId('attachment-refusal').count()===1,'today: the bare refusal line');
   ok(await page.getByTestId('ai-sign-in-warning').count()===1,'today: the sign-in warning above the field');
   ok(await page.getByTestId('nt-page').count()===0,'today: no page strip');
  }else{
   ok(await page.getByTestId('waiting-message').count()===0,'no dashed bubble');
   ok(await page.getByTestId('attachment-refusal').count()===0,'no bare line');
   ok(await page.locator('.ah-notice').count()===0,'no second notice look');
  }
  if(d===1){
   ok(await page.getByTestId('nt-page').getByTestId('note-signin').count()===1,'A: the sign-in in the page strip');
   ok(await page.getByTestId('nt-stack').locator('.ah-warning').count()===2,'A: two notices above the field');
   ok(/1 muu/.test(await page.getByTestId('nt-more').innerText()),'A: one more behind the link');
  }
  if(d===2){
   ok(await page.getByTestId('nt-page').getByTestId('note-signin').count()===1,'B: the sign-in in the page strip');
   ok(await stream.getByTestId('note-message').count()===1,'B: the message notice in the conversation');
   ok(await composer.getByTestId('note-attachments').count()===1,'B: the attachment notice in the composer');
   ok(await composer.getByTestId('note-worker').count()===1,'B: the worker notice by the strip');
  }
  if(d===3){
   ok(await page.getByTestId('nt-page').count()===0,'C: no page strip');
   ok(await page.getByTestId('nt-line').count()===1,'C: one line');
   ok((await page.getByTestId('nt-count').innerText()).trim()==='+3','C: three more counted');
   ok(/Claude/.test(await page.getByTestId('nt-line').innerText()),'C: the most serious first');
  }
  if(d===1||d===2) ok(await about(/saiko agentti|historiaa/i).count()===1,'one notice about the message');
  await shot('kaikki');
  if(d===1||d===3){
   await press(page.getByTestId(d===1?'nt-more':'nt-show'));
   await page.getByTestId('note-message').waitFor();checks++;
   ok(await page.getByTestId('nt-stack').locator('.ah-warning').count()===(d===1?3:4),'every notice open');
   ok(await about(/saiko agentti|historiaa/i).count()===1,'one notice about the message');
   await shot('kaikki-auki');
  }

  // The refused ping, today and in the system.
  await pick('epavarma');
  const field=page.locator('.ah-cbox textarea').first();
  await field.click();await page.keyboard.press('End');await page.keyboard.press('Enter');
  if(d===0){
   await page.getByTestId('composer-notice').waitFor();checks++;
   ok(/Viestiä ei lähetetty/.test(await page.getByTestId('composer-notice').innerText()),'today: the grey line');
   await shot('epavarma-ping');
   if(full){await page.getByTestId('composer-notice').waitFor({state:'detached',timeout:9000});checks++;}
  }else{
   await page.getByTestId(d===3?'nt-line':'note-message').filter({hasText:/uutta viestiäsi ei lähetetty/i}).waitFor();checks++;
   ok(await about(/saiko agentti|ei lähetetty/i).count()===1,'the refusal merged into the one notice');
   ok(await page.getByTestId('composer-notice').count()===0,'no vanishing line');
   await shot('epavarma-ping');
  }

  if(full){
   for(const c of CASES){
    await pick(c);
    if(d>0&&c!=='worker'&&c!=='epavarma'){
     const n=await page.locator('.ah-warning').count();
     ok(n>=1,`${c}: a notice`);
    }
    await shot(c);
   }
   if(d>0){
    await pick('liite');
    if(d===3) await press(page.getByTestId('nt-show'));
    await press(page.getByTestId('fix-dismiss').first());
    ok(await page.getByTestId('note-attachments').count()===0,'a refusal can be dismissed');
   }
  }
 }
 await context.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
