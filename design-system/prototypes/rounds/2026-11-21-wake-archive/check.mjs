// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Walks the three directions at 1440 and 390 px in Päivä, Yö and Kontrasti
// with reduced motion: the default view (Varakopion poisto open with its
// pending wake under the reply, the waiting rows in Hiljaiset with their
// wake times, nothing asked yet, no overflow). Then each direction's flow:
// archiving from the rail row and from the header (the phone through the
// header menu), Esc keeps and returns focus to the archive button, Enter
// archives, the production notice names the cancelled wake and its Restore
// undoes both, several wakes in one conversation, a conversation without a
// wake archives without a question, and a later restore from the archived
// foot leaves Habitat's line with what the agent hears. English last.
// Screenshots at device scale 2 into <out-dir>.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-21-wake-archive';
const [input,out,flag]=process.argv.slice(2);
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['rivilla','ikkuna','heti'];
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};

async function open(width,theme,lang='fi'){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:1000},deviceScaleFactor:2,reducedMotion:'reduce',hasTouch:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 if(lang==='en')await page.locator('#language').selectOption('en');
 return page;
}
const pick=async(page,d)=>{await page.locator('.proto-picker-item').nth(d).click();await page.locator(`.ra-review[data-direction="${d}"]`).waitFor({state:'attached'});await page.waitForTimeout(150);};
const shot=(page,name)=>page.screenshot({path:`${out}/${name}.png`});
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const row=(page,id)=>page.locator(`[data-testid="agent-item-${id}"]`);
const inRail=async(page,id)=>(await row(page,id).count())>0;
const inQuiet=(page,id)=>page.locator(`[data-testid="rail-quiet"] [data-testid="agent-item-${id}"]`).count();
const wakeEnd=(page,id)=>row(page,id).locator('time.ah-nav-time').getAttribute('data-wake');
const has=async(page,id)=>(await page.getByTestId(id).count())>0;
const focused=page=>page.evaluate(()=>document.activeElement?.getAttribute('data-archive-agent')??document.activeElement?.getAttribute('data-testid'));
const phone=page=>page.evaluate(()=>innerWidth<800);
const drawer=page=>page.locator('.ah-shell-body.ah-mobile-open').count();
async function openRail(page){if(await phone(page)&&!(await drawer(page))){await page.getByTestId('navigation-open').click();await page.waitForTimeout(250);}}
async function closeRail(page){
 if(!(await phone(page))||!(await drawer(page)))return;
 await page.locator('.ah-rail-content').first().focus().catch(()=>{});
 await page.keyboard.press('Escape');await page.waitForTimeout(250);
 if(await drawer(page))await page.getByTestId('navigation-open').click({force:true});
 await page.waitForTimeout(200);
 assert.equal(await drawer(page),0,'drawer closes');
 // No focus tooltip on the menu button in the screenshots.
 await page.evaluate(()=>document.activeElement?.blur());
}
async function openRow(page,id){
 await openRail(page);
 await row(page,id).locator('a.ah-nav-link').click();
 await page.waitForFunction(i=>document.querySelector('[data-testid="conversation"]')?.dataset.conversation===i,id);
 await page.waitForTimeout(150);
}
async function railArchive(page,id){
 await openRail(page);
 await row(page,id).hover();
 await page.locator(`[data-archive-agent="${id}"]`).click();
 await page.waitForTimeout(250);
}
async function headerArchive(page){
 if(await phone(page)){
  await page.getByTestId('conversation-menu').click();
  await page.getByTestId('menu-archive').click();
 }else await page.getByTestId('archive-conversation').click();
 await page.waitForTimeout(250);
}
const noticeDetail=async page=>(await page.getByTestId('archive-notice-detail').count())?(await page.getByTestId('archive-notice-detail').textContent()):null;
const asked=async page=>(await has(page,'inline-confirm'))||(await has(page,'wake-archive-dialog'));

async function defaultView(page,at){
 eq(await page.getByTestId('conversation').getAttribute('data-conversation'),'backup',`${at}: backup open`);
 ok(await page.getByTestId('wake-pending').isVisible(),`${at}: pending wake below the reply`);
 ok(!(await asked(page)),`${at}: nothing asked yet`);
 ok(!(await has(page,'archive-notice')),`${at}: no notice yet`);
 eq(await page.locator('.ra-lines li[aria-current]').count(),1,`${at}: its line is marked`);
 ok(await fits(page),`${at}: document overflow`);
 await openRail(page);
 for(const id of ['backup','order','lease','receipts'])eq(await inQuiet(page,id),1,`${at}: ${id} in Hiljaiset`);
 eq(await wakeEnd(page,'backup'),'to 9.00',`${at}: backup's wake time`);
 eq(await wakeEnd(page,'lease'),'1.12. 10.00',`${at}: lease's next wake`);
 eq(await wakeEnd(page,'receipts'),null,`${at}: no wake keeps the age`);
 ok(await fits(page),`${at}: rail overflow`);
}

/** Rail: Esc keeps, the next press confirms with Enter (1, 2) or archives at once (3). */
async function railFlow(page,d,tag){
 const at=`${names[d]} ${tag} rail`;
 await railArchive(page,'backup');
 if(d===2){
  ok(!(await asked(page)),`${at}: nothing asked`);
 }else{
  if(d===0){
   ok(await row(page,'backup').getByTestId('inline-confirm').isVisible(),`${at}: confirm inside the row`);
   ok((await page.getByTestId('inline-confirm').textContent()).includes('to 9.00'),`${at}: names the wake`);
  }else{
   ok(await page.getByTestId('wake-archive-dialog').isVisible(),`${at}: the window`);
   ok((await page.getByTestId('wake-archive-dialog').textContent()).includes('Muistuta poistamaan backup-2024'),`${at}: the window names the note`);
   eq(await page.getByTestId('dialog-wake').count(),1,`${at}: one wake`);
  }
  eq(await focused(page),d===0?'inline-archive':'dialog-archive',`${at}: Archive has focus`);
  await shot(page,`${d}-${names[d]}-${tag}-rail-ask`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  ok(!(await asked(page)),`${at}: Esc keeps`);
  ok(await inRail(page,'backup'),`${at}: row still there`);
  eq(await focused(page),'backup',`${at}: focus back on the row's archive button`);
  eq(await wakeEnd(page,'backup'),'to 9.00',`${at}: wake kept`);
  await railArchive(page,'backup');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
 }
 ok(!(await inRail(page,'backup')),`${at}: archived, the row left`);
 ok(await page.getByTestId('archive-notice').isVisible(),`${at}: the notice`);
 eq(await noticeDetail(page),' · herätys to 9.00 peruttu',`${at}: the notice says the wake was cancelled`);
 await closeRail(page);
 ok(await page.getByTestId('archived-foot').isVisible(),`${at}: the open conversation shows it archived`);
 ok((await page.getByTestId('wake-cancelled').textContent()).includes('to 19.11. klo 9.00'),`${at}: Habitat's line names the wake`);
 ok(!(await has(page,'agent-hears')),`${at}: nothing told while archived`);
 ok(await fits(page),`${at}: overflow after archive`);
 await shot(page,`${d}-${names[d]}-${tag}-rail-archived`);
 await page.getByTestId('restore-notice').click();
 await page.waitForTimeout(150);
 ok(!(await has(page,'wake-cancelled')),`${at}: undo, no line`);
 ok(await page.getByTestId('wake-pending').isVisible(),`${at}: undo brings the wake back`);
 await openRail(page);
 eq(await wakeEnd(page,'backup'),'to 9.00',`${at}: undo, the row's wake time`);
 await closeRail(page);
}

/** Header: several wakes, then a later restore from the foot. */
async function headerFlow(page,d,tag){
 const at=`${names[d]} ${tag} header`;
 await openRow(page,'lease');
 eq(await page.getByTestId('wake-pending').count(),2,`${at}: two pending wakes`);
 await headerArchive(page);
 if(d===0){
  ok((await page.getByTestId('inline-confirm').textContent()).includes('2 herätystä perutaan'),`${at}: names both`);
  eq(await focused(page),'inline-archive',`${at}: Archive has focus`);
 }
 if(d===1){
  eq(await page.getByTestId('dialog-wake').count(),2,`${at}: both wakes listed`);
  ok((await page.getByTestId('dialog-archive').textContent()).includes('herätykset'),`${at}: plural action`);
 }
 if(d!==2){
  ok(await fits(page),`${at}: overflow while asking`);
  await shot(page,`${d}-${names[d]}-${tag}-header-ask`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  ok(!(await asked(page)),`${at}: Esc keeps`);
  if(!(await phone(page)))eq(await focused(page),'archive-conversation',`${at}: focus back on the header's archive`);
  await headerArchive(page);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
 }
 eq(await noticeDetail(page),' · 2 herätystä peruttu',`${at}: notice counts the wakes`);
 ok(await page.getByTestId('archived-foot').isVisible(),`${at}: archived foot`);
 ok((await page.getByTestId('wake-cancelled').textContent()).includes('ma 4.1.2027'),`${at}: line names both`);
 await page.mouse.move(600,700);
 await page.getByTestId('notice-close').click();
 await page.getByTestId('archived-foot-restore').click();
 await page.waitForTimeout(150);
 ok(!(await has(page,'archived-foot')),`${at}: restored`);
 ok(await page.getByTestId('agent-hears').isVisible(),`${at}: what the agent hears`);
 eq(await page.getByTestId('wake-pending').count(),0,`${at}: a later restore leaves the wakes cancelled`);
 ok(await fits(page),`${at}: overflow after restore`);
 await shot(page,`${d}-${names[d]}-${tag}-header-restored`);
 await openRail(page);
 eq(await inQuiet(page,'lease'),1,`${at}: back in Hiljaiset`);
 eq(await wakeEnd(page,'lease'),null,`${at}: no wake time`);
 // A conversation without a wake archives as today, in every direction.
 await row(page,'receipts').hover();
 await page.locator('[data-archive-agent="receipts"]').click();
 await page.waitForTimeout(150);
 ok(!(await asked(page)),`${at}: no wake, no question`);
 ok(!(await inRail(page,'receipts')),`${at}: archived at once`);
 eq(await noticeDetail(page),null,`${at}: plain notice`);
 await closeRail(page);
}

try{
for(const width of quick?[1440]:[1440,390])for(const theme of quick?['light']:['light','dark','contrast']){
 const tag=`${width}-${theme}`;
 const page=await open(width,theme);
 await checkPicker(page,round);
 eq(await page.getByTestId('recommendation').count(),1,'the recommendation is on the page');
 for(let d=0;d<3;d++){
  await pick(page,d);
  await closeRail(page);
  await defaultView(page,`${names[d]} ${tag}`);
  await shot(page,`${d}-${names[d]}-${tag}`);
  await closeRail(page);
  if(theme!=='contrast'){
   await railFlow(page,d,tag);
   await headerFlow(page,d,tag);
   await page.getByTestId('event-reset').click();
   await page.waitForTimeout(150);
  }
 }
 await page.close();
}
{
 const en=await open(1440,'light','en');
 await pick(en,1);
 await railArchive(en,'order');
 ok((await en.getByTestId('wake-archive-dialog').textContent()).includes("the agent's own follow-up"),'English: the window says who set it');
 ok((await en.getByTestId('dialog-archive').textContent()).includes('Archive and cancel the wake'),'English: action');
 await shot(en,'en-1-ikkuna-1440-light');
 await en.getByTestId('dialog-archive').click();
 ok((await noticeDetail(en)).includes('wake Wed 14:00 cancelled'),'English: notice');
 await pick(en,0);
 await railArchive(en,'backup');
 ok((await en.getByTestId('inline-confirm').textContent()).includes('The wake Thu 9:00 is cancelled.'),'English: inline');
 await shot(en,'en-0-rivilla-1440-light');
 await en.close();
 const enPhone=await open(390,'dark','en');
 await pick(enPhone,1);
 await closeRail(enPhone);
 await headerArchive(enPhone);
 ok(await enPhone.getByTestId('wake-archive-dialog').isVisible(),'English phone: the window from the header menu');
 ok(await fits(enPhone),'English phone fits');
 await shot(enPhone,'en-1-ikkuna-390-dark');
 await enPhone.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[],'console errors');
console.log(`${checks} checks passed`);
