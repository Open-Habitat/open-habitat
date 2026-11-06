// node check.mjs <levels.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test.
//
// First the crops this round imports from proto-m365-setup-flow round 3:
// every file in its crops/ must be listed in its crops.json with the same
// sha256, none may have an original screenshot's size, none may be a PNG,
// every masked box must decode to the flat mask colour, and this round's two
// extra boxes must lie inside their crop. No image lives in this round.
//
// Then every riff at 1440x900 and 390x844, light and dark, at device scale
// factor 2:
// - Sovellus kerrallaan walks the first application with the footer button
//   alone, refuses an empty save by opening the client id, saves with ids,
//   moves on to the second application with the first ticked and the tenant
//   not asked again; closed, the page shows 1/4 levels and the open table.
// - Vaihe kerrallaan walks every step for all four applications to the last
//   step, refuses an empty save and a client id pasted twice, and saves.
// - Yksi komento walks Cloud Shell, the command and the pasted line, refuses
//   an empty and a partial line, saves from a full one; Tee käsin opens the
//   manual walk.
// At every sub-item the band has one spotlight on the sub-item's own target,
// and the dialog fits the viewport without scrolling. Before setup the
// comparison table is open under Microsoft's row; after setup it is gone
// until Mitä tasot sallivat opens it. Every cell says Kyllä or Ei (or the
// Dropbox app folder's own words). Nothing overflows sideways, the console
// stays clean. Screenshots: r3-d<riff>-<view>-<width>-<theme>.png.
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
const round='2026-11-06-integraatiotasot-3';
const [input,out]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <levels.html> <evidence-dir>');process.exit(2);}
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
 ok(createHash('sha256').update(buf).digest('hex')===c.sha256,`${name}: bytes differ from crops.json; re-run crops.py`);
 const [w,h]=avifSize(buf);
 ok(w===c.size[0]&&h===c.size[1],`${name}: size ${w}x${h}`);
 ok(!originals.includes(`${w}x${h}`),`${name}: has an original screenshot's size`);
 ok(w<c.box[2]-c.box[0]&&buf.length<120_000,`${name}: not scaled down or too large`);
}

const SAMPLE=['4f2c9a1e-7b3d-4e8a-9c21-5d6e7f8a9b0c','1b2c3d4e-5f60-4718-8a9b-0c1d2e3f4a5b','c0ffee00-1234-4abc-8def-0123456789ab','7e6d5c4b-3a29-4180-9f7e-6d5c4b3a2918'];
const TENANT='9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const names=['sovellus','vaihe','komento'];

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
  const capture=async (d,view)=>{await page.waitForTimeout(220);await page.screenshot({path:`${out}/r3-d${d+1}-${view}-${tag}.png`});};
  if(width===1440&&theme==='light'){
   const extra=await page.evaluate(()=>window.__targets);
   for(const [c,{box,extra:boxes}] of Object.entries(extra))for(const [t,b] of Object.entries(boxes))
    ok(b[0]>=box[0]&&b[1]>=box[1]&&b[2]<=box[2]&&b[3]<=box[3],`extra target ${c}.${t} inside the crop`);
  }
  const fits=async n=>{
   const r=await page.evaluate(()=>{const m=document.querySelector('.ah-modal');if(!m)return null;const b=m.getBoundingClientRect();
    return {side:document.documentElement.scrollWidth<=innerWidth&&m.scrollWidth<=m.clientWidth+1,over:Math.max(m.scrollHeight-m.clientHeight,...[...m.querySelectorAll('.ah-dialog')].map(d=>d.scrollHeight-d.clientHeight)),bottom:b.bottom,vh:innerHeight};});
   ok(r,`${n}: dialog open`);
   ok(r.side,`${n}: sideways overflow`);
   ok(r.over<=1&&r.bottom<=r.vh-56+1,`${n}: does not fit ${width}: scrolls ${r.over}px, bottom ${r.bottom}/${r.vh}`);
  };
  const band=async n=>{
   const r=await page.evaluate(()=>{const f=document.querySelector('[data-testid="m-strip"]');const p=document.querySelector('[data-testid="m-panel"]');
    if(!f)return {none:true,panel:p.dataset.target};
    const fr=f.querySelector('.m-shot-frame').getBoundingClientRect(),img=f.querySelector('img');
    const marks=[...f.querySelectorAll('.m-mark')].map(m=>{const b=m.getBoundingClientRect();return {t:m.dataset.target,on:b.left>=fr.left-1&&b.right<=fr.right+1&&b.top>=fr.top-1&&b.bottom<=fr.bottom+1&&b.width>4&&b.height>4};});
    return {avif:img.src.startsWith('data:image/avif'),loaded:img.complete&&img.naturalWidth>0,marks,panel:p.dataset.target};});
   if(r.none){ok(r.panel==='',`${n}: a sub-item with a target has no band`);return;}
   ok(r.avif&&r.loaded,`${n}: band not a loaded AVIF`);
   ok(r.marks.length===1&&r.marks[0].on,`${n}: one spotlight ${JSON.stringify(r.marks)}`);
   ok(r.marks[0].t===r.panel,`${n}: lights ${r.marks[0].t}, panel ${r.panel}`);
  };
  const cells=async n=>{
   const bad=await page.evaluate(()=>[...document.querySelectorAll('.il-cmp td')].map(td=>[td.dataset.on,td.textContent.trim()]).filter(([o,t])=>!(o==='yes'&&t==='Kyllä'||o==='no'&&t==='Ei'||o==='part'&&t==='Vain sovelluskansio')));
   ok(bad.length===0,`${n}: cells other than Kyllä/Ei ${JSON.stringify(bad.slice(0,3))}`);
  };
  const part=()=>page.getByTestId('m-panel').getAttribute('data-part');
  const open=async d=>{
   await page.locator('.proto-picker-item').nth(d).click();
   await tid('m-dialog').waitFor();
  };
  const fill=async(sel,v)=>{await page.getByTestId(sel).fill(v);};
  const fieldText=sel=>page.getByTestId(sel).locator('xpath=ancestor::*[contains(@class,"ah-field")][1]').textContent();

  /* ---------- 1 Sovellus kerrallaan ---------- */
  await open(0);
  ok(await page.getByTestId('il-rail').count()===1,'d1: the four applications in view');
  ok(await tid('il-rail-full').getAttribute('aria-current')==='step','d1: Täysi under way');
  await fits('d1 start');await band('d1 start');
  await capture(0,'alku');
  let presses=0;
  while(await page.getByTestId('m-save').count()===0){
   await tid('m-next').click();presses++;
   const at=await part();await band(`d1 ${at}`);await fits(`d1 ${at}`);
   if(at==='permissions.0.perms'){
    ok(await page.locator('.m-perm').count()===9,'d1: Täysi has 9 permissions');
    if(width===1440&&theme==='light')await capture(0,'oikeudet');
   }
   ok(presses<40,'d1: the walk ends');
  }
  ok(presses===16,`d1: ${presses} presses to the first save`);
  ok(await tid('m-save').textContent()==='Tallenna ja jatka: Ei lähetystä'||mobile,'d1: the save names the next application');
  await tid('m-save').click();
  ok((await part())==='consent.0.client','d1: an empty save opens the client id');
  await page.getByTestId('r-fill').click();
  await tid('m-next').click();
  await tid('m-save').click();
  ok(await tid('il-rail-full').getAttribute('data-done')!==null,'d1: Täysi ticked');
  ok(await tid('il-rail-nosend').getAttribute('aria-current')==='step','d1: second application under way');
  ok((await part())==='register.1.new','d1: the second application starts at New registration');
  await fits('d1 app 2');
  await capture(0,'sovellus2');
  for(let i=0;i<16;i++)await tid('m-next').click();
  ok((await part())==='consent.1.tenant','d1: the second application ends at the tenant');
  ok(await page.getByTestId('m-tenant-known').count()===1&&await page.getByTestId('m-field-tenant').count()===0,'d1: the tenant is not asked again');
  ok(await page.locator('.m-perm').count()===0,'d1: no permissions on the tenant');
  // Leave half way: the first application's credentials stay saved.
  await tid('il-close').click();
  await page.getByTestId('m-dialog').waitFor({state:'detached'});
  ok(await tid('row-microsoft').getAttribute('data-state')==='partial','d1: partial after one application');
  ok(await page.getByTestId('compare-microsoft').count()===1,'d1: the table stays open while levels are missing');
  ok(await tid('col-state-full').textContent()==='Tarjolla'&&await tid('col-state-nosend').textContent()!=='Tarjolla','d1: column states');
  ok((await tid('start-microsoft').textContent()).startsWith('Jatka'),'d1: continue');
  await cells('d1 partial');
  await capture(0,'kesken');
  // Before setup: reset and close.
  await page.getByTestId('r-reset').click();
  await tid('m-dialog').waitFor();
  await page.getByRole('button',{name:'Peruuta'}).click();
  await page.getByTestId('m-dialog').waitFor({state:'detached'});
  ok(await tid('row-microsoft').getAttribute('data-state')==='before','before: state');
  ok(await page.getByTestId('compare-microsoft').count()===1,'before: the table is open under the row');
  ok(await page.getByTestId('open-microsoft').count()===0,'before: nothing to open');
  ok(await page.getByTestId('compare-google').count()===0&&await page.getByTestId('compare-dropbox').count()===0,'before: the other providers are closed');
  ok((await tid('start-microsoft').textContent())==='Luo sovellukset…','before: one start for all four');
  await cells('before');
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'before: no sideways overflow');
  await capture(0,'ennen');
  // After setup.
  await page.getByTestId('r-done').click();
  ok(await tid('row-microsoft').getAttribute('data-state')==='set','after: state');
  ok(await page.getByTestId('compare-microsoft').count()===0,'after: the table is closed');
  await capture(0,'asetettu');
  await tid('open-microsoft').click();
  ok(await page.getByTestId('compare-microsoft').count()===1,'after: Mitä tasot sallivat opens it');
  ok(await tid('col-state-read').textContent()==='Tarjolla','after: every level offered');
  await tid('open-dropbox').click();
  await cells('after');
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'after: no sideways overflow');
  await page.getByTestId('compare-microsoft').scrollIntoViewIfNeeded();
  await page.evaluate(()=>scrollTo(0,0));
  await capture(0,'asetettu-auki');

  /* ---------- 2 Vaihe kerrallaan ---------- */
  await open(1);
  await page.getByTestId('r-reset').click();
  await tid('m-dialog').waitFor();
  ok(await page.getByTestId('m-names').count()===1,'d2: the four names in view');
  await fits('d2 start');await band('d2 start');
  await capture(1,'alku');
  presses=0;const seen=new Set();
  while(await page.getByTestId('m-save').count()===0){
   await tid('m-next').click();presses++;
   const at=await part();seen.add(at);await band(`d2 ${at}`);await fits(`d2 ${at}`);
   if(at==='permissions.1.perms'&&width===1440&&theme==='light')await capture(1,'oikeudet');
   if(at==='public.2.find')await capture(1,'julkinen3');
   ok(presses<120,'d2: the walk ends');
  }
  for(const k of [0,1,2,3])ok(seen.has(`register.${k}.register`)&&seen.has(`public.${k}.settings`)&&seen.has(`permissions.${k}.grant`),`d2: application ${k} in every step`);
  ok([...seen].indexOf('public.0.find')>[...seen].indexOf('register.3.done'),'d2: all four registered before the public client');
  ok(presses===69,`d2: ${presses} presses to the save`);
  ok((await part())==='ids.-1.tenant','d2: the save is on the tenant');
  await tid('m-back').click();
  await capture(1,'tunnukset');
  await tid('m-next').click();
  await tid('m-save').click();
  ok((await part())==='ids.-1.clients','d2: an empty save opens the client ids');
  ok(await page.locator('[data-testid^="m-field-client-"]').count()===4,'d2: four client ids at once');
  for(const k of [0,1,2,3])await fill(`m-field-client-${k}`,k===2?SAMPLE[1]:SAMPLE[k]);
  await tid('m-next').click();
  await fill('m-field-tenant',TENANT);
  await tid('m-save').click();
  ok((await part())==='ids.-1.clients','d2: an id pasted twice is refused');
  ok((await fieldText('m-field-client-2')).includes('Sama tunnus'),'d2: says which');
  await fill('m-field-client-2',SAMPLE[2]);
  await page.getByTestId('m-next').click();
  await tid('m-save').click();
  await page.getByTestId('m-dialog').waitFor({state:'detached'});
  ok(await tid('row-microsoft').getAttribute('data-state')==='set','d2: set');
  ok(await page.getByTestId('compare-microsoft').count()===0,'d2: the table closes after setup');

  /* ---------- 3 Yksi komento ---------- */
  await open(2);
  await page.getByTestId('r-reset').click();
  await tid('m-dialog').waitFor();
  ok(await page.getByTestId('il-four').count()===1,'d3: the four applications named');
  await fits('d3 start');
  await capture(2,'alku');
  await tid('m-next').click();
  ok((await tid('il-script').textContent()).split('\nmake ').length===5,'d3: one command makes four');
  await page.getByTestId('il-script').locator('xpath=..').getByTestId('m-copy').click();
  ok((await page.evaluate(()=>window.__copied.at(-1))).includes('az ad app create'),'d3: the copy is the command');
  await fits('d3 command');
  await capture(2,'komento');
  await tid('m-next').click();
  await band('d3 paste');await fits('d3 paste');
  await tid('m-save').click();
  ok((await fieldText('il-paste')).includes('open-habitat'),'d3: an empty paste is refused');
  await fill('il-paste',`open-habitat tenant=${TENANT} full=${SAMPLE[0]} nosend=${SAMPLE[1]}`);
  await tid('m-save').click();
  ok((await fieldText('il-paste')).includes('Rivistä puuttuu'),'d3: a partial line is refused');
  ok(await page.locator('.il-parsed li:not([data-ok])').count()===2,'d3: the missing two marked');
  await page.getByTestId('r-fill').click();
  await page.waitForTimeout(50);
  await fill('il-paste',`open-habitat tenant=${TENANT} ${['full','nosend','drafts','read'].map((l,k)=>`${l}=${SAMPLE[k]}`).join(' ')}`);
  ok(await page.locator('.il-parsed li[data-ok]').count()===5,'d3: five values read');
  await fits('d3 parsed');
  await capture(2,'tulos');
  await tid('m-save').click();
  await page.getByTestId('m-dialog').waitFor({state:'detached'});
  ok(await tid('row-microsoft').getAttribute('data-state')==='set','d3: set');
  await page.getByTestId('r-reset').click();
  await tid('m-dialog').waitFor();
  await tid('il-manual').click();
  ok(await page.getByTestId('il-rail').count()===1&&(await part())==='register.0.new','d3: Tee käsin opens the walk');

  // Back to the first riff, as a reviewer opening the page would find it.
  await page.locator('.proto-picker-item').nth(0).click();
  await page.close();
 }
}finally{await browser.close();}
ok(errors.length===0,`console: ${errors.join(' | ')}`);
console.log(`ok: ${checks} checkpoints`);
