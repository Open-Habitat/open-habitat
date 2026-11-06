// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. For
// each riff of the list of what holds a place, walks the refusal of a new
// conversation at the administrator's limit of 12: trying again while full,
// the list opened the way the riff offers (1 and 3 a window at the chosen
// group, 2 the card's own Näytä kaikki), one stop, and the new conversation
// running. Muuta rajaa is checked for the administrator (it opens Ylläpito ›
// Palvelin and a per-person limit is saved, in 1) and for anyone else, hidden
// and disabled with its reason (every riff). Screenshots at device scale
// factor 2 at 1440 px and 390 px (touch), light and dark; the console must
// stay clean.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-06-samanaikaiset-keskustelut-2';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['r2-1-lajeittain','r2-2-kortissa','r2-3-tyotiloittain'];
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
 const card=()=>page.getByTestId('creation-problem');
 const win=()=>page.getByTestId('who-window');
 const pick=async d=>{
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.rq-review.variant-${d}`).waitFor({state:'attached'});
  await card().waitFor();
 };
 const viewer=async v=>{await page.locator('#viewer').selectOption(v);await page.locator(`.rq-review[data-viewer="${v}"]`).waitFor({state:"attached"});await card().waitFor();};
 const created=async()=>{await page.getByTestId('workspace-title').filter({hasText:'Tumma teema'}).waitFor();checks++;};
 for(const d of [0,1,2]){
  await pick(d);
  const say=async name=>{await page.waitForTimeout(250);
   if(/^[02]-/.test(name)&&await card().count()&&!(await win().count()))await card().evaluate(el=>el.scrollIntoView({block:'end'}));await fits();await page.screenshot({path:`${out}/${names[d]}-${name}-${tag}.png`});};
  assert.match(await page.getByTestId('direction-lines').locator('li[aria-current]').innerText(),/^[123] /);checks++;
  assert.equal(await card().getAttribute('data-state'),'refused');checks++;
  const text=await card().innerText();
  ok(text.includes('Yritä uudelleen'),'retry stays');
  ok(!text.includes('Muokkaa'),'edit is gone');
  ok(text.includes('Muuta rajaa (ylläpitäjä)'),'admin sees Muuta rajaa');
  ok(text.includes('raja on 12'),'the administrator\'s 12');
  await say('0-oletus');
  // Anyone else: hidden, then disabled with its reason.
  await viewer('hidden');
  ok(!(await card().getByTestId('admin-limit').count()),'hidden for others');
  await say('0-muu-piilossa');
  await viewer('disabled');
  ok(await card().getByTestId('admin-limit').isDisabled(),'disabled for others');
  ok(await card().getByText('Vain ylläpitäjä voi muuttaa rajaa.').isVisible(),'the reason is shown');
  await say('0-muu-pois-kaytosta');
  await viewer('admin');
  await card().getByTestId('retry').click();
  await card().getByText('Yritit uudelleen',{exact:false}).waitFor();checks++;
  if(d===0){
   await card().getByTestId('chip-processes').click();
   await win().waitFor();
   await win().locator('[data-group="processes"][data-target]').waitFor({state:'attached'});checks++;
   ok((await win().locator('.rq-group-head').first().innerText()).startsWith('4 taustaprosessia'),'processes first');
   await say('1-ikkuna');
   await win().getByTestId('stop-tahdet').click();
   await win().getByTestId('busy-tahdet').and(page.locator('[data-state="stopped"]')).waitFor();checks++;
   await say('2-pysaytetty');
   await page.getByTestId('who-close').click();
   await card().and(page.locator('[data-state="room"]')).waitFor();checks++;
   ok(!(await card().innerText()).includes('Muokkaa'),'no edit when there is room');
   await card().getByTestId('retry').click();
   await created();await say('3-luotu');
   await page.getByTestId('rq-reset').click();
   await card().getByTestId('admin-limit').click();
   await page.getByTestId('admin-limit-section').waitFor();checks++;
   await page.getByTestId('person-limit-edit-maintainer').click();
   await page.getByTestId('person-limit-input').fill('16');
   await page.getByTestId('person-limit-save').click();
   await page.getByTestId('admin-person-maintainer').getByText('Oma: 16').waitFor();checks++;
   await page.getByTestId('admin-limit-section').scrollIntoViewIfNeeded();
   await say('4-yllapito');
   await page.getByTestId('settings-close').click();
   await card().and(page.locator('[data-state="room"]')).waitFor();checks++;
  }
  if(d===1){
   ok(await card().getByTestId('busy-list').isVisible(),'2: the list is in the card');
   ok(!(await card().getByTestId('who').count()),'2: no window');
   assert.equal(await card().getByTestId('busy-list').locator('li').count(),3);checks++;
   ok((await card().getByTestId('busy-list').locator('li').first().innerText()).includes('Tähtikartan data'),'the longest untouched first');
   await card().getByTestId('show-all').click();
   assert.equal(await card().getByTestId('busy-list').locator('li').count(),12);checks++;
   await say('1-kaikki');
   await card().getByTestId('stop-tahdet').click();
   await card().and(page.locator('[data-state="room"]')).waitFor();checks++;
   await say('2-tilaa');
   await card().getByTestId('retry').click();
   await created();await say('3-luotu');
  }
  if(d===2){
   ok((await card().getByTestId('busy-kinds').locator('.rq-chip').first().innerText()).includes('kotisivu'),'this workspace first');
   await card().getByTestId('chip-aurinkokello').click();
   await win().waitFor();
   await win().locator('[data-group="aurinkokello"][data-target]').waitFor({state:'attached'});checks++;
   await say('1-ikkuna');
   await win().getByTestId('stop-tahdet').click();
   await win().getByTestId('busy-tahdet').and(page.locator('[data-state="stopped"]')).waitFor();checks++;
   await say('2-pysaytetty');
   await page.getByTestId('who-close').click();
   await card().and(page.locator('[data-state="room"]')).waitFor();checks++;
   await card().getByTestId('retry').click();
   await created();await say('3-luotu');
  }
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
