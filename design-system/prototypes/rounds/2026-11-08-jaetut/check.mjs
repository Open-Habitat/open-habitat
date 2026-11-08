// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. For
// "Nyt" (production ViewLinkSettings unchanged on Settings › Tili, the same
// ten addresses served as the host's list) and each direction, at 1440 px
// and 390 px (touch), light and dark, device scale factor 2, named
// r1-<direction>-<step>-<width>-<theme>:
//   0-oletus    the default view (2: scrolled to the home page's Jaetut band);
//   1-auki      1: the public row's duration menu; 2: Muut osoitteet opened;
//               3: the folder's card opened beside (on a phone, the panel);
//   2-julkinen  Myyntitaulukko made public from its globe;
//   3-poista    the removal dialog for the removed item's address;
//   4-poistettu after deleting it.
// It asserts what each direction promises on its default view: Nyt lists
// all ten on Tili; 1 is its own Settings section with three state groups;
// 2 shows only what is public now on the home page and the rest behind one
// line; 3 is a page of its own under Etusivu, grouped by conversation. The
// console must stay clean and nothing may overflow sideways.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-08-jaetut';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['0-nyt','1-asetukset','2-alkulehti','3-oma-sivu'];
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
 for(const d of [0,1,2,3]){
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.rq-review.variant-${d}`).waitFor({state:'attached'});
  const shot=async(step)=>{await page.waitForTimeout(250);await fits();await page.screenshot({path:`${out}/r1-${names[d]}-${step}-${tag}.png`});};
  assert.match(await page.getByTestId('direction-lines').locator('li[aria-current]').innerText(),new RegExp(`^${d?d+' ':'Nyt'}`));checks++;
  if(d===0){
   const rows=page.getByTestId('view-address-row');
   await rows.first().waitFor();checks++;
   ok(await rows.count()===10,'production lists all ten on Tili');
   ok(await page.getByTestId('settings-section-tili').isVisible(),'Nyt is on Tili');
   ok(await page.locator('[data-public="true"]').count()===2,'two public');
   await shot('0-oletus');
   await press(rows.last().getByTestId('view-address-remove'));
   await page.getByTestId('view-address-remove-dialog').waitFor();checks++;
   await shot('3-poista');
   await press(page.getByTestId('view-address-remove-confirm'));
   await page.waitForFunction(()=>document.querySelectorAll('[data-testid="view-address-row"]').length===9);checks++;
   continue;
  }
  const section=page.getByTestId('js-section');
  await section.waitFor();checks++;
  const rows=section.getByTestId('js-row');
  const row=(t)=>rows.filter({hasText:t}).first();
  if(d===1){
   ok(await page.getByTestId('settings-section-jaetut').isVisible(),'own Settings section');
   ok(await section.getByTestId('js-group').count()===3,'three state groups');
   ok(await rows.count()===10,'all ten listed');
   ok(await section.locator('[data-testid="js-group"][data-group="public"] [data-testid="js-row"]').count()===2,'two public now');
  }
  if(d===2){
   ok(await page.getByTestId('workspaces-title').isVisible(),'on the home page');
   ok(await rows.count()===2,'only what is public now');
   ok(/Muut osoitteet 8/.test(await page.getByTestId('js-rest').innerText()),'the rest is one line');
   await section.evaluate(el=>{const s=el.closest('.js-page');s.scrollTop+=el.getBoundingClientRect().top-s.getBoundingClientRect().top-12;});
  }
  if(d===3){
   ok(await page.getByTestId('rail-shares').count()===1,'a page under Etusivu');
   ok(await section.getByTestId('js-group').count()===6,'grouped by conversation');
   ok(await rows.count()===10,'all ten cards');
   ok(await page.getByTestId('js-pane').count()===0,'nothing open by default');
  }
  await shot('0-oletus');
  if(d===1){
   await press(row('Testikierros 7.11.').getByTestId('view-public-until'));
   await page.locator('.ah-view-offer-durations').waitFor();checks++;
   await shot('1-auki');
   await page.keyboard.press('Escape');
  }
  if(d===2){
   await press(page.getByTestId('js-rest'));
   ok(await rows.count()===10,'all ten after opening');
   await shot('1-auki');
  }
  if(d===3){
   await press(row('Testikuvat').getByTestId('offer-open'));
   await page.getByTestId('js-pane').waitFor();checks++;
   ok(/Testikuvat/.test(await page.getByTestId('js-pane').innerText()),'the folder opened beside');
   await shot('1-auki');
   await press(page.getByTestId('js-pane-close'));
   await page.getByTestId('js-pane').waitFor({state:'detached'});checks++;
  }
  const target=row('Myyntitaulukko');
  if(d===3&&!mobile)await target.hover();
  await press(target.getByTestId('view-public'));
  await page.getByTestId('js-status').filter({hasText:'julkinen'}).waitFor();checks++;
  ok(await target.getAttribute('data-group')==='public','made public');
  await target.scrollIntoViewIfNeeded();
  await shot('2-julkinen');
  await press(row('vanha kortti').getByTestId('js-remove'));
  await page.getByTestId('js-remove-dialog').waitFor();checks++;
  await shot('3-poista');
  await press(page.getByTestId('js-remove-confirm'));
  await page.getByTestId('js-status').filter({hasText:'Osoite poistettu'}).waitFor();checks++;
  ok(await rows.count()===9,'one address fewer');
  await shot('4-poistettu');
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
