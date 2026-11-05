// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. For
// today and every direction, walks the moment a new conversation meets the
// limit and the way out the direction offers: today by trying again and
// stopping a turn from the conversation; A through Settings › Tekoäly
// (stop one, raise the limit, back, start); B through the window (stop one,
// start) and the administrator's per-person limit; C by stopping one in the
// refusal itself. Screenshots at device scale factor 2 at 1440 px and 390 px
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
const round='2026-11-05-samanaikaiset-keskustelut';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['nyt','a-oma','b-yllapitaja','c-ei-lukua'];
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
 const drawer=async open=>{if(!mobile)return;
  if(open){if(!(await page.locator('.ah-mobile-open').count())){await page.getByTestId('navigation-open').click();await page.locator('.ah-mobile-open').waitFor();}}
  else if(await page.locator('.ah-mobile-open').count()){await page.keyboard.press('Escape');await page.locator('.ah-mobile-open').waitFor({state:'detached'});}
 };
 const railClick=async text=>{await drawer(true);await page.getByTestId('workspace-navigation').getByText(text,{exact:true}).first().click();await drawer(false);};
 const pick=async d=>{
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.rq-review.variant-${d}`).waitFor({state:'attached'});
  await card().waitFor();
 };
 const created=async()=>{await page.getByTestId('workspace-title').filter({hasText:'Tumma teema'}).waitFor();checks++;};
 for(const d of [0,1,2,3]){
  await pick(d);
  const say=async name=>{await page.waitForTimeout(250);await fits();await page.screenshot({path:`${out}/${names[d]}-${name}-${tag}.png`});};
  assert.match(await page.getByTestId('direction-lines').locator('li[aria-current]').innerText(),d?/^[ABC] /:/^Nyt: /);checks++;
  assert.equal(await card().getAttribute('data-state'),'refused');checks++;
  await say('0-oletus');
  if(d===0){
   ok((await card().innerText()).includes('Neljä keskustelua'),'today names four');
   await card().getByTestId('retry').click();
   await card().getByText('2. yritys',{exact:false}).waitFor();checks++;
   await say('1-yritys');
   await railClick('Kesäajan virhe');
   await page.getByTestId('workspace-title').filter({hasText:'Kesäajan virhe'}).waitFor();
   await page.getByTestId('composer-stop').click();
   await page.getByText('Pysäytit tämän keskustelun',{exact:false}).waitFor();checks++;
   await say('2-pysaytetty');
   await drawer(true);await page.getByTestId('workspace-navigation').locator('a[href="/workspaces/ws_k"]').first().click();await drawer(false);
   await card().getByTestId('retry').click();
   await created();await say('3-luotu');
  }
  if(d===1){
   await page.getByTestId('rail-gauge').waitFor({state:'attached'});checks++;
   await card().getByTestId('raise').click();
   await page.getByTestId('own-limit').waitFor();checks++;
   await say('1-asetukset');
   await page.getByTestId('stop-dev').click();
   await page.getByTestId('busy-dev').and(page.locator('[data-state="stopped"]')).waitFor();checks++;
   const field=page.getByTestId('live-limit-input');
   await field.fill('8');await field.press('Enter');
   await page.getByText('Työskentelee nyt · 5/8').waitFor();checks++;
   await say('2-nostettu');
   await page.getByTestId('settings-close').click();
   await card().and(page.locator('[data-state="room"]')).waitFor();checks++;
   await say('3-tilaa');
   await card().getByTestId('retry').click();
   await created();await say('4-luotu');
  }
  if(d===2){
   ok(await page.getByTestId('busy-kinds').isVisible(),'B: kinds on the card');
   await card().getByTestId('who').click();
   await page.getByTestId('who-window').waitFor();checks++;
   await say('1-ikkuna');
   await page.getByTestId('who-window').getByTestId('stop-kuvat').click();
   await page.getByTestId('who-window').getByTestId('busy-kuvat').and(page.locator('[data-state="stopped"]')).waitFor();checks++;
   await say('2-pysaytetty');
   await page.getByTestId('who-close').click();
   await card().and(page.locator('[data-state="room"]')).waitFor();checks++;
   await card().getByTestId('retry').click();
   await created();await say('3-luotu');
   await page.getByTestId('rq-reset').click();
   await card().getByTestId('admin-limit').click();
   await page.getByTestId('admin-limit-section').waitFor();checks++;
   await page.getByTestId('person-limit-edit-maintainer').click();
   await page.getByTestId('person-limit-input').fill('10');
   await page.getByTestId('person-limit-save').click();
   await page.getByTestId('admin-person-maintainer').getByText('Oma: 10').waitFor();checks++;
   await page.getByTestId('admin-limit-section').scrollIntoViewIfNeeded();
   await say('4-yllapito');
   await page.getByTestId('settings-close').click();
   await card().and(page.locator('[data-state="room"]')).waitFor();checks++;
  }
  if(d===3){
   ok(await card().getByTestId('busy-list').isVisible(),'C: the list is in the refusal');
   await card().getByTestId('stop-julkaisu').click();
   await card().and(page.locator('[data-state="room"]')).waitFor();checks++;
   await say('1-tilaa');
   await card().getByTestId('retry').click();
   await created();await say('2-luotu');
  }
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
