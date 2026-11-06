// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. Walks
// today and every direction light and dark at 1440 px (pointer) and 390 px
// (touch): the default view with Contosoin tapaaminen open and the field
// empty, raising it from the composer, a draft in the field, the row while
// the agent works (Kesäajan virhe), the Sillä aikaa row and opening the
// raised one from it (it stays raised), lowering it from the composer,
// raising another from the rail without opening it, and replying to a raised
// one. Screenshots at device scale factor 2 with the r3- prefix; the console
// must stay clean.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-06-nosta-kentan-luona';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['nyt','a-apuihin','b-lahetykseen','c-keskelle'];
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
 const capture=async name=>{if(mobile)await page.evaluate(()=>document.activeElement instanceof HTMLElement&&document.activeElement.closest('[data-testid=navigation-open]')&&document.activeElement.blur());await page.waitForTimeout(150);await page.screenshot({path:`${out}/r3-${name}-${tag}.png`});};
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
 const raiseBtn=page.getByTestId('composer-raise');
 const field=page.locator('.ah-cbox-field');
 const press=async(id,want)=>{await raiseBtn.click();assert.equal(await where(id),want);checks++;};
 for(const d of [0,1,2,3]){
  await pick(d);
  const n=names[d];
  assert.match(await page.getByTestId('direction-lines').locator('li[aria-current]').innerText(),d?/^[ABC] /:/^Nyt: /);checks++;
  // Default: Contosoin tapaaminen is open, quiet and the field empty.
  await page.getByTestId('workspace-title').filter({hasText:TITLES.contoso}).waitFor();
  assert.equal(await where('contoso'),'rail-quiet');checks++;
  ok(await page.getByTestId('send').count()===1,'production send exists');
  ok(await page.getByTestId('dictation-start').or(page.locator('.ah-crow-mslot button')).first().isVisible(),'mic shows');
  if(d===0)ok(!(await raiseBtn.count()),'Nyt: nothing raises');
  else ok(await raiseBtn.isVisible(),'raise shows on the default view');
  if(d===2)ok(!(await page.getByTestId('send').isVisible()),'B: send gives its slot to the raise');
  if(d===1){
   const [r,f]=await Promise.all([raiseBtn.boundingBox(),page.getByTestId('file-picker').boundingBox()]);
   ok(r.x>f.x,'A: after Tiedosto');
  }
  if(d===3){
   const [r,m]=await Promise.all([raiseBtn.boundingBox(),page.locator('.ah-crow-mslot').boundingBox()]);
   ok(r.x<m.x,'C: before Sanele');
  }
  await fits();await capture(`${n}-0-oletus`);
  if(mobile){await drawer(true);await fits();await capture(`${n}-0-sivupalkki`);await drawer(false);}
  if(d===0){
   await openRow('kesa');await fits();await capture(`${n}-3-tyossa`);
   continue;
  }
  // Raise the open conversation from the composer.
  await press('contoso','rail-yours');
  ok(await page.getByTestId('slot-contoso').getAttribute('data-raised')==='','raised mark');
  ok(await raiseBtn.getAttribute('aria-pressed')==='true','pressed');
  ok(await page.getByTestId('rail-yours').locator('.rq-slot').first().getAttribute('data-testid')==='slot-contoso','newest raise first');
  await fits();await capture(`${n}-1-nostettu`);
  if(mobile){await drawer(true);await capture(`${n}-1-sivupalkki`);await drawer(false);}
  // A draft: B gives the slot back to Send.
  await field.fill('Hinnoittelusta: ');
  if(d===2)ok(!(await raiseBtn.count())&&await page.getByTestId('send').isVisible(),'B: send is back');
  else ok(await raiseBtn.isVisible(),'raise stays with a draft');
  await fits();await capture(`${n}-2-luonnos`);
  await field.fill('');
  // A working conversation: A dims, B and C give way.
  await openRow('kesa');
  ok(await page.getByTestId('composer-stop').isVisible(),'stop at work');
  if(d===1)ok(await raiseBtn.isDisabled(),'A: dimmed at work');
  else ok(!(await raiseBtn.count()),'B/C: none at work');
  if(d===3)ok(await page.getByTestId('composer-mode').isVisible(),'C: Ohjaa in the slot');
  await fits();await capture(`${n}-3-tyossa`);
  // Send there: Sillä aikaa offers the raised one first.
  await field.fill('Aja testit uudelleen korjauksen jälkeen.');await field.press('Enter');
  await banner.waitFor();
  assert.equal(Number(await banner.getAttribute('data-waiting')),2);checks++;
  ok(mobile||(await banner.innerText()).includes('Contosoin tapaaminen'),'banner names it');
  await fits();await capture(`${n}-4-silla-aikaa`);
  await page.getByTestId('next-open').click();
  await page.getByTestId('workspace-title').filter({hasText:TITLES.contoso}).waitFor();checks++;
  assert.equal(await where('contoso'),'rail-yours');checks++;
  ok(await raiseBtn.getAttribute('aria-pressed')==='true','still pressed after opening');
  await fits();await capture(`${n}-5-avattu-pysyy`);
  // The same control lowers it.
  await press('contoso','rail-quiet');
  await fits();await capture(`${n}-6-laskettu`);
  // The rail raises another without opening it.
  await drawer(true);if(!mobile)await page.getByTestId('slot-kuvat').hover();
  await page.getByTestId('raise-kuvat').click();
  assert.equal(await where('kuvat'),'rail-yours');checks++;
  ok(await page.getByTestId('workspace-title').filter({hasText:TITLES.contoso}).count()===1,'still in Contoso');
  await fits();await capture(`${n}-7-rivilta`);await drawer(false);
  // Raise again and reply: the raise ends and the agent works.
  await press('contoso','rail-yours');
  await field.fill('Vastaa sähköpostilla, hinnoittelu ensin.');await field.press('Enter');
  await page.waitForTimeout(100);
  assert.equal(await where('contoso'),'rail-running');checks++;
  await fits();await capture(`${n}-8-vastattu`);
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
