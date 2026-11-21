// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// First the round directory itself: no audio, image or HTML file and nothing
// over 100 KB. Then the three strip variants at 1440 and 390 px in Päivä, Yö
// and Korkea kontrasti. On the default view (picker closed) the strip's
// buttons are sized by kind: Kuvake and Ääni are squares of one size (the
// box holding the picture is square), Nimi is wider than it is high and
// shows the workspace name on one line, and every value is whole (nothing clipped or cut with an ellipsis). The sound
// button shows kotisivu's Pisara with a large emblem (at least 40 px) and the
// note glyph. The variants differ visibly: A one row Kuvake–Nimi–Ääni with
// squares as high as Nimi; B Nimi first as a bar spanning both squares above
// them, the squares higher than Nimi; C Nimi first in one row, label and
// value under the squares' frames. The rail rows hold no note.
// aurinkokello says "Kalimba · oletus" with the same boxes as Pisara. Opened,
// the pop-up has Sama kuin oletus, ten emblems and eleven ▶ buttons, Pisara
// chosen, inside the viewport (a bottom sheet on a phone). No layout shift:
// in Settings and in every variant's strip, at both widths and in English,
// all three strip buttons, the pop-up and the workspace name stay within half
// a pixel while the choice moves through values of different lengths. At
// 1440 Päivä each variant's flow: ▶ plays without choosing, a press chooses
// and plays, arrows move the choice, Valmis and Esc close and return focus;
// the length link, Pitkät, Äänet pois, "agent finished", English, a phone
// flow, and a clean console.
// Screenshots: v<n>-<variant>-<what>-<width>-<theme>.png.
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
const round='2026-11-21-workspace-sound-strip-4';
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
const names=['rivi','nimi-ylhaalla','sanat-alla'];
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
// Emblem round 7's recommended variants.
const V={kalimba:2,marimba:1,vibrafoni:2,'tunnus-puu':1,pisara:0,lasit:1,tuulikello:0,kuplat:1,kulho:3,jaapuikot:2};
const em=id=>`${id}-${V[id]}`;
const SOUND='entry-strip-sound';
const ITEMS=['strip-icon','strip-name',SOUND];
const entry=page=>tid(page,SOUND);
const rect=loc=>loc.evaluate(el=>{const r=el.getBoundingClientRect();return [r.x,r.y,r.width,r.height].map(v=>Math.round(v*2)/2);});
const same=(a,b,m)=>ok(a.every((v,i)=>Math.abs(v-b[i])<=0.5),`${m}: moved from ${a} to ${b}`);
const boxes=page=>Promise.all(ITEMS.map(i=>rect(tid(page,i))));
// Sized by kind: the two squares share one box, Nimi is flat, values whole.
const frame=(page,i)=>tid(page,i).locator('.wq-strip-box');
async function kindBoxes(page,at,dir){
 const b=await boxes(page);
 const [ic,nm,so]=b;
 ok(Math.abs(ic[2]-so[2])<=0.5&&Math.abs(ic[3]-so[3])<=0.5,`${at}: Kuvake ${ic} and Ääni ${so} differ`);
 // The square is the framed part: the whole button in A and B, the box in C.
 const sq=dir===2?await rect(frame(page,SOUND)):so;
 ok(Math.abs(sq[2]-sq[3])<=0.5,`${at}: Ääni is not square (${sq[2]}×${sq[3]})`);
 const nf=dir===2?await rect(frame(page,'strip-name')):nm;
 ok(nf[2]>=1.15*nf[3],`${at}: Nimi is not flat (${nf[2]}×${nf[3]})`);
 ok(nf[2]>sq[2],`${at}: Nimi is not wider than the squares`);
 // The synthetic names fit on one line: an identifier is never broken mid-word.
 const nl=await tid(page,'strip-name').locator('.wq-name-value').evaluate(el=>[el.getBoundingClientRect().height,parseFloat(getComputedStyle(el).lineHeight)]);
 ok(nl[0]<=nl[1]+1,`${at}: the name wraps (${nl})`);
 for(const i of ITEMS){
  const v=await tid(page,i).locator('.wq-stable-value').first().evaluate(el=>[el.scrollWidth,el.clientWidth,el.scrollHeight,el.clientHeight]);
  ok(v[0]<=v[1]+1&&v[2]<=v[3]+1,`${at}: ${i} value clipped (${v})`);
  const inside=await tid(page,i).evaluate(el=>{const r=el.getBoundingClientRect();return [...el.querySelectorAll('.wq-strip-label,.wq-stable-value,.wq-strip-box > *')].every(c=>{const q=c.getBoundingClientRect();return q.left>=r.left-0.5&&q.right<=r.right+0.5&&q.top>=r.top-0.5&&q.bottom<=r.bottom+0.5;});});
  ok(inside,`${at}: ${i} content spills out of its button`);
 }
 return b;
}
// Choose values of different lengths and assert nothing moves.
async function noShift(page,trigger,label,at,also=[]){
 await trigger.click();await waitOpen(page);await settle(page,300);
 const t0=await rect(trigger),p0=await rect(page.locator('.wq-popover')),l0=label?await rect(label):null;
 const a0=await Promise.all(also.map(rect));
 for(const c of ['default','jaapuikot','tunnus-puu','kuplat','lasit','pisara']){
  await tid(page,`wpick-${c}`).click();await settle(page,150);
  same(t0,await rect(trigger),`${at}: control after ${c}`);
  same(p0,await rect(page.locator('.wq-popover')),`${at}: pop-up after ${c}`);
  if(label)same(l0,await rect(label),`${at}: name after ${c}`);
  for(let i=0;i<also.length;i++)same(a0[i],await rect(also[i]),`${at}: strip button ${i} after ${c}`);
 }
 await page.keyboard.press('Escape');await settle(page);
}

try{
for(const width of quick?[1440]:[1440,390])for(const theme of quick?['light']:['light','dark','contrast']){
 const tag=`${width}-${theme}`;
 const page=await open(width,theme);
 await checkPicker(page,round);
 eq(await tid(page,'recommendation').count(),1,'the recommendation is on the page');
 for(let d=0;d<3;d++){
  await pick(page,d);
  const at=`${names[d]} ${tag}`;
  eq(await page.locator('.wq-review').getAttribute('data-view'),'workspace',`${at}: default view`);
  ok(!await isOpen(page),`${at}: picker closed on the default view`);
  eq(await page.locator('.rq-lines li[aria-current]').count(),1,`${at}: its line is marked`);
  const show=entry(page);
  eq(await show.count(),1,`${at}: the sound button`);
  eq(await tid(page,'entry-strip').getAttribute('data-dir'),['line','stack','under'][d],`${at}: its variant`);
  eq(await emblemOf(show),em('pisara'),`${at}: Pisara's emblem`);
  ok((await show.innerText()).includes('Pisara'),`${at}: names Pisara`);
  const size=(await rect(show.locator('svg[data-emblem]').first()))[2];
  ok(size>=40,`${at}: the emblem is large (${size} px)`);
  ok(await show.locator('svg path[d^="M9 18V6"]').count()>0,`${at}: the note glyph`);
  eq(await page.locator('.ah-workspace-row svg path[d^="M9 18V6"]').count(),0,`${at}: no note in the rail`);
  eq(await page.locator('[data-testid^="rail-note-"]').count(),0,`${at}: no rail note button`);
  const b0=await kindBoxes(page,`${at} oma`,d);
  const [ic,nm,so]=b0;
  if(d===0){
   ok(ic[0]<nm[0]&&nm[0]<so[0],`${at}: order Kuvake–Nimi–Ääni`);
   ok(b0.every(r=>Math.abs(r[1]-ic[1])<=0.5&&Math.abs(r[3]-ic[3])<=0.5),`${at}: one row of one height`);
  }
  if(d===1){
   ok(nm[1]+nm[3]<=ic[1]&&Math.abs(ic[1]-so[1])<=0.5,`${at}: Nimi above, squares side by side`);
   ok(Math.abs(nm[0]-ic[0])<=0.5&&Math.abs(nm[0]+nm[2]-(so[0]+so[2]))<=0.5,`${at}: Nimi spans both squares`);
   ok(so[3]>=2*nm[3],`${at}: squares taller than Nimi (${so[3]} vs ${nm[3]})`);
  }
  if(d===2){
   ok(nm[0]<ic[0]&&ic[0]<so[0]&&Math.abs(nm[1]-ic[1])<=0.5,`${at}: order Nimi–Kuvake–Ääni in one row`);
   const fr=await rect(frame(page,SOUND)),lab=await rect(entry(page).locator('.wq-strip-label'));
   ok(lab[1]>=fr[1]+fr[3],`${at}: the label sits under the square`);
  }
  if(width===390)ok(so[0]+so[2]<=width,`${at}: the whole strip visible on a phone`);
  ok(await fits(page),`${at}: document overflow`);
  await shot(page,d,'oma',tag);
  await sel(page,'scenario','oletus');
  ok((await entry(page).innerText()).replace(/\s+/g,' ').includes('Kalimba · oletus'),`${at}: says Kalimba · oletus`);
  eq(await emblemOf(entry(page)),em('kalimba'),`${at}: Kalimba's emblem`);
  const b1=await kindBoxes(page,`${at} oletus`,d);
  for(let i=0;i<3;i++)same(b0[i],b1[i],`${at}: ${ITEMS[i]} from Pisara to Kalimba · oletus`);
  await shot(page,d,'oletus',tag);
  await sel(page,'scenario','auki');
  await waitOpen(page);
  eq(await dialog(page).getAttribute('data-repo'),'kotisivu',`${at}: the pop-up is kotisivu's`);
  eq(await page.locator('.wq-tile').count(),10,`${at}: ten sounds`);
  eq(await page.locator('.wq-tile .rq-emblem-ripple').count(),10,`${at}: ten ripple emblems`);
  eq(await page.locator('.wq-preview').count(),11,`${at}: a ▶ on every option`);
  ok((await tid(page,'wpick-default').innerText()).includes('Sama kuin oletus'),`${at}: Sama kuin oletus`);
  eq(await tid(page,'wpick-pisara').getAttribute('aria-checked'),'true',`${at}: Pisara chosen`);
  eq(await page.locator('.wq-options [role="radio"][tabindex="0"]').count(),1,`${at}: one option in the tab order`);
  eq((await tid(page,'wsecs-kulho').innerText()).trim(),secsText(recipe.kulho.short.dur),`${at}: short length shown`);
  ok(await fits(page),`${at}: open, document overflow`);
  const box=await dialog(page).boundingBox();
  ok(box&&box.x>=0&&box.x+box.width<=width+1,`${at}: pop-up inside the viewport`);
  if(width===390){const pop=await page.locator('.wq-popover').boundingBox();ok(Math.abs(pop.y+pop.height-844)<2&&pop.width>=388,`${at}: a sheet from the bottom edge`);}
  await shot(page,d,'auki',tag);
  await sel(page,'scenario','oma');
 }
 // No layout shift when the choice changes: Settings rows and every head control.
 if(theme==='light'){
  await pick(page,0);
  await sel(page,'view','settings');
  ok((await tid(page,'repo-sound-kotisivu').innerText()).includes('Pisara'),`Settings ${tag}: the row says Pisara`);
  ok((await tid(page,'repo-sound-aurinkokello').innerText()).includes('Kalimba · oletus'),`Settings ${tag}: the row says Kalimba · oletus`);
  for(const r of ['kotisivu','aurinkokello'])
   await noShift(page,tid(page,`repo-sound-${r}`),tid(page,`repo-${r}`).locator('.rq-repo-name'),`Settings ${r} ${tag}`);
  await shot(page,0,'asetukset',tag);
  for(let d=0;d<3;d++){
   await pick(page,d);
   await noShift(page,entry(page),tid(page,'workspace-title'),`${names[d]} strip ${tag}`,ITEMS.map(i=>tid(page,i)));
  }
 }
 // Each direction's flow once, on the desktop in Päivä.
 if(width===1440&&theme==='light'){
  for(let d=0;d<3;d++){
   await pick(page,d);
   const at=`${names[d]} flow`;
   await entry(page).click();await waitOpen(page);
   await tid(page,'wpreview-marimba').click();await settle(page);
   let p=await lastPlay(page);
   eq(p.sound,'marimba',`${at}: ▶ plays Marimba`);eq(p.where,'picker-marimba',`${at}: ▶ ripples its card`);
   eq(await tid(page,'wpick-pisara').getAttribute('aria-checked'),'true',`${at}: ▶ does not choose`);
   ok(await tid(page,'wpick-marimba').locator('.rq-ripple').count()>0,`${at}: the card's emblem ripples`);
   await tid(page,'wpick-marimba').click();await settle(page);
   p=await lastPlay(page);
   eq(p.sound,'marimba',`${at}: press plays Marimba`);eq(p.length,'short',`${at}: short`);
   eq(p.samples,Math.round(recipe.marimba.short.dur*SAMPLE_RATE),`${at}: the short render`);
   eq(await tid(page,'wpick-marimba').getAttribute('aria-checked'),'true',`${at}: press chooses Marimba`);
   ok(await isOpen(page),`${at}: stays open`);
   await page.keyboard.press('ArrowRight');await settle(page);
   eq(await tid(page,'wpick-vibrafoni').getAttribute('aria-checked'),'true',`${at}: arrow moves the choice`);
   ok(await tid(page,'wpick-vibrafoni').evaluate(el=>el===document.activeElement),`${at}: focus follows`);
   await tid(page,'wpreview-default').click();await settle(page);
   eq((await lastPlay(page)).sound,'kalimba',`${at}: ▶ on Sama kuin oletus plays Kalimba`);
   eq(await tid(page,'wpick-vibrafoni').getAttribute('aria-checked'),'true',`${at}: and does not choose`);
   await tid(page,'wpick-default').click();await settle(page);
   await tid(page,'picker-done').click();await settle(page);
   ok(!await isOpen(page),`${at}: Valmis closes`);
   ok((await entry(page).innerText()).replace(/\s+/g,' ').includes('Kalimba · oletus'),`${at}: the button follows to the default`);
   await entry(page).click();await waitOpen(page);
   await page.keyboard.press('Escape');await settle(page);
   ok(!await isOpen(page),`${at}: Esc closes`);
   ok(await entry(page).evaluate(el=>el===document.activeElement),`${at}: focus back on the control`);
  }
  // The rail: hovering a row shows no sound note (Jari 21.11.).
  await pick(page,0);
  await page.getByTestId('workspace-aurinkokello').hover();await settle(page,300);
  eq(await page.getByTestId('workspace-aurinkokello').locator('svg path[d^="M9 18V6"]').count(),0,'no note on a hovered rail row');
  await shot(page,0,'sivupalkki',tag);
  // Kuvake and Nimi are in the strip but not part of this round.
  eq(await tid(page,'strip-icon').count()+await tid(page,'strip-name').count(),2,'Kuvake and Nimi in the strip');
  await pick(page,0);
  // The length link in the pop-up goes to Settings.
  await entry(page).click();await waitOpen(page);await tid(page,'picker-settings').click();await settle(page,400);
  eq(await page.locator('.wq-review').getAttribute('data-view'),'settings','length link goes to Settings');
  ok(!await isOpen(page),'Settings opened without the pop-up');
  await sel(page,'view','workspace');
  await sel(page,'scenario','pitkat');await waitOpen(page);
  eq((await tid(page,'wsecs-kulho').innerText()).trim(),secsText(recipe.kulho.long.dur),'long length shown');
  ok((await tid(page,'picker-length').innerText()).includes('pitkinä'),'the long length is said');
  await tid(page,'wpreview-lasit').click();await settle(page);
  eq((await lastPlay(page)).length,'long','▶ plays long');
  eq((await lastPlay(page)).samples,Math.round(recipe.lasit.long.dur*SAMPLE_RATE),'the long render');
  await sel(page,'scenario','pois');await waitOpen(page);
  eq(await tid(page,'picker-off').count(),1,'off note in the pop-up');
  await tid(page,'wpreview-kulho').click();await settle(page);
  eq((await lastPlay(page)).sound,'kulho','listening works while off');
  await shot(page,0,'pois',tag);
  await page.keyboard.press('Escape');
  await tid(page,'sim-kotisivu').click();await settle(page);
  eq(await page.evaluate(()=>window.__rqSim.at(-1).played),false,'off: agent finished is silent');
  await sel(page,'scenario','oma');
  await tid(page,'sim-kotisivu').click();await settle(page);
  eq(await page.evaluate(()=>window.__rqSim.at(-1).sound),'pisara','agent finished plays the workspace sound');
  ok(await entry(page).locator('.rq-ripple').count()>0,'the strip emblem ripples when its workspace rings');
  await tid(page,'sim-aurinkokello').click();await settle(page);
  eq(await page.evaluate(()=>window.__rqSim.at(-1).sound),'kalimba','a default workspace plays the default');
  // English
  await sel(page,'language','en');
  for(let d=0;d<3;d++){
   await pick(page,d);
   ok((await entry(page).innerText()).includes('Drop'),`English ${names[d]}: sound name`);
   await kindBoxes(page,`English ${names[d]}`,d);
   await sel(page,'scenario','oletus');await kindBoxes(page,`English ${names[d]} oletus`,d);await sel(page,'scenario','oma');
   await noShift(page,entry(page),tid(page,'workspace-title'),`English ${names[d]}`,ITEMS.map(i=>tid(page,i)));
  }
  await pick(page,0);
  await sel(page,'scenario','oletus');
  ok((await entry(page).innerText()).replace(/\s+/g,' ').includes('Kalimba · default'),'English: the default');
  await sel(page,'scenario','auki');await waitOpen(page);
  ok((await tid(page,'wpick-default').innerText()).includes('Same as default'),'English: Same as default');
  ok((await tid(page,'wpreview-pisara').getAttribute('aria-label')).startsWith('Listen to'),'English: ▶ label');
  await shot(page,0,'en',tag);
  await sel(page,'language','fi');
 }
 await page.close();
}
// Phone flow: A's sound square opens the sheet; ▶ listens, a press chooses.
// Then English on a phone: whole values and no shift in every variant.
if(!quick){
 const page=await open(390,'light');
 await pick(page,0);
 await entry(page).click();await waitOpen(page);
 await tid(page,'wpreview-jaapuikot').click();await settle(page);
 eq((await lastPlay(page)).sound,'jaapuikot','phone: ▶ plays');
 eq(await tid(page,'wpick-pisara').getAttribute('aria-checked'),'true','phone: ▶ does not choose');
 await tid(page,'wpick-jaapuikot').click();await settle(page);
 await tid(page,'picker-done').click();await settle(page);
 ok((await entry(page).innerText()).includes('Jääpuikot'),'phone: the square follows');
 await sel(page,'language','en');
 for(let d=0;d<3;d++){
  await pick(page,d);
  await kindBoxes(page,`English phone ${names[d]}`,d);
  await noShift(page,entry(page),tid(page,'workspace-title'),`English phone ${names[d]}`,ITEMS.map(i=>tid(page,i)));
  await shot(page,d,'en','390-light');
 }
 await page.close();
}
eq(errors.length,0,`console errors: ${errors.join(' | ')}`);
console.log(`${checks} checks passed`);
}finally{await browser.close();}
