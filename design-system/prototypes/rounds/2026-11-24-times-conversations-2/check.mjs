// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. Serves
// the page under the Habitat view's sandbox CSP (opaque origin, scripts, no
// connect, no frames) and fails on any request besides the page itself, any
// iframe, or any change of address. Walks every direction (Now = round 1 B,
// A Header, B Under, C Margin) at 1440 and 390 px in Päivä, Yö and Korkea
// kontrasti with reduced motion, in Finnish, and once more in English: day
// separators, where each message's time sits (header right, after the name,
// under the card on its own side, in the margin on its own side), which turns
// end with their duration and at which threshold, the running turn's clock
// with no closing duration, the device zone moving times and days, the rail
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
const round='2026-11-24-times-conversations-2';
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
// Turns 2 (6 min), 5 (23 min) and 6 (15 min) pass 2 and 5 minutes; only
// the last two pass 10.
const longTurns=[[],['t1','t4','t5'],['t1','t4','t5'],['t4','t5']];
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
 const allTimes=tl.locator('.ah-message time, .tt-under time');
 const headerTimes=tl.locator('.ah-message > header time');
 const today=en?'Today':'Tänään',yesterday=en?'Yesterday':'Eilen';
 const c=s=>en?s.replace('.',':'):s;
 // The rail row's age stays production's elapsed time (decided).
 const ages=await page.getByTestId('rail').locator('time.ah-nav-time').allInnerTexts();
 ok(ages.join('|')===(en?'4 min|3 h|17 h|1 d':'4 min|3 t|17 t|1 pv'),`${tag}: rail ages ${ages}`);
 // Geometry of every time against its own card, read in the page.
 const geometry=()=>tl.evaluate(root=>[...root.querySelectorAll('.ah-message time, .tt-under time')].map(time=>{
  const li=time.closest('li'),user=li.dataset.kind==='user';
  const card=time.closest('.ah-message')??time.closest('.tt-under').previousElementSibling;
  const header=card.querySelector(':scope > header'),name=header.querySelector('strong'),copy=header.querySelector('[data-ah-primitive="button"]');
  const line=time.closest('.tt-under'),t=time.getBoundingClientRect(),s=(line??time).getBoundingClientRect(),k=card.getBoundingClientRect(),h=header.getBoundingClientRect(),n=name.getBoundingClientRect(),b=copy?.getBoundingClientRect();
  return {user,inHeader:header.contains(time),under:!!time.closest('.tt-under'),
   afterName:t.left>=n.right-1&&(!b||t.right<=b.left+1),afterCopy:!!b&&t.left>=b.right-1,
   atRight:Math.abs(t.right-h.right)<=2,below:t.top>=k.bottom-1,
   sideStart:Math.abs(s.left-k.left)<=24,sideEnd:Math.abs(s.right-k.right)<=24,
   leftOf:t.right<=k.left+1,rightOf:t.left>=k.right-1,level:Math.abs(t.top-h.top)<=12};
 }));
 for(const d of [0,1,2,3]){
  const n=names[d];
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.tt-review.variant-${d}`).waitFor({state:'attached'});
  await page.getByTestId('reset').click();
  await page.evaluate(()=>scrollTo(0,0));
  ok(await page.getByTestId('lines').locator('li').nth(d).getAttribute('aria-current')==='true',`${n}: current line`);
  ok(await tl.getByTestId('message').count()===6+6+1,`${n}: six messages, six final replies and one interim`);
  ok(await tl.locator('.ah-stage-elapsed').count()===6,`${n}: production work rows keep their duration`);
  const days=await tl.getByTestId('day-separator').allInnerTexts();
  ok(days.length===3&&days[1]===yesterday&&days[2]===today&&/20/.test(days[0]),`${n}: day separators ${days}`);
  const times=await allTimes.allInnerTexts();
  ok(times.length===13,`${n}: every message has its time (${times.length})`);
  ok(times[0]===c('14.02')&&times.at(-1)===c('10.07'),`${n}: Helsinki times ${times[0]} … ${times.at(-1)}`);
  ok(await allTimes.evaluateAll(els=>els.every(e=>getComputedStyle(e).opacity!=='0'&&e.getBoundingClientRect().width>0)),`${n}: every time visible without a pointer`);
  const g=await geometry();
  if(d===0){
   ok(g.every(x=>x.inHeader),`${n}: times in the header`);
   ok(g.filter(x=>x.user).every(x=>x.afterCopy),`${n}: your time after the copy button`);
   ok(g.filter(x=>!x.user).every(x=>x.atRight),`${n}: the reply's time at the header's right edge`);
  }
  if(d===1){
   ok(g.every(x=>x.inHeader&&x.afterName),`${n}: every time right after the name`);
  }
  if(d===2){
   ok(await headerTimes.count()===0,`${n}: no time in the header`);
   ok(g.every(x=>x.under&&x.below),`${n}: every time under its card`);
   ok(g.filter(x=>x.user).every(x=>x.sideEnd)&&g.filter(x=>!x.user).every(x=>x.sideStart),`${n}: yours on the right, the agent's on the left`);
  }
  if(d===3){
   ok(g.every(x=>x.inHeader&&x.level),`${n}: times level with the header (screen readers read them there)`);
   ok(g.filter(x=>x.user).every(x=>x.rightOf)&&g.filter(x=>!x.user).every(x=>x.leftOf),`${n}: yours in the right margin, the agent's in the left`);
  }
  const long=await tl.locator('[data-long]').evaluateAll(els=>els.map(e=>e.dataset.item));
  ok(long.join()===longTurns[d].join(),`${n}: long turns ${long}`);
  const took=d===2?await tl.getByTestId('under').filter({hasText:en?'took':'kesti'}).allInnerTexts():await tl.getByTestId('took').allInnerTexts();
  ok(took.length===longTurns[d].length,`${n}: one closing duration per long turn (${took.length})`);
  if(d>0){
   const monday=took[d===3?0:1];
   ok(monday.includes('23 min'),`${n}: the Monday evening turn took 23 min: ${monday}`);
   if(d===2)ok(monday===(en?`Done ${c('17.03')} · the turn took 23 min`:'Valmis 17.03 · vuoro kesti 23 min'),`${n}: closing line ${monday}`);
   // The duration closes the last reply, not the interim one.
   ok(await tl.locator('[data-item="t1"] .ah-message-interim').locator('[data-testid="took"], + .tt-under [data-testid]').count()===0,`${n}: interim reply carries no duration`);
   // It agrees with the work row (floor, never rounded past it).
   const row=await tl.locator('[data-item="t5"] .ah-stage-elapsed').innerText();
   ok(row.startsWith('15 min')&&took.at(-1).includes('15 min'),`${n}: last turn ${took.at(-1)} agrees with the work row ${row}`);
  }
  await fits(`${n} default`);await shot(`${n}-1-oletus`,true);
  if(d===3||d===1){
   // The Monday evening turn, scrolled into view.
   await tl.locator('[data-item="t4"]').evaluate(e=>e.scrollIntoView({block:'center'}));
   await shot(`${n}-2-maanantai`);
  }
  if(!full)continue;
  // The last turn running: production's clock, no closing duration yet.
  await page.locator('#run').selectOption('running');
  ok(await tl.locator('.ah-turn-clock').innerText()==='20:14',`${n}: running turn clock`);
  ok((await page.getByTestId('rail').locator('time.ah-nav-time').first().innerText())===(en?'now':'nyt'),`${n}: running row reads now`);
  ok(await tl.locator('[data-item="t5"][data-long]').count()===0,`${n}: no closing duration while running`);
  await fits(`${n} running`);await shot(`${n}-3-kaynnissa`);
  await page.locator('#run').selectOption('done');
  // Device zone: New York moves times and the Friday afternoon stays Friday.
  await page.locator('#zone').selectOption('America/New_York');
  const ny=await allTimes.allInnerTexts();
  ok(ny[0]===c('7.02')&&ny.at(-1)===c('3.07'),`${n}: New York times ${ny[0]} … ${ny.at(-1)}`);
  const nd=await tl.getByTestId('day-separator').allInnerTexts();
  ok(nd.length===3&&nd[2]===today,`${n}: New York days ${nd}`);
  if(d===3){const g2=await geometry();ok(g2.filter(x=>!x.user).every(x=>x.leftOf),`${n}: margins hold after a re-render`);}
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
