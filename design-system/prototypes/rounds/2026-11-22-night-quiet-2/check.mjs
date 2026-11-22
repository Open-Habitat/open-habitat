// node check.mjs <offline.html> <out-dir>
// Authored synthetic component lab, not a host-backed acceptance test.
// First the round directory: no image or HTML file and nothing over 100 KB.
// Desktop (1440 × 900, Päivä and Yö), every direction, every situation:
// the status line is the first element of the page when the direction
// shows one, and it names exactly the reasons the direction promises:
// A the strongest (off › muted › night), B all active reasons, C night
// only while sounds are on. C keeps production's bottom notes for off and
// muted; A and B have none. The menu's Äänet row follows off › muted ›
// night. Fixes change the real setting: in A the default situation (23.40,
// muted) shows the mute, Poista mykistys reveals night, Ota yöhiljaisuus
// pois clears the line and turns Hiljennä yöllä off; in B each row fixes
// itself; Muuta aikaa reaches the clock. From "all", A walks off › muted ›
// night. English once. Phone (390 × 844, touch, the bare page) every
// direction, light and dark, default situation: the line is on the first
// screen, no sideways scroll. The picker; a clean console.
// Screenshots: d<n>-<situation>-<width>-<theme>.png.
import {createRequire} from 'node:module';
import {dirname,resolve,join,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync,readdirSync,statSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-22-night-quiet-2';
const [input,out]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <out-dir>');process.exit(2);}
mkdirSync(out,{recursive:true});
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
for(const f of readdirSync(here)){
 ok(!['.png','.jpg','.jpeg','.avif','.webp','.html'].includes(extname(f).toLowerCase()),`round directory holds ${f}`);
 ok(statSync(join(here,f)).size<100*1024,`${f} is over 100 KB`);
}
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const wait=(page,ms=250)=>page.waitForTimeout(ms);
async function open(width,query){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:900},deviceScaleFactor:phone?2:1,hasTouch:phone,isMobile:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto(`http://prototype.test/${query}`);
 await wait(page,600);
 return page;
}
const tid=(scope,id)=>scope.locator(`[data-testid="${id}"]`);
const shot=(page,name)=>page.screenshot({path:join(out,`${name}.png`)});
async function pick(page,d){await page.locator('.proto-picker-item').nth(d).click();await wait(page,400);}
async function select(page,id,value){await page.locator(`#${id}`).selectOption(value);await wait(page,300);}
const bodyOf=page=>tid(page.locator('[data-testid="desktop-stage"]'),'sound-settings');
const reasonsOf=async body=>(await tid(body,'status-line').count())?await tid(body,'status-line').getAttribute('data-reasons'):'';

// Active reasons per situation, strongest first, and what each direction shows.
const active={nightMuted:['muted','night'],night:['night'],muted:['muted'],off:['off'],all:['off','muted','night'],normal:[]};
const expect=(d,s)=>{const r=active[s];return d===0?r.slice(0,1).join(' '):d===1?r.join(' '):(r.includes('night')&&!r.includes('off')?'night':'');};
const menuOf=s=>{const r=active[s];return r[0]??'plays';};

for(const theme of ['light','dark']){
 const page=await open(1440,`?theme=${theme}`);
 await checkPicker(page,round);checks++;
 for(const s of Object.keys(active)){
  await select(page,'scenario',s);
  for(const d of [0,1,2]){
   await pick(page,d);
   const body=bodyOf(page);
   const got=await reasonsOf(body);
   ok(got===expect(d,s),`d${d} ${s}: line says "${got}", want "${expect(d,s)}"`);
   if(got){
    const first=await body.evaluate(el=>el.firstElementChild?.getAttribute('data-testid'));
    ok(first==='status-line',`d${d} ${s} line is first, got ${first}`);
    const box=await tid(body,'status-line').boundingBox();ok(box.y<300,`d${d} ${s} line near the top (${box.y})`);
   }
   const notes=await body.locator('[data-testid^="sound-note-"]').count();
   const wantNote=d===2&&(active[s].includes('off')||active[s].includes('muted'));
   ok(notes===(wantNote?1:0),`d${d} ${s} bottom notes ${notes}`);
   ok((await tid(page,'sound-menu-state').getAttribute('data-status'))===menuOf(s),`d${d} ${s} menu`);
   if(theme==='light'||s==='nightMuted'||s==='all')await shot(page,`d${d}-${s}-1440-${theme}`);
  }
 }
 if(theme==='light'){
  // A walks the reasons by fixing them; the fixes are real settings.
  await select(page,'scenario','all');await pick(page,0);
  let body=bodyOf(page);
  for(const [r,next] of [['off','muted'],['muted','night'],['night','']]){
   ok(await reasonsOf(body)===r,`A all: shows ${r}`);
   await tid(body,`fix-${r}`).click();await wait(page);
   ok(await tid(page,'toast').isVisible(),`A fix ${r} toast`);
   ok(await reasonsOf(body)===next,`A after ${r}: ${await reasonsOf(body)}`);
  }
  ok((await tid(body,'sound-enabled').locator('[aria-checked="true"],[aria-pressed="true"],[data-selected="true"]').innerText()).length>0,'A master on');
  ok(await tid(body,'night-clock').count()===0,'A night fix turns Hiljennä yöllä off (clock hidden)');
  ok(await tid(body,'preview-bypass').count()===0,'A no preview note after the fixes');
  await shot(page,'d0-all-fixed-1440-light');
  // B: each row fixes itself, the rest stay.
  await select(page,'scenario','normal');await select(page,'scenario','all');await pick(page,1);
  body=bodyOf(page);
  ok(await tid(body,'reason-muted').locator('em').isVisible(),'B notes muted has no effect while off');
  await tid(body,'fix-muted').click();await wait(page);
  ok(await reasonsOf(body)==='off night',`B after unmute: ${await reasonsOf(body)}`);
  await tid(body,'fix-off').click();await wait(page);
  ok(await reasonsOf(body)==='night','B after on');
  ok(await tid(body,'preview-bypass').isVisible(),'B night only: preview note');
  ok(await tid(body,'test-bypass').count()===1,'B night only: test note');
  await tid(body,'night-edit').click();await wait(page,700);
  const clock=await tid(body,'night-clock').boundingBox();
  ok(clock&&clock.y>0&&clock.y<900,`Muuta aikaa brings the clock into view (${clock&&clock.y})`);
  await tid(body,'night-start').click();await wait(page);
  await page.locator('[role^="menuitem"]').filter({hasText:/klo 0\.00/}).first().click();await wait(page);
  ok(await reasonsOf(body)==='','B: night from 0.00 makes 23.40 day, line gone');
  // C: muted at night shows night on top and the mute note at the bottom.
  await select(page,'scenario','normal');await select(page,'scenario','nightMuted');await pick(page,2);
  body=bodyOf(page);
  ok(await tid(body,'sound-note-muted').isVisible(),'C muted note at the bottom');
  await tid(body,'fix-night').click();await wait(page);
  ok(await reasonsOf(body)==='','C night fixed');
  ok(await tid(body,'sound-note-muted').isVisible(),'C mute stays a control');
  await select(page,'language','en');
  await select(page,'scenario','night');await pick(page,0);
  const t=await tid(bodyOf(page),'status-title').innerText();
  ok(/quiet until 07:00/.test(t),`English status: ${t}`);
  await select(page,'scenario','all');await pick(page,1);
  await shot(page,'d1-all-1440-light-en');
 }
 await page.close();
}
for(const theme of ['light','dark'])for(const d of [0,1,2])for(const s of ['nightMuted','all']){
 const page=await open(390,`?bare=1&d=${d}&theme=${theme}&scenario=${s}`);
 const line=tid(page,'status-line');
 if(expect(d,s)){
  const box=await line.boundingBox();
  ok(box&&box.y+box.height<844,`phone d${d} ${s} line on first screen`);
 }else ok(await line.count()===0,`phone d${d} ${s} no line`);
 const wide=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
 ok(wide<=1,`phone d${d} ${s} sideways scroll ${wide}`);
 await shot(page,`d${d}-${s}-390-${theme}`);
 await page.close();
}
await browser.close();
ok(errors.length===0,`console errors: ${errors.join(' | ')}`);
console.log(`${checks} checks passed; screenshots in ${out}`);
