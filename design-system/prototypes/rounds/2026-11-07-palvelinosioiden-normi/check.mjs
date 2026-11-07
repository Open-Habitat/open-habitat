// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. For
// today and every direction, opens the default view (every server section
// side by side), checks that all eight sections and their component lists
// are there, then works one person's limit in Keskustelut and Levytila the
// way the norm offers (stepper, or Muuta… and a field) and checks that the
// figures move. Screenshots at device scale factor 2 at 1440×900 and
// 390×844 (touch), light and dark; desktop also as a full page. The console
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
const round='2026-11-07-palvelinosioiden-normi';
const [input,out]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <evidence-dir>');process.exit(2);}
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['nyt','a-keskustelut','b-levytila','c-yhdistelma'];
const SECTIONS=['keskustelut','levy','palvelin','kayttajat','aiavain','saneluavain','palvelinintegraatiot','kayttoonotto'];
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
 const shot=async(d,name,full=false)=>{await page.waitForTimeout(300);await fits();await page.screenshot({path:`${out}/r1-${names[d]}-${name}-${tag}.png`,fullPage:full});};
 const panel=id=>page.getByTestId(`panel-${id}`);
 for(const d of [0,1,2,3]){
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.rq-review.variant-${d}`).waitFor({state:'attached'});
  await page.evaluate(()=>scrollTo(0,0));
  assert.match(await page.getByTestId('direction-lines').locator('li[aria-current]').innerText(),d?/^[ABC] /:/^Nyt: /);checks++;
  for(const id of SECTIONS){await panel(id).waitFor();ok(await page.getByTestId(`inventory-${id}`).locator('li').count()>0,`${id}: component list`);}
  if(d){ok(await page.getByTestId('kit').isVisible(),'new-section kit on the default view');}
  await page.waitForTimeout(500);
  await shot(d,'0-oletus');
  if(!mobile)await shot(d,'1-koko',true);
  // Keskustelut and Levytila: aino's own limit, the norm's way.
  const live=panel('keskustelut'),disk=panel('levy');
  if(d===0){
   await live.getByTestId('live-person-aino-limit-more').click();
   await page.waitForTimeout(900);
   ok((await live.getByTestId('live-worst').innerText()).includes('21 keskustelua'),'Nyt: the estimate follows the stepper');
   await disk.getByTestId('storage-limit-edit').first().click();
   await disk.getByTestId('storage-limit-input').fill('50');
   await disk.getByRole('button',{name:'Tallenna raja'}).click();
   await disk.getByText('14,2 GiB / 50 GiB').waitFor();checks++;
  }else if(d===2){
   await live.getByTestId('norm-live-people-aino-edit').click();
   await live.getByTestId('norm-live-people-aino-input').fill('7');
   await live.getByRole('button',{name:'Tallenna'}).click();
   await live.getByText('7 keskustelua',{exact:true}).waitFor();checks++;
   await disk.getByTestId('norm-disk-people-aino-edit').click();
   await disk.getByTestId('norm-disk-people-aino-input').fill('50');
   await disk.getByRole('button',{name:'Tallenna'}).click();
   await disk.getByText('14,2 GiB / 50 GiB').waitFor();checks++;
  }else{
   await live.getByTestId('norm-live-people-aino-limit-more').click();
   ok((await live.getByTestId('norm-live-memory').innerText()).includes('21 keskustelua'),'stepper moves the meter');
   await disk.getByTestId('norm-disk-people-aino-limit-more').click();await page.waitForTimeout(200);
   {const v=await disk.getByTestId('norm-disk-people-aino-limit-input').inputValue();ok(v==='45',`disk stepper by 5 GiB: ${v} in ${d} ${tag}`);}
   await disk.getByTestId('norm-disk-people-maintainer-limit-more').click();
   await disk.getByTestId('norm-disk-people-maintainer-reset').waitFor();checks++;
  }
  await live.scrollIntoViewIfNeeded();
  await shot(d,'2-rajat-muutettu');
  await page.getByTestId('rq-reset').click();
  if(!mobile&&theme==='light'){
   // The host without per-user disk limits: the same sections, Levytila without its limits.
   await page.getByTestId('limits').selectOption('not_in_use');
   await page.waitForTimeout(500);
   await disk.scrollIntoViewIfNeeded();
   await shot(d,'3-ei-levyrajoja');
   await page.getByTestId('limits').selectOption('enforced');
  }
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
