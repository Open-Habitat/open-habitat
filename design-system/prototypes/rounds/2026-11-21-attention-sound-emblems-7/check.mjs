// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// First the round directory itself: no audio, image or HTML file and nothing
// over 100 KB. Then both views at 1440 and 390 px in Päivä, Yö and Korkea
// kontrasti. Vertailurivit: ten rows, each with its trio idea and four
// cells (current + three variants) showing the emblem at tile and
// workspace-row size, one recommendation and one choice per row, no
// overflow. At 1440 in each theme each row's four emblems are rasterised and
// compared pairwise (they must be different pictures), and all forty are
// compared with each other. Asetuksissa: production's Settings with the
// chosen variants in the tiles and workspace rows in every situation, the
// ten chosen emblems distinct. Then the flows at 1440 Päivä: pressing a
// variant plays exactly the short recipe and spreads one ripple per strike,
// Pitkät plays the long one, a chosen variant appears in the Settings tiles,
// "all current" and "all recommended", `?valinta=`, and round 6's Settings
// flow (keyboard, "agent finished" rules, workspace sounds, mute, night,
// off). Reduced motion, English, one phone flow, and a clean console.
// Screenshots at device scale 2: <view>-<situation>-<width>-<theme>.png.
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
const round='2026-11-21-attention-sound-emblems-7';
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
const names=['rivit','asetukset'];
// The recommended variant per sound, as `RECOMMENDED` in emblems.tsx says.
const REC={kalimba:2,marimba:1,vibrafoni:2,'tunnus-puu':1,pisara:0,lasit:1,tuulikello:0,kuplat:1,kulho:3,jaapuikot:2};
const scenarios=['oletus','pitkat','yo','pois','mykistetty'];

async function open(width,theme,{reduced=false,query=''}={}){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:900},deviceScaleFactor:2,reducedMotion:reduced?'reduce':'no-preference',hasTouch:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto('http://prototype.test/'+query);
 await page.locator('#theme').selectOption(theme);
 await ready(page);
 return page;
}
const settle=(page,ms=200)=>page.waitForTimeout(ms);
const tid=(page,id)=>page.getByTestId(id);
const ready=async page=>{await page.locator('[data-testid="rows-view"], .rq-section [data-testid="settings-view"]').first().waitFor();await settle(page);};
const pick=async(page,d)=>{await page.locator('.proto-picker-item').nth(d).click();await page.locator(`.rq-review[data-direction="${d}"]`).waitFor({state:'attached'});await ready(page);};
const sel=async(page,id,v)=>{await page.locator(`#${id}`).selectOption(v);await ready(page);};
const shot=(page,d,c,tag,full=false)=>page.screenshot({path:`${out}/${names[d]}-${c}-${tag}.png`,fullPage:full});
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const plays=page=>page.evaluate(()=>window.__rqPlays.length);
const lastPlay=page=>page.evaluate(()=>window.__rqPlays.at(-1));
const lastSim=page=>page.evaluate(()=>window.__rqSim.at(-1));
const shown=async(page,id)=>(await tid(page,id).count())>0&&await tid(page,id).first().isVisible();
const menuPick=async(page,id,label)=>{await tid(page,id).click();await page.getByRole('menuitemradio',{name:label}).or(page.getByRole('menuitem',{name:label})).first().click();await settle(page);};
const secsText=(s,lang='fi')=>lang==='fi'?`${s.toFixed(1).replace('.',',')} s`:`${s.toFixed(1)} s`;
/** Rasterises every tile's emblem with its computed styles; returns the smallest pairwise difference. */
const distinct=(page,scope='.rq-tile',only=null)=>page.evaluate(async ([scope,only])=>{
 const svgs=[...document.querySelectorAll(`${scope} .rq-emblem:not(.rq-emblem-small)`)];
 const props=['fill','stroke','stroke-width','opacity','stroke-dasharray','stroke-linecap','stroke-linejoin','display'];
 const raster=async svg=>{
  const clone=svg.cloneNode(true);
  const src=[svg,...svg.querySelectorAll('*')],dst=[clone,...clone.querySelectorAll('*')];
  src.forEach((el,i)=>{const cs=getComputedStyle(el);dst[i].setAttribute('style',props.map(p=>`${p}:${cs.getPropertyValue(p)}`).join(';'));});
  // The chosen tile is drawn stronger; compare the pictures, not the selection.
  dst.forEach(el=>{if(el.style)el.style.opacity='1';});
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
},[scope,only]);


const settingsChecks=async(page,at,picks,width)=>{
 eq(await tid(page,'settings-view').count(),1,`${at}: the Settings view`);
 eq((await tid(page,'settings-section-aanet').innerText()).trim(),'Äänet',`${at}: production's h2`);
 if(width===1440)eq(await tid(page,'settings-aanet').getAttribute('aria-current'),'page',`${at}: Sounds is the current section`);
 eq(await page.locator('.rq-tile').count(),10,`${at}: ten tiles`);
 for(const id of IDS)eq(await tid(page,`pick-${id}`).locator('svg[data-emblem]').getAttribute('data-emblem'),`${id}-${picks[id]}`,`${at}: ${id} tile shows variant ${picks[id]}`);
 eq(await tid(page,'pick-kalimba').getAttribute('aria-checked'),'true',`${at}: Kalimba is the default`);
 eq(await page.locator('.rq-tile[tabindex="0"]').count(),1,`${at}: one tile in the tab order`);
 eq(await page.locator('.rq-repo').count(),3,`${at}: three workspace rows`);
 eq(await tid(page,'repo-kotisivu').locator('svg[data-emblem]').getAttribute('data-emblem'),`pisara-${picks.pisara}`,`${at}: kotisivu has Pisara's chosen variant`);
 const small=await tid(page,'repo-kotisivu').locator('svg[data-emblem]').boundingBox();
 ok(Math.abs(small.width-32)<1,`${at}: the workspace emblem is 32 px (${small.width})`);
};
try{
for(const width of quick?[1440]:[1440,390])for(const theme of quick?['light']:['light','dark','contrast']){
 const tag=`${width}-${theme}`;
 const page=await open(width,theme);
 await checkPicker(page,round);
 eq(await tid(page,'recommendation').count(),1,'the recommendation is on the page');
 // Vertailurivit
 await pick(page,0);
 let at=`rivit ${tag}`;
 ok(await fits(page),`${at}: document overflow`);
 eq(await page.locator('.rq-lines li[aria-current]').count(),1,`${at}: its line is marked`);
 eq(await page.locator('.rq-srow').count(),10,`${at}: ten rows`);
 eq(await page.locator('.rq-cell').count(),40,`${at}: forty cells`);
 eq(await page.locator('.rq-cell .rq-emblem-small').count(),40,`${at}: forty row-size emblems`);
 eq(await page.locator('.rq-badge').count(),10,`${at}: one recommendation per row`);
 eq(await page.locator('.rq-cell[data-chosen]').count(),10,`${at}: one choice per row`);
 for(const id of IDS){
  ok((await tid(page,`trio-${id}`).innerText()).trim().length>10,`${at}: ${id} states its trio idea`);
  ok(await tid(page,`cell-${id}-${REC[id]}`).locator('.rq-badge').count()===1,`${at}: ${id} recommends ${REC[id]}`);
  ok(await tid(page,`use-${id}-${REC[id]}`).isChecked(),`${at}: ${id}'s recommendation is chosen to begin with`);
  for(let v=1;v<4;v++)ok((await tid(page,`cell-${id}-${v}`).locator('.rq-cell-idea').innerText()).trim().length>20,`${at}: ${id} ${v} says what it tries`);
 }
 const sm=await page.locator('.rq-cell .rq-emblem-small').first().boundingBox();
 ok(Math.abs(sm.width-32)<1,`${at}: row-size emblem is 32 px (${sm.width})`);
 if(width===1440){
  for(const id of IDS){
   const r=await distinct(page,`[data-testid="row-${id}"]`);
   eq(r.n,4,`${at}: ${id} has four emblems`);
   ok(r.min>0.25,`${at}: ${id} variants too alike (${r.pair}: ${r.min.toFixed(3)})`);
   if(theme==='light')console.log(`${id}: most alike ${r.pair} ${r.min.toFixed(3)}`);
  }
  const all=await distinct(page,'.rq-rows');
  eq(all.keys,40,`${at}: forty emblem ids`);
  ok(all.min>0.2,`${at}: two emblems too alike across sounds (${all.pair}: ${all.min.toFixed(3)})`);
  if(theme==='light')console.log(`all forty: most alike ${all.pair} ${all.min.toFixed(3)}`);
 }
 await shot(page,0,'alku',tag);
 await tid(page,'row-kulho').scrollIntoViewIfNeeded();await shot(page,0,'kulho',tag);
 // Asetuksissa
 await pick(page,1);
 if(width===1440){
  for(const [label,button] of [['suositukset',null],['nykyiset','picks-current']]){
   if(button){await pick(page,0);await tid(page,button).click();await pick(page,1);}
   const r=await distinct(page);
   eq(r.keys,10,`asetukset ${label} ${tag}: ten emblem ids`);
   ok(r.min>0.2,`asetukset ${label} ${tag}: emblems too alike (${r.pair}: ${r.min.toFixed(3)})`);
   if(theme==='light')console.log(`settings, ${label}: most alike ${r.pair} ${r.min.toFixed(3)}`);
  }
  await pick(page,0);await tid(page,'picks-recommended').click();await pick(page,1);
 }
 for(const s of scenarios){
  await sel(page,'scenario',s);
  at=`asetukset ${s} ${tag}`;
  ok(await fits(page),`${at}: document overflow`);
  await settingsChecks(page,at,REC,width);
  const len=s==='pitkat'?'long':'short';
  eq(await tid(page,'sound-length').getByTestId(`segment-${len}`).getAttribute('aria-pressed'),'true',`${at}: length setting`);
  for(const id of ['kalimba','kulho'])eq((await tid(page,`secs-${id}`).innerText()).trim(),secsText(recipe[id][len].dur),`${at}: ${id} shows its ${len} length`);
  eq(await shown(page,'note-night'),s==='yo',`${at}: night note`);
  eq(await shown(page,'night-now'),s!=='pois',`${at}: night status line`);
  eq(await shown(page,'note-off'),s==='pois',`${at}: off note`);
  eq(await shown(page,'note-muted'),s==='mykistetty',`${at}: muted note`);
  eq(await tid(page,'pick-pisara').isDisabled(),s==='pois',`${at}: tiles disabled only when off`);
  if(s==='mykistetty')ok(await tid(page,'device-volume').locator('input').isDisabled(),`${at}: volume disabled while muted`);
  if(s==='oletus'||!quick)await shot(page,1,s,tag);
 }
 if(width===1440&&theme==='light'){await sel(page,'scenario','oletus');await shot(page,1,'koko-sivu',tag,true);}
 await page.close();
}

// Flows at 1440 Päivä.
const page=await open(1440,'light');
const segment=async(id,v)=>{await tid(page,id).getByTestId(`segment-${v}`).click();await settle(page);};
// The rows: every variant plays its sound, at the chosen length.
await pick(page,0);
{
 let n=await plays(page);
 await tid(page,'play-kulho-3').click();await settle(page,150);
 eq(await plays(page),n+1,'rows: pressing a variant plays');
 let p=await lastPlay(page);
 eq(p.sound,'kulho','rows: it played Kulho');eq(p.length,'short','rows: Lyhyet is the default');
 eq(p.samples,Math.round(recipe.kulho.short.dur*48000),'rows: the short render');
 ok(await tid(page,'cell-kulho-3').getAttribute('data-playing')!==null,'rows: the cell shows it plays');
 eq(await page.locator('[data-testid="cell-kulho-3"] .rq-ripple').count(),recipe.kulho.short.voices.length,'rows: one ripple per strike');
 eq(await page.locator('[data-testid="cell-kulho-0"] .rq-ripple').count(),0,'rows: only the pressed cell ripples');
 await shot(page,0,'soi','1440-light');
 for(const id of IDS)for(let v=0;v<4;v++){
  await tid(page,`play-${id}-${v}`).click();await settle(page,60);
  eq(await page.locator(`[data-testid="cell-${id}-${v}"] .rq-ripple`).count(),recipe[id].short.voices.length,`rows: ${id} ${v} spreads its strikes`);
 }
 await page.waitForTimeout(1600);
 await tid(page,'rows-length').getByTestId('segment-long').click();await settle(page);
 await tid(page,'play-kuplat-2').click();await settle(page,120);
 p=await lastPlay(page);
 eq(p.length,'long','rows: Pitkät plays long');eq(p.samples,Math.round(recipe.kuplat.long.dur*48000),'rows: the long render');
 eq(await page.locator('[data-testid="cell-kuplat-2"] .rq-ripple').count(),recipe.kuplat.long.voices.length,'rows: long Kuplat\'s strikes');
 await page.waitForTimeout(1600);
 await tid(page,'rows-length').getByTestId('segment-short').click();await settle(page);
 // A chosen variant goes into the Settings tiles; the radio group is a native one.
 await tid(page,'use-kalimba-3').check();
 eq(await page.locator('[data-testid="row-kalimba"] .rq-cell[data-chosen]').getAttribute('data-testid'),'cell-kalimba-3','rows: Kalimba 3 chosen');
 await tid(page,'use-kalimba-3').focus();await page.keyboard.press('ArrowLeft');await settle(page);
 ok(await tid(page,'use-kalimba-2').isChecked(),'rows: arrows move the choice within the row');
 await tid(page,'use-kalimba-1').check();await tid(page,'use-kulho-2').check();
 await pick(page,1);
 eq(await tid(page,'pick-kalimba').locator('svg[data-emblem]').getAttribute('data-emblem'),'kalimba-1','settings: Kalimba shows the chosen variant');
 eq(await tid(page,'pick-kulho').locator('svg[data-emblem]').getAttribute('data-emblem'),'kulho-2','settings: Kulho shows the chosen variant');
 await shot(page,1,'valittu','1440-light');
 await pick(page,0);await tid(page,'picks-current').click();
 eq(await page.locator('.rq-cell[data-chosen]').count(),10,'rows: still one choice per row');
 for(const id of IDS)ok(await tid(page,`use-${id}-0`).isChecked(),`rows: all current ${id}`);
 await tid(page,'picks-recommended').click();
 for(const id of IDS)ok(await tid(page,`use-${id}-${REC[id]}`).isChecked(),`rows: all recommended ${id}`);
}
// Round 6's Settings flow, with the chosen emblems.
for(const d of [1]){
 const at='asetukset';
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
 eq(await tid(page,'repo-aurinkokello').locator('svg[data-emblem]').getAttribute('data-emblem'),`jaapuikot-${REC.jaapuikot}`,`${at}: the row's emblem follows`);
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
await pick(page,0);
ok((await tid(page,'trio-kulho').innerText()).startsWith('Boldest'),'rows: English trio idea');
ok((await tid(page,'cell-kulho-3').innerText()).includes('The circling mallet'),'rows: English variant name');
await shot(page,0,'en','1440-light');
for(const d of [1]){
 await pick(page,d);await sel(page,'scenario','oletus');
 eq((await tid(page,'settings-section-aanet').innerText()).trim(),'Sounds',`${names[d]}: English h2`);
 ok((await tid(page,'settings-view').textContent()).includes('Quiet at night'),`${names[d]}: English body`);
 ok((await tid(page,'pick-pisara').getAttribute('aria-label')).startsWith('Drop.'),`${names[d]}: English tile name`);
 eq((await tid(page,'secs-kalimba').innerText()).trim(),secsText(recipe.kalimba.short.dur,'en'),`${names[d]}: English seconds`);
 await shot(page,d,'oletus-en','1440-light');
}
await page.close();
// Reduced motion: still emblems that say they play.
for(const [how,opts] of [['media',{reduced:true}],['review',{}]]){
 const r=await open(1440,'dark',opts);
 if(how==='review')await sel(r,'motion','reduced');
 await pick(r,0);
 await tid(r,'play-lasit-2').click();await settle(r,120);
 ok(await tid(r,'cell-lasit-2').getAttribute('data-playing')!==null,`rows reduced (${how}): the cell shows it plays`);
 eq(await r.locator('[data-testid="cell-lasit-2"] .rq-ripple').count(),0,`rows reduced (${how}): no spreading rings`);
 await r.waitForTimeout(1300);
 await pick(r,1);
 await tid(r,'pick-lasit').click();await settle(r,120);
 const at=`settings reduced (${how})`;
 ok((await tid(r,'pick-lasit').innerText()).includes('Soi'),`${at}: says it plays`);
 eq(await r.locator('[data-testid="pick-lasit"] .rq-ripple').count(),0,`${at}: no spreading rings`);
 if(how==='media')await shot(r,1,'soi-vahennetty','1440-dark');
 await r.waitForTimeout(1300);
 await r.close();
}
// `?valinta=` sets the Settings set: ten digits, one variant per sound.
{
 const q=await open(1440,'light',{query:'?valinta=3210321032'});
 for(const [k,id] of IDS.entries())ok(await q.getByTestId(`use-${id}-${+'3210321032'[k]}`).isChecked(),`?valinta=: ${id}`);
 await pick(q,1);
 eq(await tid(q,'pick-kulho').locator('svg[data-emblem]').getAttribute('data-emblem'),'kulho-3','?valinta=: Settings follows');
 await q.close();
}
// One flow at 390 px.
const phone=await open(390,'light');
await pick(phone,0);
await tid(phone,'row-kalimba').scrollIntoViewIfNeeded();
await tid(phone,'play-kalimba-2').click();await settle(phone,150);
eq((await lastPlay(phone)).sound,'kalimba','phone rows: plays');
await tid(phone,'use-kalimba-3').check();
ok(await fits(phone),'phone rows: fits');
await shot(phone,0,'kalimba','390-light');
await phone.waitForTimeout(900);
for(const d of [1]){
 await pick(phone,d);
 eq(await tid(phone,'pick-kalimba').locator('svg[data-emblem]').getAttribute('data-emblem'),'kalimba-3','phone: the choice carries over');
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
