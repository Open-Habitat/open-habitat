// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Every direction in every situation of both views at 1440 light, with
// reduced motion: asserts where the search key sits (nothing in Nyt), that
// it is in view on the default page, and what it says. Then dark and 390 px
// for one situation of each view, the administrator's flows (refused at
// save, saved with who got a copy, changed, removed), the person's flows
// (refused, saved, removed as with the speech key, added when every model
// searches on its own), English, and no running animation with reduced
// motion. Screenshots at device scale 2 named
// r2-<d>-<direction>-<view>-<case>-<width>-<theme>.png; --quick takes only
// the 1440 light situations.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-23-hakuavain-2';
const [input,out,flag]=process.argv.slice(2);
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['nyt','oma-osio','tiedot','tekoaly'];
const places=[null,'own','integrations','ai'];
const situations={admin:['ei-avainta','avain'],person:['yllapitaja','oma','molemmat','ei-avainta','natiivi','torjuttu']};
// The person's key source each situation starts from.
const source={yllapitaja:'site',oma:'own',molemmat:'own','ei-avainta':'none',natiivi:'none',torjuttu:'own'};
// The settings page each direction stands on, per view.
const pages={admin:['saneluavain','saneluavain','palvelinintegraatiot','aiavain'],person:['sanelu','sanelu','tiedot','tekoaly']};
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};

async function open(width,theme,d,view,s,motion='reduce'){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:900},deviceScaleFactor:2,reducedMotion:motion,hasTouch:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto(`http://prototype.test/?v=${d+1}&view=${view}&s=${s}&theme=${theme}`);
 await page.locator(`.rq-review[data-direction="${d}"]`).waitFor({state:'attached'});
 await settle(page,d,view);
 return page;
}
const row=view=>view==='admin'?'[data-testid="site-search-key"]':'[data-testid="search-key"]';
async function settle(page,d,view){
 await page.locator(`[data-settings-page="${pages[view][d]}"]`).waitFor({timeout:8000});
 if(d)await page.locator(row(view)).waitFor({state:'visible',timeout:8000});
 await page.waitForTimeout(800);
}
const shot=(page,d,view,c,tag)=>page.screenshot({path:`${out}/r2-${d}-${names[d]}-${view}-${c}-${tag}.png`});
const inView=async(page,sel)=>page.locator(sel).first().evaluate(el=>{const r=el.getBoundingClientRect();const top=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--review-h'))||0;return r.top>=top-1&&r.top<innerHeight-80;});
const noOverflow=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const text=(page,sel)=>page.locator(sel).first().innerText();

async function assertDefault(page,d,view,s,tag){
 const what=`${names[d]} ${view} ${s} ${tag}`;
 ok(await noOverflow(page),`${what}: document overflow`);
 eq(await page.locator('.rq-lines li[aria-current]').count(),1,`${what}: its line is marked`);
 if(d===0){
  eq(await page.locator('[data-testid="search-place"]').count(),0,`${what}: no search key today`);
  ok(await page.locator(view==='admin'?'[data-testid="site-speech-key"]':'[data-testid="speech-key-state"]').isVisible(),`${what}: today's speech key is the reference`);
  return;
 }
 eq(await page.getByTestId('search-place').getAttribute('data-place'),places[d],`${what}: in its place`);
 ok(await inView(page,row(view)),`${what}: the key row is in view on the default page`);
 if(d===1){
  eq(await page.locator('[data-testid="settings-hakuavain"][aria-current]').count(),1,`${what}: its own section is current`);
  eq(await page.locator('.s-nav-i[aria-current]').count(),1,`${what}: only one section is current`);
  if(tag.startsWith('1440'))ok(await page.locator(`[data-testid="settings-${pages[view][d]}"] + .rq-slot [data-testid="settings-hakuavain"]`).count()===1,`${what}: the section sits right after dictation's`);
 }
 const words=await text(page,row(view));
 if(view==='admin'){
  eq(await page.getByTestId('site-search-key').getAttribute('data-site'),s==='avain'?'brave':'none',`${what}: site key`);
  if(s==='avain')ok(/4 sai avaimen, 1 käyttää omaa avaintaan/.test(words),`${what}: says who got a copy`);
  else ok(await page.getByTestId('search-key-form').isVisible(),`${what}: the form stands open with no key, as in Saneluavain`);
  return;
 }
 eq(await page.getByTestId('search-key').getAttribute('data-source'),source[s],`${what}: key source`);
 if(s==='yllapitaja')ok(/Ylläpitäjän avain Brave …k7q2/.test(words)&&/Lisää oma avain/.test(words),`${what}: the administrator's key and adding one's own`);
 if(s==='oma'||s==='molemmat')ok(/Oma avain/.test(words)&&!/Ylläpitäjä/.test(words),`${what}: one's own key, the site's not told, as with the speech key`);
 if(s==='ei-avainta'){ok(/DeepSeek-mallit eivät voi hakea/.test(words),`${what}: names who cannot search`);ok(await page.getByTestId('search-key-form').isVisible(),`${what}: the form stands open`);}
 if(s==='natiivi'){ok(/ChatGPT ja Claude hakevat verkosta itse/.test(words),`${what}: names who search on their own`);eq(await page.getByTestId('search-key-form').count(),0,`${what}: no form when no model needs it`);}
 if(s==='torjuttu')ok(/torjui avaimen/.test(words)&&/Ei vastaa/.test(words),`${what}: says Brave refused`);
 if(source[s]!=='none')ok(/DeepSeek-mallit hakevat tällä avaimella/.test(words),`${what}: says which models use it`);
}

try{
 for(const view of ['admin','person'])for(let d=0;d<4;d++)for(const s of situations[view]){
  const page=await open(1440,'light',d,view,s);
  if(d===0&&view==='admin'&&s==='ei-avainta')await checkPicker(page,round);
  await assertDefault(page,d,view,s,'1440-light');
  await shot(page,d,view,s,'1440-light');
  await page.close();
 }
 if(!quick){
  for(const [width,theme] of [[1440,'dark'],[390,'light'],[390,'dark']])for(const [view,s] of [['admin','avain'],['person','oma']])for(let d=0;d<4;d++){
   const tag=`${width}-${theme}`;
   const page=await open(width,theme,d,view,s);
   await assertDefault(page,d,view,s,tag);
   await shot(page,d,view,s,tag);
   await page.close();
  }
  for(let d=1;d<4;d++){
   // The administrator: a key the service refuses, then one it takes.
   let page=await open(1440,'light',d,'admin','ei-avainta');
   eq(await page.locator('[data-testid="search-backend-brave"][aria-pressed="true"]').count(),1,`${names[d]}: Brave is the default`);
   await page.getByTestId('search-key-input').fill('huono-avain-1234567890');
   await page.getByTestId('search-key-save').click();
   await page.getByTestId('site-search-key-problem').waitFor();
   eq(await page.getByTestId('site-search-key').getAttribute('data-site'),'none',`${names[d]}: a refused site key is not stored`);
   await shot(page,d,'admin','torjuttu-tallennus','1440-light');
   await page.getByTestId('search-backend-staan').click();
   await page.getByTestId('search-key-input').fill('STn7Hk2pQ9mN4vR8tY3wZ6c');
   await page.getByTestId('search-key-save').click();
   await page.getByTestId('site-search-key-giving').waitFor();
   await page.getByTestId('site-search-key-saved').waitFor();
   eq(await page.getByTestId('site-search-key').getAttribute('data-site'),'staan',`${names[d]}: the Staan key is stored`);
   ok(/ei tavoitettu/.test(await text(page,'[data-testid="site-search-given"]'))&&/tallennat sen uudelleen/.test(await text(page,'[data-testid="site-search-given"]')),`${names[d]}: who got a copy and who was not reached`);
   await shot(page,d,'admin','tallennettu','1440-light');
   // Changing: the form returns with the stored key's service chosen.
   await page.getByTestId('site-search-key-replace').click();
   eq(await page.locator('[data-testid="search-backend-staan"][aria-pressed="true"]').count(),1,`${names[d]}: changing starts from the stored service`);
   await page.getByTestId('search-key-input').fill('BSAq8Lm3Np7Rt2Vx9Yz4Kd');
   await page.getByTestId('search-backend-brave').click();
   await page.getByTestId('search-key-save').click();
   await page.getByTestId('site-search-key-saved').waitFor();
   ok(/sai uuden avaimen aiemman tilalle/.test(await text(page,'[data-testid="site-search-given"]')),`${names[d]}: a new key replaces earlier copies`);
   // Removing leaves the copies.
   await page.getByTestId('site-search-key-remove').click();
   await page.getByTestId('search-key-form').waitFor();
   eq(await page.getByTestId('site-search-key').getAttribute('data-site'),'none',`${names[d]}: the site key is gone`);
   ok(/kopiot jäivät ennalleen/.test(await text(page,'[data-testid="site-search-key-saved"]')),`${names[d]}: removing says the copies stay`);
   await shot(page,d,'admin','poistettu','1440-light');
   await page.close();
   // The person: refused, then saved.
   page=await open(1440,'light',d,'person','ei-avainta');
   await page.getByTestId('search-key-input').fill('bad-key-12345678901234');
   await page.getByTestId('search-key-save').click();
   await page.getByTestId('search-key-rejected').waitFor();
   eq(await page.getByTestId('search-key').getAttribute('data-source'),'none',`${names[d]}: a refused key is not saved`);
   await page.getByTestId('search-key-input').fill('BSAq8Lm3Np7Rt2Vx9Yz4Kd');
   await page.getByTestId('search-key-save').click();
   await page.getByTestId('search-key-saved').waitFor();
   eq(await page.getByTestId('search-key').getAttribute('data-source'),'own',`${names[d]}: the saved key is own`);
   await shot(page,d,'person','tallennettu','1440-light');
   await page.close();
   // Removing an own key with the site's behind it leaves none, as Sanelu does.
   page=await open(1440,'light',d,'person','molemmat');
   await page.getByTestId('search-key-remove').click();
   await page.getByTestId('search-key-form').waitFor();
   eq(await page.getByTestId('search-key').getAttribute('data-source'),'none',`${names[d]}: removal leaves no key until the administrator saves again`);
   await page.close();
   // Every model searches on its own: the key is only something to add.
   page=await open(1440,'light',d,'person','natiivi');
   await page.getByTestId('search-key-add').click();
   await page.getByTestId('search-key-form').waitFor();
   await page.getByTestId('search-key-cancel').click();
   eq(await page.getByTestId('search-key-form').count(),0,`${names[d]}: cancel folds the form`);
   await page.close();
   // Nothing animates with reduced motion, the form open.
   page=await open(1440,'light',d,'person','oma');
   await page.getByTestId('search-key-replace').click();
   await page.waitForTimeout(400);
   eq(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length),0,`${names[d]}: no running animation with reduced motion`);
   await page.close();
  }
  // English, both views.
  for(const [view,s] of [['admin','avain'],['person','oma']])for(let d=0;d<4;d++){
   const page=await open(1440,'light',d,view,s);
   await page.locator('#language').selectOption('en');
   await settle(page,d,view);
   if(d)ok(/Shared search key|Search key/.test(await text(page,row(view))),`${names[d]} ${view}: English`);
   ok(/Settings|Server administration|Administration/i.test(await text(page,'.ah-account-settings')),`${names[d]} ${view}: production follows the language`);
   await shot(page,d,view,`${s}-en`,'1440-light');
   await page.close();
  }
 }
 eq(errors.length,0,`console clean: ${errors.join(' | ')}`);
 console.log(`${checks} checks, console clean`);
}finally{await browser.close();}
