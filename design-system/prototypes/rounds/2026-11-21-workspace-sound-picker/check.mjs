// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// First the round directory itself: no audio, image or HTML file and nothing
// over 100 KB. Then the three entry-point directions at 1440 and 390 px in
// Päivä, Yö and Korkea kontrasti: the direction's default view with the
// pop-up open (A, B: the workspace page; C: Settings › Äänet), Sama kuin
// oletus first and ten B emblems, kotisivu's Pisara chosen, the short lengths,
// no document overflow; then closed, the chosen emblem where the direction
// shows it. At 1440 Päivä each direction's flow: a press plays the short
// render and chooses, the pop-up stays open, Sama kuin oletus plays the
// default and the entry point follows; arrows move the choice; the Settings
// row opens the same pop-up; Pitkät plays long; Äänet pois still listens;
// "agent finished" plays the workspace's sound. English, a phone sheet flow,
// and a clean console. Screenshots: v<n>-<dir>-<what>-<width>-<theme>.png.
import {createRequire} from 'node:module';
import {dirname,resolve,join,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync,readdirSync,statSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
import {SOUNDS,SAMPLE_RATE} from '../2026-11-21-attention-sounds-4/synth.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-21-workspace-sound-picker';
const [input,out,flag]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <out-dir> [--quick]');process.exit(2);}
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};

for(const f of readdirSync(here)){
 ok(!['.wav','.mp3','.ogg','.opus','.png','.jpg','.jpeg','.avif','.webp','.html'].includes(extname(f).toLowerCase()),`round directory holds ${f}`);
 ok(statSync(join(here,f)).size<100*1024,`${f} is over 100 KB`);
}
const IDS=['kalimba','marimba','vibrafoni','tunnus-puu','pisara','lasit','tuulikello','kuplat','kulho','jaapuikot'];
const recipe=Object.fromEntries(SOUNDS.filter(s=>IDS.includes(s.id)).map(s=>[s.id,s.variants]));
eq(Object.keys(recipe).length,10,'round 5 has the ten sounds');
const secsText=s=>`${s.toFixed(1).replace('.',',')} s`;

const browser=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required'],...(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{})});
const html=readFileSync(input,'utf8');
const names=['otsikko','merkki','asetukset'];
async function open(width,theme){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:900},deviceScaleFactor:2,hasTouch:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 await settle(page,400);
 return page;
}
const settle=(page,ms=250)=>page.waitForTimeout(ms);
const tid=(page,id)=>page.getByTestId(id);
const dialog=page=>tid(page,'sound-picker');
const isOpen=async page=>(await dialog(page).count())>0&&await dialog(page).isVisible();
const waitOpen=page=>dialog(page).waitFor({state:'visible',timeout:3000});
const pick=async(page,d)=>{await page.keyboard.press('Escape');await page.locator('.proto-picker-item').nth(d).click();await page.locator(`.rq-review[data-direction="${d}"]`).waitFor({state:'attached'});await settle(page,400);};
const sel=async(page,id,v)=>{await page.keyboard.press('Escape');await page.locator(`#${id}`).selectOption(v);await settle(page,400);};
const shot=(page,d,what,tag)=>page.screenshot({path:`${out}/v${d+1}-${names[d]}-${what}-${tag}.png`});
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const lastPlay=page=>page.evaluate(()=>window.__rqPlays.at(-1));
const emblemOf=loc=>loc.locator('svg[data-emblem]').first().getAttribute('data-emblem');
const entry=(page,d)=>d===0?tid(page,'head-sound'):d===1?tid(page,'chip-sound'):tid(page,'repo-sound-kotisivu');

try{
for(const width of quick?[1440]:[1440,390])for(const theme of quick?['light']:['light','dark','contrast']){
 const tag=`${width}-${theme}`;
 const page=await open(width,theme);
 await checkPicker(page,round);
 eq(await tid(page,'recommendation').count(),1,'the recommendation is on the page');
 for(let d=0;d<3;d++){
  await pick(page,d);
  const at=`${names[d]} ${tag}`;
  await waitOpen(page);
  eq(await page.locator('.wq-review').getAttribute('data-view'),d===2?'settings':'workspace',`${at}: default view`);
  eq(await page.locator('.rq-lines li[aria-current]').count(),1,`${at}: its line is marked`);
  eq(await dialog(page).getAttribute('data-repo'),'kotisivu',`${at}: the pop-up is kotisivu's`);
  eq(await page.locator('.wq-tile').count(),10,`${at}: ten sounds`);
  eq(await page.locator('.wq-tile .rq-emblem-ripple').count(),10,`${at}: ten B emblems`);
  ok((await tid(page,'wpick-default').innerText()).includes('Sama kuin oletus'),`${at}: Sama kuin oletus`);
  ok((await tid(page,'wpick-default').innerText()).includes('Kalimba'),`${at}: the default is named`);
  eq(await tid(page,'wpick-pisara').getAttribute('aria-checked'),'true',`${at}: Pisara chosen`);
  eq(await page.locator('.wq-options [role="radio"][tabindex="0"]').count(),1,`${at}: one option in the tab order`);
  eq((await tid(page,'wsecs-kulho').innerText()).trim(),secsText(recipe.kulho.short.dur),`${at}: short length shown`);
  ok((await tid(page,'picker-length').innerText()).includes('lyhyinä'),`${at}: the short length is said`);
  ok(await fits(page),`${at}: document overflow`);
  const box=await dialog(page).boundingBox();
  ok(box&&box.x>=0&&box.x+box.width<=width+1,`${at}: pop-up inside the viewport`);
  if(width===390){const pop=await page.locator('.wq-popover').boundingBox();ok(Math.abs(pop.y+pop.height-844)<2&&pop.width>=388,`${at}: a sheet from the bottom edge`);}
  await shot(page,d,'auki',tag);
  // Afterwards: closed, the chosen emblem visible where the direction shows it.
  await sel(page,'scenario','valittu');
  ok(!await isOpen(page),`${at}: closed after choosing`);
  if(d===0){
   eq(await emblemOf(tid(page,'head-sound')),'ripple-pisara',`${at}: head button shows Pisara`);
   if(width===1440){eq(await tid(page,'rail-sound-kotisivu').count(),1,`${at}: rail shows the own sound`);eq(await tid(page,'rail-sound-aurinkokello').count(),0,`${at}: no rail mark for a default`);}
  }else if(d===1){
   ok((await tid(page,'chip-sound').innerText()).includes('Pisara'),`${at}: chip names Pisara`);
   eq(await emblemOf(tid(page,'chip-sound')),'ripple-pisara',`${at}: chip shows Pisara`);
  }else{
   eq(await emblemOf(tid(page,'repo-kotisivu')),'ripple-pisara',`${at}: Settings row shows Pisara`);
   eq(await tid(page,'head-sound').count()+await tid(page,'chip-sound').count(),0,`${at}: nothing in the workspace`);
  }
  ok(await fits(page),`${at}: closed, document overflow`);
  await shot(page,d,'kiinni',tag);
  await sel(page,'scenario','oletus');
  await waitOpen(page);
  eq(await dialog(page).getAttribute('data-repo'),'aurinkokello',`${at}: aurinkokello's pop-up`);
  eq(await tid(page,'wpick-default').getAttribute('aria-checked'),'true',`${at}: Sama kuin oletus chosen`);
  await shot(page,d,'oletus',tag);
  await sel(page,'scenario','oma');
 }
 // Each direction's flow once, on the desktop in Päivä.
 if(width===1440&&theme==='light'){
  for(let d=0;d<3;d++){
   await pick(page,d);await waitOpen(page);
   const at=`${names[d]} flow`;
   await tid(page,'wpick-marimba').click();await settle(page);
   const p=await lastPlay(page);
   eq(p.sound,'marimba',`${at}: plays Marimba`);eq(p.length,'short',`${at}: short`);
   eq(p.samples,Math.round(recipe.marimba.short.dur*SAMPLE_RATE),`${at}: the short render`);
   eq(await tid(page,'wpick-marimba').getAttribute('aria-checked'),'true',`${at}: Marimba chosen`);
   ok(await isOpen(page),`${at}: stays open for trying others`);
   ok(await tid(page,'wpick-marimba').locator('.rq-ripple').count()>0,`${at}: the emblem ripples`);
   await page.keyboard.press('ArrowRight');await settle(page);
   eq(await tid(page,'wpick-vibrafoni').getAttribute('aria-checked'),'true',`${at}: arrow moves the choice`);
   eq((await lastPlay(page)).sound,'vibrafoni',`${at}: arrow plays`);
   ok(await tid(page,'wpick-vibrafoni').evaluate(el=>el===document.activeElement),`${at}: focus follows`);
   await tid(page,'wpick-default').click();await settle(page);
   eq((await lastPlay(page)).sound,'kalimba',`${at}: Sama kuin oletus plays Kalimba`);
   await tid(page,'picker-done').click();await settle(page);
   ok(!await isOpen(page),`${at}: Valmis closes`);
   if(d===0){eq(await emblemOf(tid(page,'head-sound')),'ripple-kalimba',`${at}: head follows`);eq(await tid(page,'rail-sound-kotisivu').count(),0,`${at}: rail mark gone`);}
   if(d===1)ok((await tid(page,'chip-sound').innerText()).includes('oletus'),`${at}: chip says default`);
   if(d===2)ok((await tid(page,'repo-sound-kotisivu').innerText()).includes('Sama kuin oletus'),`${at}: row says default`);
   // Reopen from the entry point; Esc returns focus to it.
   await entry(page,d).click();await waitOpen(page);
   await page.keyboard.press('Escape');await settle(page);
   ok(!await isOpen(page),`${at}: Esc closes`);
   ok(await entry(page,d).evaluate(el=>el===document.activeElement),`${at}: focus back on the entry point`);
   if(d<2){
    // The Settings row opens the same pop-up.
    await sel(page,'view','settings');
    await waitOpen(page);await page.keyboard.press('Escape');await settle(page);
    await tid(page,'repo-sound-muistiinpanot').click();await waitOpen(page);
    eq(await dialog(page).getAttribute('data-repo'),'muistiinpanot',`${at}: Settings row opens muistiinpanot`);
    await tid(page,'wpick-kuplat').click();await settle(page);await page.keyboard.press('Escape');await settle(page);
    eq(await emblemOf(tid(page,'repo-muistiinpanot')),'ripple-kuplat',`${at}: Settings row follows`);
    await sel(page,'view','workspace');
   }
  }
  await pick(page,1);
  // The length link in the pop-up goes to Settings.
  await waitOpen(page);await tid(page,'picker-settings').click();await settle(page,400);
  eq(await page.locator('.wq-review').getAttribute('data-view'),'settings','length link goes to Settings');
  ok(!await isOpen(page),'Settings opened without the pop-up');
  await sel(page,'view','workspace');
  await sel(page,'scenario','pitkat');await waitOpen(page);
  eq((await tid(page,'wsecs-kulho').innerText()).trim(),secsText(recipe.kulho.long.dur),'long length shown');
  ok((await tid(page,'picker-length').innerText()).includes('pitkinä'),'the long length is said');
  await tid(page,'wpick-lasit').click();await settle(page);
  eq((await lastPlay(page)).length,'long','plays long');
  eq((await lastPlay(page)).samples,Math.round(recipe.lasit.long.dur*SAMPLE_RATE),'the long render');
  await sel(page,'scenario','pois');await waitOpen(page);
  eq(await tid(page,'picker-off').count(),1,'off note in the pop-up');
  await tid(page,'wpick-kulho').click();await settle(page);
  eq((await lastPlay(page)).sound,'kulho','listening works while off');
  await shot(page,1,'pois',tag);
  await page.keyboard.press('Escape');
  await tid(page,'sim-kotisivu').click();await settle(page);
  eq(await page.evaluate(()=>window.__rqSim.at(-1).played),false,'off: agent finished is silent');
  await sel(page,'scenario','oma');await page.keyboard.press('Escape');await settle(page);
  await tid(page,'sim-kotisivu').click();await settle(page);
  eq(await page.evaluate(()=>window.__rqSim.at(-1).sound),'pisara','agent finished plays the workspace sound');
  ok(await tid(page,'chip-sound').locator('.rq-ripple').count()>0,'the chip ripples when its workspace rings');
  await tid(page,'sim-aurinkokello').click();await settle(page);
  eq(await page.evaluate(()=>window.__rqSim.at(-1).sound),'kalimba','a default workspace plays the default');
  // English
  await sel(page,'language','en');await waitOpen(page);
  ok((await tid(page,'wpick-default').innerText()).includes('Same as default'),'English: Same as default');
  ok((await tid(page,'wpick-pisara').getAttribute('aria-label')).startsWith('Drop'),'English: sound names');
  await shot(page,1,'en',tag);
  await sel(page,'language','fi');
 }
 await page.close();
}
// Phone flow: B's chip opens the sheet, a press plays and chooses.
if(!quick){
 const page=await open(390,'light');
 await pick(page,1);await page.keyboard.press('Escape');await settle(page);
 await tid(page,'chip-sound').click();await waitOpen(page);
 await tid(page,'wpick-jaapuikot').click();await settle(page);
 eq((await lastPlay(page)).sound,'jaapuikot','phone: plays');
 await tid(page,'picker-done').click();await settle(page);
 ok((await tid(page,'chip-sound').innerText()).includes('Jääpuikot'),'phone: chip follows');
 await page.close();
}
eq(errors.length,0,`console errors: ${errors.join(' | ')}`);
console.log(`${checks} checks passed`);
}finally{await browser.close();}
