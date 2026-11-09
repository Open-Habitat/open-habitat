// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. For
// both directions (round 3's B for reference, and round 4), at 1440 px and
// 390 px (touch), light and dark, device scale factor 2, in Europe/Helsinki
// time, named r4-<direction>-<step>-<width>-<theme>:
//   0-oletus  the default view (desktop: the list beside the first share;
//             phone: the list alone);
//   1-auki    the folder Testikuvat picked;
//   2-kesto   the public view Testikierros 7.11. picked, its duration menu;
//   3-kopioi  its link copied from the icon at the field's end;
//   4-tyhja   the page with nothing shared yet.
// Between 3 and 4 the removed item's address is deleted through the dialog.
// It asserts that round 4 orders the conversations by their last activity
// (Testikierros 7.11. went on on 9.11., so it leads although Asetusten
// kuvakaappaukset shared later), names each with its day, opens the first
// conversation's newest share and names its conversation there, while round
// 3's B orders by the latest share. On a phone the address comes before the
// icons, so the date's tooltip, which stays after a tap, falls on the hint
// and not on the copy icon, and the icon is finger-sized. The copied text
// is the address in the field. The console must stay clean and nothing may
// overflow sideways.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-09-jaetut-keskustelut';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['kierros3-b','viimeistely'];
const order3=['Asetusten kuvakaappaukset','Testikierros 7.11.','Tarjouskorttien kokeilu','Raportti /var/tmp:stä','Testikierros 5.11.','Kohde poistettu'];
const order4=['Testikierros 7.11.','Asetusten kuvakaappaukset','Tarjouskorttien kokeilu','Raportti /var/tmp:stä','Testikierros 5.11.','Kohde poistettu'];
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const runs=[{width:1440,theme:'light'},{width:1440,theme:'dark'},{width:390,theme:'light'},{width:390,theme:'dark'}];
try{
for(const {width,theme} of runs){
 const mobile=width===390,H=mobile?844:900;
 // The clipboard needs a secure origin; the page is served from https.
 const context=await browser.newContext({viewport:{width,height:H},deviceScaleFactor:2,reducedMotion:'reduce',isMobile:mobile,hasTouch:mobile,timezoneId:'Europe/Helsinki',locale:'fi-FI',permissions:['clipboard-read','clipboard-write']});
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('https://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));
 await page.goto('https://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 await checkPicker(page,round);
 const tag=`${width}-${theme}`;
 const fits=async()=>ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'document overflow');
 const press=async(loc)=>{await loc.scrollIntoViewIfNeeded();await (mobile?loc.tap():loc.click());};
 for(const d of [0,1]){
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.rq-review.variant-${d}`).waitFor({state:'attached'});
  const shot=async(step)=>{await page.waitForTimeout(250);await fits();await page.screenshot({path:`${out}/r4-${names[d]}-${step}-${tag}.png`});};
  assert.match(await page.getByTestId('direction-lines').locator('li[aria-current]').innerText(),new RegExp(`^${d?'4 ':'Kierros 3 B'}`));checks++;
  const section=page.getByTestId('js-section');
  await section.waitFor();checks++;
  ok(await page.getByTestId('rail-shares').count()===1,'a page under Etusivu');
  const rows=section.getByTestId('js-row');
  const row=(t)=>rows.filter({hasText:t}).first();
  const detail=page.getByTestId('js-detail');
  const pick=async(t)=>{await press(row(t).getByTestId('js-open'));await detail.filter({hasText:t}).waitFor();checks++;};
  const back=async()=>{if(mobile){await press(page.getByTestId('js-back'));await detail.waitFor({state:'detached'});checks++;}};
  ok(await rows.count()===10,'all ten shares');
  ok(await section.locator('[data-testid="js-row"]:has-text("Testikierros 7.11. – tilanne")').innerText().then(t=>/7\.12\.2026/.test(t)),'the public row says until when');
  const convs=section.getByTestId('js-conv');
  ok(await convs.count()===6,'six conversations on the line');
  const heads=await convs.evaluateAll(els=>els.map(e=>e.querySelector('h2').innerText));
  for(const [i,t] of (d?order4:order3).entries())ok(heads[i].includes(t),`conversation ${i+1} is ${t}`);
  if(d===1){
   ok((await convs.first().getByTestId('js-conv-day').innerText())==='ma 9.11.','the first conversation\'s last activity');
   ok(/1 jako/.test(await convs.first().innerText()),'its count of shares');
  }
  if(mobile)ok(await detail.count()===0,'the list alone on a phone');
  else{
   ok((d?/Testikierros 7\.11\. – tilanne/:/Asetukset › Tili/).test(await detail.locator('h2').innerText()),'the first conversation\'s newest share shown large');
   if(d===1)ok(/Keskustelusta\s+Testikierros 7\.11\./.test(await page.getByTestId('js-detail-conv').innerText()),'its conversation named');
   ok(await detail.locator('input[readonly]').count()===1,'the address in a field');
  }
  await shot('0-oletus');

  // 1: the folder picked.
  await pick('Testikuvat');
  await shot('1-auki');
  await back();

  // 2-3: the public view's duration and link.
  await pick('Testikierros 7.11.');
  ok(/7\.12\./.test(await detail.innerText()),'its expiry shown');
  await press(detail.getByTestId('view-public-until'));
  await page.locator('.ah-view-offer-durations').waitFor();checks++;
  await shot('2-kesto');
  await page.keyboard.press('Escape');
  await page.locator('.ah-view-offer-durations').waitFor({state:'detached'});checks++;
  // Focus returns to the date, whose tooltip would sit over the row below
  // (on a phone the address comes before the icons, so it falls on the hint).
  if(!mobile){await page.mouse.move(5,H-5);await page.evaluate(()=>document.activeElement?.blur());await page.locator('[role="tooltip"]').waitFor({state:'detached'});}
  ok(await detail.locator('input[readonly]').count()===1,'the address in a field');
  if(mobile){
   const [u,a]=await Promise.all([detail.locator('.jl-url').boundingBox(),detail.locator('.jl-acts').boundingBox()]);
   ok(u.y<a.y,'on a phone the address before the icons');
   ok((await detail.getByTestId('js-copy').boundingBox()).width>=44,'a finger-sized copy icon');
  }
  await press(detail.getByTestId('js-copy'));
  await detail.locator('[data-copied="yes"]').waitFor();checks++;
  const copied=await page.evaluate(()=>navigator.clipboard.readText());
  ok(/^https:\/\/birch\.habitat\.example\/n\//.test(copied),'a /n/ address copied');
  ok(copied===await detail.locator('input[readonly]').inputValue(),'the shown address on the clipboard');
  await shot('3-kopioi');
  await back();

  // The removed item's address deleted for good.
  await pick('vanha kortti');
  await press(detail.getByTestId('js-remove'));
  await page.getByTestId('js-remove-dialog').waitFor();checks++;
  await press(page.getByTestId('js-remove-confirm'));
  await page.getByTestId('js-status').filter({hasText:'Osoite poistettu'}).waitFor();checks++;
  ok(await rows.count()===9,'one address fewer');

  // 4: nothing shared yet.
  await page.locator('#empty').check();
  await page.getByTestId('js-empty').waitFor();checks++;
  ok(await page.getByTestId('js-row').count()===0,'no rows');
  ok(await page.getByTestId('rail-shares').locator('.ah-rail-count').count()===0,'no count in the rail');
  await shot('4-tyhja');
  await page.locator('#empty').uncheck();
  await page.getByTestId('js-row').first().waitFor();checks++;
 }
 await context.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
