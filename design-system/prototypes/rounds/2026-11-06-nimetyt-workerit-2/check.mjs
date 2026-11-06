// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. For
// every riff, walks the scenario: two named workers (Prototyyppari and
// Katselmoija) wait beside a one-shot worker in the production Workers
// pill; the person asks the main agent to "riffaa A1:tä oikeilla
// kuvakaappauksilla"; the main agent relays (the prototyper's mark turns),
// the prototyper works, its round 3 report comes in (a fresh mark, the main
// agent's own summary in the conversation), the person opens its read-only
// conversation and comes back, and stops it. Screenshots at device scale
// factor 2 at 1440 px and 390 px (touch), light and dark, named
// r2-<riff>-<step>-<width>-<theme>. The console must stay clean.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-06-nimetyt-workerit-2';
const RIFF='riffaa A1:tä oikeilla kuvakaappauksilla';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['1-pallossa','2-sirut','3-avustajat'];
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
 const field=()=>page.locator('.ah-composer textarea').first();
 const row=id=>page.getByTestId(`named-${id}`);
 const phase=async(id,p)=>{await page.locator(`[data-testid="named-${id}"][data-phase="${p}"], [data-testid="chip-${id}"][data-phase="${p}"]`).first().waitFor({state:'attached',timeout:8000});checks++;};
 for(const d of [0,1,2]){
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.rq-review.variant-${d}`).waitFor({state:'attached'});
  const say=async name=>{await page.waitForTimeout(250);await fits();await page.screenshot({path:`${out}/r2-${names[d]}-${name}-${tag}.png`});};
  // Each riff opens its own place: the pill's panel, a chip's card, the Avustajat list.
  const open=async()=>{
   // The pill's panel stays open across the worker view, as production's does.
   if(d===0){if(!(await page.getByTestId('named-group').count()))await page.getByTestId('background-spinoffs').click();await page.getByTestId('named-group').waitFor();}
   if(d===1){await page.getByTestId('chip-proto').click();await page.getByTestId('named-card').waitFor();}
   if(d===2){await page.getByTestId('chip-group').click();await page.getByTestId('named-list').waitFor();}
   checks++;
  };
  const close=async()=>{await page.keyboard.press('Escape');await page.locator('.ah-bg-pop').waitFor({state:'detached'});checks++;};
  assert.match(await page.getByTestId('direction-lines').locator('li[aria-current]').innerText(),new RegExp(`^${d+1} `));checks++;
  // The default view: the production pill with the one-shot worker, and the riff's named workers.
  await page.getByTestId('background-spinoffs').waitFor();checks++;
  ok(!(await page.locator('.ww-panel, .ww-band').count()),'no panel above the composer');
  ok(!(await page.getByTestId('rail-running').getByText('Prototyyppari').count()),'no rail row for a named worker');
  if(d===0)ok(await page.getByTestId('pill-named-marks').isVisible(),'1: named marks in the pill');
  if(d===1)ok(await page.getByTestId('chip-proto').isVisible()&&await page.getByTestId('chip-review').isVisible(),'2: a chip per named worker');
  if(d===2)ok(await page.getByTestId('chip-group').isVisible(),'2: one Avustajat chip');
  await say('0-oletus');
  await open();
  if(d===1)ok((await page.getByTestId('named-card').innerText()).includes('mainissa'),'2: rounds landed on main');
  else ok(await row('proto').isVisible()&&await row('review').isVisible(),'both named rows');
  await say('1-auki');
  await close();
  // The person writes to the main agent; it relays.
  await field().fill(RIFF);await page.getByTestId('send').click();
  await page.getByText('Välitän viestiä prototypparille',{exact:false}).waitFor();checks++;
  await open();
  await phase('proto','relaying');
  ok(await page.getByText('Pääagentti välittää viestiä').first().isVisible(),'relaying in words');
  await say('2-valittaa');
  await phase('proto','working');
  ok(await page.getByTestId('stop-proto').getAttribute('aria-disabled')==='true'||await page.getByTestId('stop-proto').isDisabled(),'stop refused while it works');
  await say('3-tyoskentelee');
  await close();
  await page.getByText('Välitin Prototyypparille',{exact:false}).waitFor();checks++;
  await say('3b-tyoskentelee-kiinni');
  await page.getByText('toimitti kierroksen 3',{exact:false}).waitFor({timeout:8000});checks++;
  ok(!(await page.locator('.ah-conversation-frame').getByText('12 uutta kuvaa').count()),'no worker reply in the main conversation');
  await say('4-raportti');
  await open();
  await page.locator('[data-fresh]').first().waitFor({state:'attached'});checks++;
  await say('5-raportti-auki');
  // Its own conversation is production's read-only worker view.
  await page.getByTestId('named-open-proto').click();
  await page.getByTestId('named-view').waitFor();checks++;
  ok(await page.getByTestId('worker-ask').isVisible(),'read only, ask through the main agent');
  ok(!(await page.getByTestId('named-view').locator('.ah-composer').count()),'no field that writes to the worker');
  ok(await page.getByText('Kierros 3 yhdistetty main-haaraan',{exact:false}).count()>0,'each round lands on main');
  await say('6-keskustelu');
  await page.getByTestId('parent-top').click();
  await page.getByTestId('background-spinoffs').waitFor();checks++;
  ok(!(await page.locator('[data-fresh]').count()),'seen: no longer fresh');
  await open();
  await page.getByTestId('stop-proto').click();
  await phase('proto','stopping');
  await phase('proto','stopped');
  await say('7-lopetettu');
  await page.locator('[data-testid="named-proto"], [data-testid="chip-proto"], [data-testid="named-card"]').first().waitFor({state:'detached',timeout:8000});checks++;
  if(d===0)ok(await row('review').isVisible(),'1: the reviewer stays');
  if(d===2)ok(await row('review').isVisible(),'3: the reviewer stays');
  if(d!==1)await close();
  await say('8-jaljella');
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
