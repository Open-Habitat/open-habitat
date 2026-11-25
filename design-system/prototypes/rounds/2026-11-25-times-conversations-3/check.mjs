// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. Serves
// the page under the Habitat view's sandbox CSP (opaque origin, scripts, no
// connect, no frames) and fails on any request besides the page itself, any
// iframe, or any change of address. Walks every direction (Now = round 2 A,
// A Every long turn, B Only new information, C End row) at 1440 and 390 px in
// Päivä, Yö and Korkea kontrasti with reduced motion, in Finnish, and once
// more in English: every time right after its name, day separators, which
// turns carry their duration and where (reply header, stopped row, end row),
// the duration floored and agreeing with the work row, production's stopped
// row kept in Now and restated with its time after the verb elsewhere, the
// restart cut and the mid-tool stop, the running turn's clock with no
// duration, the device zone, the rail ages, no overflow. Screenshots at
// DPR 2; console clean.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-25-times-conversations-3';
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
// Long finished turns: t1 (6 min, 2 stages), t5 (48 min, 4 stages), t7
// (23 min, 1 stage), t9 (15 min, 1 stage). Stopped: t2 (12 min, mid-tool,
// 1 stage), t6 (8 min, 2 stages), t8 (11 min, restart, 1 stage).
const where=[
 {t1:'header',t5:'header',t7:'header',t9:'header'},
 {t1:'header',t2:'stop',t5:'header',t6:'stop',t7:'header',t8:'stop',t9:'header'},
 {t1:'header',t5:'header',t6:'stop'},
 {t1:'end',t2:'stop',t5:'end',t6:'stop',t7:'end',t8:'stop',t9:'end'},
];
const mins={t1:6,t2:12,t5:48,t6:8,t7:23,t8:11,t9:15};
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
 const allTimes=tl.locator('.ah-message > header time');
 const today=en?'Today':'Tänään',yesterday=en?'Yesterday':'Eilen';
 const c=s=>en?s.replace('.',':'):s;
 const stopped=en?'You stopped it':'Keskeytit',cut=en?'Cut off when the server restarted':'Katkesi palvelimen uudelleenkäynnistyksessä';
 const tookWord=m=>en?`the turn took ${m} min`:`vuoro kesti ${m} min`;
 const ages=await page.getByTestId('rail').locator('time.ah-nav-time').allInnerTexts();
 ok(ages.join('|')===(en?'4 min|3 h|17 h|1 d':'4 min|3 t|17 t|1 pv'),`${tag}: rail ages ${ages}`);
 const afterName=()=>tl.evaluate(root=>[...root.querySelectorAll('.ah-message > header time')].every(time=>{
  const header=time.closest('header'),name=header.querySelector('strong'),copy=header.querySelector('[data-ah-primitive="button"]');
  const t=time.getBoundingClientRect(),n=name.getBoundingClientRect(),b=copy?.getBoundingClientRect();
  return (t.left>=n.right-1||t.top>=n.bottom-1)&&(!b||t.right<=b.left+1||t.top>=b.bottom-1||t.bottom<=b.top+1);
 }));
 const view=async id=>{await tl.locator(`[data-item="${id}"]`).evaluate(e=>e.scrollIntoView({block:'center'}));};
 for(const d of [0,1,2,3]){
  const n=names[d];
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.tt-review.variant-${d}`).waitFor({state:'attached'});
  await page.getByTestId('reset').click();
  await page.evaluate(()=>scrollTo(0,0));
  ok(await page.getByTestId('lines').locator('li').nth(d).getAttribute('aria-current')==='true',`${n}: current line`);
  ok(await tl.getByTestId('message').count()===10+12,`${n}: ten messages and twelve replies (seven final, five interim)`);
  ok(await tl.locator('.ah-stage-elapsed').count()===14,`${n}: production work rows keep their duration`);
  ok(await tl.locator('[data-item="t5"] .ah-stage-elapsed').count()===4,`${n}: the four-stage turn has four work rows`);
  const days=await tl.getByTestId('day-separator').allInnerTexts();
  ok(days.length===3&&days[1]===yesterday&&days[2]===today&&/20/.test(days[0]),`${n}: day separators ${days}`);
  const times=await allTimes.allInnerTexts();
  ok(times.length===22,`${n}: every message has its time (${times.length})`);
  ok(times[0]===c('14.02')&&times.at(-1)===c('10.07'),`${n}: Helsinki times ${times[0]} … ${times.at(-1)}`);
  ok(await afterName(),`${n}: every time right after the name`);
  // Where each duration goes.
  const got=Object.fromEntries(await tl.locator('[data-took]').evaluateAll(els=>els.map(e=>[e.dataset.item,e.dataset.took])));
  ok(JSON.stringify(got)===JSON.stringify(where[d]),`${n}: durations ${JSON.stringify(got)}`);
  for(const [id,w] of Object.entries(where[d])){
   const item=tl.locator(`[data-item="${id}"]`);
   const sel=w==='header'?'.ah-turn-reply:not(.ah-turn-interim) .ah-message > header [data-testid="took"]':w==='stop'?'[data-testid="stop-line"] [data-testid="took"]':'[data-testid="turn-end"] [data-testid="took"]';
   const tx=await item.locator(sel).innerText();
   ok(tx.toLowerCase().includes(tookWord(mins[id]).toLowerCase()),`${n}: ${id} ${w} reads ${tx}`);
   ok(await item.locator('[data-testid="took"]').count()===1,`${n}: ${id} one duration`);
  }
  ok(await tl.locator('[data-testid="took"]').count()===Object.keys(where[d]).length,`${n}: no other durations`);
  ok(await tl.locator('.ah-turn-interim [data-testid="took"]').count()===0,`${n}: interim replies carry no duration`);
  // A single-stage duration agrees with its work row (floored).
  if(where[d].t7){const row=await tl.locator('[data-item="t7"] .ah-stage-elapsed').innerText();ok(row==='23 min 05 s',`${n}: t7 work row ${row}`);}
  await fits(`${n} default`);await shot(`${n}-1-oletus`,true);
  // Stopped rows: production in Now, restated after the verb elsewhere.
  ok(await tl.getByTestId('turn-stopped').count()===3,`${n}: three stopped turns`);
  ok(await tl.locator('[data-testid="turn-stopped"][data-by="restart"]').count()===1,`${n}: one cut by a restart`);
  // Open the mid-tool stop's work row: its tool reads interrupted.
  await tl.locator('[data-item="t2"] [data-testid="history-stage-toggle"]').click();
  ok(await tl.locator('[data-item="t2"] .ah-tool-row[data-state="cancelled"]').count()===1,`${n}: the mid-tool stop shows its tool interrupted`);
  const lines=await tl.locator('.ah-turn-stopped-text').evaluateAll(els=>els.filter(e=>e.getClientRects().length).map(e=>e.innerText));
  const exp=d===0?[`${stopped} · ${c('14.52')}`,`${stopped} · ${c('13.18')}`,`${cut} · ${c('17.41')}`]
   :[`${stopped} ${c('14.52')}`,`${stopped} ${c('13.18')}`,`${cut} ${c('17.41')}`];
  const visibleStops=lines.filter(l=>!/^(The turn|Vuoro) /.test(l));
  ok(visibleStops.length===3&&exp.every((e,k)=>visibleStops[k].startsWith(e)),`${n}: stopped rows ${visibleStops}`);
  ok(d!==3||lines.filter(l=>/^(The turn|Vuoro) /.test(l)).length===4,`${n}: four end rows`);
  await view('t5');await shot(`${n}-2-monivaihe`);
  await view('t6');await shot(`${n}-3-pysaytetty`);
  await view('t2');await shot(`${n}-4-perjantai`);
  if(!full)continue;
  await page.locator('#run').selectOption('running');
  ok(await tl.locator('.ah-turn-clock').innerText()==='20:14',`${n}: running turn clock`);
  ok(await tl.locator('[data-item="t9"][data-took]').count()===0,`${n}: no duration while running`);
  await fits(`${n} running`);await shot(`${n}-5-kaynnissa`);
  await page.locator('#run').selectOption('done');
  await page.locator('#zone').selectOption('America/New_York');
  const ny=await allTimes.allInnerTexts();
  ok(ny[0]===c('7.02')&&ny.at(-1)===c('3.07'),`${n}: New York times ${ny[0]} … ${ny.at(-1)}`);
  const nd=await tl.getByTestId('day-separator').allInnerTexts();
  ok(nd.length===3&&nd[2]===today,`${n}: New York days ${nd}`);
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
