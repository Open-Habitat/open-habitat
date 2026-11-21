// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Walks the three tile directions in every situation at 1440 and 390 px in
// Päivä, Yö and Korkea kontrasti: no document overflow, the direction's line
// marked, production's Settings with Sounds current, twelve tiles drawn from
// the offline render, the default sound (Ovi) chosen, the notes each
// situation shows (night, always-dark hint, off, muted, browser gate, read
// error). Then at 1440 Päivä it clicks each direction: a tile press plays,
// chooses and shows the playing state (A's fill moves, B's rings spread, C's
// meter lights), arrow keys move the choice with focus, the review's "agent
// finished" follows the rules (conversation in view, night by device and by
// clock, the always-dark hint's switch to the clock, off, muted), the
// browser gate, the read error. Reduced motion: the playing tile is still
// and says it plays. English, and one flow at 390 px. Screenshots at device
// scale 2 named v<n>-<direction>-<situation>-<width>-<theme>.png.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-21-attention-sound-tiles';
const [input,out,flag]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <out-dir> [--quick]');process.exit(2);}
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required'],...(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{})});
const html=readFileSync(input,'utf8');
const names=['aaltomuoto','renkaat','kuva'];
const kinds=['wave','rings','picture'];
const scenarios=['oletus','yo','aina-tumma','pois','mykistetty','estetty','lukuvirhe'];
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};

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
const ready=async page=>{
 await page.locator('.rq-section [data-testid^="direction-"]').waitFor();
 await page.waitForFunction(()=>window.__rqAnalysed===12);
 await settle(page);
};
const pick=async(page,d)=>{await page.locator('.proto-picker-item').nth(d).click();await page.locator(`.rq-review[data-direction="${d}"]`).waitFor({state:'attached'});await ready(page);};
const sel=async(page,id,v)=>{await page.locator(`#${id}`).selectOption(v);await ready(page);};
const shot=(page,d,c,tag,full=false)=>page.screenshot({path:`${out}/v${d+1}-${names[d]}-${c}-${tag}.png`,fullPage:full});
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const plays=page=>page.evaluate(()=>window.__rqPlays.length);
const lastPlay=page=>page.evaluate(()=>window.__rqPlays.at(-1));
const lastSim=page=>page.evaluate(()=>window.__rqSim.at(-1));
const shown=async(page,id)=>(await tid(page,id).count())>0&&await tid(page,id).first().isVisible();
const menuPick=async(page,id,label)=>{await tid(page,id).click();await page.getByRole('menuitemradio',{name:label}).or(page.getByRole('menuitem',{name:label})).first().click();await settle(page);};

try{
for(const width of quick?[1440]:[1440,390])for(const theme of quick?['light']:['light','dark','contrast']){
 const tag=`${width}-${theme}`;
 const page=await open(width,theme);
 await checkPicker(page,round);
 eq(await tid(page,'recommendation').count(),1,'the recommendation is on the page');
 for(let d=0;d<3;d++){
  await pick(page,d);
  for(const s of scenarios){
   await sel(page,'scenario',s);
   const at=`${names[d]} ${s} ${tag}`;
   ok(await fits(page),`${at}: document overflow`);
   eq(await page.locator('.rq-lines li[aria-current]').count(),1,`${at}: its line is marked`);
   eq(await tid(page,`direction-${kinds[d]}`).count(),1,`${at}: the direction's body`);
   eq((await tid(page,'settings-section-aanet').innerText()).trim(),'Äänet',`${at}: production's h2`);
   if(width===1440)eq(await tid(page,'settings-aanet').getAttribute('aria-current'),'page',`${at}: Sounds is the current section`);
   ok(await shown(page,'placeholder-tag'),`${at}: placeholder tag`);
   eq(await page.locator('.rq-tile').count(),12,`${at}: twelve tiles`);
   eq(await tid(page,'pick-c1').getAttribute('aria-checked'),'true',`${at}: Ovi is the default`);
   eq(await page.locator('.rq-tile[tabindex="0"]').count(),1,`${at}: one tile in the tab order`);
   if(d===0)ok(await page.locator('.rq-wave-base').first().getAttribute('d'),`${at}: the envelope is drawn`);
   if(d===1)ok(await page.locator('.rq-ring').count()>=12,`${at}: rings are drawn`);
   if(d===2)eq(await page.locator('.rq-pic').count(),12,`${at}: pictures are drawn`);
   const night=s==='yo'||s==='aina-tumma';
   eq(await shown(page,'note-night'),night,`${at}: night note`);
   eq(await shown(page,'note-always-dark'),s==='aina-tumma',`${at}: always-dark hint`);
   eq(await shown(page,'night-now'),!['pois','lukuvirhe'].includes(s),`${at}: night status line`);
   eq(await shown(page,'note-off'),s==='pois',`${at}: off note`);
   eq(await shown(page,'note-muted'),s==='mykistetty',`${at}: muted note`);
   eq(await shown(page,'note-blocked'),s==='estetty',`${at}: browser gate note`);
   eq(await shown(page,'sound-read-error'),s==='lukuvirhe',`${at}: read error`);
   eq(await tid(page,'pick-a1').isDisabled(),s==='pois'||s==='lukuvirhe',`${at}: tiles disabled only when off or unreadable`);
   if(s==='mykistetty')ok(await tid(page,'device-volume').locator('input').isDisabled(),`${at}: volume disabled while muted`);
   await shot(page,d,s,tag);
  }
 }
 await page.close();
}

// Flows at 1440 Päivä.
const page=await open(1440,'light');
for(const d of [0,1,2]){
 const at=names[d];
 await pick(page,d);await sel(page,'scenario','oletus');
 let n=await plays(page);
 await tid(page,'pick-b2').click();await settle(page,150);
 eq(await tid(page,'pick-b2').getAttribute('aria-checked'),'true',`${at}: Marimba chosen`);
 eq(await plays(page),n+1,`${at}: pressing plays`);
 eq((await lastPlay(page)).sound,'b2',`${at}: it played Marimba`);
 ok(await tid(page,'pick-b2').getAttribute('data-playing')!==null,`${at}: the tile shows it plays`);
 if(d===0)ok(+(await page.locator('[data-testid="pick-b2"] clipPath rect').getAttribute('width'))>0,`${at}: the fill moves`);
 if(d===1)ok(await page.locator('[data-testid="pick-b2"] .rq-ripple').count()===2,`${at}: two strikes spread`);
 if(d===2)ok(await page.locator('[data-testid="pick-b2"] .rq-meter i[data-on="true"]').count()>0,`${at}: the meter lights`);
 await shot(page,d,'soi','1440-light');
 await page.waitForTimeout(900);
 eq(await tid(page,'pick-b2').getAttribute('data-playing'),null,`${at}: playing ends`);
 // Keyboard: arrows move the choice and focus, and play.
 await tid(page,'pick-b2').focus();
 n=await plays(page);
 await page.keyboard.press('ArrowRight');await settle(page);
 eq(await tid(page,'pick-b3').getAttribute('aria-checked'),'true',`${at}: ArrowRight chooses Lasi`);
 ok(await tid(page,'pick-b3').evaluate(el=>el===document.activeElement&&el.matches(':focus-visible')),`${at}: focus follows, visibly`);
 eq(await plays(page),n+1,`${at}: the arrow plays`);
 await page.keyboard.press('ArrowLeft');await settle(page);
 eq(await tid(page,'pick-b2').getAttribute('aria-checked'),'true',`${at}: ArrowLeft back`);
 await page.waitForTimeout(900);
 await shot(page,d,'fokus','1440-light');
 // Agent finished: another conversation plays, the one in view does not.
 await tid(page,'sim-other').click();await settle(page);
 eq((await lastSim(page)).played,true,`${at}: another conversation plays`);
 eq((await lastPlay(page)).sound,'b2',`${at}: with the chosen sound`);
 await tid(page,'sim-in-view').click();await settle(page);
 eq((await lastSim(page)).played,false,`${at}: the conversation in view is quiet`);
 await tid(page,'in-view').getByTestId('segment-plays').click();await settle(page);
 await tid(page,'sim-in-view').click();await settle(page);
 eq((await lastSim(page)).played,true,`${at}: "play anyway" plays in view`);
 // Volume by keyboard, then test at that volume.
 await tid(page,'device-volume').locator('input').focus();
 await page.keyboard.press('ArrowLeft');await page.keyboard.press('ArrowLeft');
 await tid(page,'sound-test').click();
 eq((await lastPlay(page)).volume,50,`${at}: test plays at the device volume`);
 // Mute this device: agent finished is quiet, the test still plays.
 await tid(page,'device-mute').getByTestId('segment-muted').click();await settle(page);
 await tid(page,'sim-other').click();await settle(page);
 eq((await lastSim(page)).played,false,`${at}: muted device is quiet`);
 await tid(page,'device-mute').getByTestId('segment-plays').click();await settle(page);
 // Night by the device's dark mode.
 await sel(page,'scenario','yo');
 await tid(page,'sim-other').click();await settle(page);
 eq((await lastSim(page)).played,false,`${at}: quiet at night`);
 n=await plays(page);await tid(page,'sound-test').click();
 eq(await plays(page),n+1,`${at}: test plays at night`);
 await menuPick(page,'night-rhythm',/22/);
 eq(await tid(page,'night-rhythm').getAttribute('data-value'),'clock',`${at}: clock chosen`);
 ok((await tid(page,'night-now').innerText()).includes('7.00'),`${at}: clock night says until 7`);
 await tid(page,'night').getByTestId('segment-off').click();await settle(page);
 await tid(page,'sim-other').click();await settle(page);
 eq((await lastSim(page)).played,true,`${at}: night quieting off plays`);
 ok(await tid(page,'night-rhythm').isDisabled(),`${at}: rhythm locked while off`);
 // A device dark at midday: the hint switches to the clock.
 await sel(page,'scenario','aina-tumma');
 await shot(page,d,'aina-tumma-flow','1440-light');
 await tid(page,'use-clock').click();await settle(page);
 eq(await tid(page,'note-always-dark').count(),0,`${at}: hint gone with the clock`);
 eq(await tid(page,'night-now').getAttribute('data-night'),null,`${at}: daytime by the clock`);
 await tid(page,'sim-other').click();await settle(page);
 eq((await lastSim(page)).played,true,`${at}: plays at midday by the clock`);
 // Off: tiles locked, test still plays, agent finished quiet.
 await sel(page,'scenario','oletus');
 await tid(page,'sound-on').getByTestId('segment-off').click();await settle(page);
 ok(await tid(page,'pick-a1').isDisabled(),`${at}: tiles locked when off`);
 ok(await tid(page,'night-rhythm').isDisabled(),`${at}: night locked when off`);
 n=await plays(page);await tid(page,'sound-test').click();
 eq(await plays(page),n+1,`${at}: test plays when off`);
 await tid(page,'sim-other').click();await settle(page);
 eq((await lastSim(page)).played,false,`${at}: off is quiet`);
 // The browser gate: a tile press allows sound.
 await sel(page,'scenario','estetty');
 await tid(page,'sim-other').click();await settle(page);
 eq((await lastSim(page)).played,false,`${at}: gate keeps quiet`);
 await tid(page,'pick-a2').click();await settle(page);
 eq(await tid(page,'note-blocked').count(),0,`${at}: the press opens the gate`);
 ok(await shown(page,'note-allowed'),`${at}: allowed said`);
 // Read error: device works, reload recovers.
 await sel(page,'scenario','lukuvirhe');
 await tid(page,'device-mute').getByTestId('segment-muted').click();await settle(page);
 ok(await shown(page,'note-muted'),`${at}: mute works while unreadable`);
 await tid(page,'sound-read-error-reload').click();await settle(page);
 eq(await tid(page,'sound-read-error').count(),0,`${at}: reload recovers`);
}
// English.
await sel(page,'language','en');
for(const d of [0,1,2]){
 await pick(page,d);await sel(page,'scenario','oletus');
 eq((await tid(page,'settings-section-aanet').innerText()).trim(),'Sounds',`${names[d]}: English h2`);
 ok((await tid(page,`direction-${kinds[d]}`).textContent()).includes('Quiet at night'),`${names[d]}: English body`);
 ok((await tid(page,'pick-c1').getAttribute('aria-label')).startsWith('Door.'),`${names[d]}: English tile name`);
 await shot(page,d,'oletus-en','1440-light');
}
await page.close();
// Reduced motion: still pictures that say they play.
for(const [how,opts] of [['media',{reduced:true}],['review',{}]]){
 const r=await open(1440,'dark',opts);
 if(how==='review')await sel(r,'motion','reduced');
 for(const d of [0,1,2]){
  await pick(r,d);
  await tid(r,'pick-a2').click();await settle(r,120);
  const at=`${names[d]} reduced (${how})`;
  ok((await tid(r,'pick-a2').innerText()).includes('Soi'),`${at}: says it plays`);
  if(d===0)eq(await r.locator('[data-testid="pick-a2"] .rq-wave-head').evaluate(el=>el.style.opacity),'0',`${at}: no moving playhead`);
  if(d===1)eq(await r.locator('[data-testid="pick-a2"] .rq-ripple').count(),0,`${at}: no spreading rings`);
  if(d===2){
   const a=await r.locator('[data-testid="pick-a2"] .rq-meter i[data-on="true"]').count();
   await settle(r,150);
   eq(await r.locator('[data-testid="pick-a2"] .rq-meter i[data-on="true"]').count(),a,`${at}: the meter stays still`);
  }
  if(how==='media')await shot(r,d,'soi-vahennetty','1440-dark');
  await r.waitForTimeout(1000);
 }
 await r.close();
}
// One flow at 390 px.
const phone=await open(390,'light');
await pick(phone,0);
await tid(phone,'pick-a4').scrollIntoViewIfNeeded();await tid(phone,'pick-a4').click();await settle(phone,150);
eq(await tid(phone,'pick-a4').getAttribute('aria-checked'),'true','phone: Kulho chosen');
await shot(phone,0,'soi','390-light');
await tid(phone,'night-rhythm').scrollIntoViewIfNeeded();
await shot(phone,0,'yo-rivit','390-light');
ok(await fits(phone),'phone: fits');
await phone.close();
}finally{await browser.close();}
assert.deepEqual(errors,[],`console: ${errors.join('\n')}`);
console.log(`${checks} checks, console clean`);
