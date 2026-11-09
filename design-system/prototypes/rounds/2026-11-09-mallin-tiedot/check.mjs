// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. For
// each direction, at 1440 px and 390 px (touch), light and dark, device
// scale factor 2, named r1-<direction>-<step>-<width>-<theme>:
//   0-oletus   the conversation with the model popover open;
//   A 1-valinta  Sonnet 5.5 picked: the consequence and the commit;
//   A 2-vaihdettu  committed: the chip says Sonnet, the thread a change row;
//   A 3-tyossa   the agent working: the picker disabled with its reason;
//   C 1-oletus   the default model's pointer pressed (a toast here);
//   C 2-uusi     a new conversation with the composer's picker open.
// It asserts what each direction promises on its default view: A offers
// radio rows and a thinking control, B states the facts with no control in
// the popover, C states one line and two ways out. The console must stay
// clean and nothing may overflow sideways.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-09-mallin-tiedot';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['a-vaihda','b-tietona','c-lyhyesti'];
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const runs=[{width:1440,theme:'light'},{width:1440,theme:'dark'},{width:390,theme:'light'},{width:390,theme:'dark'}];
try{
for(const {width,theme} of runs){
 const mobile=width===390,H=mobile?844:900;
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
 const inView=async(loc)=>{const b=await loc.boundingBox();ok(b&&b.y>=0&&b.y+b.height<=H+1&&b.x>=0&&b.x+b.width<=width+1,'popover inside the viewport');};
 for(const d of [0,1,2]){
  if(await page.locator('#working').isChecked())await page.locator('#working').uncheck();
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.rq-review.variant-${d}`).waitFor({state:'attached'});
  const shot=async(step)=>{await page.waitForTimeout(250);await fits();await page.screenshot({path:`${out}/r1-${names[d]}-${step}-${tag}.png`});};
  assert.match(await page.getByTestId('direction-lines').locator('li[aria-current]').innerText(),new RegExp(`^${'ABC'[d]} `));checks++;
  const pop=page.getByTestId('mi-pop');
  await pop.locator('section').waitFor();checks++;
  await inView(pop);
  const chip=page.getByTestId('conversation-model');
  ok(/Opus 5\.5/.test(await chip.innerText()),'the chip names the conversation model');
  const radios=pop.locator('input[type=radio]'),buttons=pop.locator('button, a');
  if(d===0){
   ok(await radios.count()===4,'four models to choose from');
   ok(await pop.locator('input[type=radio]:checked').count()===1,'one chosen');
   ok(await pop.getByRole('radiogroup').count()+await pop.locator('[role=radiogroup], .md-seg').count()>=1,'a thinking control');
  }
  if(d===1){
   ok(await radios.count()===0&&await buttons.count()===0,'no control in the popover');
   ok(await pop.locator('.md-info-ribbon, [aria-current]').count()===0,'no highlighted option rows');
   ok(/Fable 5\.1, Sonnet 5\.5 ja Haiku 5\.5/.test(await pop.getByTestId('mi-others').innerText()),'the others as a sentence');
   ok(/claude-opus-5-5/.test(await pop.innerText()),'the model id stated');
  }
  if(d===2){
   ok(await radios.count()===0,'no model list');
   ok(await pop.getByTestId('mi-new').count()===1&&await pop.getByTestId('mi-default').count()===1,'two ways out');
  }
  await shot('0-oletus');

  if(d===0){
   await press(pop.getByTestId('model-claude-sonnet-5-5'));
   await pop.getByTestId('mi-impact').waitFor();checks++;
   ok(/12 % sen kontekstista/.test(await pop.getByTestId('mi-impact').innerText()),'the consequence names the context share');
   await shot('1-valinta');
   await press(pop.getByTestId('mi-commit'));
   await page.getByTestId('model-change').waitFor();checks++;
   ok(/Opus 5\.5 → Sonnet 5\.5/.test(await page.getByTestId('model-change').innerText()),'the change row in the thread');
   ok(/Sonnet 5\.5/.test(await chip.innerText()),'the chip follows');
   await shot('2-vaihdettu');
   await page.locator('#working').check();
   await page.evaluate(()=>{document.querySelector('.md-chip-picker').open=true;});
   await pop.getByTestId('mi-busy').waitFor();checks++;
   ok(await pop.locator('input[type=radio]:disabled').count()===4,'every row disabled while working');
   await shot('3-tyossa');
   await page.keyboard.press('Escape');
  }
  if(d===2){
   await press(pop.getByTestId('mi-default'));
   await page.getByTestId('mi-toast').waitFor();checks++;
   await shot('1-oletus');
   await press(pop.getByTestId('mi-new'));
   await page.getByTestId('composer-model-menu').waitFor({state:'visible'});checks++;
   ok(await page.getByTestId('composer-model-menu').locator('input[type=radio]').count()===4,'the composer offers the models');
   ok(await page.locator('.ah-agent-header').filter({hasText:'Uusi keskustelu'}).count()===1,'a new conversation');
   await shot('2-uusi');
  }
 }
 await context.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
