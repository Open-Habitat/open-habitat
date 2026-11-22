// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component check, not a host-backed acceptance test.
// Every direction × fi/en × Päivä/Yö/Kontrasti × 1440/390 px, reduced
// motion. Default view: the finished visit (1: Habitat line after the turn;
// 2: Selain card under the reply beside Muutokset; 3: only a mark on the
// folded work row). Then: open the record (13 pages on two sites, 13 files,
// 2 presses/entries), switch to the visit in progress (window list open,
// agent's tab named with its page count, production "agentti tässä"),
// "Näytä keskustelussa" from the strip, step to the end (tab gone, record
// stays). Picker contract, no horizontal overflow, clean console, no
// network. Screenshots are review material, not pixel assertions.
// PROTO_CHROMIUM may name a Chromium executable.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-22-browser-visit-record';
const [input,out,flag]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <out-dir> [--quick]');process.exit(2);}
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['rivi','kortti','tyo'];
let checks=0,shots=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
const settle=page=>page.waitForTimeout(200);

async function open(width,theme,lang){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:1000},deviceScaleFactor:phone?2:1,reducedMotion:'reduce',hasTouch:phone});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/*',r=>{const u=r.request().url();if(u==='http://prototype.test/')return r.fulfill({contentType:'text/html',body:html});if(u.startsWith('data:'))return r.continue();errors.push('unexpected network '+u);return r.abort();});
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 if(lang==='en')await page.locator('#language').selectOption('en');
 await settle(page);
 return page;
}
const pick=async(page,d)=>{await page.locator('.proto-picker-item').nth(d).click();await page.locator(`.ra-review[data-direction="${d}"]`).waitFor({state:'attached'});await settle(page);};
const shot=async(page,name)=>{await page.screenshot({path:`${out}/${name}.png`});shots++;};
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const tid=(page,id)=>page.getByTestId(id);
const visible=async(page,id)=>{const l=tid(page,id);return (await l.count())>0&&await l.first().isVisible();};
const text=async(page,id)=>(await tid(page,id).first().textContent())||'';
const toRecord=page=>page.evaluate(()=>(document.querySelector('[data-testid="visit-record"]')||document.querySelector('[data-testid="history-stage-toggle"]')||document.querySelector('[data-testid="turn-progress"]'))?.scrollIntoView({block:'center'}));
const inView=page=>page.evaluate(()=>{const el=document.querySelector('[data-testid="visit-record"]')||document.querySelector('[data-testid="history-stage-toggle"]')||document.querySelector('[data-testid="turn-progress"]');const r=el.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight;});

/** Direction 3 keeps the record inside the work: open the work first. */
async function openWork(page){
 const t=tid(page,'history-stage-toggle').first();
 if((await t.getAttribute('aria-expanded'))!=='true'){await t.click();await settle(page);}
}
async function openRecord(page,d){
 if(d===2){await openWork(page);await page.locator('.vr-work button[aria-expanded]').first().click();}
 else await tid(page,'visit-toggle').click();
 await settle(page);
}

async function walk(width,theme,lang,d){
 const page=await open(width,theme,lang);
 const fi=lang==='fi';
 const tag=`${d+1}-${names[d]}-${lang}-${theme}-${width}`;
 await pick(page,d);
 await checkPicker(page,round);
 eq(await page.locator('.ra-lines li[aria-current]').count(),1,'one direction line current');
 // Finished: the default view.
 eq(await page.locator('.ra-review').getAttribute('data-state'),'done','opens finished');
 eq(await tid(page,'browser-dock').count(),1,'chip present');
 if(d===0){
  ok(await visible(page,'habitat-line'),'line visible');
  ok((await text(page,'habitat-line')).includes('16.42–16.48'),'line has span');
  ok((await text(page,'habitat-line')).includes(fi?'13 sivua':'13 pages'),'line counts pages');
 }
 if(d===1){
  ok(await visible(page,'visit-record'),'card visible');
  ok(await visible(page,'turn-changes'),'Muutokset beside it');
  ok((await text(page,'visit-record')).includes(fi?'13 latausta':'13 downloads'),'card counts downloads');
 }
 if(d===2){
  ok(!(await visible(page,'visit-record')),'record folded with the work');
  ok(await visible(page,'stage-browser-mark'),'mark on the work row');
  ok((await text(page,'stage-browser-mark')).includes(fi?'13 sivua':'13 pages'),'mark counts pages');
 }
 eq(await tid(page,'habitat-line').count(),d===0?1:0,'line only in 1');
 ok(await fits(page),'no overflow (done)');
 await toRecord(page);await settle(page);
 await shot(page,`${tag}-done`);
 // Open the record.
 await openRecord(page,d);
 ok(await visible(page,'visit-detail'),'detail opens');
 eq(await page.getByTestId('visit-page').count(),13,'13 pages');
 eq(await page.getByTestId('visit-origin').count(),2,'two sites');
 eq(await page.locator('[data-testid="visit-files"] li').count(),13,'13 files');
 eq(await page.locator('[data-testid="visit-actions"] li').count(),2,'two presses/entries');
 ok(await visible(page,'visit-coverage'),'coverage note');
 ok(await fits(page),'no overflow (detail)');
 if(!quick||theme==='light'){await tid(page,'visit-detail').scrollIntoViewIfNeeded();await shot(page,`${tag}-detail`);}
 // In progress.
 await tid(page,'event-live').click();await settle(page);
 eq(await page.locator('.ra-review').getAttribute('data-state'),'live','live');
 ok(await visible(page,'browser-strip'),'strip open while live');
 eq(await tid(page,'browser-window').count(),2,'own window and agent tab');
 const mark=await text(page,'agent-tab-mark');
 ok(mark.includes(fi?'Agentin välilehti':"Agent's tab")&&/8/.test(mark),'agent tab named with page count');
 ok(await page.locator('[data-window="agent"] .sb-who-agent').isVisible(),'production agent mark');
 eq(await page.locator('[data-window="own"] [data-testid="agent-tab-mark"]').count(),0,'own window unmarked');
 if(d===0)ok((await text(page,'habitat-line')).includes(fi?'nyt':'now'),'live line');
 if(d===1)ok(await visible(page,'visit-look'),'live card offers Katso');
 if(d===2)ok(await visible(page,'stage-browser-mark'),'live work mark');
 ok(await fits(page),'no overflow (live)');
 await shot(page,`${tag}-live`);
 await tid(page,'strip-show').click();await page.waitForTimeout(300);
 ok(await inView(page),'strip leads to the record');
 // Step to the end: the tab closes, the record stays.
 for(let i=0;i<40&&await tid(page,'event-step').isEnabled();i++)await tid(page,'event-step').click();
 await settle(page);
 eq(await page.locator('.ra-review').getAttribute('data-state'),'done','stepped to the end');
 if(await visible(page,'browser-strip'))eq(await tid(page,'browser-window').count(),1,'agent tab gone');
 if(d===2)await openWork(page);
 ok((await page.getByTestId('visit-record').count())>0,'record stays');
 await page.close();
}

try{
 const widths=[1440,390],themes=quick?['light','dark']:['light','dark','contrast'],langs=['fi','en'];
 for(const w of widths)for(const th of themes)for(const l of langs)for(let d=0;d<3;d++){try{await walk(w,th,l,d);}catch(e){e.message=`${d+1}-${names[d]}-${l}-${th}-${w}: ${e.message}`;throw e;}}
 eq(errors,[],'console and network clean');
 console.log(JSON.stringify({passed:true,checks,shots,combinations:widths.length*themes.length*langs.length*3,out}));
}finally{await browser.close();}
