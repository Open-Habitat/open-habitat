// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. Serves
// the page under the Habitat view's sandbox CSP (opaque origin, scripts, no
// connect, no frames) and fails on any request besides the page itself, any
// iframe, or any change of address. Walks every direction (Now, A, B, C) at
// 1440 and 390 px in Päivä, Yö and Korkea kontrasti with reduced motion, in
// Finnish, and once more in English: which times the default view shows
// (none, hidden until hover/tap, every header, only after long breaks), day
// separators and gap markers, A's hover and tap, C's long-turn line, the
// running turn's clock, the device zone moving the day boundaries, the rail
// row's age, no overflow. Screenshots at DPR 2; console clean.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-24-times-conversations';
const [input,out]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <evidence-dir>');process.exit(2);}
mkdirSync(out,{recursive:true});
const html=readFileSync(input,'utf8');
const origin='https://view.test';
// The gateway's view CSP (internal/gateway/views_linux.go), self = the view host.
const csp=`sandbox allow-scripts; default-src 'none'; script-src ${origin} 'unsafe-inline' 'unsafe-eval'; style-src ${origin} 'unsafe-inline'; img-src ${origin} data: blob:; font-src ${origin} data:; media-src ${origin} data: blob:; connect-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none'; object-src 'none'; manifest-src 'none'; form-action 'none'; base-uri 'none'`;
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
let checks=0;const errors=[];const stray=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const names=['nyt','a','b','c'];
const runs=[];
for(const width of [1440,390])for(const theme of ['light','dark','contrast'])runs.push({width,theme,lang:'fi'});
runs.push({width:1440,theme:'light',lang:'en'},{width:390,theme:'dark',lang:'en'});
try{
for(const {width,theme,lang} of runs){
 const phone=width===390,en=lang==='en';
 // The page's own zone control decides the times; the browser zone is
 // elsewhere on purpose so nothing leans on it.
 const page=await browser.newPage({viewport:{width,height:phone?844:1000},deviceScaleFactor:2,reducedMotion:'reduce',hasTouch:phone,isMobile:phone,timezoneId:'Asia/Tokyo'});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 let served=0;
 await page.route('**/*',r=>{
  const u=r.request().url();
  if(u===`${origin}/view`&&served++===0)return r.fulfill({contentType:'text/html',headers:{'content-security-policy':csp},body:html});
  stray.push(u);return r.abort();
 });
 await page.goto(`${origin}/view`);
 await page.locator('#theme').selectOption(theme);
 await page.locator('#lang').selectOption(lang);
 await checkPicker(page,round);
 const tag=`${width}-${theme}-${lang}`;
 const full=theme==='light'||lang==='en';
 const shot=async(name,always=false)=>{if(!full&&!always)return;await page.waitForTimeout(120);await page.screenshot({path:`${out}/${name}-${tag}.png`,fullPage:true});};
 const fits=async(m)=>ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${tag} ${m}: document overflow`);
 ok(await page.evaluate(()=>origin==='null'),`${tag}: opaque-origin sandbox`);
 ok(await page.locator('iframe, frame, object, embed').count()===0,`${tag}: no frames`);
 ok(await page.evaluate(()=>document.documentElement.lang)===lang,`${tag}: document language`);
 const tl=page.getByTestId('conversation-timeline');
 const headerTimes=tl.locator('.ah-message > header time');
 const visibleTimes=async()=>headerTimes.evaluateAll(els=>els.filter(e=>getComputedStyle(e).opacity!=='0').length);
 const today=en?'Today':'Tänään',yesterday=en?'Yesterday':'Eilen';
 // The rail row's age is production's, the same in every direction.
 const ages=await page.getByTestId('rail').locator('time.ah-nav-time').allInnerTexts();
 ok(ages.join('|')===(en?'4 min|3 h|17 h|1 d':'4 min|3 t|17 t|1 pv'),`${tag}: rail ages ${ages}`);
 for(const d of [0,1,2,3]){
  const n=names[d];
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.tt-review.variant-${d}`).waitFor({state:'attached'});
  await page.getByTestId('reset').click();
  await page.evaluate(()=>scrollTo(0,0));
  ok(await page.getByTestId('lines').locator('li').nth(d).getAttribute('aria-current')==='true',`${n}: current line`);
  ok(await tl.getByTestId('message').count()===6+6+1,`${n}: six messages, six final replies and one interim`);
  // Production's stage rows carry their elapsed time in every direction.
  ok(await tl.locator('.ah-stage-elapsed').count()===6,`${n}: stage elapsed on the work rows`);
  const days=await tl.getByTestId('day-separator').allInnerTexts();
  const gaps=await tl.getByTestId('gap-marker').allInnerTexts();
  const lines=await tl.getByTestId('turn-line').allInnerTexts();
  if(d===0){
   ok(await headerTimes.count()===0,`${n}: today no message has a time`);
   ok(days.length+gaps.length+lines.length===0,`${n}: no separators or markers`);
  }
  if(d===1||d===2){
   ok(days.length===3&&days[1]===yesterday&&days[2]===today&&/20/.test(days[0]),`${n}: day separators ${days}`);
   ok(await headerTimes.count()===13,`${n}: every message header has its time`);
   ok(gaps.length+lines.length===0,`${n}: no gap markers`);
   const times=await headerTimes.allInnerTexts();
   ok(times[0]===(en?'14:02':'14.02')&&times.at(-1)===(en?'10:07':'10.07'),`${n}: Helsinki times ${times[0]} … ${times.at(-1)}`);
  }
  if(d===2)ok(await visibleTimes()===13,`${n}: all times visible without a pointer`);
  if(d===1){
   ok(await visibleTimes()===0,`${n}: times hidden by default`);
   const last=tl.locator('[data-item="u5"] .ah-message');
   if(phone){await last.locator('[data-testid="user-content"]').tap();}
   else await last.hover();
   await page.waitForTimeout(80);
   ok(await last.locator('header time').evaluate(e=>getComputedStyle(e).opacity)==='1',`${n}: ${phone?'tap':'hover'} shows the time`);
   ok(await headerTimes.first().evaluate(e=>getComputedStyle(e).transitionDuration)==='0s',`${n}: no fade under reduced motion`);
   if(phone){const body=last.locator('[data-testid="user-content"]');
    await body.tap();await page.waitForTimeout(80);
    // Emulated touch still reports (hover: hover) here, so the sticky hover
    // would keep it visible; a phone reports none. Assert the tap state.
    ok(await last.evaluate(e=>e.dataset.ttShown===undefined),`${n}: second tap hides it`);
    await body.tap();await page.waitForTimeout(80);}
   await shot(`${n}-2-${phone?'napautus':'osoitin'}`,true);
  }
  if(d===3){
   ok(await headerTimes.count()===0,`${n}: no per-message times`);
   ok(gaps.length===4,`${n}: start and three long breaks (Mon morning, Mon evening, today): ${gaps}`);
   ok(gaps[1].startsWith(`${yesterday} `)&&gaps[2].startsWith(`${yesterday} `)&&gaps[3].startsWith(`${today} `),`${n}: gap markers name the day`);
   ok(gaps[1].includes(en?'2-day':'2 päivän'),`${n}: the Monday restart says after a 2-day break`);
   ok(lines.length===3&&lines[1].includes('23 min'),`${n}: long turns end with their duration ${lines}`);
  }
  await fits(`${n} default`);await shot(`${n}-1-oletus`,true);
  if(!full)continue;
  // The last turn running: production's clock; B gives its start time.
  await page.locator('#run').selectOption('running');
  ok(await tl.locator('.ah-turn-clock').innerText()==='20:14',`${n}: running turn clock`);
  ok((await page.getByTestId('rail').locator('time.ah-nav-time').first().innerText())===(en?'now':'nyt'),`${n}: running row reads now`);
  if(d===3)ok(await tl.getByTestId('turn-line').count()===2,`${n}: no closing line while running`);
  await fits(`${n} running`);await shot(`${n}-3-kaynnissa`);
  await page.locator('#run').selectOption('done');
  // Device zone: New York moves times and the Friday afternoon stays Friday.
  await page.locator('#zone').selectOption('America/New_York');
  if(d===1||d===2){
   const times=await headerTimes.allInnerTexts();
   ok(times[0]===(en?'7:02':'7.02')&&times.at(-1)===(en?'3:07':'3.07'),`${n}: New York times ${times[0]} … ${times.at(-1)}`);
   const nd=await tl.getByTestId('day-separator').allInnerTexts();
   ok(nd.length===3&&nd[2]===today,`${n}: New York days ${nd}`);
  }
  if(d===3)ok((await tl.getByTestId('gap-marker').first().innerText()).includes(en?'7:02':'7.02'),`${n}: gap marker in New York time`);
  await shot(`${n}-4-new-york`);
  await page.locator('#zone').selectOption('Europe/Helsinki');
 }
 ok(served===1,`${tag}: one document load`);
 ok(page.url()===`${origin}/view`,`${tag}: address unchanged`);
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(stray,[],`requests besides the view:\n${stray.join('\n')}`);
assert.deepEqual(errors,[],`console errors:\n${errors.join('\n')}`);
console.log(`${checks} checks passed; screenshots in ${out}`);
