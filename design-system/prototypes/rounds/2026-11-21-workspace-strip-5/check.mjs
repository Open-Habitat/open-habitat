// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// First the round directory itself: no audio, image or HTML file and nothing
// over 100 KB. Then both variants (A Ponnahdus, B Paikallaan) at 1440 and
// 390 px in Päivä, Yö and Korkea kontrasti:
// - the strip is A Yksi rivi: Kuvake–Nimi–Ääni in one row of one height, the
//   squares equal and square, Nimi flat; Kuvake shows the workspace's real
//   icon (production WorkspaceIcon) and where it comes from, Ääni the final
//   emblem; the rail rows carry the same icons; nothing clipped;
// - Kuvake opens production's icon editor (workspace-icon-dialog), Nimi the
//   rename (a pop-up in A, the field in Nimi's own box in B), Ääni the sound
//   picker with the ten final emblems; each inside the viewport, a bottom
//   sheet on a phone, and opening any of them moves no strip button;
// - no layout shift (Päivä, both widths, Finnish and English): choosing
//   icons of each kind, renaming to short, long and empty names, and choosing
//   sounds of different lengths keep all three strip buttons, the heading
//   and the open pop-up within half a pixel;
// - flows at 1440 Päivä: the icon editor's emoji grid, letters, an invalid
//   own emoji and the model footer; rename by Enter, Tallenna, Esc, Peru and
//   (B) a click elsewhere, with the heading, rail and focus following; the
//   sound picker's ▶, press and Esc; English words; a phone flow; and a clean
//   console.
// Screenshots: v<n>-<variant>-<what>-<width>-<theme>.png.
import {createRequire} from 'node:module';
import {dirname,resolve,join,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync,readdirSync,statSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-21-workspace-strip-5';
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
// Jari 21.11. on emblem round 7.
const FINAL={kalimba:2,marimba:1,vibrafoni:2,'tunnus-puu':0,pisara:0,lasit:2,tuulikello:0,kuplat:0,kulho:2,jaapuikot:3};
const em=id=>`${id}-${FINAL[id]}`;

const browser=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required'],...(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{})});
const html=readFileSync(input,'utf8');
const names=['ponnahdus','paikallaan'];
const settle=(page,ms=250)=>page.waitForTimeout(ms);
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
const tid=(page,id)=>page.getByTestId(id);
const visible=async loc=>(await loc.count())>0&&await loc.first().isVisible();
const pick=async(page,d)=>{await page.keyboard.press('Escape');await page.locator('.proto-picker-item').nth(d).click();await page.locator(`.rq-review[data-direction="${d}"]`).waitFor({state:'attached'});await settle(page,400);};
const sel=async(page,id,v)=>{await page.keyboard.press('Escape');await page.locator(`#${id}`).selectOption(v);await settle(page,450);};
const shot=(page,d,what,tag)=>page.screenshot({path:`${out}/v${d+1}-${names[d]}-${what}-${tag}.png`});
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const lastPlay=page=>page.evaluate(()=>window.__rqPlays.at(-1));
const hostState=page=>page.evaluate(()=>window.__rqHost());
const emblemOf=loc=>loc.locator('svg[data-emblem]').first().getAttribute('data-emblem');
const SOUND='entry-strip-sound';
const ITEMS=['strip-icon','strip-name',SOUND];
const rect=loc=>loc.evaluate(el=>{const r=el.getBoundingClientRect();return [r.x,r.y,r.width,r.height].map(v=>Math.round(v*2)/2);});
const same=(a,b,m)=>ok(a.every((v,i)=>Math.abs(v-b[i])<=0.5),`${m}: moved from ${a} to ${b}`);
const boxes=page=>Promise.all(ITEMS.map(i=>rect(tid(page,i))));
const sameBoxes=async(page,b0,m)=>{const b=await boxes(page);for(let i=0;i<3;i++)same(b0[i],b[i],`${m}: ${ITEMS[i]}`);};
const iconDialog=page=>tid(page,'workspace-icon-dialog');
const renameOpen=async(page,d)=>d===0?visible(tid(page,'rename-dialog')):(await tid(page,'strip-name').getAttribute('data-editing'))==='true';
const openRename=async(page,d)=>{await tid(page,'strip-name').click();await settle(page,300);ok(await renameOpen(page,d),`${names[d]}: Nimi opens the rename`);};
const nameInput=page=>tid(page,'workspace-name');
async function rename(page,d,value,how='enter'){
 await openRename(page,d);
 await nameInput(page).fill(value);
 if(how==='enter')await nameInput(page).press('Enter');
 else if(how==='save')await tid(page,'save-workspace-name').click();
 else if(how==='esc')await nameInput(page).press('Escape');
 else if(how==='cancel')await tid(page,'rename-cancel').click();
 else if(how==='outside')await page.locator('.wq-convs').click();
 await settle(page,300);
}
async function kindBoxes(page,at){
 const b=await boxes(page);
 const [ic,nm,so]=b;
 ok(Math.abs(ic[2]-so[2])<=0.5&&Math.abs(ic[3]-so[3])<=0.5,`${at}: Kuvake ${ic} and Ääni ${so} differ`);
 ok(Math.abs(so[2]-so[3])<=0.5,`${at}: Ääni is not square (${so[2]}×${so[3]})`);
 ok(nm[2]>=1.15*nm[3]||nm[2]>so[2],`${at}: Nimi is not flat (${nm[2]}×${nm[3]})`);
 ok(nm[2]>so[2],`${at}: Nimi is not wider than the squares`);
 ok(ic[0]<nm[0]&&nm[0]<so[0],`${at}: order Kuvake–Nimi–Ääni`);
 ok(b.every(r=>Math.abs(r[1]-ic[1])<=0.5&&Math.abs(r[3]-ic[3])<=0.5),`${at}: one row of one height`);
 for(const i of ITEMS){
  const vals=tid(page,i).locator('.wq-stable-value, .wq-name-value:not(input)');
  for(const v of await vals.all()){
   const s=await v.evaluate(el=>[el.scrollWidth,el.clientWidth,el.scrollHeight,el.clientHeight]);
   ok(s[0]<=s[1]+1&&s[2]<=s[3]+1,`${at}: ${i} value clipped (${s})`);
  }
  const inside=await tid(page,i).evaluate(el=>{const r=el.getBoundingClientRect();return [...el.querySelectorAll('.wq-strip-label,.wq-stable-value,.wq-name-value,.ah-wsi,.rq-emblem')].every(c=>{const q=c.getBoundingClientRect();return q.left>=r.left-0.5&&q.right<=r.right+0.5&&q.top>=r.top-0.5&&q.bottom<=r.bottom+0.5;});});
  ok(inside,`${at}: ${i} content spills out of its button`);
 }
 return b;
}
async function inViewport(page,loc,at,width){
 const box=await loc.boundingBox();
 ok(box&&box.x>=-0.5&&box.x+box.width<=width+1,`${at}: inside the viewport`);
 if(width===390)ok(Math.abs(box.y+box.height-844)<2&&box.width>=388,`${at}: a sheet from the bottom edge (${box.y}+${box.height})`);
}
// The strip and the heading stay put while values of different lengths come and go.
async function noShiftAll(page,d,at){
 const b0=await boxes(page),h0=await rect(tid(page,'workspace-title').locator('xpath=..'));
 // Icons of each kind, from production's editor.
 for(const step of [['emoji','🦉'],['letters','AB'],['auto'],['emoji','🌻']]){
  await tid(page,'workspace-icon-picker').click();await iconDialog(page).waitFor({state:'visible'});
  const p0=await rect(page.locator('.ah-wsip-popover'));
  if(step[0]==='emoji'){
   const e=page.locator(`[data-testid="workspace-icon-emoji"][aria-label="${step[1]}"]`);
   await e.click();
  }else if(step[0]==='letters'){
   await tid(page,'workspace-icon-letters-input').fill(step[1]);
   same(p0,await rect(page.locator('.ah-wsip-popover')),`${at}: icon pop-up while typing letters`);
   await tid(page,'workspace-icon-letters-input').press('Enter');
  }else await tid(page,'workspace-icon-auto').click();
  await settle(page,250);
  ok(!await visible(iconDialog(page)),`${at}: a choice closes the icon editor`);
  await sameBoxes(page,b0,`${at}: after icon ${step.join(' ')}`);
  same(h0,await rect(tid(page,'workspace-title').locator('xpath=..')),`${at}: heading after icon ${step.join(' ')}`);
 }
 // Display names of different lengths, and the empty name.
 for(const n of ['Asiakkaan verkkokauppa','x','','kotisivu']){
  await openRename(page,d);
  await sameBoxes(page,b0,`${at}: rename open`);
  const p0=d===0?await rect(page.locator('.wq-name-popover')):null;
  await nameInput(page).fill(n);
  if(p0)same(p0,await rect(page.locator('.wq-name-popover')),`${at}: rename pop-up while typing`);
  await sameBoxes(page,b0,`${at}: while typing "${n}"`);
  await nameInput(page).press('Enter');await settle(page,250);
  ok(!await renameOpen(page,d),`${at}: Enter saves and closes`);
  await sameBoxes(page,b0,`${at}: after renaming to "${n}"`);
  eq((await tid(page,'workspace-title').innerText()).trim(),n.trim()||'kotisivu',`${at}: heading follows "${n}"`);
  const v=await tid(page,'name-value').evaluate(el=>[el.scrollHeight,el.clientHeight]);
  ok(v[0]<=v[1]+1,`${at}: the name "${n}" shows whole in Nimi (${v})`);
 }
 // Sounds of different lengths.
 await tid(page,SOUND).click();await tid(page,'sound-picker').waitFor({state:'visible'});
 const p0=await rect(page.locator('.wq-popover'));
 for(const c of ['default','jaapuikot','tunnus-puu','kuplat','lasit','pisara']){
  await tid(page,`wpick-${c}`).click();await settle(page,150);
  await sameBoxes(page,b0,`${at}: after sound ${c}`);
  same(p0,await rect(page.locator('.wq-popover')),`${at}: sound pop-up after ${c}`);
 }
 await page.keyboard.press('Escape');await settle(page);
}

try{
for(const width of quick?[1440]:[1440,390])for(const theme of quick?['light']:['light','dark','contrast']){
 const tag=`${width}-${theme}`;
 const page=await open(width,theme);
 await checkPicker(page,round);
 eq(await tid(page,'recommendation').count(),1,'the recommendation is on the page');
 eq(await page.locator('.rq-lines li').count(),2,'one line per variant');
 for(let d=0;d<2;d++){
  await pick(page,d);
  const at=`${names[d]} ${tag}`;
  eq(await tid(page,'entry-strip').getAttribute('data-mode'),['popup','inline'][d],`${at}: its variant`);
  eq(await page.locator('.rq-lines li[aria-current]').count(),1,`${at}: its line is marked`);
  ok(!await visible(iconDialog(page))&&!await renameOpen(page,d)&&!await visible(tid(page,'sound-picker')),`${at}: nothing open on the default view`);
  // Kuvake: the real icon, its kind, and the real trigger covering the square.
  const icon=tid(page,'strip-icon');
  eq((await icon.locator('.ah-wsi').innerText()).trim(),'🌻',`${at}: kotisivu's emoji icon`);
  eq(await icon.getAttribute('data-icon-kind'),'emoji',`${at}: icon kind`);
  ok((await icon.innerText()).includes('Emoji'),`${at}: says Emoji`);
  same(await rect(icon),await rect(icon.locator('.ah-wsip-head')),`${at}: the editor's trigger covers the square`);
  eq((await page.locator('.ah-workspace-row[data-selected] .ah-wsi').innerText()).trim(),'🌻',`${at}: the rail row shows the icon`);
  eq(await page.locator('.ah-workspace-page-head .ah-wsip-head').count(),0,`${at}: the head's icon is a picture, not a second editor`);
  eq(await page.locator('[data-testid="rename-workspace"]').count(),0,`${at}: no second rename button in the head`);
  eq(await emblemOf(tid(page,SOUND)),em('pisara'),`${at}: Pisara's final emblem`);
  ok((await tid(page,'name-value').innerText()).trim()==='kotisivu',`${at}: Nimi shows the name`);
  const b0=await kindBoxes(page,`${at} oma`);
  if(width===390)ok(b0[2][0]+b0[2][2]<=width,`${at}: the whole strip visible on a phone`);
  ok(await fits(page),`${at}: document overflow`);
  await shot(page,d,'oma',tag);
  // aurinkokello: name-derived letters and the default sound, same boxes.
  await sel(page,'scenario','oletus');
  eq(await tid(page,'strip-icon').getAttribute('data-icon-kind'),'derived',`${at}: derived icon`);
  eq((await tid(page,'strip-icon').locator('.ah-wsi').innerText()).trim(),'AU',`${at}: derived letters`);
  ok((await tid(page,SOUND).innerText()).replace(/\s+/g,' ').includes('Kalimba · oletus'),`${at}: Kalimba · oletus`);
  eq(await emblemOf(tid(page,SOUND)),em('kalimba'),`${at}: Kalimba's final emblem`);
  const b1=await kindBoxes(page,`${at} oletus`);
  for(let i=0;i<3;i++)same(b0[i],b1[i],`${at}: ${ITEMS[i]} from kotisivu to aurinkokello`);
  await shot(page,d,'oletus',tag);
  // Each editor opened by its scenario.
  await sel(page,'scenario','kuvake');await iconDialog(page).waitFor({state:'visible'});
  ok(await visible(tid(page,'workspace-icon-auto'))&&await page.locator('[data-testid="workspace-icon-emoji"]').count()>=24,`${at}: production's icon editor`);
  eq(await page.locator('[data-testid="workspace-icon-emoji"][aria-pressed="true"]').count(),1,`${at}: the current emoji pressed`);
  await inViewport(page,page.locator('.ah-wsip-popover'),`${at} icon editor`,width);
  await sameBoxes(page,b0,`${at}: icon editor open`);
  ok(await fits(page),`${at}: icon editor, document overflow`);
  await shot(page,d,'kuvake',tag);
  await sel(page,'scenario','nimi');
  ok(await renameOpen(page,d),`${at}: rename open`);
  eq(await nameInput(page).inputValue(),'kotisivu',`${at}: the field holds the name`);
  ok(await nameInput(page).evaluate(el=>el===document.activeElement),`${at}: the field has focus`);
  await sameBoxes(page,b0,`${at}: rename open`);
  if(d===0){
   await inViewport(page,page.locator('.wq-name-popover'),`${at} rename pop-up`,width);
   ok((await tid(page,'rename-dialog').innerText()).includes('Muuta näyttönimeä'),`${at}: production's rename title`);
  }else{
   const r=await rect(nameInput(page)),n=await rect(tid(page,'strip-name'));
   ok(r[0]>=n[0]&&r[0]+r[2]<=n[0]+n[2]+0.5,`${at}: the field fits in Nimi's box`);
  }
  ok(await fits(page),`${at}: rename, document overflow`);
  await shot(page,d,'nimi',tag);
  await sel(page,'scenario','aani');await tid(page,'sound-picker').waitFor({state:'visible'});
  eq(await page.locator('.wq-tile').count(),10,`${at}: ten sounds`);
  for(const id of Object.keys(FINAL))eq(await emblemOf(tid(page,`wpick-${id}`)),em(id),`${at}: ${id}'s final emblem in the picker`);
  eq(await tid(page,'wpick-pisara').getAttribute('aria-checked'),'true',`${at}: Pisara chosen`);
  await inViewport(page,page.locator('.wq-popover'),`${at} sound picker`,width);
  await sameBoxes(page,b0,`${at}: sound picker open`);
  await shot(page,d,'aani',tag);
  await sel(page,'scenario','pitka');
  eq((await tid(page,'workspace-title').innerText()).trim(),'Asiakkaan verkkokauppa',`${at}: the long display name`);
  const b2=await kindBoxes(page,`${at} pitka`);
  for(let i=0;i<3;i++)same(b0[i],b2[i],`${at}: ${ITEMS[i]} with the long name`);
  await shot(page,d,'pitka',tag);
  await sel(page,'scenario','oma');
 }
 if(theme==='light')for(let d=0;d<2;d++){await pick(page,d);await noShiftAll(page,d,`${names[d]} no-shift ${tag}`);}
 if(width===1440&&theme==='light'){
  for(let d=0;d<2;d++){
   await pick(page,d);
   const at=`${names[d]} flow`;
   // Rename: Enter, Tallenna, Esc, Peru, and in B a click elsewhere.
   await rename(page,d,'Kotisivu 2027');
   eq((await tid(page,'workspace-title').innerText()).trim(),'Kotisivu 2027',`${at}: Enter saves`);
   eq(await page.locator('.ah-workspace-row[data-selected] [data-workspace-name]').getAttribute('data-workspace-name'),'Kotisivu 2027',`${at}: the rail follows`);
   ok(await tid(page,'strip-name').evaluate(el=>el===document.activeElement),`${at}: focus back on Nimi`);
   eq((await tid(page,'workspace-title').locator('xpath=following-sibling::p').innerText()).trim(),'~/src/kotisivu',`${at}: the folder stays`);
   await rename(page,d,'Ei tallennu','esc');
   eq((await tid(page,'workspace-title').innerText()).trim(),'Kotisivu 2027',`${at}: Esc cancels`);
   ok(await tid(page,'strip-name').evaluate(el=>el===document.activeElement),`${at}: focus back on Nimi after Esc`);
   await rename(page,d,'Ei tallennu','cancel');
   eq((await tid(page,'workspace-title').innerText()).trim(),'Kotisivu 2027',`${at}: Peru cancels`);
   await rename(page,d,'Tallenna-painike','save');
   eq((await tid(page,'workspace-title').innerText()).trim(),'Tallenna-painike',`${at}: Tallenna saves`);
   if(d===1){
    await rename(page,d,'Muualle klikkaus','outside');
    eq((await tid(page,'workspace-title').innerText()).trim(),'Muualle klikkaus',`${at}: a click elsewhere saves`);
   }
   await rename(page,d,'');
   eq((await hostState(page)).names.kotisivu,undefined,`${at}: an empty name clears the display name`);
   // Production's icon editor: grid, letters, invalid own emoji, model footer.
   await tid(page,'workspace-icon-picker').click();await iconDialog(page).waitFor({state:'visible'});
   await tid(page,'workspace-icon-own').fill('abc');await tid(page,'workspace-icon-own-use').click();await settle(page);
   ok((await iconDialog(page).innerText()).includes('Kelpaa yksi emoji.'),`${at}: an invalid own emoji is refused`);
   await tid(page,'workspace-icon-own').fill('🧮');await tid(page,'workspace-icon-own-use').click();await settle(page);
   eq((await hostState(page)).icons.kotisivu,'🧮',`${at}: own emoji saved`);
   eq((await tid(page,'strip-icon').locator('.ah-wsi').innerText()).trim(),'🧮',`${at}: the square follows`);
   eq((await page.locator('.ah-workspace-page-head .wq-head-icon .ah-wsi').innerText()).trim(),'🧮',`${at}: the head follows`);
   eq((await page.locator('.ah-workspace-row[data-selected] .ah-wsi').innerText()).trim(),'🧮',`${at}: the rail follows`);
   await tid(page,'workspace-icon-picker').click();await iconDialog(page).waitFor({state:'visible'});
   await tid(page,'workspace-icon-letters-input').fill('ks');await settle(page,100);
   eq((await tid(page,'workspace-icon-letters').innerText()).trim(),'KS',`${at}: letters preview`);
   await tid(page,'workspace-icon-letters').click();await settle(page);
   eq((await hostState(page)).icons.kotisivu,'KS',`${at}: letters saved`);
   ok((await tid(page,'strip-icon').innerText()).includes('Kirjaimet'),`${at}: says Kirjaimet`);
   await tid(page,'workspace-icon-picker').click();await iconDialog(page).waitFor({state:'visible'});
   await tid(page,'workspace-icon-ask-model').click();await settle(page);
   ok(!await visible(iconDialog(page)),`${at}: the model footer closes the editor`);
   await tid(page,'workspace-icon-picker').click();await iconDialog(page).waitFor({state:'visible'});
   await page.keyboard.press('Escape');await settle(page);
   ok(!await visible(iconDialog(page)),`${at}: Esc closes the icon editor`);
   ok(await tid(page,'workspace-icon-picker').evaluate(el=>el===document.activeElement),`${at}: focus back on Kuvake`);
   // The sound picker, as in round 4.
   await tid(page,SOUND).click();await tid(page,'sound-picker').waitFor({state:'visible'});
   await tid(page,'wpreview-marimba').click();await settle(page);
   eq((await lastPlay(page)).sound,'marimba',`${at}: ▶ plays`);
   eq(await tid(page,'wpick-pisara').getAttribute('aria-checked'),'true',`${at}: ▶ does not choose`);
   await tid(page,'wpick-marimba').click();await settle(page);
   eq(await tid(page,'wpick-marimba').getAttribute('aria-checked'),'true',`${at}: press chooses`);
   await page.keyboard.press('Escape');await settle(page);
   ok(await tid(page,SOUND).evaluate(el=>el===document.activeElement),`${at}: focus back on Ääni`);
   ok((await tid(page,SOUND).innerText()).includes('Marimba'),`${at}: the square follows`);
   await sel(page,'scenario','oma');
  }
  await tid(page,'sim-kotisivu').click();await settle(page);
  eq(await page.evaluate(()=>window.__rqSim.at(-1).sound),'pisara','agent finished plays the workspace sound');
  ok(await tid(page,SOUND).locator('.rq-ripple').count()>0,'the strip emblem ripples');
  // English
  await sel(page,'language','en');
  for(let d=0;d<2;d++){
   await pick(page,d);
   const txt=(await tid(page,'entry-strip').innerText()).replace(/\s+/g,' ');
   ok(txt.includes('Icon')&&txt.includes('Name')&&txt.includes('Sound')&&txt.includes('Drop'),`English ${names[d]}: strip words`);
   await kindBoxes(page,`English ${names[d]}`);
   await noShiftAll(page,d,`English ${names[d]}`);
   await openRename(page,d);
   if(d===0)ok((await tid(page,'rename-dialog').innerText()).includes('Change display name'),'English: rename title');
   else eq(await nameInput(page).evaluate(el=>el.labels[0].getAttribute('aria-label')),'Display name','English: inline field name');
   await shot(page,d,'en-nimi',tag);
   await page.keyboard.press('Escape');await settle(page);
   await tid(page,'workspace-icon-picker').click();await iconDialog(page).waitFor({state:'visible'});
   ok((await iconDialog(page).innerText()).includes('Workspace icon'),'English: icon editor');
   await page.keyboard.press('Escape');await settle(page);
  }
  await sel(page,'language','fi');
 }
 await page.close();
}
// Phone: each variant renames, picks an icon and a sound; English no-shift.
if(!quick){
 const page=await open(390,'light');
 for(let d=0;d<2;d++){
  await pick(page,d);
  await rename(page,d,'Puhelimelta');
  eq((await tid(page,'workspace-title').innerText()).trim(),'Puhelimelta',`phone ${names[d]}: rename saves`);
  await tid(page,'workspace-icon-picker').click();await iconDialog(page).waitFor({state:'visible'});
  await page.locator('[data-testid="workspace-icon-emoji"][aria-label="🐙"]').click();await settle(page);
  eq((await tid(page,'strip-icon').locator('.ah-wsi').innerText()).trim(),'🐙',`phone ${names[d]}: icon chosen`);
  await tid(page,SOUND).click();await tid(page,'sound-picker').waitFor({state:'visible'});
  await tid(page,'wpick-jaapuikot').click();await settle(page);
  await tid(page,'picker-done').click();await settle(page);
  ok((await tid(page,SOUND).innerText()).includes('Jääpuikot'),`phone ${names[d]}: the square follows`);
  await kindBoxes(page,`phone ${names[d]} after edits`);
  await sel(page,'scenario','oma');
 }
 await sel(page,'language','en');
 for(let d=0;d<2;d++){
  await pick(page,d);
  await kindBoxes(page,`English phone ${names[d]}`);
  await noShiftAll(page,d,`English phone ${names[d]}`);
  await shot(page,d,'en','390-light');
 }
 await page.close();
}
eq(errors.length,0,`console errors: ${errors.join(' | ')}`);
console.log(`${checks} checks passed`);
}finally{await browser.close();}
