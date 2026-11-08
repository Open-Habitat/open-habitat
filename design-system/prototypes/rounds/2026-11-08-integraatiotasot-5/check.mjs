// node check.mjs <levels.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test.
//
// First the crops this round imports from proto-m365-setup-flow round 3,
// as in round 4: listed with the same sha256 in crops.json, AVIF only, no
// original screenshot's size, every mask flat. No image lives in this round,
// and nothing in it names Cloud Shell.
//
// Then every riff at 1440x900 and 390x844, light and dark, at device scale
// factor 2, starting from the synthetic host's state: Täysi saved by an
// administrator on 7.11., Vain luku written by root, the two others missing.
// The start page must show the comparison table (Tilalista behind Mitä tasot
// sallivat), mark exactly the saved levels as set and say how the host knows
// (client id, who, when, section), and offer only the missing ones. Rastit
// taulukossa starts both ticked ones; Taulukko valitsimena starts one level
// from its column (a cell click works too) and comes back to the table after
// the save; Tilalista starts one row's level or all missing. The walk holds
// only the chosen applications, names the skipped ones, takes 16 presses per
// application by the footer button alone, never asks the tenant (it is in the
// saved sections), refuses an empty save and an id that is another level's,
// and ends back on the start page with the level set. Back from the first
// sub-item is back to the start. With no credentials at all the tenant is
// asked in the first application. At every walk sub-item the band has one
// spotlight on the sub-item's own target and the dialog fits the viewport;
// the start page keeps its footer in view. Every cell says Kyllä or Ei.
// Nothing overflows sideways, the console stays clean.
// Screenshots: r5-d<riff>-<view>-<width>-<theme>.png.
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
const round='2026-11-08-integraatiotasot-5';
const [input,out]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <levels.html> <evidence-dir>');process.exit(2);}
mkdirSync(out,{recursive:true});
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};

/* ---------- the committed crops (round 3's) ---------- */
ok(!readdirSync(here).some(f=>/\.(png|avif|jpe?g|webp)$/i.test(f)),'no image files in this round');
ok(!/az ad |az rest|shell\.azure|Avaa Cloud Shell/i.test(readFileSync(join(here,'round.tsx'),'utf8').replace(/^\s*\/\/.*$/gm,'')),'no Cloud Shell route in the round');
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
  const capture=async (d,view)=>{await page.waitForTimeout(220);await page.screenshot({path:`${out}/r5-d${d+1}-${view}-${tag}.png`});};
  const side=async n=>ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${n}: sideways overflow`);
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
  const pageOf=()=>page.getByTestId('m-dialog').getAttribute('data-page');
  const open=async d=>{await page.locator('.proto-picker-item').nth(d).click();await tid('m-dialog').waitFor();};
  const fieldText=sel=>page.getByTestId(sel).locator('xpath=ancestor::*[contains(@class,"ah-field")][1]').textContent();
  // The start page: the table (or the list), the set levels and how they are known.
  const startPage=async(d,{table=true,set=['full','read']}={})=>{
   const n=`d${d+1} start`;
   ok(await pageOf()==='start',`${n}: the dialog opens on the start page`);
   ok(await page.getByTestId('cmp-microsoft').count()===(table?1:0),`${n}: table ${table?'shown':'behind the disclosure'}`);
   ok((await tid('il-how').textContent()).includes('tallennettu palvelimelle'),`${n}: says how a set level is known`);
   const prov=await page.getByTestId('il-prov').evaluateAll(es=>es.map(e=>[e.dataset.section,e.textContent]));
   ok(prov.length===set.length,`${n}: ${prov.length} provenance lines for ${set.length} set levels`);
   if(set.includes('full'))ok(prov.some(([s,t])=>s==='microsoft'&&t.includes('4f2c9a1e-…')&&t.includes('@kaisa-admin')),`${n}: Täysi's client id and who saved it`);
   if(set.includes('read'))ok(prov.some(([s,t])=>s==='microsoft_read'&&t.includes('asetettu palvelimella')),`${n}: Vain luku set by root`);
   for(const id of ['full','nosend','drafts','read'])ok(await page.getByTestId(`pick-${id}`).count()===(set.includes(id)?0:1),`${n}: ${id} ${set.includes(id)?'is not offered':'is offered'}`);
   if(table){
    ok(await page.getByTestId('il-colset').count()===set.length,`${n}: the set columns say Asetettu`);
    await cells(n);
   }
   const r=await page.evaluate(()=>{const f=document.querySelector('.m-dialog .si-foot').getBoundingClientRect();return {bottom:f.bottom,vh:innerHeight};});
   ok(r.bottom<=r.vh-56+1,`${n}: the footer is in view (${r.bottom}/${r.vh})`);
   await side(n);
  };
  // One application to its save, by the footer button alone.
  const walkApp=async(d,k,shots={})=>{
   let presses=0,missing=0;
   while(await page.getByTestId('m-save').count()===0){
    await tid('m-next').click();presses++;
    const at=await part();await band(`d${d+1} ${at}`);await fits(`d${d+1} ${at}`);
    ok(at.split('.')[1]===String(k),`d${d+1}: ${at} belongs to application ${k}`);
    missing+=await page.getByTestId('il-nocap').count();
    if(shots[at])await capture(d,shots[at]);
    ok(presses<40,`d${d+1}: the walk ends`);
   }
   ok(presses===16,`d${d+1}: ${presses} presses to application ${k}'s save`);
   ok(missing>=2,`d${d+1}: uncaptured screens named (${missing})`);
  };
  const tenantKnown=async n=>ok(await page.getByTestId('m-tenant-known').count()===1&&await page.getByTestId('m-field-tenant').count()===0&&(await tid('m-tenant-known').textContent()).includes('9a8b7c6d'),`${n}: the tenant comes from the saved sections`);
  const walkStart=async(d,order,skipped)=>{
   const n=`d${d+1} walk`;
   ok(await pageOf()==='walk',`${n}: started`);
   ok(await page.getByTestId('il-rail').locator('li').count()===order.length,`${n}: the rail holds the chosen ${order.length}`);
   for(const id of order)ok(await page.getByTestId(`il-rail-${id}`).count()===1,`${n}: ${id} in the rail`);
   if(skipped)ok((await tid('il-skipped').getAttribute('aria-label')).includes(skipped),`${n}: says ${skipped} is skipped`);
   ok((await part())===`register.${['full','nosend','drafts','read'].indexOf(order[0])}.new`,`${n}: begins at New registration`);
   ok(await page.getByTestId('m-console-link').count()===1,`${n}: the first application of the walk links App registrations`);
   await fits(n);await band(n);
  };
  // Save application k: an empty save opens the client id, another level's id is refused.
  const saveApp=async(d,k)=>{
   const n=`d${d+1} save ${k}`;
   await tid('m-save').click();
   ok((await part())===`consent.${k}.client`,`${n}: an empty save opens the client id`);
   await page.getByTestId(`m-field-client-${k}`).fill(SAMPLE[0]);
   await tid('m-next').click();
   await tenantKnown(n);
   await tid('m-save').click();
   ok((await part())===`consent.${k}.client`&&(await fieldText(`m-field-client-${k}`)).includes('Sama tunnus'),`${n}: Täysi's id is refused`);
   await page.getByTestId(`m-field-client-${k}`).fill(SAMPLE[k]);
   await tid('m-next').click();
   await tid('m-save').click();
  };

  /* ---------- 1 Rastit taulukossa ---------- */
  await open(0);
  await startPage(0);
  for(const id of ['nosend','drafts'])ok(await page.getByTestId(`pick-${id}`).getAttribute('data-selected')!==null,`d1: ${id} ticked at first`);
  ok((await tid('il-begin').textContent())==='Aloita: 2 tasoa','d1: begin both');
  await capture(0,'alku');
  // Untick both: nothing to begin; tick one back.
  await page.getByTestId('pick-nosend').click();await page.getByTestId('pick-drafts').click();
  ok(await tid('il-begin').isDisabled(),'d1: nothing ticked, nothing to begin');
  await page.getByTestId('pick-nosend').click();await page.getByTestId('pick-drafts').click();
  await tid('il-begin').click();
  await walkStart(0,['nosend','drafts'],'Täysi, Vain luku');
  await capture(0,'kavely');
  await tid('m-back').click();
  ok(await pageOf()==='start','d1: back from the first sub-item is the start page');
  await tid('il-begin').click();
  await walkApp(0,1,mobile||theme==='dark'?{}:{'consent.1.tenant':'tenantti'});
  ok(await tid('m-save').textContent()==='Tallenna ja jatka: Luonnokset'||mobile,'d1: the save names the next chosen level');
  await saveApp(0,1);
  ok((await part())==='register.2.new','d1: on to Luonnokset');
  ok(await tid('il-rail-nosend').getAttribute('data-done')!==null,'d1: Ei lähetystä ticked');
  await capture(0,'sovellus2');
  await walkApp(0,2);
  ok(await tid('m-save').textContent()==='Tallenna','d1: the last chosen saves');
  await saveApp(0,2);
  ok(await pageOf()==='start','d1: the walk ends on the start page');
  ok((await tid('il-just').textContent()).includes('Ei lähetystä, Luonnokset'),'d1: says what was saved');
  await startPage(0,{set:['full','nosend','drafts','read']});
  ok(await page.getByTestId('il-begin').count()===0&&await page.getByTestId('il-finish').count()===1,'d1: nothing left, Valmis');
  await capture(0,'valmis');
  await tid('il-finish').click();
  await page.getByTestId('m-dialog').waitFor({state:'detached'});
  ok(await tid('row-microsoft').getAttribute('data-state')==='set','d1: the page has all four');
  // No credentials at all: the tenant is asked in the first application.
  await page.getByTestId('r-none').click();
  await tid('m-dialog').waitFor();
  await startPage(0,{set:[]});
  ok((await tid('il-begin').textContent())==='Aloita: 4 tasoa','d1: all four ticked when none is set');
  await capture(0,'ei-tunnuksia');
  await tid('il-begin').click();
  await walkStart(0,['full','nosend','drafts','read']);
  ok(await page.getByTestId('il-skipped').count()===0,'d1: nothing skipped');
  for(let i=0;i<16;i++)await tid('m-next').click();
  ok(await page.getByTestId('m-field-tenant').count()===1,'d1: the tenant is asked when no level has it');
  await tid('il-close').click();
  await page.getByTestId('m-dialog').waitFor({state:'detached'});

  /* ---------- 2 Taulukko valitsimena ---------- */
  await open(1);
  await page.getByTestId('r-reset').click();
  await tid('m-dialog').waitFor();
  await startPage(1);
  ok(await page.getByTestId('il-begin').count()===0,'d2: no begin button, the columns are the choice');
  ok(await page.locator('th[data-pick]').count()===2,'d2: two pickable columns');
  if(!mobile){
   await page.locator('td[data-pick]').first().hover();
   ok(await page.locator('td[data-hot]').count()>5,'d2: hovering lights the whole column');
  }
  await capture(1,'alku');
  // A cell of Luonnokset's column starts Luonnokset.
  await page.locator('[data-testid="cmp-microsoft"] tbody tr').nth(1).locator('td').nth(2).click();
  await walkStart(1,['drafts'],'Täysi');
  await capture(1,'kavely');
  await walkApp(1,2);
  await saveApp(1,2);
  ok(await pageOf()==='start','d2: back to the table after the save');
  ok((await tid('il-just').textContent()).includes('Luonnokset'),'d2: says what was saved');
  await startPage(1,{set:['full','drafts','read']});
  await capture(1,'takaisin');
  await page.getByTestId('pick-nosend').click();
  await walkStart(1,['nosend']);
  await tid('il-close').click();
  await page.getByTestId('m-dialog').waitFor({state:'detached'});
  ok(await tid('row-microsoft').getAttribute('data-state')==='partial','d2: 3/4 on the page');

  /* ---------- 3 Tilalista ---------- */
  await open(2);
  await page.getByTestId('r-reset').click();
  await tid('m-dialog').waitFor();
  await startPage(2,{table:false});
  ok(await page.getByTestId('il-levels').locator('li').count()===4,'d3: four rows');
  ok(await page.locator('[data-testid^="il-level-"][data-set]').count()===2,'d3: two rows set');
  ok((await tid('il-begin').textContent())==='Aseta puuttuvat (2)','d3: set the missing two');
  await fits('d3 start');
  await capture(2,'alku');
  await tid('il-open-table').click();
  ok(await page.getByTestId('cmp-microsoft').count()===1,'d3: Mitä tasot sallivat opens the table');
  await cells('d3 table');await side('d3 table');
  await capture(2,'taulukko');
  await tid('il-open-table').click();
  await page.getByTestId('pick-nosend').click();
  await walkStart(2,['nosend'],'Täysi');
  await capture(2,'kavely');
  await walkApp(2,1);
  await saveApp(2,1);
  ok(await pageOf()==='start','d3: back to the list');
  ok(await page.locator('[data-testid^="il-level-"][data-set]').count()===3,'d3: three rows set');
  ok((await tid('il-begin').textContent())==='Aseta puuttuva','d3: one missing');
  await capture(2,'takaisin');
  await tid('il-begin').click();
  await walkStart(2,['drafts']);
  await tid('il-close').click();
  await page.getByTestId('m-dialog').waitFor({state:'detached'});

  // The page itself: the table opens from Mitä tasot sallivat.
  await page.getByTestId('r-done').click();
  ok(await tid('row-microsoft').getAttribute('data-state')==='set','page: all set');
  ok(await page.getByTestId('compare-microsoft').count()===0,'page: the table is closed');
  await tid('open-microsoft').click();
  ok(await page.getByTestId('compare-microsoft').count()===1,'page: Mitä tasot sallivat opens it');
  await cells('page');await side('page');
  if(!mobile&&theme==='light')await capture(2,'sivu');

  // Back to the first riff, as a reviewer opening the page would find it.
  await page.locator('.proto-picker-item').nth(0).click();
  await page.close();
 }
}finally{await browser.close();}
ok(errors.length===0,`console: ${errors.join(' | ')}`);
console.log(`ok: ${checks} checkpoints`);
