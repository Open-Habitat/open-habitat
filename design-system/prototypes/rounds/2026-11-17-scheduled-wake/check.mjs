// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Walks Nyt and the three directions at 1440 and 390 px in Päivä, Yö and
// Kontrasti with reduced motion: every row is in its section (Nyt: the
// scheduled conversations stay quiet and nothing woke; 1: a woken and a
// late-woken reply in Sinun vuorosi, the waiting rows in Hiljaiset with
// their wake time where the age is; 2: the waiting rows in their own
// Herätykset section in wake order; 3: the waiting rows' marks drawn as a
// clock), the conversation shows the direction's pending wake (1 a line
// below the reply, 2 a bar at the foot, 3 a header menu, Nyt nothing), the
// document does not overflow, and at 390 the rail opens from the menu.
// Then the flow: change a wake, cancel another from a different row,
// advance the clock so the moved wake fires and rises to Sinun vuorosi,
// open it (read), the late wake's line, the last wake, then cancel from
// direction 2's bar and direction 3's menu, English last.
// Screenshots at device scale 2: <n>-<direction>-<width>-<theme>.png and
// flow-*.png.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-17-scheduled-wake';
const [input,out,flag]=process.argv.slice(2);
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['nyt','aika','osio','kello'];
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};

async function open(width,theme,opts={}){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:1000},deviceScaleFactor:2,reducedMotion:'reduce',forcedColors:opts.forced?'active':'none',hasTouch:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 return page;
}
const pick=async(page,d)=>{await page.locator('.proto-picker-item').nth(d).click();await page.locator(`.ra-review[data-direction="${d}"]`).waitFor({state:'attached'});await page.waitForTimeout(150);};
const shot=(page,name)=>page.screenshot({path:`${out}/${name}.png`});
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const inSection=(page,section,id)=>page.locator(`[data-testid="${section}"] [data-testid="agent-item-${id}"]`).count();
const row=(page,id)=>page.locator(`[data-testid="agent-item-${id}"]`);
const wakeEnd=(page,id)=>row(page,id).locator('time.ah-nav-time').getAttribute('data-wake');
const woke=async(page,id)=>(await row(page,id).locator('time.ah-nav-time').getAttribute('data-woke'))!==null;
const clockMark=async(page,id)=>row(page,id).evaluate(li=>li.hasAttribute('data-wake-clock')&&getComputedStyle(li.querySelector('.ah-row-mark-hit'),'::before').content!=='none');
const quietIds=page=>page.evaluate(()=>[...document.querySelectorAll('[data-testid="rail-quiet"] li[data-testid^="agent-item-"]')].map(l=>l.dataset.testid.slice(11)).sort());
const wakeIds=page=>page.evaluate(()=>[...document.querySelectorAll('[data-testid="rail-wakes"] li[data-testid^="agent-item-"]')].map(l=>l.dataset.testid.slice(11)));
const conv=page=>page.getByTestId('conversation').getAttribute('data-conversation');
const has=async(page,id)=>(await page.getByTestId(id).count())>0;
async function openRow(page,id){
 await row(page,id).locator('a.ah-nav-link').click();
 await page.waitForFunction(i=>document.querySelector('[data-testid="conversation"]')?.dataset.conversation===i,id);
}

async function directionChecks(page,d,at){
 eq(await inSection(page,'rail-running','release'),1,`${at}: release in Käynnissä`);
 eq(await inSection(page,'rail-yours','a11y'),1,`${at}: a11y in Sinun vuorosi`);
 eq(await conv(page),'backup',`${at}: the backup conversation is open`);
 if(d===0){
  eq(await quietIds(page),['backup','invoices','lease','order','receipts'],`${at}: nothing woke, all quiet`);
  eq(await page.locator('time[data-wake]').count(),0,`${at}: no wake times`);
  ok(await page.getByTestId('event-advance').isDisabled(),`${at}: no wakes to advance to`);
  ok(!(await has(page,'wake-pending'))&&!(await has(page,'wake-bar'))&&!(await has(page,'wake-menu')),`${at}: no pending wake in the conversation`);
  eq(await page.locator('[data-testid="conversation"] [data-tool-name]').count(),0,`${at}: no wake command`);
  return;
 }
 eq(await inSection(page,'rail-yours','invoices'),1,`${at}: the late-woken reply is in Sinun vuorosi`);
 eq(await page.locator('[data-testid="conversation"] [data-tool-name="bash"]').count(),1,`${at}: the wake command`);
 if(d===1){
  eq(await quietIds(page),['backup','lease','order','receipts'],`${at}: waiting rows quiet`);
  eq(await wakeEnd(page,'backup'),'to 9.00',`${at}: backup's wake time`);
  eq(await wakeEnd(page,'order'),'ke 14.00',`${at}: order's wake time`);
  eq(await wakeEnd(page,'lease'),'1.12. 10.00',`${at}: lease's wake date`);
  eq(await wakeEnd(page,'receipts'),null,`${at}: a quiet row without wake keeps its age`);
  ok(await woke(page,'invoices'),`${at}: the unread woken row says when it woke`);
  ok(await page.getByTestId('wake-pending').isVisible(),`${at}: pending wake below the reply`);
 }
 if(d===2){
  eq(await wakeIds(page),['order','backup','lease'],`${at}: Herätykset in wake order`);
  eq(await quietIds(page),['receipts'],`${at}: Hiljaiset keeps the rest`);
  eq(await wakeEnd(page,'backup'),'to 9.00',`${at}: time in the section`);
  ok(await page.getByTestId('wake-bar').isVisible(),`${at}: the bar at the foot`);
 }
 if(d===3){
  eq(await quietIds(page),['backup','lease','order','receipts'],`${at}: waiting rows quiet`);
  for(const id of ['backup','order','lease'])ok(await clockMark(page,id),`${at}: ${id} mark is a clock`);
  ok(!(await clockMark(page,'receipts')),`${at}: receipts' mark is not a clock`);
  eq(await page.locator('time[data-wake]').count(),0,`${at}: no time on the row`);
  ok(await has(page,'wake-menu'),`${at}: the header's wake menu`);
 }
}

try{
for(const width of quick?[1440]:[1440,390])for(const theme of quick?['light']:['light','dark','contrast']){
 const tag=`${width}-${theme}`;
 const page=await open(width,theme);
 await checkPicker(page,round);
 eq(await page.getByTestId('recommendation').count(),1,'the recommendation is on the page');
 for(let d=0;d<4;d++){
  await pick(page,d);
  const at=`${names[d]} ${tag}`;
  eq(await page.locator('.ra-lines li[aria-current]').count(),1,`${at}: its line is marked`);
  ok(await fits(page),`${at}: document overflow`);
  await directionChecks(page,d,at);
  if(width===390){
   await shot(page,`${d}-${names[d]}-${tag}-conversation`);
   await page.getByTestId('navigation-open').click();
   await page.waitForTimeout(250);
   ok(await page.locator('[data-testid="rail-yours"]').isVisible(),`${at}: the rail opens from the menu`);
   ok(await fits(page),`${at}: drawer overflow`);
  }
  await shot(page,`${d}-${names[d]}-${tag}`);
  if(width===390){await page.keyboard.press('Escape');await page.waitForTimeout(150);}
 }
 await page.close();
}

{
 // The flow in direction 1.
 const page=await open(1440,'light');
 await pick(page,1);
 await page.getByTestId('wake-change').click();
 await page.getByTestId('wake-input').fill('2026-11-20T09:00');
 await page.getByTestId('wake-save').click();
 ok(await page.getByTestId('wake-moved').isVisible(),'flow: the move is told in the conversation');
 ok((await page.getByTestId('wake-moved').textContent()).includes('pe 20.11. klo 9.00'),'flow: the new time in words');
 eq(await wakeEnd(page,'backup'),'pe 9.00','flow: the row shows the new time');
 await shot(page,'flow-1-moved');
 await openRow(page,'order');
 ok((await page.getByTestId('wake-pending').textContent()).includes('agentin oma seuranta'),'flow: the agent\'s own follow-up says so');
 await page.getByTestId('wake-cancel').click();
 ok(await page.getByTestId('wake-cancelled').isVisible(),'flow: the cancel is told');
 eq(await wakeEnd(page,'order'),null,'flow: the cancelled row has no wake time');
 eq(await inSection(page,'rail-quiet','order'),1,'flow: the cancelled row stays quiet');
 await shot(page,'flow-2-cancelled');
 ok((await page.getByTestId('event-advance').textContent()).includes('pe 20.11.'),'flow: the next wake is the moved one');
 await page.getByTestId('event-advance').click();
 ok((await page.getByTestId('clock').textContent()).includes('pe 20.11. klo 9.00'),'flow: the clock advanced');
 eq(await inSection(page,'rail-yours','backup'),1,'flow: the woken conversation rose to Sinun vuorosi');
 ok(await woke(page,'backup'),'flow: the unread woken row says when it woke');
 eq(await page.getByTestId('rail-yours').locator('.ah-rail-count').textContent(),'3','flow: Sinun vuorosi counts it');
 await shot(page,'flow-3-woke-rail');
 await openRow(page,'backup');
 ok(await page.getByTestId('wake-woke').isVisible(),'flow: Habitat says what woke it');
 ok((await page.getByTestId('conversation').textContent()).includes('backup-2026-11-18'),'flow: the agent\'s new message');
 ok(!(await woke(page,'backup')),'flow: opened, the row is read');
 eq(await row(page,'backup').locator('svg.oh-mark').getAttribute('data-state'),'read','flow: read mark');
 await shot(page,'flow-4-woke-conversation');
 await openRow(page,'invoices');
 eq(await page.getByTestId('wake-woke').getAttribute('data-tone'),'late','flow: the late wake is marked');
 ok((await page.getByTestId('wake-woke').textContent()).includes('7.40–10.35'),'flow: the late wake says why');
 await shot(page,'flow-5-late');
 await page.getByTestId('event-advance').click();
 eq(await inSection(page,'rail-yours','lease'),1,'flow: the last wake rose');
 ok(await page.getByTestId('event-advance').isDisabled(),'flow: no wakes left');
 await page.getByTestId('event-reset').click();
 eq(await wakeEnd(page,'backup'),'to 9.00','flow: reset');
 await page.close();
}
{
 // Direction 2's bar and direction 3's menu.
 const page=await open(1440,'dark');
 await pick(page,2);
 await page.getByTestId('wake-bar').getByTestId('wake-change').click();
 ok(await page.getByTestId('wake-editor').isVisible(),'bar: the editor opens');
 await shot(page,'flow-6-bar-editor');
 await page.getByTestId('wake-keep').click();
 await page.getByTestId('wake-bar').getByTestId('wake-cancel').click();
 eq(await wakeIds(page),['order','lease'],'bar: cancelled leaves Herätykset');
 eq(await inSection(page,'rail-quiet','backup'),1,'bar: and goes to Hiljaiset');
 ok(!(await has(page,'wake-bar')),'bar: gone');
 await pick(page,3);
 await page.getByTestId('wake-menu').click();
 ok(await page.getByTestId('menu-cancel').isVisible(),'menu: opens with cancel');
 await shot(page,'flow-7-header-menu');
 await page.getByTestId('menu-change').click();
 ok(await page.getByTestId('wake-editor').isVisible(),'menu: change opens the editor');
 await page.getByTestId('wake-input').fill('2026-11-18T08:00');
 await page.getByTestId('wake-save').click();
 ok((await page.getByTestId('wake-menu').textContent()).includes('ke 18.11. klo 8.00'),'menu: the header shows the new time');
 await page.getByTestId('wake-menu').click();
 await page.getByTestId('menu-cancel').click();
 await page.waitForTimeout(150);
 ok(!(await clockMark(page,'backup')),'menu: cancelled, the clock leaves the mark');
 ok(await page.getByTestId('wake-cancelled').isVisible(),'menu: the cancel is told');
 await page.close();

 const fc=await open(1440,'dark',{forced:true});
 await pick(fc,3);
 const color=await row(fc,'backup').locator('.ah-row-mark-hit').evaluate(e=>getComputedStyle(e,'::before').backgroundColor);
 ok(color&&color!=='rgba(0, 0, 0, 0)','forced colours: the clock keeps a colour');
 await shot(fc,'forced-3-kello');
 await fc.close();

 const en=await open(1440,'light');
 await en.locator('#language').selectOption('en');
 await pick(en,1);
 ok((await en.locator('[data-testid="rail-yours"] h2').textContent()).includes('Your turn'),'English: production heading');
 eq(await wakeEnd(en,'backup'),'Thu 9:00','English: the wake time');
 ok((await row(en,'backup').getAttribute('title')).includes('Waiting to wake Thu 19 Nov at 9:00'),'English: the row says when');
 await shot(en,'en-1440-light');
 await en.close();
 const enPhone=await open(390,'dark');
 await enPhone.locator('#language').selectOption('en');
 await pick(enPhone,1);
 ok(await fits(enPhone),'English phone fits');
 await shot(enPhone,'en-390-dark-conversation');
 await enPhone.getByTestId('navigation-open').click();
 await enPhone.waitForTimeout(250);
 await shot(enPhone,'en-390-dark');
 await enPhone.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[],'console errors');
console.log(`${checks} checks passed`);
