// node check.mjs <m365.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test.
//
// First the crops: every file in crops/ must be listed in crops.json with the
// same sha256, none may have an original screenshot's size, none may be a
// PNG, and in the browser every masked box must decode to the flat mask
// colour (so an unmasked id or domain, or an original swapped in, fails).
//
// Then every riff is clicked through every step to Tallenna at 1440 and 390,
// light and dark, at device scale factor 2, each step captured whole. Checks:
// the menu path reads at body size in full ink, the only console link is in
// the first step, the permissions have no checkboxes and copy one name each,
// A1a numbers every targeted row and its mark on the crop beside it, A1b
// moves its one spotlight with each row's eye button, A1c cuts one control
// per targeted row and opens the whole page on request, every mark lies on
// its image, the saved row appears, nothing overflows sideways, and the
// console stays clean.
import {createRequire} from 'node:module';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,readdirSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-06-m365-leikkeet';
const [input,out]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <m365.html> <evidence-dir>');process.exit(2);}
mkdirSync(out,{recursive:true});
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};

/* ---------- the committed crops ---------- */
const record=JSON.parse(readFileSync(join(here,'crops.json'),'utf8'));
const originals=Object.values(record.originals).map(s=>s.join('x'));
const files=readdirSync(join(here,'crops'));
ok(!readdirSync(here).some(f=>/\.png$/i.test(f))&&!files.some(f=>!/\.avif$/.test(f)),'only AVIF crops in the round');
ok(files.length===Object.keys(record.crops).length,'every crop file is recorded');
const avifSize=buf=>{const i=buf.indexOf('ispe');assert.ok(i>0,'AVIF without ispe');return [buf.readUInt32BE(i+8),buf.readUInt32BE(i+12)];};
for(const [name,c] of Object.entries(record.crops)){
 const buf=readFileSync(join(here,c.file));
 ok(files.includes(`${name}.avif`),`${name}: file present`);
 ok(createHash('sha256').update(buf).digest('hex')===c.sha256,`${name}: bytes differ from crops.json; re-run crops.py`);
 const [w,h]=avifSize(buf);
 ok(w===c.size[0]&&h===c.size[1],`${name}: size ${w}x${h}`);
 ok(!originals.includes(`${w}x${h}`),`${name}: has an original screenshot's size`);
 ok(w<c.box[2]-c.box[0]&&buf.length<120_000,`${name}: not scaled down or too large`);
 for(const m of c.masks)ok(m[0]>=c.box[0]&&m[2]<=c.box[2]&&m[1]>=c.box[1]&&m[3]<=c.box[3],`${name}: mask inside crop`);
}

const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
try{
 // Decode each crop and sample its masks: flat mask colour, nothing else.
 {
  const page=await browser.newPage();
  for(const [name,c] of Object.entries(record.crops)){
   const data=`data:image/avif;base64,${readFileSync(join(here,c.file)).toString('base64')}`;
   const bad=await page.evaluate(async ({data,c,s,mask})=>{
    const img=new Image();img.src=data;await img.decode();
    const cv=document.createElement('canvas');cv.width=img.naturalWidth;cv.height=img.naturalHeight;
    const g=cv.getContext('2d');g.drawImage(img,0,0);
    const out=[];
    for(const m of c.masks){
     // Inset by 3 px: the scaled edge blends with its neighbours.
     const x0=Math.ceil((m[0]-c.box[0])*s)+3,y0=Math.ceil((m[1]-c.box[1])*s)+3,x1=Math.floor((m[2]-c.box[0])*s)-3,y1=Math.floor((m[3]-c.box[1])*s)-3;
     const px=g.getImageData(x0,y0,x1-x0,y1-y0).data;
     let worst=0;for(let i=0;i<px.length;i+=4)worst=Math.max(worst,Math.abs(px[i]-mask[0]),Math.abs(px[i+1]-mask[1]),Math.abs(px[i+2]-mask[2]));
     if(worst>14)out.push({m,worst});
    }
    return out;
   },{data,c,s:record.scale,mask:record.mask});
   ok(bad.length===0,`${name}: a mask is not flat ${JSON.stringify(bad)}`);
  }
  await page.close();
 }

 const names=['a1a-vieressa','a1b-kaistale','a1c-rivissa'];
 const CLIENT='4f2c9a1e-7b3d-4e8a-9c21-5d6e7f8a9b0c',TENANT='9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
 const runs=[{width:1440,theme:'light'},{width:390,theme:'light'},{width:1440,theme:'dark'},{width:390,theme:'dark'}];
 for(const {width,theme} of runs){
  const mobile=width===390;
  const page=await browser.newPage({viewport:{width,height:mobile?844:900},deviceScaleFactor:2,isMobile:mobile,hasTouch:mobile});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));
  await page.goto('http://prototype.test/');
  await page.locator('#theme').selectOption(theme);
  await checkPicker(page,round);
  const tag=`${width}-${theme}`;
  const tid=x=>page.getByTestId(x).first();
  const fits=async()=>ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&[...document.querySelectorAll('.ah-dialog')].every(d=>d.scrollWidth<=d.clientWidth+1)),'sideways overflow');
  // Every crop shown is one of the committed ones, decoded, and every mark lies on it.
  const shots=async n=>{
   const r=await page.evaluate(()=>[...document.querySelectorAll('.m-shot')].map(f=>{
    const fr=f.querySelector('.m-shot-frame').getBoundingClientRect(),img=f.querySelector('img');
    return {avif:img.src.startsWith('data:image/avif'),loaded:img.complete&&img.naturalWidth>0,
     marks:[...f.querySelectorAll('.m-mark')].map(m=>{const b=m.getBoundingClientRect();return b.left>=fr.left-1&&b.right<=fr.right+1&&b.top>=fr.top-1&&b.bottom<=fr.bottom+1&&b.width>4&&b.height>4;})};
   }));
   for(const s of r){ok(s.avif&&s.loaded,`${n}: crop not a loaded AVIF`);for(const m of s.marks)ok(m,`${n}: mark off its image`);}
   return r;
  };
  const capture=async name=>{
   await page.waitForTimeout(250);await fits();await shots(name);
   await page.addStyleTag({content:'.cap .ah-overlay{position:absolute!important;bottom:auto!important;min-height:100%}.cap .ah-overlay .ah-modal{max-height:none!important;overflow:visible!important}.cap,.cap body{overflow:visible!important;height:auto!important}.cap .proto-picker{display:none!important}.cap .m-beside-r{position:static!important}'});
   await page.evaluate(()=>document.documentElement.classList.add('cap'));
   await page.screenshot({path:`${out}/${name}-${tag}.png`,fullPage:true});
   await page.evaluate(()=>document.documentElement.classList.remove('cap'));
  };
  const paths=async n=>{
   const r=await page.evaluate(()=>{const ink=getComputedStyle(document.querySelector('.ah-dialog')).getPropertyValue('--ah-ink');const probe=document.createElement('span');probe.style.color=ink;document.body.append(probe);const inkRgb=getComputedStyle(probe).color;probe.remove();
    return [...document.querySelectorAll('.m-path')].map(el=>{const s=getComputedStyle(el);return {size:parseFloat(s.fontSize),ok:s.color===inkRgb};});});
   for(const p of r){ok(p.size>=14,`${n}: path ${p.size}px`);ok(p.ok,`${n}: path colour`);}
  };
  const links=async()=>page.getByTestId('m-console-link').count();
  const spotted=async()=>page.locator('.m-field[data-has-spot], .m-done:has(.m-num), .m-done:has([data-testid="m-light"]), .m-done:has(.m-cut)').count();
  // The highlight, per riff, on the step now open.
  const highlight=async(d,n,id)=>{
   if(d===0){
    const nums=await page.locator('.m-num').allInnerTexts();
    const marks=await page.locator('[data-testid="m-side"] .m-mark b').allInnerTexts();
    ok(nums.length>0&&nums.join()===[...marks].sort((a,b)=>a-b).join(),`${n}: row numbers ${nums} match marks ${marks} (${id})`);
    ok(await page.evaluate(()=>{const l=document.querySelector('.m-beside-l').getBoundingClientRect(),r=document.querySelector('.m-beside-r').getBoundingClientRect();return r.left>=l.right-1||r.bottom<=l.top+1;}),`${n}: crops beside or above, not over (${id})`);
   }else if(d===1){
    const eyes=page.getByTestId('m-light');const k=await eyes.count();
    ok(k>0&&await page.locator('[data-testid="m-strip"] .m-mark').count()===1,`${n}: one spotlight (${id})`);
    const seen=new Set();
    for(let j=0;j<k;j++){
     await eyes.nth(j).click();
     ok(await eyes.nth(j).getAttribute('aria-pressed')==='true',`${n}: eye ${j} pressed`);
     seen.add(await page.locator('[data-testid="m-strip"] .m-mark').getAttribute('data-target'));
    }
    ok(seen.size===k,`${n}: each eye lights its own target (${id})`);
    await tid('m-strip-prev').click();
    await eyes.nth(0).click();
    ok(await tid('m-strip-prev').isDisabled(),`${n}: strip starts at the first target`);
    await shots(n);
   }else{
    ok(await page.getByTestId('m-cut').count()===await spotted(),`${n}: one cut per targeted row (${id})`);
    ok(await page.locator('.m-shot-outline').count()===0,`${n}: whole page closed by default`);
    await tid('m-whole').click();
    ok(await page.locator('.m-whole .m-shot-outline').count()>=1&&await page.locator('.m-whole .m-mark').count()===await spotted(),`${n}: whole page with every mark (${id})`);
    await shots(n);
   }
  };
  const perms=async n=>{
   const rows=page.locator('.m-perm');const count=await rows.count();
   ok(count>=7,`${n}: ${count} permission rows`);
   ok(await page.locator('.m-perms input[type=checkbox], .m-perms .ah-checkbox, .m-perms [role=checkbox]').count()===0,`${n}: no checkboxes`);
   ok(await page.locator('.m-perm [data-testid="m-copy"]').count()===count,`${n}: one copy per permission`);
   await rows.nth(1).locator('[data-testid="m-copy"]').click();
   const last=await page.evaluate(()=>window.__copied.at(-1));
   ok(last&&!/\s/.test(last)&&last===(await rows.nth(1).locator('.m-perm-name').innerText()),`${n}: one permission per copy (${last})`);
  };
  for(const d of [0,1,2]){
   const n=names[d];
   await page.locator('.proto-picker-item').nth(d).click();
   await page.locator(`.m-review.variant-${d}`).waitFor({state:'attached'});
   assert.match(await tid('direction-lines').locator('li[aria-current]').innerText(),new RegExp(`^A1${'abc'[d]} `));checks++;
   await page.evaluate(()=>{window.__copied.length=0;});
   const steps=['register','public','permissions','consent'];
   for(const [k,id] of steps.entries()){
    await tid(`m-step-${id}`).waitFor();await paths(n);
    ok(await links()===(k===0?1:0),`${n}: console link only in step 1 (${id})`);
    if(k===0)await capture(`${n}-${k+1}-${id}`);
    await highlight(d,n,id);
    if(id==='permissions'){await perms(n);}
    if(id==='consent'){
     await tid('m-field-client_id').fill(CLIENT);await tid('m-field-tenant_id').fill(TENANT);
     ok((await tid('m-handoff').locator('pre').textContent()).includes(`/${TENANT}/adminconsent?client_id=${CLIENT}`),`${n}: consent link filled`);
     await capture(`${n}-${k+1}-${id}`);
     await tid('m-save').click();await tid('m-saved').waitFor({timeout:4000});ok(true);
     await capture(`${n}-${k+2}-tallennettu`);
    }else{
     if(k>0)await capture(`${n}-${k+1}-${id}`);
     await tid('m-next').click();
    }
   }
   // Minulla on jo sovellus: from the list to Overview, values only.
   await tid('m-reset').click();
   await tid('m-skip').click();
   await tid('m-field-client_id').waitFor();ok(await links()===1,'skip: link to the list');
   await capture(`${n}-x-minulla-on-jo-sovellus`);
   await tid('m-back').click();
   await tid('m-step-register').waitFor();ok(true);
  }
  // The narrower level: its own app and list.
  await page.locator('.proto-picker-item').nth(0).click();
  await page.locator('#level').selectOption('microsoft_read');
  await tid('m-level-app').waitFor();ok(true);
  await tid('m-next').click();await tid('m-next').click();
  ok(await page.locator('.m-perm').count()===8,'read level rows');
  ok(await page.getByText('Mail.Send').count()===0,'read level has no Mail.Send');
  ok(await page.getByText('Microsoft Graph (9)').count()===1,'read level count');
  await page.locator('#level').selectOption('microsoft');
  await page.close();
 }
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
