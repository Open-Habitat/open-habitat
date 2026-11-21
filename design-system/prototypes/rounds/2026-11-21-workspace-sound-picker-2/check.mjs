// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// First the round directory itself: no audio, image or HTML file and nothing
// over 100 KB. Then the three head directions at 1440 and 390 px in Päivä, Yö
// and Korkea kontrasti: on the default view (picker closed) the direction's
// own control shows kotisivu's Pisara with a large emblem (at least 40 px) and
// the other directions' controls are absent; aurinkokello says
// "Kalimba · oletus"; opened, the pop-up has Sama kuin oletus, ten emblems and
// eleven ▶ buttons, Pisara chosen, inside the viewport (a bottom sheet on a
// phone). No layout shift: in Settings and in every direction's head, the
// control that opened the pop-up, the pop-up itself and the row's name stay
// within half a pixel while the choice moves through values of different
// lengths. At 1440 Päivä each direction's flow: ▶ plays without choosing, a
// press chooses and plays, arrows move the choice, Valmis and Esc close and
// return focus; the rail's note is hidden until the row is hovered and opens
// the picker; B's Kuuntele plays; the length link, Pitkät, Äänet pois,
// "agent finished", English, a phone flow, and a clean console.
// Screenshots: v<n>-<dir>-<what>-<width>-<theme>.png.
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
const round='2026-11-21-workspace-sound-picker-2';
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
const names=['valitsin','kortti','nauha'];
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
const ENTRY=['entry-select','entry-card','entry-strip-sound'];
const SHOW=['entry-select','entry-card','entry-strip-sound'];
const entry=(page,d)=>tid(page,d===1?'entry-card-change':ENTRY[d]);
const rect=loc=>loc.evaluate(el=>{const r=el.getBoundingClientRect();return [r.x,r.y,r.width,r.height].map(v=>Math.round(v*2)/2);});
const same=(a,b,m)=>ok(a.every((v,i)=>Math.abs(v-b[i])<=0.5),`${m}: moved from ${a} to ${b}`);
// Choose values of different lengths and assert nothing moves.
async function noShift(page,trigger,label,at){
 await trigger.click();await waitOpen(page);await settle(page,300);
 const t0=await rect(trigger),p0=await rect(page.locator('.wq-popover')),l0=label?await rect(label):null;
 for(const c of ['default','jaapuikot','tunnus-puu','kuplat','lasit','pisara']){
  await tid(page,`wpick-${c}`).click();await settle(page,150);
  same(t0,await rect(trigger),`${at}: control after ${c}`);
  same(p0,await rect(page.locator('.wq-popover')),`${at}: pop-up after ${c}`);
  if(label)same(l0,await rect(label),`${at}: name after ${c}`);
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
  const show=tid(page,SHOW[d]);
  eq(await show.count(),1,`${at}: its control`);
  for(let o=0;o<3;o++)if(o!==d)eq(await tid(page,SHOW[o]).count(),0,`${at}: no ${SHOW[o]}`);
  eq(await emblemOf(show),em('pisara'),`${at}: Pisara's emblem`);
  ok((await show.innerText()).includes('Pisara'),`${at}: names Pisara`);
  const size=(await rect(show.locator('svg[data-emblem]').first()))[2];
  ok(size>=40,`${at}: the emblem is large (${size} px)`);
  ok(await show.locator('svg path[d^="M9 18V6"]').count()>0||await entry(page,d).locator('svg path[d^="M9 18V6"]').count()>0,`${at}: the note glyph`);
  if(width===1440)eq(await tid(page,'rail-note-kotisivu').count(),1,`${at}: rail note in the row`);
  ok(await fits(page),`${at}: document overflow`);
  await shot(page,d,'oma',tag);
  await sel(page,'scenario','oletus');
  ok((await tid(page,SHOW[d]).innerText()).includes('Kalimba'),`${at}: default names Kalimba`);
  ok((await tid(page,SHOW[d]).innerText()).includes(d===1?'oletus':'Kalimba · oletus'),`${at}: says it is the default`);
  eq(await emblemOf(tid(page,SHOW[d])),em('kalimba'),`${at}: Kalimba's emblem`);
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
   await noShift(page,entry(page,d),tid(page,'workspace-title'),`${names[d]} head ${tag}`);
  }
 }
 // Each direction's flow once, on the desktop in Päivä.
 if(width===1440&&theme==='light'){
  for(let d=0;d<3;d++){
   await pick(page,d);
   const at=`${names[d]} flow`;
   await entry(page,d).click();await waitOpen(page);
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
   ok((await tid(page,SHOW[d]).innerText()).includes(d===1?'Sama kuin oletusäänesi':'Kalimba · oletus'),`${at}: the control follows to the default`);
   await entry(page,d).click();await waitOpen(page);
   await page.keyboard.press('Escape');await settle(page);
   ok(!await isOpen(page),`${at}: Esc closes`);
   ok(await entry(page,d).evaluate(el=>el===document.activeElement),`${at}: focus back on the control`);
  }
  // The rail's note: hidden until the row is hovered, then it opens the picker.
  await pick(page,0);
  await page.mouse.move(900,700);await settle(page);
  const note=tid(page,'rail-note-aurinkokello');
  eq(await note.evaluate(el=>getComputedStyle(el).opacity),'0','rail note hidden without hover');
  await page.getByTestId('workspace-aurinkokello').hover();await settle(page,300);
  eq(await note.evaluate(el=>getComputedStyle(el).opacity),'1','rail note shows on hover');
  await note.click();await waitOpen(page);
  eq(await dialog(page).getAttribute('data-repo'),'aurinkokello','rail note opens aurinkokello\'s picker');
  await tid(page,'wpick-kuplat').click();await settle(page);
  await page.keyboard.press('Escape');await settle(page);
  eq(await page.locator('.wq-review').getAttribute('data-view'),'workspace','rail note keeps the workspace view');
  await shot(page,0,'sivupalkki',tag);
  // B's Listen plays the workspace's sound and ripples the card.
  await pick(page,1);
  await tid(page,'card-listen').click();await settle(page);
  eq((await lastPlay(page)).sound,'pisara','B: Kuuntele plays Pisara');
  ok(await tid(page,'entry-card').locator('.rq-ripple').count()>0,'B: the card ripples');
  // C's other strip buttons are present but not part of this round.
  await pick(page,2);
  eq(await tid(page,'strip-icon').count()+await tid(page,'strip-name').count(),2,'C: Kuvake and Nimi in the strip');
  await pick(page,0);
  // The length link in the pop-up goes to Settings.
  await entry(page,0).click();await waitOpen(page);await tid(page,'picker-settings').click();await settle(page,400);
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
  ok(await tid(page,'entry-select').locator('.rq-ripple').count()>0,'the head emblem ripples when its workspace rings');
  await tid(page,'sim-aurinkokello').click();await settle(page);
  eq(await page.evaluate(()=>window.__rqSim.at(-1).sound),'kalimba','a default workspace plays the default');
  // English
  await sel(page,'language','en');
  ok((await tid(page,'entry-select').innerText()).includes('Drop'),'English: sound name');
  await sel(page,'scenario','oletus');
  ok((await tid(page,'entry-select').innerText()).includes('Kalimba · default'),'English: the default');
  await sel(page,'scenario','auki');await waitOpen(page);
  ok((await tid(page,'wpick-default').innerText()).includes('Same as default'),'English: Same as default');
  ok((await tid(page,'wpreview-pisara').getAttribute('aria-label')).startsWith('Listen to'),'English: ▶ label');
  await shot(page,0,'en',tag);
  await sel(page,'language','fi');
 }
 await page.close();
}
// Phone flow: A's selector opens the sheet; ▶ listens, a press chooses.
if(!quick){
 const page=await open(390,'light');
 await pick(page,0);
 await tid(page,'entry-select').click();await waitOpen(page);
 await tid(page,'wpreview-jaapuikot').click();await settle(page);
 eq((await lastPlay(page)).sound,'jaapuikot','phone: ▶ plays');
 eq(await tid(page,'wpick-pisara').getAttribute('aria-checked'),'true','phone: ▶ does not choose');
 await tid(page,'wpick-jaapuikot').click();await settle(page);
 await tid(page,'picker-done').click();await settle(page);
 ok((await tid(page,'entry-select').innerText()).includes('Jääpuikot'),'phone: selector follows');
 await page.close();
}
eq(errors.length,0,`console errors: ${errors.join(' | ')}`);
console.log(`${checks} checks passed`);
}finally{await browser.close();}
