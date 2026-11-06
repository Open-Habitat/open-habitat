// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. For
// each riff of the administrator's Ylläpito › Keskustelut section: the
// default view in the server area (its own link current, Yleiset not), one
// change the riff offers (1 a person's own limit and the installation's
// limit above 32, 2 an exception added and one removed, 3 the steppers moving
// the memory estimate), then the refusal card as the administrator (Muuta
// rajaa (ylläpitäjä) back into the section, the limit raised, Tilaa on nyt,
// the new conversation running) and as an ordinary person (Muuta rajaa
// greyed out, the Työtiloittain window, one stop frees the place). The card
// is the same in every riff, so its screenshots are taken in riff 1 only.
// Screenshots at device scale factor 2 at 1440 px and 390 px (touch), light
// and dark; the console must stay clean.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-06-samanaikaiset-keskustelut-3';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['r3-1-kaikki','r3-2-poikkeukset','r3-3-muisti'];
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
 const section=()=>page.getByTestId('admin-limit-section');
 const card=()=>page.getByTestId('creation-problem');
 const win=()=>page.getByTestId('who-window');
 const shot=async(name,el)=>{await page.waitForTimeout(250);if(el)await el.scrollIntoViewIfNeeded();await fits();await page.screenshot({path:`${out}/${name}-${tag}.png`});};
 const viewer=async v=>{await page.locator('#viewer').selectOption(v);await page.locator(`.rq-review[data-viewer="${v}"]`).waitFor({state:'attached'});};
 const pick=async d=>{
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.rq-review.variant-${d}`).waitFor({state:'attached'});
 };
 const inServerArea=async d=>{
  await section().and(page.locator(`[data-direction="${d}"]`)).waitFor();checks++;
  assert.equal(await page.getByTestId('settings-keskustelut').getAttribute('aria-current'),'page');checks++;
  assert.equal(await page.getByTestId('settings-palvelin').getAttribute('aria-current'),null);checks++;
  ok(await page.getByTestId('settings-own-back').isVisible(),'the production server area');
 };
 const raise=async d=>{
  if(d===2){for(let i=0;i<4;i++)await page.getByTestId('admin-default-more').click();}
  else{const f=page.getByTestId('admin-default');await f.fill('16');await f.press('Enter');await page.getByTestId('inline-setting-status').first().filter({hasText:/Tallennettu/}).waitFor();}
  checks++;
 };
 for(const d of [0,1,2]){
  await viewer('admin');
  await pick(d);
  assert.match(await page.getByTestId('direction-lines').locator('li[aria-current]').innerText(),/^[123] /);checks++;
  await inServerArea(d);
  await shot(`${names[d]}-0-yllapito`);
  if(d===0){
   await page.getByTestId('person-limit-edit-ville').click();
   await page.getByTestId('person-limit-input').fill('50');
   await page.getByTestId('person-limit-save').click();
   await page.getByTestId('admin-person-ville').getByText('Oma: 50').waitFor();checks++;
   const f=page.getByTestId('admin-default');await f.fill('200');await f.press('Enter');
   await page.getByText('Kokonaisluku 1–128').waitFor();checks++;
   await f.fill('40');await f.press('Enter');
   await section().getByText('Yli palvelimen oman oletuksen 32',{exact:false}).waitFor();checks++;
   await page.getByTestId('admin-person-kaisa').getByText('Oletus (40)').waitFor();checks++;
   await shot(`${names[d]}-1-muutettu`,section().locator('h2'));
  }
  if(d===1){
   ok(!(await page.getByTestId('admin-person-kaisa').count()),'only exceptions are listed');
   await page.getByTestId('exception-add').click();
   const form=page.getByTestId('exception-form');
   await form.locator('select').selectOption({label:'mikko'});
   ok(await page.getByTestId('exception-save').isDisabled(),'no number, no save');
   await page.getByTestId('exception-input').fill('60');
   await page.getByTestId('exception-save').click();
   await page.getByTestId('admin-person-mikko').getByText('60 keskustelua · yli 32').waitFor();checks++;
   await page.getByTestId('person-limit-remove-aino').click();
   await page.getByTestId('admin-person-aino').waitFor({state:'detached'});checks++;
   await section().getByText('Muut 4 käyttävät rajaa 12.').waitFor();checks++;
   await shot(`${names[d]}-1-lisatty`,section().locator('h2'));
  }
  if(d===2){
   ok(await page.getByTestId('memory-over').isVisible(),'the limits together exceed the memory');
   await page.getByTestId('person-ville-input').fill('20');await page.getByTestId('person-ville-input').press('Enter');
   await page.getByTestId('memory-over').waitFor({state:'detached'});checks++;
   ok((await page.getByTestId('memory-worst').innerText()).includes('72 keskustelua'),'the estimate follows the steppers');
   await page.getByTestId('person-kaisa-more').click();
   await page.getByTestId('person-limit-reset-kaisa').waitFor();checks++;
   ok((await page.getByTestId('admin-person-kaisa').innerText()).includes('oma raja'),'a stepper makes an exception');
   await page.getByTestId('person-limit-reset-kaisa').click();
   await page.getByTestId('person-limit-reset-kaisa').waitFor({state:'detached'});checks++;
   await page.getByTestId('admin-default-input').fill('36');await page.getByTestId('admin-default-input').press('Enter');
   await section().getByText('Yli palvelimen oman oletuksen 32',{exact:false}).waitFor();checks++;
   await page.getByTestId('memory-over').waitFor();checks++;
   await shot(`${names[d]}-1-saadetty`,section().locator('h2'));
  }
  // The administrator meets the limit: back into the section, raise, room.
  await page.getByTestId('rq-reset').click();
  await inServerArea(d);
  await page.getByTestId('settings-close').click();
  await card().and(page.locator('[data-state="refused"]')).waitFor();checks++;
  const adminText=await card().innerText();
  ok(adminText.includes('Muuta rajaa (ylläpitäjä)'),'the administrator\'s button is marked');
  ok(adminText.includes('raja on 12'),'the installation\'s 12');
  ok(!adminText.includes('Muokkaa'),'no Muokkaa');
  if(d===0)await shot('r3-kortti-0-yllapitaja',card());
  await card().getByTestId('admin-limit').click();
  await inServerArea(d);
  await raise(d);
  await page.getByTestId('settings-close').click();
  await card().and(page.locator('[data-state="room"]')).waitFor();checks++;
  if(d===0)await shot('r3-kortti-2-tilaa',card());
  await card().getByTestId('retry').click();
  await page.getByTestId('workspace-title').filter({hasText:'Tumma teema'}).waitFor();checks++;
  // An ordinary person: the button greyed out, the window, a stop.
  await viewer('person');
  await card().and(page.locator('[data-state="refused"]')).waitFor();checks++;
  const button=card().getByTestId('admin-limit');
  ok(await button.isDisabled(),'greyed out for an ordinary person');
  assert.equal((await button.innerText()).trim(),'Muuta rajaa');checks++;
  ok(!(await page.getByTestId('settings-keskustelut').count()),'no server area link');
  if(d===0)await shot('r3-kortti-1-muu',card());
  await card().getByTestId('retry').click();
  await card().getByText('Yritit uudelleen',{exact:false}).waitFor();checks++;
  await card().getByTestId('chip-aurinkokello').click();
  await win().locator('[data-group="aurinkokello"][data-target]').waitFor({state:'attached'});checks++;
  await win().getByTestId('stop-tahdet').click();
  await win().getByTestId('busy-tahdet').and(page.locator('[data-state="stopped"]')).waitFor();checks++;
  await page.getByTestId('who-close').click();
  await card().and(page.locator('[data-state="room"]')).waitFor();checks++;
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
