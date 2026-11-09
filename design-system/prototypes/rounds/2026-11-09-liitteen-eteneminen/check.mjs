// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Walks every direction at 1440 and 390 px, light and dark, with reduced
// motion, stopped on the page clock six seconds in: on the left one 18.6 MB
// video, on the right five files at once. Asserts what each direction shows
// of the files on the way, then at 1440 light runs every case on the right
// faster than real time (a broken connection and its retry, a cancel, Lähetä
// pressed meanwhile, a slow connection), English, and the saving ring's
// motion with and without reduced motion. Screenshots at device scale 2
// named r1-d<n>-<direction>-<case>-<width>-<theme>.png; --quick takes only
// 1440 light.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-09-liitteen-eteneminen';
const [input,out,flag]=process.argv.slice(2);
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['nyt','rengas','palkki','era'];
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};

async function open(width,theme,query,motion='reduce'){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:900},deviceScaleFactor:2,reducedMotion:motion,hasTouch:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto(`http://prototype.test/?${query}`);
 await page.locator('#theme').selectOption(theme);
 return page;
}
const panels=page=>[page.locator('.lt-panel').nth(0),page.locator('.lt-panel').nth(1)];
const chips=p=>p.getByTestId('attachment-chip');
const busy=p=>p.locator('[data-testid="upload-progress"], .ah-composer p[role="status"]');
/** Until the page clock has stopped at the address's moment. */
const stopped=(page,ms)=>page.waitForFunction(m=>window.__sim.now>=m&&document.querySelector('[data-testid="ue-pause"]')?.getAttribute('aria-pressed')==='true',ms,{timeout:20000});
/** Until neither panel has anything on the way. */
const settled=async page=>{for(const p of panels(page))await busy(p).first().waitFor({state:'detached',timeout:60000});await page.waitForTimeout(150);};
const pick=async(page,d)=>{await page.locator('.proto-picker-item').nth(d).click();};

try{
for(const width of quick?[1440]:[1440,390])for(const theme of quick?['light']:['light','dark']){
 const tag=`${width}-${theme}`;
 const page=await open(width,theme,'pause=6000&warp=4');
 await checkPicker(page,round);
 const [L,R]=panels(page);
 for(let d=0;d<4;d++){
  await pick(page,d);await stopped(page,6000);
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${names[d]} ${tag}: document overflow`);
  eq(await page.locator('.cl-lines li[aria-current]').count(),1,`${names[d]}: its line is marked`);
  if(d===0){
   // Today: one still line, Liitä and Lähetä wait, nothing to cancel.
   eq(await L.locator('.ah-composer p[role="status"]').textContent(),'Tallennetaan liitettä…','nyt: today\'s line');
   eq(await page.locator('[role="progressbar"]').count(),0,'nyt: no progress');
   ok((await L.getByTestId('attachment-chip').innerText()).includes('Odottaa tallennusta'),'nyt: the file on the way says it waits');
   ok(await L.locator('.ah-crow-attach button').isDisabled(),'nyt: Liitä waits');
  }else{
   ok(await L.locator('.ah-crow-attach button').isEnabled(),`${names[d]}: Liitä stays open`);
   eq(await chips(R).count(),2,`${names[d]}: the two small files are saved`);
  }
  if(d===1){
   eq(await L.getByTestId('upload-chip').count(),1,'rengas: Jari\'s file is a chip at once');
   ok(/^\d+ %$/.test(await L.locator('.ue-figure').textContent()),'rengas: a percentage');
   eq(await R.getByTestId('upload-chip').count(),3,'rengas: the file on the way and two waiting');
   eq(await R.locator('[data-testid="upload-chip"][data-phase="queued"]').count(),2,'rengas: two waiting');
   eq(await R.locator('.ue-figure').last().textContent(),'odottaa','rengas: a waiting file says so');
  }
  if(d===2){
   eq(await L.getByTestId('upload-chip').count(),1,'palkki: Jari\'s file is a chip at once');
   ok(/Mt \/ 18,6 Mt · noin \d+ s jäljellä/.test(await L.getByTestId('upload-line').textContent()),'palkki: megabytes and time left');
   ok((await R.getByTestId('upload-line').textContent()).includes('2 odottaa'),'palkki: how many wait');
   ok(await L.locator('.ue-chip-bar span').evaluate(e=>e.getBoundingClientRect().width>10),'palkki: the bar has moved');
  }
  if(d===3){
   eq(await L.getByTestId('upload-chip').count(),0,'erä: no chip before the file is saved');
   ok((await R.getByTestId('upload-progress').textContent()).includes('Liitetään tiedostoja 3/5'),'erä: counts the files');
   ok(/28,0 Mt · noin \d+ s jäljellä/.test(await R.getByTestId('upload-progress').textContent()),'erä: the batch\'s megabytes and time left');
   eq(await R.getByTestId('upload-cancel-all').count(),1,'erä: one Peru');
  }
  await page.screenshot({path:`${out}/r1-d${d}-${names[d]}-oletus-${tag}.png`,fullPage:true});
 }
 await page.close();
}

{
 const tag='1440-light';
 for(let d=0;d<4;d++){
  // A broken connection: the batch stops, the warning names the file, and
  // one retry sends it and the file after it.
  let page=await open(1440,'light','case=failed&warp=10');
  await pick(page,d);
  let [,R]=panels(page);
  if(d===0){
   await R.locator('.ah-composer p[role="alert"]').waitFor({timeout:30000});
   ok((await R.innerText()).includes('Failed to fetch'),'nyt: today the raw browser error');
   await page.screenshot({path:`${out}/r1-d0-nyt-katkeaa-${tag}.png`});
  }else{
   await R.getByTestId('upload-failed').waitFor({timeout:30000});
   const text=await R.getByTestId('upload-failed').innerText();
   ok(text.includes('raportti.pdf ei tallentunut'),`${names[d]}: names the file`);
   ok(text.includes('5,0 Mt / 8,4 Mt'),`${names[d]}: how far it got`);
   ok(text.includes('Yksi tiedosto jäi odottamaan'),`${names[d]}: the file after it waits`);
   eq(await chips(R).count(),1,`${names[d]}: the file before it stays`);
   eq(await busy(R).count(),0,`${names[d]}: nothing on the way`);
   await page.screenshot({path:`${out}/r1-d${d}-${names[d]}-katkeaa-${tag}.png`});
   await R.getByTestId('upload-retry').click();
   await settled(page);
   eq(await chips(R).count(),3,`${names[d]}: the retry put both in`);
   eq(await R.getByTestId('upload-failed').count(),0,`${names[d]}: and the warning went away`);
  }
  await page.close();

  // Cancelled: Rengas and Palkki cancel the file on the way, Erä the rest.
  page=await open(1440,'light','case=cancel&warp=10');
  await pick(page,d);[,R]=panels(page);
  await page.waitForTimeout(800);
  await settled(page);
  eq(await chips(R).count(),[3,2,2,1][d],`${names[d]}: what the cancel left`);
  await page.screenshot({path:`${out}/r1-d${d}-${names[d]}-peruttu-${tag}.png`});
  await page.close();

  // Lähetä meanwhile: the message waits for the files, then goes with them.
  page=await open(1440,'light','case=send&pause=3000&warp=4');
  await pick(page,d);await stopped(page,3000);[,R]=panels(page);
  if(d===0)eq(await R.getByTestId('send-waits').count(),0,'nyt: the press is not heard');
  else{
   eq(await R.getByTestId('send-waits').count(),1,`${names[d]}: says the message waits`);
   eq(await R.locator('[data-testid="send"][data-waiting]').count(),1,`${names[d]}: Lähetä marked waiting`);
  }
  await page.screenshot({path:`${out}/r1-d${d}-${names[d]}-laheta-${tag}.png`});
  await page.evaluate(()=>window.__sim.resume());
  await settled(page);await page.waitForTimeout(300);
  if(d===0)eq(await R.getByTestId('send-receipt').count(),0,'nyt: nothing was sent');
  else ok((await R.getByTestId('send-receipt').innerText()).includes('2 liitettä'),`${names[d]}: sent with both`);
  await page.close();

  // A slow connection: time left in minutes where it is said.
  page=await open(1440,'light','case=slow&pause=20000&warp=10');
  await pick(page,d);await stopped(page,20000);[,R]=panels(page);
  if(d===2)ok((await R.getByTestId('upload-line').innerText()).includes('min jäljellä'),'palkki: minutes left');
  if(d===3)ok((await R.getByTestId('upload-progress').innerText()).includes('min jäljellä'),'erä: minutes left');
  if(d===1)ok(/\d+ %/.test(await R.locator('.ue-figure').innerText()),'rengas: a percentage');
  await page.screenshot({path:`${out}/r1-d${d}-${names[d]}-hidas-${tag}.png`});
  await page.close();
 }

 // English, stopped six seconds in.
 {
  const page=await open(1440,'light','pause=6000&warp=4');
  await page.locator('#language').selectOption('en');
  for(const d of [1,2,3]){
   await pick(page,d);await stopped(page,6000);
   const text=await page.locator('.lt-stage').innerText();
   ok([/\d+%/, /MB \/ 18\.6 MB · about \d+ s left/, /Attaching files 3\/5/][d-1].test(text),`${names[d]}: English`);
   await page.screenshot({path:`${out}/r1-d${d}-${names[d]}-oletus-en-${tag}.png`});
  }
  await page.close();
 }

 // Motion: the saving ring turns, and stands still with reduced motion
 // from the system or from the page's Liike.
 for(const motion of ['no-preference','reduce']){
  const page=await open(1440,'light','case=one&warp=4',motion);
  await pick(page,1);
  const ring=page.locator('.lt-panel').nth(0).locator('.ue-ring[data-phase="saving"]');
  // The host's write lasts a moment: stop the clock in the same frame.
  await page.waitForFunction(()=>{const on=document.querySelector('.lt-panel .ue-ring[data-phase="saving"]');if(on)window.__sim.pause();return !!on;},null,{polling:'raf',timeout:30000});
  const turning=await ring.evaluate(e=>getComputedStyle(e).animationName);
  if(motion==='reduce')eq(turning,'none','reduced motion: the ring stands still');
  else{
   eq(turning,'ah-title-spin','the saving ring turns');
   await page.locator('#motion').selectOption('reduce');
   eq(await ring.evaluate(e=>getComputedStyle(e).animationName),'none','Liike Vähennetty: the ring stands still');
  }
  await page.close();
 }
}
}finally{await browser.close();}
assert.deepEqual(errors,[],'console errors');
console.log(`${checks} checks passed`);
