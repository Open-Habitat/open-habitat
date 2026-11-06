// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. Walks
// today and every direction light and dark at 1440 px (pointer) and 390 px
// (touch): the default view with NDA-viestin tarkistus open (its reply seen,
// still in Sinun vuorosi as a ring) and Ei nyt in the direction's place,
// Ei nyt pressed (to Hiljaiset), raised again with Nosta (Ei nyt is back),
// opening another new reply (ring, stays), replying there and the agent's
// answer returning it, and in every direction the rail's ⤒ raise without
// opening. Screenshots at device scale factor 2 with the k2- prefix; the
// console must stay clean.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-06-ei-nyt-paikka';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['nyt','a-kentta','b-sivupalkki','c-vastaus'];
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
 const capture=async name=>{if(mobile)await page.evaluate(()=>document.activeElement instanceof HTMLElement&&document.activeElement.closest('[data-testid=navigation-open]')&&document.activeElement.blur());await page.waitForTimeout(150);await page.screenshot({path:`${out}/k2-${name}-${tag}.png`});};
 const fits=async()=>ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'document overflow');
 const where=async id=>{for(const s of ['rail-yours','rail-running','rail-quiet'])if(await page.getByTestId(s).getByTestId(`slot-${id}`).count())return s;return 'none';};
 const drawer=async open=>{if(!mobile)return;
  if(open){if(!(await page.locator('.ah-mobile-open').count())){await page.getByTestId('navigation-open').click();await page.locator('.ah-mobile-open').waitFor();}}
  else if(await page.locator('.ah-mobile-open').count()){await page.keyboard.press('Escape');await page.locator('.ah-mobile-open').waitFor({state:'detached'});}
 };
 const TITLES={nda:'NDA-viestin tarkistus',kuvat:'Etusivun kuvat',kesa:'Kesäajan virhe',contoso:'Contosoin tapaaminen',lasku:'Laskun muistutus'};
 const openRow=async id=>{await drawer(true);await page.getByTestId(`slot-${id}`).locator('.ah-nav-link').click();await drawer(false);await page.getByTestId('workspace-title').filter({hasText:TITLES[id]}).waitFor();await page.waitForTimeout(50);};
 const pick=async d=>{
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.rq-review.variant-${d}`).waitFor({state:'attached'});
  await page.getByTestId('rq-reset').click();
  await page.getByTestId('slot-kuvat').waitFor({state:'attached'});
 };
 const raiseBtn=page.getByTestId('composer-raise');
 const field=page.locator('.ah-cbox-field');
 // Ei nyt for the open conversation, in the direction's place.
 const notNow=async(d,id)=>{
  if(d===1)await page.getByTestId('composer-notnow').click();
  else if(d===2){await drawer(true);if(!mobile)await page.getByTestId(`slot-${id}`).hover();await page.getByTestId(`notnow-${id}`).click();await drawer(false);}
  else await page.getByTestId('under-notnow').click();
 };
 // Waits for the control to settle in (the round's portals find their host
 // after the commit), or confirms it is absent.
 const notNowLoc=(d,id)=>d===1?page.getByTestId('composer-notnow'):d===3?page.getByTestId('under-notnow'):page.getByTestId(`notnow-${id}`);
 const notNowShows=async(d,id,want=true)=>{
  try{await notNowLoc(d,id).waitFor({state:want?'attached':'detached',timeout:2000});return want;}catch{return !want;}
 };
 for(const d of [0,1,2,3]){
  await pick(d);
  const n=names[d];
  assert.match(await page.getByTestId('direction-lines').locator('li[aria-current]').innerText(),d?/^[ABC] /:/^Nyt: /);checks++;
  await page.getByTestId('workspace-title').filter({hasText:TITLES.nda}).waitFor();
  ok(await page.getByTestId('send').count()===1,'production send exists');
  if(d===0){
   // Today: seeing the reply drops it to Hiljaiset at once.
   assert.equal(await where('nda'),'rail-quiet');checks++;
   ok(!(await raiseBtn.count()),'Nyt: nothing raises');
   await fits();await capture(`${n}-0-oletus`);
   if(mobile){await drawer(true);await fits();await capture(`${n}-0-sivupalkki`);await drawer(false);}
   continue;
  }
  // Default: seen, but it stays in Sinun vuorosi as a ring.
  assert.equal(await where('nda'),'rail-yours');checks++;
  ok(await page.getByTestId('slot-nda').getAttribute('data-ring')==='','ring');
  ok(await notNowShows(d,'nda'),'Ei nyt shows on the default view');
  ok(!(await raiseBtn.count()),'no Nosta for a conversation in Sinun vuorosi');
  if(d===1){const [b,m]=await Promise.all([page.getByTestId('composer-notnow').boundingBox(),page.locator('.ah-crow-mslot').boundingBox()]);ok(b.x<m.x,'A: before Sanele');}
  else ok(!(await page.getByTestId('composer-notnow').count()),'B/C: none in the composer');
  if(d!==3)ok(!(await page.getByTestId('under-reply').count()),'A/B: none under the reply');
  if(d===2&&!mobile)ok(await page.getByTestId('notnow-nda').isVisible(),'B: shown on the default view');
  await fits();await capture(`${n}-0-oletus`);
  if(mobile){await drawer(true);await fits();await capture(`${n}-0-sivupalkki`);await drawer(false);}
  // Ei nyt: to Hiljaiset; the composer's slot offers Nosta.
  await notNow(d,'nda');
  assert.equal(await where('nda'),'rail-quiet');checks++;
  await raiseBtn.waitFor();checks++;
  ok(!(await page.getByTestId('under-reply').count()),'line under the reply gone');
  await fits();await capture(`${n}-1-ei-nyt`);
  // Nosta: back in Sinun vuorosi, raised; Ei nyt is again in its place.
  await raiseBtn.click();
  assert.equal(await where('nda'),'rail-yours');checks++;
  ok(await page.getByTestId('slot-nda').getAttribute('data-raised')==='','raised');
  ok(await notNowShows(d,'nda'),'Ei nyt for a raised one');
  if(d===3)ok((await page.getByTestId('under-reply').innerText()).includes('Nostit'),'C: says raised');
  await fits();await capture(`${n}-2-nostettu`);
  if(mobile){await drawer(true);await capture(`${n}-2-sivupalkki`);await drawer(false);}
  // Opening another new reply: ring, it stays.
  await openRow('kuvat');
  assert.equal(await where('kuvat'),'rail-yours');checks++;
  ok(await page.getByTestId('slot-kuvat').getAttribute('data-ring')==='','kuvat ring');
  ok(await notNowShows(d,'kuvat'),'Ei nyt in kuvat');
  await fits();await capture(`${n}-3-avattu-pysyy`);
  // Reply: Käynnissä; the agent's answer brings it back, ring as it is open.
  await field.fill('Jätä ylempi kuva.');await field.press('Enter');
  await page.waitForTimeout(100);
  assert.equal(await where('kuvat'),'rail-running');checks++;
  ok(!(await notNowShows(d,'kuvat',false)),'no Ei nyt at work');
  await page.getByTestId('slot-kuvat').and(page.locator('[data-ring]')).waitFor({state:'attached',timeout:5000});
  assert.equal(await where('kuvat'),'rail-yours');checks++;
  ok(await notNowShows(d,'kuvat'),'Ei nyt for the new reply');
  await fits();await capture(`${n}-4-vastaus-palaa`);
  // The rail raises another without opening it (decided, every direction).
  await drawer(true);if(!mobile)await page.getByTestId('slot-contoso').hover();
  await page.getByTestId('raise-contoso').click();
  assert.equal(await where('contoso'),'rail-yours');checks++;
  ok(await page.getByTestId('workspace-title').filter({hasText:TITLES.kuvat}).count()===1,'still in kuvat');
  if(d===2){
   // B: drop a row from the rail without opening it.
   if(!mobile)await page.getByTestId('slot-nda').hover();
   await page.getByTestId('notnow-nda').click();
   assert.equal(await where('nda'),'rail-quiet');checks++;
  }
  await fits();await capture(`${n}-5-rivilta`);await drawer(false);
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
