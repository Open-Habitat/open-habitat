// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Walks the three directions in every situation at 1440 and 390 px, light
// and dark: no document overflow, the direction's line marked, production's
// Settings with the Sounds section current, the placeholder tag, the notes
// each situation shows (off, muted, browser gate, read error) and the own
// sounds list or its empty line. Then at 1440 light it clicks each
// direction: choose a sound (plays and selects), listen, turn the sound off
// (choices disabled, listening still plays), mute this device, change the
// "conversation in view" rule, the browser gate opened by Test sound, the
// volume by keyboard, a later-round link, the read error's reload, English,
// and one flow at 390 px. Screenshots at device scale 2 named
// v<n>-<direction>-<situation>-<width>-<theme>.png; --quick takes 1440 light.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-17-attention-sound-settings';
const [input,out,flag]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <out-dir> [--quick]');process.exit(2);}
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required'],...(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{})});
const html=readFileSync(input,'utf8');
const names=['lista','valikko','laatat'];
const A=0,B=1,C=2;
const scenarios=['oletus','pois','mykistetty','estetty','ei-omia','lukuvirhe'];
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};

async function open(width,theme){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:900},deviceScaleFactor:2,reducedMotion:'reduce',hasTouch:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 await ready(page);
 return page;
}
const settle=page=>page.waitForTimeout(200);
const tid=(page,id)=>page.getByTestId(id);
const ready=async page=>{await page.locator('.rq-section [data-testid^="direction-"]').waitFor();await settle(page);};
const pick=async(page,d)=>{await page.locator('.proto-picker-item').nth(d).click();await page.locator(`.rq-review[data-direction="${d}"]`).waitFor({state:'attached'});await ready(page);};
const sel=async(page,id,v)=>{await page.locator(`#${id}`).selectOption(v);await ready(page);};
const shot=(page,d,c,tag)=>page.screenshot({path:`${out}/v${d+1}-${names[d]}-${c}-${tag}.png`,fullPage:false});
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const plays=page=>page.evaluate(()=>window.__rqPlays.length);
const lastPlay=page=>page.evaluate(()=>window.__rqPlays.at(-1));
const shown=async(page,id)=>(await tid(page,id).count())>0&&await tid(page,id).first().isVisible();
const testIdDir=['direction-a','direction-b','direction-c'];

try{
for(const width of quick?[1440]:[1440,390])for(const theme of quick?['light']:['light','dark']){
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
   eq(await tid(page,testIdDir[d]).count(),1,`${at}: the direction's body`);
   eq((await tid(page,'settings-section-aanet').innerText()).trim(),'Äänet',`${at}: production's h2`);
   if(width===1440)eq(await tid(page,'settings-aanet').getAttribute('aria-current'),'page',`${at}: Sounds is the current section`);
   ok(await shown(page,'placeholder-tag'),`${at}: placeholder tag`);
   ok(await tid(page,'sound-test').count()===1,`${at}: one test button`);
   eq(await shown(page,'note-off'),s==='pois',`${at}: off note`);
   eq(await shown(page,'note-muted'),s==='mykistetty',`${at}: muted note`);
   eq(await shown(page,'note-blocked'),s==='estetty',`${at}: browser gate note`);
   eq(await shown(page,'sound-read-error'),s==='lukuvirhe',`${at}: read error`);
   eq(await tid(page,'own-empty').count(),s==='ei-omia'?1:0,`${at}: own sounds empty line`);
   eq(await tid(page,'own-off').count(),s==='pois'?1:0,`${at}: own sounds silent when off`);
   ok(await tid(page,'own-how').count()===1,`${at}: where own sounds are set`);
   if(s==='pois'||s==='lukuvirhe'){
    const picker=d===B?tid(page,'sound-menu'):tid(page,'pick-s1');
    ok(await picker.isDisabled(),`${at}: default sound choice disabled`);
   }
   if(s==='mykistetty')ok(await tid(page,'device-volume').locator('input').isDisabled(),`${at}: volume disabled while muted`);
   await shot(page,d,s,tag);
  }
 }
 await page.close();
}

// Flows at 1440 light.
const page=await open(1440,'light');
for(const d of [A,B,C]){
 const at=names[d];
 await pick(page,d);await sel(page,'scenario','oletus');
 let n=await plays(page);
 if(d===B){
  await tid(page,'sound-menu').click();
  await page.getByRole('menuitemradio',{name:'Lasi'}).or(page.getByRole('menuitem',{name:'Lasi'})).first().click();await settle(page);
  eq(await tid(page,'sound-menu').getAttribute('data-value'),'s5',`${at}: Lasi chosen from the menu`);
 }else{
  await tid(page,'pick-s5').click();await settle(page);
  eq(await tid(page,'pick-s5').getAttribute('aria-checked'),'true',`${at}: Lasi chosen`);
 }
 eq(await plays(page),n+1,`${at}: choosing plays the sound`);
 eq((await lastPlay(page)).sound,'s5',`${at}: it played Lasi`);
 ok(await tid(page,'rq-toast').isVisible(),`${at}: the review shows what played`);
 await tid(page,'listen-s5').first().click();
 eq(await plays(page),n+2,`${at}: listen plays`);
 // The rule for the conversation in view.
 await tid(page,'sound-watch').click();
 await page.getByRole('menuitemradio',{name:/Soi vain, kun Habitat on piilossa/}).or(page.getByRole('menuitem',{name:/Soi vain, kun Habitat on piilossa/})).first().click();await settle(page);
 eq(await tid(page,'sound-watch').getAttribute('data-value'),'hidden',`${at}: rule changed`);
 // Volume by keyboard, then test plays at that volume.
 await tid(page,'device-volume').locator('input').focus();
 await page.keyboard.press('ArrowLeft');await page.keyboard.press('ArrowLeft');await tid(page,'sound-test').focus();await settle(page);
 await tid(page,'sound-test').click();
 eq((await lastPlay(page)).volume,50,`${at}: test plays at the device volume`);
 // Mute this device.
 await tid(page,'device-mute').getByTestId('segment-muted').click();await settle(page);
 ok(await shown(page,'note-muted'),`${at}: muted note`);
 await tid(page,'device-mute').getByTestId('segment-plays').click();await settle(page);
 // Off for every device: choices disabled, listening still plays.
 await tid(page,'sound-on').getByTestId('segment-off').click();await settle(page);
 ok(await shown(page,'note-off'),`${at}: off note`);
 ok(await tid(page,'event-done').locator('input').isDisabled(),`${at}: events disabled when off`);
 n=await plays(page);await tid(page,'sound-test').click();
 eq(await plays(page),n+1,`${at}: test still plays when off`);
 await shot(page,d,'pois-flow','1440-light');
 await tid(page,'sound-on').getByTestId('segment-on').click();await settle(page);
 // Own sounds: B folds them; the links say later rounds.
 if(d===B){await tid(page,'own-toggle').click();await settle(page);ok(await tid(page,'own-list').isVisible(),`${at}: own list opens`);}
 await tid(page,'own-open-workspace').first().click();
 ok((await tid(page,'rq-toast').innerText()).includes('myöhemmillä'),`${at}: later-round link`);
 await shot(page,d,'omat-flow','1440-light');
 // The browser gate: Test sound allows it.
 await sel(page,'scenario','estetty');
 await tid(page,'sound-test').click();await settle(page);
 eq(await tid(page,'note-blocked').count(),0,`${at}: gate closed by the press`);
 ok(await shown(page,'note-allowed'),`${at}: allowed said`);
 // Read error: device works, reload recovers.
 await sel(page,'scenario','lukuvirhe');
 await tid(page,'device-mute').getByTestId('segment-muted').click();await settle(page);
 ok(await shown(page,'note-muted'),`${at}: this device's mute works while the personal file is unreadable`);
 await tid(page,'sound-read-error-reload').click();await settle(page);
 eq(await tid(page,'sound-read-error').count(),0,`${at}: reload recovers`);
}
// English.
await sel(page,'language','en');
for(const d of [A,B,C]){
 await pick(page,d);await sel(page,'scenario','oletus');
 eq((await tid(page,'settings-section-aanet').innerText()).trim(),'Sounds',`${names[d]}: English h2`);
 ok((await tid(page,testIdDir[d]).textContent()).includes('Default sound'),`${names[d]}: English body`);
 await shot(page,d,'oletus-en','1440-light');
}
await sel(page,'language','fi');
await page.close();
// One flow at 390 px.
const phone=await open(390,'light');
await pick(phone,A);
await tid(phone,'pick-s2').scrollIntoViewIfNeeded();await tid(phone,'pick-s2').click();await settle(phone);
eq(await tid(phone,'pick-s2').getAttribute('aria-checked'),'true','phone: Kello chosen');
await tid(phone,'sound-test').scrollIntoViewIfNeeded();
await tid(phone,'device-mute').getByTestId('segment-muted').click();await settle(phone);
ok(await fits(phone),'phone: muted note fits');
await shot(phone,A,'mykistys-flow','390-light');
await phone.close();
}finally{await browser.close();}
assert.deepEqual(errors,[],`console: ${errors.join('\n')}`);
console.log(`${checks} checks, console clean`);
