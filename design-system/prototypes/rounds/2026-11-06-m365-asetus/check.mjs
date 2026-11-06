// node check.mjs <m365.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. Today
// (the production AppSetupDialog) and every direction are clicked through
// every step to Tallenna at 1440 and 390, light and dark, at device scale
// factor 2. Each step is captured whole (the dialog's own scroll is lifted
// for the picture). Checks: the console path reads at body size in full ink
// in the directions (today's is recorded), permissions copy one name at a
// time in A and B (today copies the whole list), C has no permissions step
// and its consent link names the permissions, the saved row appears, the
// page never overflows sideways, and the console stays clean.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-06-m365-asetus';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['nyt','a-lista','b-rinnakkain','c-kolme'];
const CLIENT='4f2c9a1e-7b3d-4e8a-9c21-5d6e7f8a9b0c',TENANT='9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
let checks=0;const errors=[];const facts={};
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const runs=[{width:1440,theme:'light'},{width:390,theme:'light'},{width:1440,theme:'dark'},{width:390,theme:'dark'}];
try{
for(const {width,theme} of runs){
 const mobile=width===390;
 const page=await browser.newPage({viewport:{width,height:mobile?844:900},deviceScaleFactor:2,isMobile:mobile,hasTouch:mobile});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 await checkPicker(page,round);
 const tag=`${width}-${theme}`;
 const fits=async()=>ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&[...document.querySelectorAll('.ah-dialog')].every(d=>d.scrollWidth<=d.clientWidth+1)),'sideways overflow');
 // Lift the dialog's own scroll so one picture holds the whole step.
 const capture=async name=>{
  await page.waitForTimeout(200);await fits();
  await page.addStyleTag({content:'.cap .ah-overlay{position:absolute!important;bottom:auto!important;min-height:100%}.cap .ah-overlay .ah-modal{max-height:none!important;overflow:visible!important}.cap,.cap body{overflow:visible!important;height:auto!important}.cap .proto-picker{display:none!important}'});
  await page.evaluate(()=>document.documentElement.classList.add('cap'));
  await page.screenshot({path:`${out}/${name}-${tag}.png`,fullPage:true});
  await page.evaluate(()=>document.documentElement.classList.remove('cap'));
 };
 const tid=x=>page.getByTestId(x).first();
 for(const d of [0,1,2,3]){
  const n=names[d],p=d?'m':'si';
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.m-review.variant-${d}`).waitFor({state:'attached'});
  assert.match(await tid('direction-lines').locator('li[aria-current]').innerText(),d?/^[ABC] /:/^Nyt: /);checks++;
  await page.evaluate(()=>{window.__copied.length=0;});
  const stepIds=d===3?['register','public','consent']:['register','public','permissions','consent'];
  ok(await page.locator(`[data-testid="${p}-progress"] span`).count()===stepIds.length,`${n}: step count`);
  for(const [k,id] of stepIds.entries()){
   await tid(`${p}-step-${id}`).waitFor();
   // The console path: today's line is meta size and muted; the directions' is body size in ink.
   const path=await page.evaluate(sel=>{const el=document.querySelector(sel);if(!el)return null;const s=getComputedStyle(el);const ink=getComputedStyle(document.querySelector('.ah-dialog')).getPropertyValue('--ah-ink');const probe=document.createElement('span');probe.style.color=ink;document.body.append(probe);const inkRgb=getComputedStyle(probe).color;probe.remove();return {size:parseFloat(s.fontSize),color:s.color,ink:inkRgb};},d?'.m-path':'.si-path');
   if(path){
    if(d===0)facts[`nyt-path-${tag}`]=path;
    else{ok(path.size>=14,`${n}: path ${path.size}px`);ok(path.color===path.ink,`${n}: path colour ${path.color} vs ${path.ink}`);}
   }
   if(id==='permissions'){
    if(d===0){
     await tid('si-permissions').locator('[data-testid="si-copy"]').click();
     facts.nytCopiesList=true;
    }else{
     const rows=page.locator('.m-perm');const count=await rows.count();
     ok(count>=9,`${n}: ${count} permission rows`);
     await rows.nth(0).locator('[data-testid="m-copy"]').click();
     const last=await page.evaluate(()=>window.__copied.at(-1));
     ok(last&&!/\s/.test(last),`${n}: one permission per copy (${last})`);
     await capture(`${n}-${k+1}-${id}-0-alussa`);
     for(let j=0;j<count;j++){
      await rows.nth(j).locator('.ah-checkbox').click();
      if(j===2)await capture(`${n}-${k+1}-${id}-1-kesken`);
     }
     assert.match(await tid('m-count').innerText(),new RegExp(`^${count}/${count} `));checks++;
    }
   }
   if(d===2&&id!=='permissions'&&await page.getByTestId('m-sub-0').count()){
    const subs=await page.locator('[data-testid^="m-sub-"]').count();
    for(let j=0;j<subs;j++){await tid(`m-sub-${j}`).click();ok(await page.locator('[data-testid="m-entra"]').count()===1,'entra sketch');await capture(`${n}-${k+1}-${id}-${j}`);}
   }
   const lastStep=k===stepIds.length-1;
   if(lastStep){
    await tid(`${p}-field-client_id`).fill(CLIENT);
    await tid(`${p}-field-tenant_id`).fill(TENANT);
    if(d===3){
     ok(await tid('m-consent-open').isEnabled(),'consent opens once ids are in');
     const link=await tid('m-handoff').locator('pre').textContent();
     ok(link.includes('/v2.0/adminconsent')&&link.includes('Mail.Send')&&link.includes('nativeclient'),'C link names permissions');
     await capture(`${n}-${k+1}-${id}-0-tunnukset`);
     await tid('m-consent-open').click();await tid('m-ms-consent').waitFor();
     await capture(`${n}-${k+1}-${id}-1-microsoft`);
     await tid('m-ms-accept').click();await tid('m-ms-blank').waitFor();
     await capture(`${n}-${k+1}-${id}-2-tyhja-sivu`);
     await tid('m-ms-return').click();await tid('m-consented').waitFor();
     await capture(`${n}-${k+1}-${id}-3-valmis`);
    }else if(d!==2)await capture(`${n}-${k+1}-${id}`);
    else{await tid('m-sub-1').click();await capture(`${n}-${k+1}-${id}-tunnukset`);}
    await tid(`${p}-save`).click();
    await tid('m-saved').waitFor({timeout:4000});ok(true);
    await capture(`${n}-${k+2}-tallennettu`);
   }else{
    if(d!==2&&id!=='permissions')await capture(`${n}-${k+1}-${id}`);
    if(d===0&&id==='permissions')await capture(`${n}-${k+1}-${id}`);
    if(d===2&&id==='permissions')await capture(`${n}-${k+1}-${id}-2-valmis`);
    else if(d!==0&&d!==2&&id==='permissions')await capture(`${n}-${k+1}-${id}-2-valmis`);
    await tid(`${p}-next`).click();
   }
  }
  // Minulla on jo sovellus: values only.
  await tid('m-open').click();
  await tid(`${p}-skip`).click();
  await tid(`${p}-field-client_id`).waitFor();ok(true);
  await tid(`${p}-back`).click();
  await tid(`${p}-step-register`).waitFor();ok(true);
 }
 // The narrower levels get their own app and its own list (A).
 await page.locator('.proto-picker-item').nth(1).click();
 await page.locator('#level').selectOption('microsoft_read');
 await tid('m-level-app').waitFor();ok(true);
 await tid('m-next').click();await tid('m-next').click();
 ok(await page.locator('.m-perm').count()===8,'read level rows');
 ok(await page.getByText('Mail.Send').count()===0,'read level has no Mail.Send');
 await capture(`a-lista-3-permissions-vain-luku`);
 await page.locator('#level').selectOption('microsoft');
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(JSON.stringify(facts));
console.log(`ok: ${checks} checkpoints`);
