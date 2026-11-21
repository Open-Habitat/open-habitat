// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// First the round directory itself: no audio, image or HTML file and nothing
// over 100 KB. Then the three emblem directions in every situation at 1440
// and 390 px in Päivä, Yö and Korkea kontrasti: no document overflow, the
// direction's line marked, production's Settings with Sounds current, ten
// tiles with Kalimba chosen, every tile's length matching the Lyhyet/Pitkät
// setting, the notes each situation shows, three workspace rows. At 1440 in
// each theme the ten emblems of each direction are rasterised and compared
// pairwise: no two may be the same picture. Then at 1440 Päivä each
// direction's flow: a press plays the short render of exactly the recipe's
// length and spreads one ripple per strike; Pitkät plays the long render
// (Kuplat's long recipe has more strikes than its short one, and the ripples
// follow); arrows move the choice and focus; "agent finished" follows the
// rules (conversation in view, workspace sound, mute, night, off); a
// workspace's sound is chosen from the ten and its row's emblem follows.
// Reduced motion, English, one phone flow, and a clean console.
// Screenshots at device scale 2: v<n>-<direction>-<situation>-<width>-<theme>.png.
import {createRequire} from 'node:module';
import {dirname,resolve,join,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync,readdirSync,statSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
import {SOUNDS} from '../2026-11-21-attention-sounds-4/synth.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-21-attention-sound-icons';
const [input,out,flag]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <out-dir> [--quick]');process.exit(2);}
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};

// The round directory holds sources only.
for(const f of readdirSync(here)){
 ok(!['.wav','.mp3','.ogg','.opus','.png','.jpg','.jpeg','.avif','.webp','.html'].includes(extname(f).toLowerCase()),`round directory holds ${f}`);
 ok(statSync(join(here,f)).size<100*1024,`${f} is over 100 KB`);
}
const IDS=['kalimba','marimba','vibrafoni','tunnus-puu','pisara','lasit','tuulikello','kuplat','kulho','jaapuikot'];
const recipe=Object.fromEntries(SOUNDS.filter(s=>IDS.includes(s.id)).map(s=>[s.id,s.variants]));
eq(Object.keys(recipe).length,10,'round 5 has the ten sounds');

const browser=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required'],...(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{})});
const html=readFileSync(input,'utf8');
const names=['esine','vareily','kuvio'];
const dirs=['object','ripple','pattern'];
const scenarios=['oletus','pitkat','yo','pois','mykistetty'];

async function open(width,theme,{reduced=false}={}){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:900},deviceScaleFactor:2,reducedMotion:reduced?'reduce':'no-preference',hasTouch:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 await ready(page);
 return page;
}
const settle=(page,ms=200)=>page.waitForTimeout(ms);
const tid=(page,id)=>page.getByTestId(id);
const ready=async page=>{await page.locator('.rq-section [data-testid^="direction-"]').waitFor();await settle(page);};
const pick=async(page,d)=>{await page.locator('.proto-picker-item').nth(d).click();await page.locator(`.rq-review[data-direction="${d}"]`).waitFor({state:'attached'});await ready(page);};
const sel=async(page,id,v)=>{await page.locator(`#${id}`).selectOption(v);await ready(page);};
const shot=(page,d,c,tag,full=false)=>page.screenshot({path:`${out}/v${d+1}-${names[d]}-${c}-${tag}.png`,fullPage:full});
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const plays=page=>page.evaluate(()=>window.__rqPlays.length);
const lastPlay=page=>page.evaluate(()=>window.__rqPlays.at(-1));
const lastSim=page=>page.evaluate(()=>window.__rqSim.at(-1));
const shown=async(page,id)=>(await tid(page,id).count())>0&&await tid(page,id).first().isVisible();
const menuPick=async(page,id,label)=>{await tid(page,id).click();await page.getByRole('menuitemradio',{name:label}).or(page.getByRole('menuitem',{name:label})).first().click();await settle(page);};
const secsText=(s,lang='fi')=>lang==='fi'?`${s.toFixed(1).replace('.',',')} s`:`${s.toFixed(1)} s`;
/** Rasterises every tile's emblem with its computed styles; returns the smallest pairwise difference. */
const distinct=(page,only=null)=>page.evaluate(async only=>{
 const svgs=[...document.querySelectorAll('.rq-tile .rq-emblem')];
 const props=['fill','stroke','stroke-width','opacity','stroke-dasharray','stroke-linecap','stroke-linejoin','display'];
 const raster=async svg=>{
  const clone=svg.cloneNode(true);
  const src=[svg,...svg.querySelectorAll('*')],dst=[clone,...clone.querySelectorAll('*')];
  src.forEach((el,i)=>{const cs=getComputedStyle(el);dst[i].setAttribute('style',props.map(p=>`${p}:${cs.getPropertyValue(p)}`).join(';'));});
  // The chosen tile is drawn stronger; compare the pictures, not the selection.
  dst.forEach(el=>{if(el.style)el.style.opacity='1';});
  // `only`: keep just that part (A's pictogram), to compare what tells the sounds apart.
  if(only)clone.querySelectorAll('.rq-e-still > *').forEach(el=>{if(!el.matches(only))el.style.display='none';});
  clone.setAttribute('width','96');clone.setAttribute('height','96');clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
  const img=new Image();img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(clone));
  await img.decode();
  const c=document.createElement('canvas');c.width=c.height=96;const g=c.getContext('2d');g.drawImage(img,0,0);
  return g.getImageData(0,0,96,96).data.filter((_,i)=>i%4===3);
 };
 const rs=await Promise.all(svgs.map(raster));
 let min=Infinity,pair='';
 for(let i=0;i<rs.length;i++)for(let j=i+1;j<rs.length;j++){
  let d=0,ink=0;for(let k=0;k<rs[i].length;k++){d+=Math.abs(rs[i][k]-rs[j][k]);ink+=Math.max(rs[i][k],rs[j][k]);}
  const r=d/ink;if(r<min){min=r;pair=`${svgs[i].dataset.emblem} ~ ${svgs[j].dataset.emblem}`;}
 }
 return {n:rs.length,min,pair,keys:new Set(svgs.map(s=>s.dataset.emblem)).size};
},only);

try{
for(const width of quick?[1440]:[1440,390])for(const theme of quick?['light']:['light','dark','contrast']){
 const tag=`${width}-${theme}`;
 const page=await open(width,theme);
 await checkPicker(page,round);
 eq(await tid(page,'recommendation').count(),1,'the recommendation is on the page');
 for(let d=0;d<3;d++){
  await pick(page,d);
  if(width===1440){
   const r=await distinct(page);
   eq(r.n,10,`${names[d]} ${tag}: ten emblems`);eq(r.keys,10,`${names[d]} ${tag}: ten emblem ids`);
   // Share of differing ink between the two most alike emblems: same pictures give 0.
   // A shares its rings by design, so its pictograms are also compared on their own.
   ok(r.min>0.2,`${names[d]} ${tag}: emblems too alike (${r.pair}: ${r.min.toFixed(3)})`);
   if(theme==='light')console.log(`${names[d]}: most alike ${r.pair} ${r.min.toFixed(3)}`);
   if(d===0){const g=await distinct(page,'.rq-e-glyph');ok(g.min>0.4,`${tag}: pictograms too alike (${g.pair}: ${g.min.toFixed(3)})`);if(theme==='light')console.log(`esine pictograms: most alike ${g.pair} ${g.min.toFixed(3)}`);}
  }
  for(const s of scenarios){
   await sel(page,'scenario',s);
   const at=`${names[d]} ${s} ${tag}`;
   ok(await fits(page),`${at}: document overflow`);
   eq(await page.locator('.rq-lines li[aria-current]').count(),1,`${at}: its line is marked`);
   eq(await tid(page,`direction-${dirs[d]}`).count(),1,`${at}: the direction's body`);
   eq((await tid(page,'settings-section-aanet').innerText()).trim(),'Äänet',`${at}: production's h2`);
   if(width===1440)eq(await tid(page,'settings-aanet').getAttribute('aria-current'),'page',`${at}: Sounds is the current section`);
   eq(await page.locator('.rq-tile').count(),10,`${at}: ten tiles`);
   eq(await page.locator(`.rq-tile .rq-emblem-${dirs[d]}`).count(),10,`${at}: ten emblems of the direction`);
   eq(await tid(page,'pick-kalimba').getAttribute('aria-checked'),'true',`${at}: Kalimba is the default`);
   eq(await page.locator('.rq-tile[tabindex="0"]').count(),1,`${at}: one tile in the tab order`);
   const len=s==='pitkat'?'long':'short';
   eq(await tid(page,'sound-length').getByTestId(`segment-${len}`).getAttribute('aria-pressed'),'true',`${at}: length setting`);
   for(const id of ['kalimba','kulho'])eq((await tid(page,`secs-${id}`).innerText()).trim(),secsText(recipe[id][len].dur),`${at}: ${id} shows its ${len} length`);
   eq(await page.locator('.rq-repo').count(),3,`${at}: three workspace rows`);
   eq(await page.locator(`.rq-repo .rq-emblem-${dirs[d]}`).count(),3,`${at}: workspace emblems`);
   eq(await tid(page,'repo-kotisivu').locator('svg[data-emblem]').getAttribute('data-emblem'),`${dirs[d]}-pisara`,`${at}: kotisivu has Pisara`);
   eq(await shown(page,'note-night'),s==='yo',`${at}: night note`);
   eq(await shown(page,'night-now'),s!=='pois',`${at}: night status line`);
   eq(await shown(page,'note-off'),s==='pois',`${at}: off note`);
   eq(await shown(page,'note-muted'),s==='mykistetty',`${at}: muted note`);
   eq(await tid(page,'pick-pisara').isDisabled(),s==='pois',`${at}: tiles disabled only when off`);
   if(s==='mykistetty')ok(await tid(page,'device-volume').locator('input').isDisabled(),`${at}: volume disabled while muted`);
   await shot(page,d,s,tag);
  }
 }
 if(width===1440&&theme==='light')for(let d=0;d<3;d++){await pick(page,d);await sel(page,'scenario','oletus');await shot(page,d,'koko-sivu',tag,true);}
 await page.close();
}

// Flows at 1440 Päivä.
const page=await open(1440,'light');
const segment=async(id,v)=>{await tid(page,id).getByTestId(`segment-${v}`).click();await settle(page);};
for(const d of [0,1,2]){
 const at=names[d];
 await pick(page,d);await sel(page,'scenario','oletus');
 let n=await plays(page);
 await tid(page,'pick-marimba').click();await settle(page,150);
 eq(await tid(page,'pick-marimba').getAttribute('aria-checked'),'true',`${at}: Marimba chosen`);
 eq(await plays(page),n+1,`${at}: pressing plays`);
 let p=await lastPlay(page);
 eq(p.sound,'marimba',`${at}: it played Marimba`);eq(p.length,'short',`${at}: the short length`);
 eq(p.samples,Math.round(recipe.marimba.short.dur*48000),`${at}: the short render's samples`);
 ok(p.dur>=0.5&&p.dur<=0.8,`${at}: short within 0.5–0.8 s`);
 ok(await tid(page,'pick-marimba').getAttribute('data-playing')!==null,`${at}: the tile shows it plays`);
 eq(await page.locator('[data-testid="pick-marimba"] .rq-ripple').count(),recipe.marimba.short.voices.length,`${at}: one ripple per strike`);
 await shot(page,d,'soi',`1440-light`);
 await page.waitForTimeout(1300);
 eq(await tid(page,'pick-marimba').getAttribute('data-playing'),null,`${at}: playing ends`);
 // Long sounds: the setting plays the chosen sound long, and the tiles say so.
 n=await plays(page);
 await segment('sound-length','long');
 eq(await plays(page),n+1,`${at}: choosing the length plays`);
 p=await lastPlay(page);
 eq(p.length,'long',`${at}: the long length`);eq(p.samples,Math.round(recipe.marimba.long.dur*48000),`${at}: the long render's samples`);
 ok(p.dur>=1.2&&p.dur<=1.6,`${at}: long within 1.2–1.6 s`);
 eq((await tid(page,'secs-kulho').innerText()).trim(),secsText(recipe.kulho.long.dur),`${at}: tiles show long lengths`);
 await page.waitForTimeout(1900);
 await tid(page,'pick-kuplat').click();await settle(page,120);
 eq((await lastPlay(page)).length,'long',`${at}: Kuplat long`);
 eq(await page.locator('[data-testid="pick-kuplat"] .rq-ripple').count(),recipe.kuplat.long.voices.length,`${at}: long Kuplat's strikes spread`);
 await shot(page,d,'soi-pitka',`1440-light`);
 await page.waitForTimeout(1900);
 await segment('sound-length','short');await page.waitForTimeout(1000);
 await tid(page,'pick-kuplat').click();await settle(page,120);
 eq(await page.locator('[data-testid="pick-kuplat"] .rq-ripple').count(),recipe.kuplat.short.voices.length,`${at}: short Kuplat's strikes spread`);
 ok(recipe.kuplat.short.voices.length!==recipe.kuplat.long.voices.length,'Kuplat differs by length');
 await page.waitForTimeout(1000);
 // Keyboard: arrows move the choice and focus, and play.
 await tid(page,'pick-kuplat').focus();
 n=await plays(page);
 await page.keyboard.press('ArrowRight');await settle(page);
 eq(await tid(page,'pick-kulho').getAttribute('aria-checked'),'true',`${at}: ArrowRight chooses Kulho`);
 ok(await tid(page,'pick-kulho').evaluate(el=>el===document.activeElement&&el.matches(':focus-visible')),`${at}: focus follows, visibly`);
 eq(await plays(page),n+1,`${at}: the arrow plays`);
 await page.keyboard.press('Home');await settle(page);
 eq(await tid(page,'pick-kalimba').getAttribute('aria-checked'),'true',`${at}: Home chooses Kalimba`);
 await page.waitForTimeout(1000);
 // Agent finished: another conversation plays the default, kotisivu its own, the one in view is quiet.
 await tid(page,'sim-other').click();await settle(page);
 eq((await lastSim(page)).sound,'kalimba',`${at}: another conversation plays the chosen sound`);
 await tid(page,'sim-repo').click();await settle(page);
 eq((await lastSim(page)).sound,'pisara',`${at}: kotisivu plays its own sound`);
 eq(await tid(page,'repo-kotisivu').locator('svg[data-emblem]').getAttribute('data-active'),'true',`${at}: the workspace row's emblem plays`);
 await tid(page,'sim-in-view').click();await settle(page);
 eq((await lastSim(page)).played,false,`${at}: the conversation in view is quiet`);
 await segment('in-view','plays');
 await tid(page,'sim-in-view').click();await settle(page);
 eq((await lastSim(page)).played,true,`${at}: "play anyway" plays in view`);
 // A workspace sound chosen from the ten.
 n=await plays(page);
 await menuPick(page,'repo-sound-aurinkokello',/^Jääpuikot/);
 eq(await tid(page,'repo-sound-aurinkokello').getAttribute('data-value'),'jaapuikot',`${at}: aurinkokello gets Jääpuikot`);
 eq((await lastPlay(page)).sound,'jaapuikot',`${at}: choosing plays it`);
 eq(await tid(page,'repo-aurinkokello').locator('svg[data-emblem]').getAttribute('data-emblem'),`${dirs[d]}-jaapuikot`,`${at}: the row's emblem follows`);
 await tid(page,'repo-listen-muistiinpanot').click();await settle(page);
 eq((await lastPlay(page)).sound,'kalimba',`${at}: a default workspace plays the chosen sound`);
 await shot(page,d,'tyotilat','1440-light');
 // Volume, mute, night, off.
 await tid(page,'device-volume').locator('input').focus();
 await page.keyboard.press('ArrowLeft');await page.keyboard.press('ArrowLeft');
 await tid(page,'sound-test').click();
 eq((await lastPlay(page)).volume,50,`${at}: test plays at the device volume`);
 await segment('device-mute','muted');
 await tid(page,'sim-other').click();await settle(page);
 eq((await lastSim(page)).played,false,`${at}: muted device is quiet`);
 await segment('device-mute','plays');
 await sel(page,'scenario','yo');
 await tid(page,'sim-other').click();await settle(page);
 eq((await lastSim(page)).played,false,`${at}: quiet at night`);
 n=await plays(page);await tid(page,'sound-test').click();
 eq(await plays(page),n+1,`${at}: test plays at night`);
 await segment('night','off');
 await tid(page,'sim-other').click();await settle(page);
 eq((await lastSim(page)).played,true,`${at}: night quieting off plays`);
 await sel(page,'scenario','oletus');
 await segment('sound-on','off');
 ok(await tid(page,'pick-pisara').isDisabled(),`${at}: tiles locked when off`);
 ok(await tid(page,'sound-length').getByTestId('segment-long').isDisabled(),`${at}: length locked when off`);
 n=await plays(page);await tid(page,'sound-test').click();
 eq(await plays(page),n+1,`${at}: test plays when off`);
 await tid(page,'sim-other').click();await settle(page);
 eq((await lastSim(page)).played,false,`${at}: off is quiet`);
 await page.waitForTimeout(1000);
}
// English.
await sel(page,'language','en');
for(const d of [0,1,2]){
 await pick(page,d);await sel(page,'scenario','oletus');
 eq((await tid(page,'settings-section-aanet').innerText()).trim(),'Sounds',`${names[d]}: English h2`);
 ok((await tid(page,`direction-${dirs[d]}`).textContent()).includes('Quiet at night'),`${names[d]}: English body`);
 ok((await tid(page,'pick-pisara').getAttribute('aria-label')).startsWith('Drop.'),`${names[d]}: English tile name`);
 eq((await tid(page,'secs-kalimba').innerText()).trim(),secsText(recipe.kalimba.short.dur,'en'),`${names[d]}: English seconds`);
 await shot(page,d,'oletus-en','1440-light');
}
await page.close();
// Reduced motion: still emblems that say they play.
for(const [how,opts] of [['media',{reduced:true}],['review',{}]]){
 const r=await open(1440,'dark',opts);
 if(how==='review')await sel(r,'motion','reduced');
 for(const d of [0,1,2]){
  await pick(r,d);
  await tid(r,'pick-lasit').click();await settle(r,120);
  const at=`${names[d]} reduced (${how})`;
  ok((await tid(r,'pick-lasit').innerText()).includes('Soi'),`${at}: says it plays`);
  eq(await r.locator('[data-testid="pick-lasit"] .rq-ripple').count(),0,`${at}: no spreading rings`);
  if(how==='media')await shot(r,d,'soi-vahennetty','1440-dark');
  await r.waitForTimeout(1300);
 }
 await r.close();
}
// One flow at 390 px.
const phone=await open(390,'light');
for(const d of [0,1,2]){
 await pick(phone,d);
 await tid(phone,'pick-jaapuikot').scrollIntoViewIfNeeded();await tid(phone,'pick-jaapuikot').click();await settle(phone,150);
 eq(await tid(phone,'pick-jaapuikot').getAttribute('aria-checked'),'true',`phone ${names[d]}: Jääpuikot chosen`);
 await shot(phone,d,'soi','390-light');
 await tid(phone,'repo-kotisivu').scrollIntoViewIfNeeded();
 await shot(phone,d,'tyotilat','390-light');
 ok(await fits(phone),`phone ${names[d]}: fits`);
 await phone.waitForTimeout(900);
}
await phone.close();
}finally{await browser.close();}
assert.deepEqual(errors,[],`console: ${errors.join('\n')}`);
console.log(`${checks} checks, console clean`);
