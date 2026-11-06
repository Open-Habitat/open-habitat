// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. Walks
// today and every direction light and dark at 1440 px (pointer) and 390 px
// (touch): the default view with Contosoin tapaaminen open, raising it with
// the direction's button, the raised row in Sinun vuorosi, sending in
// Kesäajan virhe so the Sillä aikaa row offers it first, opening it there
// (it stays raised), lowering it with the same button, and either raising
// another one without opening it (C) or replying to it (A, B). Screenshots
// at device scale factor 2 with the r2- prefix; the console must stay clean.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-06-nosta-painike';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['nyt','a-ylapalkissa','b-kentan-luona','c-rivilla'];
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
try{
for(const width of [1440,390])for(const theme of ['light','dark']){
 const mobile=width===390;
 const page=await browser.newPage({viewport:{width,height:mobile?844:900},deviceScaleFactor:2,reducedMotion:'reduce',isMobile:mobile,hasTouch:mobile});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 await checkPicker(page,round);
 const tag=`${width}-${theme}`;
 const capture=async name=>{await page.waitForTimeout(150);await page.screenshot({path:`${out}/r2-${name}-${tag}.png`});};
 const fits=async()=>ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'document overflow');
 const where=async id=>{for(const s of ['rail-yours','rail-running','rail-quiet'])if(await page.getByTestId(s).getByTestId(`slot-${id}`).count())return s;return 'none';};
 const drawer=async open=>{if(!mobile)return;
  if(open){if(!(await page.locator('.ah-mobile-open').count())){await page.getByTestId('navigation-open').click();await page.locator('.ah-mobile-open').waitFor();}}
  else if(await page.locator('.ah-mobile-open').count()){await page.keyboard.press('Escape');await page.locator('.ah-mobile-open').waitFor({state:'detached'});}
 };
 const TITLES={nda:'NDA-viestin tarkistus',kuvat:'Etusivun kuvat',kesa:'Kesäajan virhe',contoso:'Contosoin tapaaminen'};
 const openRow=async id=>{await drawer(true);await page.getByTestId(`slot-${id}`).locator('.ah-nav-link').click();await drawer(false);await page.getByTestId('workspace-title').filter({hasText:TITLES[id]}).waitFor();await page.waitForTimeout(50);};
 const banner=page.getByTestId('next-waiting');
 const pick=async d=>{
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.rq-review.variant-${d}`).waitFor({state:'attached'});
  await page.getByTestId('rq-reset').click();
  await page.getByTestId('slot-kuvat').waitFor({state:'attached'});
 };
 // The direction's own button for the open conversation (C: its row).
 const press=async(d,id,want)=>{
  if(d===1)await page.getByTestId('head-raise').click();
  if(d===2)await page.getByTestId('composer-raise').click();
  if(d===3){await drawer(true);if(!mobile)await page.getByTestId(`slot-${id}`).hover();await page.getByTestId(`${want==='rail-yours'?'raise':'lower'}-${id}`).click();}
  assert.equal(await where(id),want);checks++;
 };
 for(const d of [0,1,2,3]){
  await pick(d);
  const n=names[d];
  assert.match(await page.getByTestId('direction-lines').locator('li[aria-current]').innerText(),d?/^[ABC] /:/^Nyt: /);checks++;
  // Default: Contosoin tapaaminen is open and quiet; NDA waits as a reply.
  await page.getByTestId('workspace-title').filter({hasText:TITLES.contoso}).waitFor();
  assert.equal(await where('contoso'),'rail-quiet');checks++;
  const visible=async t=>page.getByTestId(t).isVisible().catch(()=>false);
  if(d===1)ok(await visible('head-raise'),'A: header button shows');
  if(d===2)ok(await visible('composer-raise'),'B: composer button shows');
  if(d===0)ok(!(await page.locator('[data-testid="head-raise"],[data-testid="composer-raise"],[data-testid^="raise-"]').count()),'Nyt: nothing raises');
  await fits();await capture(`${n}-0-oletus`);
  if(mobile){await drawer(true);await fits();await capture(`${n}-0-sivupalkki`);await drawer(false);}
  if(d===0)continue;
  // Raise the open conversation.
  await press(d,'contoso','rail-yours');
  ok(await page.getByTestId('slot-contoso').getAttribute('data-raised')==='','raised mark');
  ok(await page.getByTestId('rail-yours').locator('.rq-slot').first().getAttribute('data-testid')==='slot-contoso','newest raise first');
  if(d===1)ok(await page.getByTestId('head-raise').getAttribute('aria-pressed')==='true','A: pressed');
  if(d===2)ok((await page.getByTestId('composer-raise').innerText()).includes('Sinun vuorossasi'),'B: says so');
  await drawer(false);await fits();await capture(`${n}-1-nostettu`);
  if(mobile){await drawer(true);await capture(`${n}-1-sivupalkki`);await drawer(false);}
  // A working conversation cannot be raised; the reason is on the button.
  await openRow('kesa');
  if(d===1)ok(await page.getByTestId('head-raise').isDisabled(),'A: disabled while working');
  if(d===2)ok(!(await page.getByTestId('composer-raise').count()),'B: hidden while working');
  if(d===3){await drawer(true);ok(!(await page.getByTestId('raise-kesa').count()),'C: no raise on a running row');await drawer(false);}
  // Send there: Sillä aikaa offers the raised one first.
  const field=page.locator('.ah-cbox-field');
  await field.fill('Aja testit uudelleen korjauksen jälkeen.');await field.press('Enter');
  await banner.waitFor();
  assert.equal(Number(await banner.getAttribute('data-waiting')),2);checks++;
  ok(mobile||(await banner.innerText()).includes('Contosoin tapaaminen'),'banner names it');
  await fits();await capture(`${n}-2-silla-aikaa`);
  await page.getByTestId('next-open').click();
  await page.getByTestId('workspace-title').filter({hasText:TITLES.contoso}).waitFor();checks++;
  assert.equal(await where('contoso'),'rail-yours');checks++;
  await fits();await capture(`${n}-3-avattu-pysyy`);
  // The same button lowers it.
  await press(d,'contoso','rail-quiet');
  await drawer(false);await fits();await capture(`${n}-4-laskettu`);
  if(d===3){
   // C raises a conversation without opening it.
   await press(d,'kuvat','rail-yours');
   ok(await page.getByTestId('workspace-title').filter({hasText:TITLES.contoso}).count()===1,'C: still in Contoso');
   await fits();await capture(`${n}-5-avaamatta`);await drawer(false);
  }else{
   // Raise again and reply: the raise ends and the agent works.
   await press(d,'contoso','rail-yours');
   await field.fill('Vastaa sähköpostilla, hinnoittelu ensin.');await field.press('Enter');
   await page.waitForTimeout(100);
   assert.equal(await where('contoso'),'rail-running');checks++;
   await fits();await capture(`${n}-5-vastattu`);
  }
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
