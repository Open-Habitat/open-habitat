// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Every direction in every situation of both views at 1440 light with
// reduced motion: asserts where search sits among the services (nothing in
// Nyt), what it says, and that the whole page fits. Then dark and 390 px for
// one situation of each view, the administrator's flows (refused at save,
// saved with who got a copy, changed, removed), the person's flows (refused,
// saved, removed as with the speech key, added and cancelled when every
// model searches on its own), English, and no running animation with
// reduced motion. Screenshots at device scale 2, named
// r3-<d>-<direction>-<view>-<case>-<width>-<theme>.png; each 1440 light
// situation and each 390 light one also as -page.png, the whole settings
// page unrolled. --quick
// takes only the 1440 light situations.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-23-hakuavain-3';
const [input,out,flag]=process.argv.slice(2);
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['nyt','palvelu-kerrallaan','yksi-rivi','tiivis'];
const places=[null,'services','service','compact'];
const situations={admin:['ei-avainta','avain'],person:['yllapitaja','oma','molemmat','ei-avainta','natiivi','torjuttu']};
const source={yllapitaja:'site',oma:'own',molemmat:'own','ei-avainta':'none',natiivi:'none',torjuttu:'own'};
const pages={admin:'palvelinintegraatiot',person:'tiedot'};
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
async function settle(page,d,view){
 await page.locator(`[data-settings-page="${pages[view]}"]`).waitFor({timeout:8000});
 await page.locator(view==='admin'?'[data-testid="si-rows"]':'.ig-main .ig-tiles, .ig-main .ig-provider').first().waitFor({timeout:8000});
 if(d)await page.locator('[data-testid="search-place"]').first().waitFor({state:'attached',timeout:8000});
 await page.waitForTimeout(700);
}
const shot=(page,d,view,c,tag)=>page.screenshot({path:`${out}/r3-${d}-${names[d]}-${view}-${c}-${tag}.png`});
/** The whole settings page, its scroll containers unrolled. */
async function pageShot(page,d,view,c,tag){
 await page.evaluate(()=>{let e=document.querySelector('.s-main');while(e&&e!==document.body){e.style.overflow='visible';e.style.height='auto';e.style.maxHeight='none';e=e.parentElement;}for(const el of [document.documentElement,document.body]){el.style.height='auto';el.style.overflow='visible';}for(const el of document.querySelectorAll('.proto-picker,.rq-bar'))el.style.display='none';document.querySelector('.rq-stage .ah-app-shell')?.style.setProperty('top','0');});
 await page.waitForTimeout(200);
 const box=await page.locator('.s-main').first().boundingBox();
 await page.screenshot({path:`${out}/r3-${d}-${names[d]}-${view}-${c}-${tag}-page.png`,fullPage:true,clip:{x:box.x,y:box.y,width:box.width,height:box.height}});
}
const noOverflow=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const text=(page,sel)=>page.locator(sel).first().innerText();

// The administrator's key, as the rows say it: which service, or none.
async function siteOf(page,d){
 if(d===1){for(const b of ['brave','staan'])if(await page.getByTestId(`site-search-row-${b}`).getAttribute('data-site')==='set')return b;return 'none';}
 return page.getByTestId('site-search-row').getAttribute('data-site');
}
const personSource=async page=>(await page.getByTestId('search-key').count())?page.getByTestId('search-key').getAttribute('data-source'):'none';
async function menu(page,item){
 await page.locator('[data-testid="site-search-menu"] button').click();
 await page.getByRole('menuitem',{name:item}).click();
}
/** Opens the administrator's form for a service (A) or at all (B, C). */
async function openSite(page,d,b){
 const set=await siteOf(page,d);
 if(d===1){if(set===b)await menu(page,'Vaihda avain…');else await page.getByTestId(`site-search-set-${b}`).click();}
 else if(d===2){if(set!=='none')await menu(page,'Vaihda avain…');else await page.getByTestId('site-search-set').click();}
 else if(set!=='none')await page.getByTestId('site-search-key-replace').click();
 await page.getByTestId('search-key-form').waitFor();
}
async function removeSiteKey(page,d){
 if(d===3)await page.getByTestId('site-search-key-remove').click();else await menu(page,'Poista avain');
}
async function openPerson(page,d,b){
 if(await page.getByTestId('search-key-form').count())return;
 if(await page.getByTestId('search-key-replace').count()&&(d!==1||(await page.getByTestId('search-key').getAttribute('data-backend'))===b))await page.getByTestId('search-key-replace').click();
 else await page.getByTestId(d===1?`search-add-${b}`:'search-add').click();
 await page.getByTestId('search-key-form').waitFor();
}

async function assertDefault(page,d,view,s,tag){
 const what=`${names[d]} ${view} ${s} ${tag}`;
 ok(await noOverflow(page),`${what}: document overflow`);
 eq(await page.locator('.rq-lines li[aria-current]').count(),1,`${what}: its line is marked`);
 if(d===0){eq(await page.locator('[data-testid="search-place"]').count(),0,`${what}: no search today`);return;}
 eq(await page.locator('[data-testid="search-place"]').first().getAttribute('data-place'),places[d],`${what}: its shape`);
 if(view==='admin'){
  // Every direction sits in the services list itself, after the services.
  ok(await page.locator('[data-testid="si-rows"] [data-testid^="site-search-row"]').count()===(d===1?2:1),`${what}: rows in the services list`);
  eq(await siteOf(page,d),s==='avain'?'brave':'none',`${what}: site key`);
  const words=await text(page,'[data-testid="si-rows"] .rq-slot');
  if(s==='avain')ok(/4 sai avaimen, 1 käyttää omaa avaintaan/.test(words),`${what}: says who got a copy`);
  if(s==='avain'&&d===1)ok(/Käytössä on Brave/.test(words),`${what}: Staan says Brave is in use`);
  if(s==='ei-avainta')ok(/Ei tarjolla/.test(words),`${what}: not offered`);
  if(s==='ei-avainta')eq(await page.getByTestId('search-key-form').count(),d===3?1:0,`${what}: the form stands open only in C`);
  return;
 }
 eq(await personSource(page),source[s],`${what}: key source`);
 const words=await text(page,'.ig-main');
 if(s==='yllapitaja')ok(/Ylläpitäjän avain/.test(words)&&/k7q2/.test(words)&&/Lisää oma avain/.test(words),`${what}: the administrator's key and adding one's own`);
 if(s==='oma'||s==='molemmat')ok(/Oma avain/.test(words)&&!/Ylläpitäjän avain/.test(words),`${what}: one's own key, the site's not told`);
 if(s==='ei-avainta'){ok(/DeepSeek-mallit eivät (voi hakea|hae)/.test(words),`${what}: names who cannot search`);eq(await page.getByTestId('search-key-form').count(),d===3?1:0,`${what}: the form stands open only in C`);}
 if(s==='natiivi'){ok(/ChatGPT ja Claude hakevat/.test(words),`${what}: names who search on their own`);eq(await page.getByTestId('search-key-form').count(),0,`${what}: no form`);}
 if(s==='torjuttu')ok(/torjui avaimen/.test(words)&&/Ei vastaa/.test(words),`${what}: says Brave refused`);
 if(source[s]!=='none')ok(/DeepSeek-mallit hakevat tällä avaimella/.test(words),`${what}: says which models use it`);
 if(d===1&&s==='molemmat')ok(await page.getByTestId('search-tile-brave').isVisible()&&(await page.getByTestId('search-key').getAttribute('data-backend'))==='staan',`${what}: Staan's card, Brave's tile`);
 if(d===2&&source[s]==='none')ok(await page.getByTestId('search-tile').isVisible(),`${what}: one Web search tile`);
 if(d===3){const first=await page.locator('.ig-main > *').evaluateAll(els=>els.findIndex(e=>e.matches('.rq-slot')||e.classList.contains('ig-provider')));ok(first>=0,`${what}: compact card leads the connected services`);}
}

try{
 for(const view of ['admin','person'])for(let d=0;d<4;d++)for(const s of situations[view]){
  const page=await open(1440,'light',d,view,s);
  if(d===0&&view==='admin'&&s==='ei-avainta')await checkPicker(page,round);
  await assertDefault(page,d,view,s,'1440-light');
  await shot(page,d,view,s,'1440-light');
  await pageShot(page,d,view,s,'1440-light');
  await page.close();
 }
 if(!quick){
  for(const [width,theme] of [[1440,'dark'],[390,'light'],[390,'dark']])for(const [view,s] of [['admin','avain'],['person','yllapitaja']])for(let d=0;d<4;d++){
   const tag=`${width}-${theme}`;
   const page=await open(width,theme,d,view,s);
   await assertDefault(page,d,view,s,tag);
   await shot(page,d,view,s,tag);
   if(tag==='390-light')await pageShot(page,d,view,s,tag);
   await page.close();
  }
  for(let d=1;d<4;d++){
   // The administrator: a key the service refuses, then one it takes.
   let page=await open(1440,'light',d,'admin','ei-avainta');
   await openSite(page,d,'brave');
   eq(await page.getByTestId('search-key-form').getAttribute('data-backend'),'brave',`${names[d]}: Brave is the default`);
   eq(await page.getByTestId('search-backends').count(),d===1?0:1,`${names[d]}: the service is chosen in the form unless the row names it`);
   await page.getByTestId('search-key-input').fill('huono-avain-1234567890');
   await page.getByTestId('search-key-save').click();
   await page.getByTestId('search-key-rejected').waitFor();
   eq(await siteOf(page,d),'none',`${names[d]}: a refused site key is not stored`);
   await shot(page,d,'admin','torjuttu-tallennus','1440-light');
   if(d===1){await page.getByTestId('search-key-cancel').click();await page.getByTestId('search-key-form').waitFor({state:'detached'});await openSite(page,d,'staan');}
   else await page.getByTestId('search-backend-staan').click();
   await page.getByTestId('search-key-input').fill('STn7Hk2pQ9mN4vR8tY3wZ6c');
   await page.getByTestId('search-key-save').click();
   await page.getByTestId('search-key-checking').waitFor();
   await page.getByTestId('site-search-given').waitFor();
   eq(await siteOf(page,d),'staan',`${names[d]}: the Staan key is stored`);
   eq(await page.getByTestId('search-key-form').count(),0,`${names[d]}: the form closes on save`);
   ok(/ei tavoitettu/.test(await text(page,'[data-testid="site-search-given"]'))&&/tallennat sen uudelleen/.test(await text(page,'[data-testid="site-search-given"]')),`${names[d]}: who got a copy and who was not reached`);
   await shot(page,d,'admin','tallennettu','1440-light');
   // Changing: B and C start from the stored service; A changes service on the other row.
   await openSite(page,d,'brave');
   if(d===1)ok(/korvaa yhteisen Staan-avaimen/.test(await text(page,'[data-testid="search-key-replaces"]')),`${names[d]}: the other row says it replaces the key in use`);
   else{eq(await page.getByTestId('search-key-form').getAttribute('data-backend'),'staan',`${names[d]}: changing starts from the stored service`);await page.getByTestId('search-backend-brave').click();}
   await shot(page,d,'admin','vaihto','1440-light');
   await page.getByTestId('search-key-input').fill('BSAq8Lm3Np7Rt2Vx9Yz4Kd');
   await page.getByTestId('search-key-save').click();
   await page.getByTestId('search-key-form').waitFor({state:'detached'});
   eq(await siteOf(page,d),'brave',`${names[d]}: the Brave key replaced the Staan key`);
   ok(/sai uuden avaimen aiemman tilalle/.test(await text(page,'[data-testid="site-search-given"]')),`${names[d]}: a new key replaces earlier copies`);
   if(d!==3){await page.locator('[data-testid="site-search-menu"] button').click();await page.getByTestId('site-search-menu-given').waitFor();await shot(page,d,'admin','valikko','1440-light');await page.keyboard.press('Escape');}
   // Removing leaves the copies.
   await removeSiteKey(page,d);
   await page.getByTestId('site-search-key-saved').waitFor();
   eq(await siteOf(page,d),'none',`${names[d]}: the site key is gone`);
   ok(/kopiot jäivät ennalleen/.test(await text(page,'[data-testid="site-search-key-saved"]')),`${names[d]}: removing says the copies stay`);
   await shot(page,d,'admin','poistettu','1440-light');
   await page.close();
   // The person: refused, then saved.
   page=await open(1440,'light',d,'person','ei-avainta');
   await openPerson(page,d,'brave');
   await page.getByTestId('search-key-input').fill('bad-key-12345678901234');
   await page.getByTestId('search-key-save').click();
   await page.getByTestId('search-key-rejected').waitFor();
   eq(await personSource(page),'none',`${names[d]}: a refused key is not saved`);
   await shot(page,d,'person','torjuttu-tallennus','1440-light');
   await page.getByTestId('search-key-input').fill('BSAq8Lm3Np7Rt2Vx9Yz4Kd');
   await page.getByTestId('search-key-save').click();
   await page.getByTestId('search-key-form').waitFor({state:'detached'});
   eq(await personSource(page),'own',`${names[d]}: the saved key is own`);
   eq(await page.getByTestId('search-key-form').count(),0,`${names[d]}: the form closes on save`);
   await shot(page,d,'person','tallennettu','1440-light');
   await page.close();
   // Removing an own key with the site's behind it leaves none, as Sanelu does.
   page=await open(1440,'light',d,'person','molemmat');
   await page.getByTestId('search-key-remove').click();
   await page.waitForTimeout(500);
   eq(await personSource(page),'none',`${names[d]}: removal leaves no key until the administrator saves again`);
   await page.close();
   // Every model searches on its own: the key is only something to add.
   page=await open(1440,'light',d,'person','natiivi');
   await openPerson(page,d,'brave');
   await page.getByTestId('search-key-cancel').click();
   await page.getByTestId('search-key-form').waitFor({state:'detached'});
   eq(await page.getByTestId('search-key-form').count(),0,`${names[d]}: cancel folds the form`);
   await page.close();
   // Nothing animates with reduced motion, the form open.
   page=await open(1440,'light',d,'person','oma');
   await openPerson(page,d,'brave');
   await page.waitForTimeout(400);
   eq(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length),0,`${names[d]}: no running animation with reduced motion`);
   await shot(page,d,'person','lomake','1440-light');
   await page.close();
  }
  // English, both views.
  for(const [view,s] of [['admin','avain'],['person','yllapitaja']])for(let d=0;d<4;d++){
   const page=await open(1440,'light',d,view,s);
   await page.locator('#language').selectOption('en');
   await settle(page,d,view);
   if(d)ok(/Web search|Brave/.test(await text(page,view==='admin'?'[data-testid="si-rows"] .rq-slot':'[data-testid="search-key"]')),`${names[d]} ${view}: English`);
   if(d&&view==='admin')ok(/Offered/.test(await text(page,'[data-testid="si-rows"] .rq-slot')),`${names[d]} ${view}: English state`);
   ok(/Integrations|Data for agents/i.test(await text(page,'.ah-account-settings')),`${names[d]} ${view}: production follows the language`);
   await shot(page,d,view,`${s}-en`,'1440-light');
   await page.close();
  }
 }
 eq(errors.length,0,`console clean: ${errors.join(' | ')}`);
 console.log(`${checks} checks, console clean`);
}finally{await browser.close();}
