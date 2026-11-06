// node check.mjs <m365.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. Every
// riff is clicked through every step to Tallenna at 1440 and 390, light and
// dark, at device scale factor 2. Each step is captured whole (the dialog's
// own scroll is lifted for the picture). Checks: the menu path reads at body
// size in full ink, the only console link is in the first step, A1 shows an
// Entra fragment on every step, A2 is one list whose items open in menu order,
// A3 opens every step with "Olet nyt" and takes the ids in step 2,
// permissions copy one name at a time, the saved row appears, the page never
// overflows sideways, no Entra fragment shows an unmasked id, and the console
// stays clean.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-06-m365-riffi';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['a1-valikkopala','a2-valikon-jarjestys','a3-olet-nyt'];
// Synthetic ids typed into the guide's own fields, not anyone's tenant.
const CLIENT='4f2c9a1e-7b3d-4e8a-9c21-5d6e7f8a9b0c',TENANT='9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const GUID=/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
let checks=0;const errors=[];
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
 const masked=async()=>ok(await page.evaluate(re=>[...document.querySelectorAll('.m-frag,.m-pair-entra')].every(f=>!new RegExp(re,'i').test(f.textContent)),GUID.source),'fragment shows an id');
 const capture=async name=>{
  await page.waitForTimeout(200);await fits();await masked();
  await page.addStyleTag({content:'.cap .ah-overlay{position:absolute!important;bottom:auto!important;min-height:100%}.cap .ah-overlay .ah-modal{max-height:none!important;overflow:visible!important}.cap,.cap body{overflow:visible!important;height:auto!important}.cap .proto-picker{display:none!important}'});
  await page.evaluate(()=>document.documentElement.classList.add('cap'));
  await page.screenshot({path:`${out}/${name}-${tag}.png`,fullPage:true});
  await page.evaluate(()=>document.documentElement.classList.remove('cap'));
 };
 const tid=x=>page.getByTestId(x).first();
 // The menu path is the instruction: body size, full ink, wherever it shows.
 const paths=async n=>{
  const r=await page.evaluate(()=>{const ink=getComputedStyle(document.querySelector('.ah-dialog')).getPropertyValue('--ah-ink');const probe=document.createElement('span');probe.style.color=ink;document.body.append(probe);const inkRgb=getComputedStyle(probe).color;probe.remove();
   return [...document.querySelectorAll('.m-path')].filter(el=>!el.closest('.m-item[data-done]:not([data-open])')).map(el=>{const s=getComputedStyle(el);return {size:parseFloat(s.fontSize),ok:s.color===inkRgb};});});
  for(const p of r){ok(p.size>=14,`${n}: path ${p.size}px`);ok(p.ok,`${n}: path colour`);}
 };
 const links=async()=>page.getByTestId('m-console-link').count();
 // Copy one permission, then tick them all; one copy holds one name.
 const perms=async(n,shot)=>{
  const rows=page.locator('.m-perm');const count=await rows.count();
  ok(count>=7,`${n}: ${count} permission rows`);
  await rows.nth(0).locator('[data-testid="m-copy"]').click();
  const last=await page.evaluate(()=>window.__copied.at(-1));
  ok(last&&!/\s/.test(last),`${n}: one permission per copy (${last})`);
  for(let j=0;j<count;j++){await rows.nth(j).locator('.ah-checkbox').click();if(j===2&&shot)await capture(shot);}
  assert.match(await tid('m-count').innerText(),new RegExp(`^${count}/${count} `));checks++;
 };
 const ids=async()=>{await tid('m-field-client_id').fill(CLIENT);await tid('m-field-tenant_id').fill(TENANT);};
 const save=async n=>{await tid('m-save').click();await tid('m-saved').waitFor({timeout:4000});ok(true);await capture(n);};
 for(const d of [0,1,2]){
  const n=names[d];
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.m-review.variant-${d}`).waitFor({state:'attached'});
  assert.match(await tid('direction-lines').locator('li[aria-current]').innerText(),new RegExp(`^A${d+1} `));checks++;
  await page.evaluate(()=>{window.__copied.length=0;});
  if(d===0){
   const steps=['register','public','permissions','consent'];
   for(const [k,id] of steps.entries()){
    await tid(`m-step-${id}`).waitFor();await paths(n);
    ok(await page.locator('[data-testid="m-frag"]').count()>=1,`${n}: fragment on ${id}`);
    ok(await links()===(k===0?1:0),`${n}: console link only in step 1 (${id})`);
    ok(await page.evaluate(()=>[...document.querySelectorAll('.m-beside')].every(b=>{const l=b.querySelector('.m-beside-l').getBoundingClientRect(),r=b.querySelector('.m-beside-r').getBoundingClientRect();return r.left>=l.right-1||r.bottom<=l.top+1;})),`${n}: fragment beside or above, not over (${id})`);
    if(id==='public')ok(await page.locator('.m-frag-menu li[data-on]').innerText()==='Authentication (Preview)','A1: menu item');
    if(id==='permissions'){await capture(`${n}-${k+1}-${id}-0-alussa`);await perms(n,`${n}-${k+1}-${id}-1-kesken`);}
    if(id==='consent'){await capture(`${n}-${k+1}-${id}-0-tyhja`);await ids();await capture(`${n}-${k+1}-${id}-1-tunnukset`);await save(`${n}-${k+2}-tallennettu`);}
    else{await capture(`${n}-${k+1}-${id}`);await tid('m-next').click();}
   }
  }else if(d===1){
   await tid('m-step-list').waitFor();
   ok(await page.locator('[data-testid="m-progress"]').count()===0,'A2: one list, no step dots');
   const items=['register','overview','redirect','settings','permissions','consent'];
   ok(await page.locator('.m-item').count()===items.length,'A2: item count');
   await capture(`${n}-0-lista`);
   for(const [k,id] of items.entries()){
    await tid(`m-item-${id}`).locator('.m-item-body').waitFor();
    ok(await page.locator('.m-item[data-open]').count()===1,'A2: one item open');
    await paths(n);
    ok(await links()===(k===0?1:0),`${n}: console link only in the first item (${id})`);
    if(id==='overview')await ids();
    if(id==='permissions'){await perms(n);}
    if(k>0)await capture(`${n}-${k}-${id}`);
    await tid(`m-item-done-${id}`).click();
   }
   ok(await page.locator('.m-item[data-done]').count()===items.length,'A2: all ticked');
   assert.match(await tid('m-items-count').innerText(),/^6\/6 /);checks++;
   await capture(`${n}-7-kaikki-tehty`);
   await save(`${n}-8-tallennettu`);
   // An empty id on save opens the Overview item with the error.
   await tid('m-open').click();await tid('m-save').click();
   await tid('m-item-overview').locator('.m-item-body').waitFor();ok(true);
   ok(await page.locator('.ah-field-error, [data-invalid], [aria-invalid="true"]').count()>0,'A2: empty ids rejected');
   await capture(`${n}-9-tunnukset-puuttuvat`);
  }else{
   const steps=['register','ids','public','permissions','consent'];
   for(const [k,id] of steps.entries()){
    await tid(`m-step-${id}`).waitFor();await paths(n);
    ok(await page.locator('[data-testid="m-here"]').count()===1,`${n}: Olet nyt on ${id}`);
    ok(await links()===(k===0?1:0),`${n}: console link only in step 1 (${id})`);
    if(id==='ids'){
     await capture(`${n}-${k+1}-${id}-0-tyhja`);
     await tid('m-field-client_id').fill('abcd-ei-kokonainen');
     ok(/Ei näytä tunnukselta/.test(await tid('m-pair-client_id').innerText()),'A3: partial id named');
     await ids();
     ok(/Muoto kunnossa/.test(await tid('m-pair-client_id').innerText())&&/Muoto kunnossa/.test(await tid('m-pair-tenant_id').innerText()),'A3: ids accepted');
     await capture(`${n}-${k+1}-${id}-1-liitetty`);
    }else if(id==='permissions'){await capture(`${n}-${k+1}-${id}-0-alussa`);await perms(n,`${n}-${k+1}-${id}-1-kesken`);}
    else if(id!=='consent')await capture(`${n}-${k+1}-${id}`);
    if(id==='consent'){
     ok((await tid('m-handoff').locator('pre').textContent()).includes(`/${TENANT}/adminconsent?client_id=${CLIENT}`),'A3: consent link filled from step 2');
     await capture(`${n}-${k+1}-${id}`);
     await save(`${n}-${k+2}-tallennettu`);
    }else await tid('m-next').click();
   }
  }
  // Minulla on jo sovellus: from the list to Overview, values only.
  await tid('m-reset').click();
  await tid('m-skip').click();
  await tid('m-field-client_id').waitFor();ok(await links()===1,'skip: link to the list');
  await capture(`${n}-x-minulla-on-jo-sovellus`);
  await tid('m-back').click();
  await page.locator('[data-testid="m-step-register"],[data-testid="m-step-list"]').first().waitFor();ok(true);
 }
 // The narrower levels get their own app and its own list (A1).
 await page.locator('.proto-picker-item').nth(0).click();
 await page.locator('#level').selectOption('microsoft_read');
 await tid('m-level-app').waitFor();ok(true);
 await tid('m-next').click();await tid('m-next').click();
 ok(await page.locator('.m-perm').count()===8,'read level rows');
 ok(await page.getByText('Mail.Send').count()===0,'read level has no Mail.Send');
 ok(await page.getByText('Microsoft Graph (9)').count()===1,'read level count');
 await capture(`a1-valikkopala-3-permissions-vain-luku`);
 await page.locator('#level').selectOption('microsoft');
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
