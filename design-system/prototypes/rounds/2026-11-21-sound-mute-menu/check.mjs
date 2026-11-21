// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Walks the three directions in every situation at 1440 and 390 px, light
// and dark: the account menu opens by itself with the direction's sound row,
// the state line says what silences this device (plays, this device, off on
// every device, night), the avatar mark shows only for a muted device (A, C),
// B's speaker is on the default view, nothing overflows. Then each
// direction's flow at 1440 light: mute and restore this device (the phone in
// the review aid keeps playing, a fired "agent finishes" plays only when it
// should), night stays quiet after a device unmute, off disables the
// control, C's hour silences every device, the keyboard (Tab to the sound row
// or the speaker, Space/Enter), English, and one flow at 390 px. Screenshots
// at device scale 2 into <out-dir>; --quick takes 1440 light only.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-21-sound-mute-menu';
const [input,out,flag]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <out-dir> [--quick]');process.exit(2);}
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required'],...(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{})});
const html=readFileSync(input,'utf8');
const names=['rivi','kaiutin','hetkeksi'];
const A=0,B=1,C=2;
const scenarios=['oletus','laite','kaikkialla','yo'];
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};

async function open(width,theme,lang='fi'){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:900},deviceScaleFactor:2,reducedMotion:'reduce',hasTouch:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto(`http://prototype.test/?theme=${theme}${lang==='en'?'&lang=en':''}`);
 await menuOpen(page);
 return page;
}
const menuOpen=page=>page.locator('.sm-menu').waitFor({state:'visible',timeout:5000});
const shot=(page,name)=>page.screenshot({path:`${out}/${name}.png`});
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const has=async(page,id)=>(await page.getByTestId(id).count())>0;
const state=page=>page.getByTestId('sound-state').getAttribute('data-status');
const stateText=page=>page.getByTestId('sound-state-text').textContent();
const plays=page=>page.evaluate(()=>window.__smPlays.length);
async function closeMenu(page){
 if(await page.locator('.sm-menu').count()){await page.keyboard.press('Escape');await page.locator('.sm-menu').waitFor({state:'detached'});}
 // Esc returns focus to the account button, whose tooltip opens to the
 // right over B's speaker (a cost of B, in NOTES). Click as a pointer would.
 await page.evaluate(()=>document.activeElement?.blur());await page.mouse.move(900,600);await page.waitForTimeout(100);
}
async function reopen(page){
 if(!(await page.locator('.sm-menu').count())){await page.getByTestId('account-menu-trigger').click();await menuOpen(page);}
}
async function pick(page,d){
 // The modal menu's underlay takes the first outside press: close it first.
 await closeMenu(page);
 if(await page.locator('.ah-shell-body.ah-mobile-open').count()){await page.keyboard.press('Escape');await page.waitForTimeout(250);}
 await page.locator('.proto-picker-item').nth(d).click();
 await page.locator(`.sm-review[data-direction="${d}"]`).waitFor({state:'attached'});
 await menuOpen(page);
}
async function scenario(page,s){
 await closeMenu(page);
 if(await page.locator('.ah-shell-body.ah-mobile-open').count()){await page.keyboard.press('Escape');await page.waitForTimeout(250);}
 await page.locator('#scenario').selectOption(s);
 await page.locator(`.sm-review[data-scenario="${s}"]`).waitFor({state:'attached'});
 await menuOpen(page);
 await page.waitForTimeout(100);
}
async function fire(page){
 await closeMenu(page);
 if(await page.locator('.ah-shell-body.ah-mobile-open').count()){await page.keyboard.press('Escape');await page.waitForTimeout(250);}
 const before=await plays(page);
 await page.getByTestId('aid-fire').click();
 return (await plays(page))-before;
}
const expectStatus={oletus:'on',laite:'device',kaikkialla:'off',yo:'night'};

async function defaultView(page,d,s,at){
 eq(await state(page),expectStatus[s],`${at}: state`);
 ok(await page.getByTestId('sound-row').isVisible(),`${at}: the sound row in the menu`);
 eq(await page.locator('.sm-lines li[aria-current]').count(),1,`${at}: its line is marked`);
 const badge=await has(page,'avatar-badge');
 eq(badge,d!==B&&s==='laite',`${at}: avatar mark only for a muted device`);
 if(d===B){
  ok(await page.getByTestId('speaker').isVisible(),`${at}: speaker beside the account`);
  eq(await page.getByTestId('speaker').getAttribute('data-status'),expectStatus[s],`${at}: speaker state`);
 }
 if(d===A)eq(await page.getByTestId('device-mute').locator('button').first().isDisabled(),s==='kaikkialla',`${at}: A disabled only when off`);
 if(d===C&&s!=='laite')ok(await page.getByTestId('snooze-hour').isVisible(),`${at}: C offers the hour`);
 if(s==='kaikkialla')ok((await page.getByTestId('sound-state').textContent()).includes('Asetuksista'),`${at}: off says where`);
 ok(await fits(page),`${at}: overflow`);
 const here=await page.getByTestId('aid-here').getAttribute('data-plays'),other=await page.getByTestId('aid-other').getAttribute('data-plays');
 eq(here!==null,s==='oletus',`${at}: aid here`);
 eq(other!==null,s==='oletus'||s==='laite',`${at}: aid phone`);
}

async function flowA(page,tag){
 const at=`rivi ${tag}`;
 await scenario(page,'oletus');
 eq(await stateText(page),'Vain tämä laite',`${at}: scope read before pressing`);
 await page.getByTestId('device-mute').getByTestId('segment-quiet').click();
 eq(await state(page),'device',`${at}: muted`);
 ok(await has(page,'avatar-badge'),`${at}: avatar mark`);
 ok(await page.locator('.sm-menu').isVisible(),`${at}: menu stays open`);
 ok(await fits(page),`${at}: overflow muted`);
 await shot(page,`${A}-rivi-${tag}-muted`);
 eq(await fire(page),0,`${at}: muted device does not play`);
 ok((await page.getByTestId('aid-other').getAttribute('data-plays'))!==null,`${at}: phone still plays`);
 ok((await page.getByTestId('account-menu-trigger').getAttribute('aria-label')).includes('Hiljaa tällä laitteella'),`${at}: trigger names the mute`);
 await reopen(page);
 await page.getByTestId('device-mute').getByTestId('segment-plays').click();
 ok(!(await has(page,'avatar-badge')),`${at}: mark gone`);
 eq(await fire(page),1,`${at}: plays again`);
 // Night: a device unmute does not override Quiet at night.
 await scenario(page,'yo');
 await page.getByTestId('device-mute').getByTestId('segment-quiet').click();
 eq(await state(page),'device',`${at}: night, muted`);
 await page.getByTestId('device-mute').getByTestId('segment-plays').click();
 eq(await state(page),'night',`${at}: night, unmuted stays quiet`);
 eq(await fire(page),0,`${at}: night does not play`);
 // Off on every device.
 await scenario(page,'kaikkialla');
 await page.getByTestId('sound-settings').click();
 ok(await page.getByTestId('sm-toast').isVisible(),`${at}: settings link`);
 eq(await fire(page),0,`${at}: off does not play`);
 // Keyboard: open with Enter, Tab to the sound row, Space.
 await scenario(page,'oletus');
 await closeMenu(page);
 await page.getByTestId('account-menu-trigger').focus();
 await page.keyboard.press('Enter');
 await menuOpen(page);
 let reached=false;
 for(let i=0;i<12&&!reached;i++){
  await page.keyboard.press('Tab');
  reached=await page.evaluate(()=>document.activeElement?.closest('[data-testid="device-mute"]')!==null&&document.activeElement?.getAttribute('data-testid')==='segment-quiet');
 }
 ok(reached,`${at}: Tab reaches Hiljaa`);
 await page.keyboard.press('Space');
 eq(await state(page),'device',`${at}: Space mutes`);
 await page.keyboard.press('Escape');
 await page.locator('.sm-menu').waitFor({state:'detached'});
 eq(await page.evaluate(()=>document.activeElement?.getAttribute('data-testid')),'account-menu-trigger',`${at}: Esc returns focus`);
}

async function flowB(page,tag){
 const at=`kaiutin ${tag}`;
 await scenario(page,'oletus');
 await closeMenu(page);
 await page.getByTestId('speaker').click();
 eq(await page.getByTestId('speaker').getAttribute('aria-pressed'),'true',`${at}: one press mutes`);
 eq(await page.getByTestId('speaker').getAttribute('data-status'),'device',`${at}: speaker shows muted`);
 ok(await page.getByTestId('sm-toast').textContent().then(s=>s.includes('Muut laitteet')),`${at}: toast says only this device`);
 await shot(page,`${B}-kaiutin-${tag}-muted`);
 eq(await fire(page),0,`${at}: muted does not play`);
 await page.getByTestId('speaker').focus();
 await page.keyboard.press('Space');
 eq(await page.getByTestId('speaker').getAttribute('aria-pressed'),'false',`${at}: Space restores`);
 eq(await fire(page),1,`${at}: plays`);
 await scenario(page,'yo');
 await closeMenu(page);
 ok((await page.getByTestId('speaker').getAttribute('aria-label')).includes('Yö'),`${at}: night named on the speaker`);
 await scenario(page,'kaikkialla');
 await closeMenu(page);
 ok(await page.getByTestId('speaker').isDisabled(),`${at}: off disables the speaker`);
}

async function flowC(page,tag){
 const at=`hetkeksi ${tag}`;
 await scenario(page,'oletus');
 await page.getByTestId('snooze-hour').click();
 eq(await state(page),'snooze',`${at}: an hour`);
 ok((await stateText(page)).includes('15.40'),`${at}: until when`);
 ok(await has(page,'avatar-badge'),`${at}: avatar mark`);
 eq(await page.getByTestId('aid-other').getAttribute('data-plays'),null,`${at}: phone quiet too`);
 ok(await fits(page),`${at}: overflow`);
 await shot(page,`${C}-hetkeksi-${tag}-hour`);
 await page.getByTestId('sound-restore').click();
 eq(await state(page),'on',`${at}: restored`);
 await page.getByTestId('device-mute-c').click();
 eq(await state(page),'device',`${at}: this device`);
 ok((await page.getByTestId('aid-other').getAttribute('data-plays'))!==null,`${at}: phone plays`);
 await shot(page,`${C}-hetkeksi-${tag}-device`);
 eq(await fire(page),0,`${at}: quiet here`);
 await reopen(page);
 await page.getByTestId('sound-restore').focus();
 await page.keyboard.press('Enter');
 eq(await state(page),'on',`${at}: Enter restores`);
 await scenario(page,'kaikkialla');
 ok(await page.getByTestId('snooze-hour').isDisabled(),`${at}: off disables`);
}

try{
for(const width of quick?[1440]:[1440,390])for(const theme of quick?['light']:['light','dark']){
 const tag=`${width}-${theme}`;
 const page=await open(width,theme);
 await checkPicker(page,round);
 eq(await page.getByTestId('recommendation').count(),1,'the recommendation is on the page');
 for(let d=0;d<3;d++){
  await pick(page,d);
  for(const s of scenarios){
   await scenario(page,s);
   await defaultView(page,d,s,`${names[d]} ${s} ${tag}`);
   await shot(page,`${d}-${names[d]}-${s}-${tag}`);
  }
 }
 if(width===1440&&theme==='light'){
  await pick(page,A);await flowA(page,tag);
  await pick(page,B);await flowB(page,tag);
  await pick(page,C);await flowC(page,tag);
 }
 if(width===390&&theme==='light'){
  await pick(page,A);
  await page.getByTestId('device-mute').getByTestId('segment-quiet').click();
  eq(await state(page),'device','phone A: mute');
  ok(await fits(page),'phone A: overflow');
  await pick(page,B);
  await closeMenu(page);
  await page.getByTestId('speaker').click();
  eq(await page.getByTestId('speaker').getAttribute('aria-pressed'),'true','phone B: one press in the drawer');
  await shot(page,`${B}-kaiutin-${tag}-muted`);
 }
 await page.close();
}
{
 const en=await open(1440,'light','en');
 eq(await stateText(en),'This device only','English A scope');
 await en.getByTestId('device-mute').getByTestId('segment-quiet').click();
 eq(await stateText(en),'Quiet on this device','English A muted');
 await shot(en,'en-0-rivi-1440-light');
 await pick(en,C);
 await en.getByTestId('snooze-hour').click();
 ok((await stateText(en)).includes('15:40 on every device'),'English C hour');
 await shot(en,'en-2-hetkeksi-1440-light');
 await scenario(en,'yo');
 eq(await stateText(en),'Night: quiet until the device turns to day','English night');
 await en.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[],'console errors');
console.log(`${checks} checks passed`);
