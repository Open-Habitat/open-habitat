// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Walks every direction at 1440 and 390 px, light and dark. Default view:
// on the left one file over 20 MiB, on the right several at once. Asserts
// what each direction says about which files went in and which did not,
// then at 1440 light walks every case on the right and the interactions
// (the chip's detail, Rivi's Näytä, a retry, English). Screenshots at
// device scale 2 named r1-d<n>-<direction>-<case>-<width>-<theme>.png;
// --quick takes only 1440 light.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-08-liitteen-torjunta';
const [input,out,flag]=process.argv.slice(2);
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['nyt','varoitus','siru','rivi'];
const cases=['many','large','empty','count','total','quota','disk','failed'];
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};
try{
for(const width of quick?[1440]:[1440,390])for(const theme of quick?['light']:['light','dark']){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:900},deviceScaleFactor:2,reducedMotion:'reduce',hasTouch:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 await checkPicker(page,round);
 const tag=`${width}-${theme}`;
 const L=page.locator('.lt-panel').nth(0),Rt=page.locator('.lt-panel').nth(1);
 const played=()=>page.waitForFunction(()=>[...document.querySelectorAll('.lt-panel')].every(p=>p.dataset.played==='yes'),null,{timeout:15000});
 const shot=async(d,name,full=true)=>{await page.waitForTimeout(200);await page.screenshot({path:`${out}/r1-d${d}-${names[d]}-${name}-${tag}.png`,fullPage:full});};
 const chips=p=>p.getByTestId('attachment-chip');
 const refusal=p=>p.getByTestId('attachment-refusal');
 for(let d=0;d<names.length;d++){
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator('#case').selectOption('many');
  await played();
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${names[d]}: document overflow`);
  if(d===0){
   // Today: the bare line, the first refusal ends the drop.
   eq((await L.locator('.ah-composer p[role="alert"]').textContent()),'Valitse 1 tavun – 20 MiB:n tiedosto.','nyt: today\'s text');
   eq(await chips(Rt).count(),1,'nyt: only the file before the first refusal went in');
  }else{
   eq(await refusal(L).count(),1,`${names[d]}: left refusal shown`);
   ok((await refusal(L).textContent()).includes('kokous-2026-11-07.mov'),`${names[d]}: names the file`);
   if(d!==2)ok((await refusal(L).textContent()).includes('20 Mt'),`${names[d]}: says the limit`);
   eq(await chips(Rt).count(),2,`${names[d]}: both files that fit went in`);
   if(d===2)eq(await Rt.getByTestId('refused-chip').count(),3,'siru: three refused chips');
   else ok((await refusal(Rt).textContent()).includes('3'),`${names[d]}: counts three refused`);
   if(d===1)eq(await refusal(Rt).locator('li').count(),3,'varoitus: lists each refused file');
   if(d===3)eq(await Rt.getByTestId('refusal-details').count(),0,'rivi: details closed by default');
  }
  await shot(d,'monta');
  if(width===1440&&theme==='light'){
   for(const c of cases.slice(1)){
    await page.locator('#case').selectOption(c);await played();
    const text=await Rt.innerText();
    if(d>0){
     if(c==='count'){eq(await chips(Rt).count(),30,`${names[d]}: fills to 30`);ok(/3/.test(await refusal(Rt).innerText()),`${names[d]}: three over`);}
     if(c==='total'){eq(await Rt.getByTestId('send-receipt').count(),0,`${names[d]}: caught when added, not at send`);ok(text.includes('esitys.pdf'),`${names[d]}: names the file`);}
     if(c==='failed')ok(await Rt.getByRole('button',{name:/^Yritä/}).count()>0,`${names[d]}: retry offered`);
     ok(!text.includes('Failed to fetch'),`${names[d]}: no raw browser error`);
    }else{
     if(c==='total')eq(await Rt.getByTestId('send-receipt').count(),1,'nyt: total refused only at send');
     if(c==='failed')ok(text.includes('Failed to fetch'),'nyt: today the raw browser error shows');
    }
    await shot(d,c,false);
   }
   if(d===2){
    await page.locator('#case').selectOption('many');await played();
    await Rt.getByTestId('refused-chip').nth(0).locator('.ah-attachment-open').click();
    eq(await Rt.getByTestId('refused-detail').count(),1,'siru: pressing a chip shows its sentence');
    await shot(d,'siru-auki',false);
   }
   if(d===3){
    await page.locator('#case').selectOption('many');await played();
    await Rt.getByTestId('refusal-toggle').click();
    eq(await Rt.getByTestId('refusal-details').locator('li').count(),3,'rivi: Näytä lists each');
    await shot(d,'nayta',false);
   }
   if(d>0){
    // A retry after a broken connection: the stub host now takes the file.
    await page.locator('#case').selectOption('failed');await played();
    eq(await chips(Rt).count(),0,`${names[d]}: nothing went in`);
    await Rt.getByRole('button',{name:/^Yritä/}).first().click();
    await page.waitForTimeout(500);
    eq(await chips(Rt).count(),1,`${names[d]}: the retry put it in`);
    eq(await refusal(Rt).count(),0,`${names[d]}: and the refusal went away`);
   }
  }
 }
 if(!quick&&width===1440){
  // English, in the recommended direction and today.
  await page.locator('#language').selectOption('en');
  for(const d of [0,1,2,3]){
   await page.locator('.proto-picker-item').nth(d).click();
   await page.locator('#case').selectOption('many');await played();
   if(d>0)ok(/files were not attached|was left out|over 20 MB/.test(await page.locator('.lt-stage').innerText()),`${names[d]}: English`);
   await shot(d,'monta-en');
  }
  await page.locator('#language').selectOption('fi');
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[],'console errors');
console.log(`${checks} checks passed`);
