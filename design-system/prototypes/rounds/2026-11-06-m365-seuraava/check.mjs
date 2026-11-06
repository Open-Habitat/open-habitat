// node check.mjs <m365.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test.
//
// First round 3's crops, which this round imports: every file in its crops/
// must be listed in its crops.json with the same sha256, none may have an
// original screenshot's size, none may be a PNG, and in the browser every
// masked box must decode to the flat mask colour (so an unmasked id or
// domain, or an original swapped in, fails). No image lives in this round.
//
// Then every riff is walked through every sub-item of every step to Tallenna
// at 1440x900 and 390x844, light and dark, at device scale factor 2, pressing
// only the one forward control. The point of the round: at every sub-item
// exactly one forward control is visible (data-forward: the next, or Tallenna
// at the very end) and no other visible control says Seuraava. Also at every
// sub-item: the dialog fits the viewport without scrolling, the band has one
// spotlight on the sub-item's own target and keeps one height within the
// step, the menu path reads at body size in full ink, the only console link
// is in the first step, the permissions have no checkboxes and copy one name
// each. Per riff: A1b4's later dots are not buttons and a passed one returns;
// A1b5's tabs hold nothing to press; A1b6's tabs can be picked and moved by
// arrow key. Back crosses a step boundary in all three. A save with empty ids
// opens the sub-item of the missing field. The saved row appears, nothing
// overflows sideways, the console stays clean.
import {createRequire} from 'node:module';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,readdirSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const crops3=resolve(here,'../2026-11-06-m365-leikkeet');
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-06-m365-seuraava';
const [input,out]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <m365.html> <evidence-dir>');process.exit(2);}
mkdirSync(out,{recursive:true});
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};

/* ---------- the committed crops (round 3's) ---------- */
ok(!readdirSync(here).some(f=>/\.(png|avif|jpe?g|webp)$/i.test(f)),'no image files in this round');
const record=JSON.parse(readFileSync(join(crops3,'crops.json'),'utf8'));
const originals=Object.values(record.originals).map(s=>s.join('x'));
const files=readdirSync(join(crops3,'crops'));
ok(!readdirSync(crops3).some(f=>/\.png$/i.test(f))&&!files.some(f=>!/\.avif$/.test(f)),'only AVIF crops');
ok(files.length===Object.keys(record.crops).length,'every crop file is recorded');
const avifSize=buf=>{const i=buf.indexOf('ispe');assert.ok(i>0,'AVIF without ispe');return [buf.readUInt32BE(i+8),buf.readUInt32BE(i+12)];};
for(const [name,c] of Object.entries(record.crops)){
 const buf=readFileSync(join(crops3,c.file));
 ok(files.includes(`${name}.avif`),`${name}: file present`);
 ok(createHash('sha256').update(buf).digest('hex')===c.sha256,`${name}: bytes differ from crops.json; re-run crops.py`);
 const [w,h]=avifSize(buf);
 ok(w===c.size[0]&&h===c.size[1],`${name}: size ${w}x${h}`);
 ok(!originals.includes(`${w}x${h}`),`${name}: has an original screenshot's size`);
 ok(w<c.box[2]-c.box[0]&&buf.length<120_000,`${name}: not scaled down or too large`);
 for(const m of c.masks)ok(m[0]>=c.box[0]&&m[2]<=c.box[2]&&m[1]>=c.box[1]&&m[3]<=c.box[3],`${name}: mask inside crop`);
}

// The sub-items each step must show, in order, with the target each lights.
const STEPS={
 register:['list.new','register.name','register.accounts','register.redirect','register.register','overview.menu'],
 public:['auth.menu','auth.add','auth.settings','auth.tabs'],
 permissions:['perms.menu','perms.add','perms.configured','perms.graph'],
 consent:['perms.grant','overview.menu','overview.client','overview.tenant'],
};

const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
try{
 {
  const page=await browser.newPage();
  for(const [name,c] of Object.entries(record.crops)){
   const data=`data:image/avif;base64,${readFileSync(join(crops3,c.file)).toString('base64')}`;
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

 const names=['r5-a1b4-polku','r5-a1b5-yksi-nappi','r5-a1b6-nuoli-rivissa'];
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
  // Fits: no sideways overflow, and the whole dialog inside the viewport
  // above the review picker with nothing to scroll.
  const fits=async n=>{
   const r=await page.evaluate(()=>{const m=document.querySelector('.ah-modal'),b=m.getBoundingClientRect();
    return {side:document.documentElement.scrollWidth<=innerWidth&&m.scrollWidth<=m.clientWidth+1,over:m.scrollHeight-m.clientHeight,bottom:b.bottom,top:b.top,vh:innerHeight};});
   ok(r.side,`${n}: sideways overflow`);
   ok(r.over<=1&&r.bottom<=r.vh-56+1,`${n}: does not fit ${width}: scrolls ${r.over}px, bottom ${r.bottom}/${r.vh}`);
  };
  const band=async(n,want)=>{
   const r=await page.evaluate(()=>{const f=document.querySelector('[data-testid="m-strip"]');const fr=f.querySelector('.m-shot-frame').getBoundingClientRect(),img=f.querySelector('img');
    const marks=[...f.querySelectorAll('.m-mark')].map(m=>{const b=m.getBoundingClientRect();return {t:m.dataset.target,on:b.left>=fr.left-1&&b.right<=fr.right+1&&b.top>=fr.top-1&&b.bottom<=fr.bottom+1&&b.width>4&&b.height>4};});
    return {h:Math.round(fr.height),avif:img.src.startsWith('data:image/avif'),loaded:img.complete&&img.naturalWidth>0,marks,panel:document.querySelector('[data-testid="m-panel"]').dataset.target};});
   ok(r.avif&&r.loaded,`${n}: band not a loaded AVIF`);
   ok(r.marks.length===1&&r.marks[0].on,`${n}: one spotlight on the band ${JSON.stringify(r.marks)}`);
   ok(r.marks[0].t===want&&r.panel===want,`${n}: lights ${r.marks[0].t}, panel ${r.panel}, want ${want}`);
   return r.h;
  };
  const paths=async n=>{
   const r=await page.evaluate(()=>{const ink=getComputedStyle(document.querySelector('.ah-dialog')).getPropertyValue('--ah-ink');const probe=document.createElement('span');probe.style.color=ink;document.body.append(probe);const inkRgb=getComputedStyle(probe).color;probe.remove();
    return [...document.querySelectorAll('.m-path')].map(el=>{const s=getComputedStyle(el);return {size:parseFloat(s.fontSize),ok:s.color===inkRgb};});});
   for(const p of r){ok(p.size>=14,`${n}: path ${p.size}px`);ok(p.ok,`${n}: path colour`);}
  };
  const capture=async name=>{
   await page.waitForTimeout(220);
   await page.screenshot({path:`${out}/${name}-${tag}.png`});
  };
  const perms=async n=>{
   const rows=page.locator('.m-perm');const count=await rows.count();
   ok(count>=7,`${n}: ${count} permission chips`);
   ok(await page.locator('.m-perms input[type=checkbox], .m-perms .ah-checkbox, .m-perms [role=checkbox]').count()===0,`${n}: no checkboxes`);
   ok(await page.locator('.m-perm [data-testid="m-copy"]').count()===count,`${n}: one copy per permission`);
   await rows.nth(1).locator('[data-testid="m-copy"]').click();
   const last=await page.evaluate(()=>window.__copied.at(-1));
   ok(last&&!/\s/.test(last)&&last===(await rows.nth(1).locator('.m-perm-name').innerText()),`${n}: one permission per copy (${last})`);
  };
  // Exactly one forward control on screen, and nothing else that says Seuraava.
 const one=async(n,final)=>{
  const r=await page.evaluate(()=>{const vis=e=>{const b=e.getBoundingClientRect();return b.width>0&&b.height>0&&getComputedStyle(e).visibility!=='hidden';};
   const fwd=[...document.querySelectorAll('.ah-dialog [data-forward]')].filter(vis).map(e=>e.dataset.testid);
   const say=[...document.querySelectorAll('.ah-dialog button')].filter(vis).filter(e=>!e.hasAttribute('data-forward')&&/^Seuraava/i.test((e.getAttribute('aria-label')||e.textContent||'').trim())).length;
   return {fwd,say};});
  ok(r.fwd.length===1&&r.fwd[0]===(final?'m-save':'m-next'),`${n}: one forward control ${JSON.stringify(r.fwd)}`);
  ok(r.say===0,`${n}: another control says Seuraava`);
 };
 for(const d of [0,1,2]){
   const n=names[d];
   await page.locator('.proto-picker-item').nth(d).click();
   await page.locator(`.m-review.variant-${d}`).waitFor({state:'attached'});
   assert.match(await tid('direction-lines').locator('li[aria-current]').innerText(),new RegExp(`^A1b${d+4} `));checks++;
   await page.evaluate(()=>{window.__copied.length=0;});
   for(const [k,id] of Object.keys(STEPS).entries()){
    await tid(`m-step-${id}`).waitFor();
    const want=STEPS[id];let h0=null;
    for(let j=0;j<want.length;j++){
     if(j>0)await tid('m-next').click();
     const at=`${n} ${id}/${j}`;
     const final=k===3&&j===want.length-1;
     await one(at,final);
     await paths(at);
     ok(await page.getByTestId('m-console-link').count()===(k===0&&j===0?1:0),`${at}: console link only in step 1`);
     const h=await band(at,want[j]);
     if(h0===null)h0=h;else ok(Math.abs(h-h0)<=1,`${at}: band height ${h} vs ${h0}`);
     if(d===0){
      ok(await page.locator('.m-prow li[data-later] button').count()===0,`${at}: later dots are not buttons`);
      ok(await page.locator('.m-prow li[aria-current="step"]').count()===1,`${at}: one current dot`);
      ok(await page.locator('.si-foot [data-testid="m-back"]').count()===0,`${at}: no footer Takaisin`);
     }
     if(d===1)ok(await page.locator('.m-rtabs button, .m-rtabs a, .m-rtabs [tabindex]').count()===0&&await page.locator('.m-rtab[aria-current="step"]').count()===1,`${at}: progress tabs hold nothing to press`);
     if(d===2)ok(await page.getByTestId('m-tab').nth(j).getAttribute('aria-selected')==='true',`${at}: tab follows`);
     if(id==='permissions'&&want[j]==='perms.configured')await perms(at);
     if(id==='consent'&&want[j]==='overview.tenant'){
      // Tallenna with the ids empty opens the client field's sub-item.
      await tid('m-save').click();
      ok(await page.getByTestId('m-panel').getAttribute('data-target')==='overview.client','save error opens the client field');
      await one(`${at} after error`,false);
      await tid('m-field-client_id').fill(CLIENT);
      await tid('m-next').click();
      await tid('m-field-tenant_id').fill(TENANT);
     }
     await page.waitForTimeout(170);
     await fits(at);
     const keep=j===0||j===1||(id==='register'&&j===want.length-1)||want[j]==='perms.configured'||want[j]==='overview.tenant';
     if(keep&&(theme==='light'||(k===0&&j<2)||want[j]==='perms.configured'))await capture(`${n}-${k+1}-${id}-${j+1}`);
    }
    if(id==='consent'){
     // Back to the first sub-item with each riff's own way back: the hand-off is filled now.
     if(d===0)await page.getByTestId('m-dot').nth(0).click();
     else if(d===2)await page.getByTestId('m-tab').nth(0).click();
     else for(let b=0;b<3;b++)await tid('m-back').click();
     ok(await page.getByTestId('m-panel').getAttribute('data-target')==='perms.grant',`${n}: back to Grant`);
     ok((await tid('m-handoff').locator('pre').textContent()).includes(`/${TENANT}/adminconsent?client_id=${CLIENT}`),`${n}: consent link filled`);
     await fits(`${n} consent handoff`);
     if(theme==='light')await capture(`${n}-4-consent-1-linkki`);
     for(let b=0;b<3;b++)await tid('m-next').click();
     await tid('m-save').click();await tid('m-saved').waitFor({timeout:4000});ok(true);
     if(theme==='light')await capture(`${n}-5-tallennettu`);
    }else{
     ok((await tid('m-next').getAttribute('aria-label')||await tid('m-next').innerText()).startsWith('Seuraava vaihe'),`${n} ${id}: last sub-item leads to the next step`);
     await tid('m-next').click();
     ok(await page.getByTestId('m-panel').getAttribute('data-part')===`${Object.keys(STEPS)[k+1]}.${['auth','menu','grant'][k]}`,`${n}: next step starts at its first sub-item`);
     if(k===0&&theme==='light')await capture(`${n}-2-public-0-raja`);
    }
   }
   // Back walks one sub-item, and across a step boundary lands on the last one.
   await tid('m-reset').click();await tid('m-next').click();
   if(d===0){await page.getByTestId('m-dot').nth(0).click();}else await tid('m-back').click();
   ok(await page.getByTestId('m-panel').getAttribute('data-target')==='list.new',`${n}: back one sub-item`);
   for(let j=0;j<6;j++)await tid('m-next').click();
   await tid('m-back').click();
   ok(await page.getByTestId('m-panel').getAttribute('data-target')==='overview.menu',`${n}: back across a step lands on its last sub-item`);
   if(d===2){
    // A1b6 tabs are free: a later tab is one press away, arrows move along.
    await page.getByTestId('m-tab').nth(4).click();
    ok(await page.getByTestId('m-panel').getAttribute('data-target')==='register.register',`${n}: tab jumps ahead`);
    await page.keyboard.press('ArrowLeft');
    ok(await page.getByTestId('m-tab').nth(3).getAttribute('aria-selected')==='true',`${n}: arrow key moves along the tabs`);
   }
   // Minulla on jo sovellus: from the list to Overview, values only.
   await tid('m-reset').click();
   await tid('m-skip').click();
   await tid('m-step-enter').waitFor();ok(await page.getByTestId('m-console-link').count()===1,'skip: link to the list');
   await band(`${n} skip`,'list.search');await fits(`${n} skip`);await one(`${n} skip`,false);
   if(theme==='light')await capture(`${n}-x-minulla-on-jo-sovellus`);
   await tid('m-back').click();
   await tid('m-step-register').waitFor();ok(true);
  }
 // The narrower level: its own app and list.
  await page.locator('.proto-picker-item').nth(1).click();
  await page.locator('#level').selectOption('microsoft_read');
  await tid('m-next').click();
  await tid('m-level-app').waitFor();await fits('read level name');ok(true);
  for(let j=0;j<11;j++)await tid('m-next').click();
  ok(await page.locator('.m-perm').count()===8,'read level rows');
  ok(await page.getByText('Mail.Send').count()===0,'read level has no Mail.Send');
  await tid('m-next').click();
  ok(await page.getByText('Microsoft Graph (9)').count()===1,'read level count');
  await page.locator('#level').selectOption('microsoft');
  await page.close();
 }
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
