// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. For
// "Nyt" (production unchanged) and each direction, at 1440 px and 390 px
// (touch), light and dark, device scale factor 2, named
// r1-<direction>-<step>-<width>-<theme>:
//   0-oletus      the default view: the moment the archive press is made;
//   1-keskustelu  the conversation before archiving, two helpers in the strip;
//   1-avustajat   (Nyt) the Avustajat list behind the chip;
//   2-vahvistus   (1 Vahvistus) the question before archiving;
//   2-arkistoitu  the workspace page right after archiving, its notice;
//   2-haara       (2 Ilmoitus) Avaa haara;
//   3-arkisto     the workspace's archive opened;
//   4-palautettu  the conversation restored from the archive;
//   4-avustajat   the helpers after restoring, behind the chip.
// It asserts the timing each direction promises: Nyt's notice is gone after
// its 8 s, 2 Ilmoitus's stays until closed; production's own archive words
// name both helpers and the round still under way. The console must stay
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
const round='2026-11-08-avustajien-arkistointi';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['0-nyt','1-vahvistus','2-ilmoitus','3-arkistossa'];
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const runs=[{width:1440,theme:'light'},{width:1440,theme:'dark'},{width:390,theme:'light'},{width:390,theme:'dark'}];
try{
for(const {width,theme} of runs){
 const mobile=width===390,H=mobile?844:900;
 const page=await browser.newPage({viewport:{width,height:H},deviceScaleFactor:2,reducedMotion:'reduce',isMobile:mobile,hasTouch:mobile});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 await checkPicker(page,round);
 const tag=`${width}-${theme}`;
 const fits=async()=>ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'document overflow');
 const press=async(loc)=>{await loc.scrollIntoViewIfNeeded();await (mobile?loc.tap():loc.click());};
 const notice=page.getByTestId('archive-notice');
 for(const d of [0,1,2,3]){
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.rq-review.variant-${d}`).waitFor({state:'attached'});
  const shot=async(step)=>{await page.waitForTimeout(300);await fits();await page.screenshot({path:`${out}/r1-${names[d]}-${step}-${tag}.png`});};
  assert.match(await page.getByTestId('direction-lines').locator('li[aria-current]').innerText(),new RegExp(`^${d?d+' ':'Nyt'}`));checks++;
  // The default view: the archive press has just been made.
  if(d===1){
   await page.getByTestId('aa-confirm').waitFor();checks++;
   ok(await page.getByTestId('aa-helper-row').count()===2,'the question lists both helpers');
   ok(await page.locator('[data-testid="aa-helper-row"][data-branch]').count()===1,'one helper keeps work on its branch');
  }else{
   await notice.waitFor();checks++;
   const text=await notice.innerText();
   if(d===0){
    ok(/Avustajat arkistoitiin mukana \(Prototyyppari, Katselmoija\)/.test(text),'production words name both helpers');
    ok(/Kierros on vielä kesken \(Katselmoija\)/.test(text),'and the round still under way');
   }
   if(d===2) ok(await page.getByTestId('notice-link').innerText()==='Avaa haara','Avaa haara in the notice');
   if(d===3){
    ok(await page.getByTestId('aa-archive-helper').count()===2,'helpers as rows in the archive');
    ok(await page.getByTestId('notice-link').innerText()==='Näytä arkistossa','the notice points to the archive');
   }
  }
  await shot('0-oletus');
  // From the conversation before archiving.
  await press(page.getByTestId('rq-reset'));
  await page.locator('.aa-stage[data-stage="conversation"]').waitFor();checks++;
  const chip=page.getByTestId('background-helpers');
  await chip.waitFor();checks++;
  ok(await chip.locator('.ah-worker-mark').count()===2,'two Pallot marks in the chip');
  await shot('1-keskustelu');
  if(d===0){
   await press(chip);
   await page.getByTestId('helper-Katselmoija').waitFor();checks++;
   await shot('1-avustajat');
   await page.keyboard.press('Escape');
   await page.waitForTimeout(200);
  }
  if(mobile){
   await press(page.locator('.ah-header-more'));
   await press(page.getByRole('menuitem',{name:/Arkistoi/}));
  }else await press(page.getByTestId('archive-conversation'));
  if(d===1){
   await page.getByTestId('aa-confirm').waitFor();checks++;
   await shot('2-vahvistus');
   await press(page.getByTestId('aa-confirm-archive'));
  }
  await notice.waitFor();checks++;
  await page.locator('.aa-stage[data-stage="workspace"]').waitFor();checks++;
  await shot('2-arkistoitu');
  if(d===2){
   await press(page.getByTestId('notice-link'));
   await page.getByTestId('aa-branch').waitFor();checks++;
   ok(/katselmoija-saavutettavuus/.test(await page.getByTestId('aa-branch-name').innerText()),'the branch by name');
   await shot('2-haara');
   await press(page.getByTestId('aa-branch-close'));
  }
  if(d===0||d===2){
   await page.mouse.move(0,H-1);
   await page.waitForTimeout(8800);
   ok(await notice.count()===(d===2?1:0),d===2?'2 Ilmoitus stays until closed':'production notice is gone after 8 s');
  }
  if(!(await page.getByTestId('aa-archive').evaluate(el=>el.open))) await press(page.getByTestId('aa-archive-summary'));
  await page.getByTestId('aa-archive-entry').waitFor();checks++;
  await page.getByTestId('aa-archive').scrollIntoViewIfNeeded();
  await shot('3-arkisto');
  await press(page.getByTestId('aa-archive-entry').getByTestId('restore-conversation'));
  await page.locator('.aa-stage[data-stage="restored"]').waitFor();checks++;
  if(d===3) ok(await page.getByTestId('aa-restored-row').count()===2,'restoring says what happened meanwhile');
  if(d===1||d===2) ok(/Palautettu/.test(await notice.innerText()),'a restore notice');
  if(d===0) ok(await notice.count()===0,'production says nothing on restore');
  await shot('4-palautettu');
  await press(page.getByTestId('background-helpers'));
  await page.getByTestId('helper-Katselmoija').waitFor();checks++;
  ok(/haarassa/.test(await page.getByTestId('helper-Katselmoija').innerText()),'the restored helper says its work is on the branch');
  await shot('4-avustajat');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
