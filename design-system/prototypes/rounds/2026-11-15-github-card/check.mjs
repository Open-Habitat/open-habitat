// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component check, not a host-backed acceptance test.
// Walks Nyt and the three directions at 1440 and 390 px in Päivä, Yö and
// Kontrasti in Finnish, and Päivä in English: seven scenes per direction,
// Nyt's production card with its Check pressed (the gateway's 403), the
// directions' card saying who and whether it works, the workflow row's
// state, where the rare actions are (1 behind Details, 2 visible, 3 in the
// ⋯ menu), and no document overflow. Then at 1440 Päivä per direction:
// Allow, Remove permission, Don't allow, Cancel, Sign in again from
// expired, and the disconnect path (old sign-in → Confirm with GitHub →
// Disconnect → disconnected with its notice). Screenshots are full pages
// at device scale 2 named <n>-<direction>-<width>-<theme>[-en].png;
// --quick takes only 1440 Päivä.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-15-github-card';
const [input,out,flag]=process.argv.slice(2);
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['nyt','lisatiedot','nakyvissa','valikko'];
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};

async function open(width,theme,lang='fi'){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:1000},deviceScaleFactor:2,hasTouch:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto(`http://prototype.test/?theme=${theme}&lang=${lang}`);
 await settle(page);
 return page;
}
const settle=async page=>{await page.locator('.gc-review[data-ready]').waitFor({state:'attached',timeout:15000});await page.waitForTimeout(300);};
const pick=async(page,d)=>{await page.locator('.proto-picker-item').nth(d).click();await page.locator(`.gc-review[data-direction="${d}"]`).waitFor({state:'attached'});await settle(page);};
const shot=(page,d,tag)=>page.screenshot({path:`${out}/${d}-${names[d]}-${tag}.png`,fullPage:true});
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const scene=(page,id)=>page.getByTestId(`scene-${id}`);
const REAUTH={fi:'5 minuutin sisällä',en:'within 5 minutes'};

async function scenes(page,d,lang,at){
 eq(await page.locator('.gc-scene').count(),7,`${at}: seven scenes`);
 if(d===0){
  eq(await scene(page,'off').getByTestId('github-native-state').getAttribute('data-state'),'connected',`${at}: production card`);
  eq(await scene(page,'missing').getByTestId('github-workflow').getAttribute('data-wf'),'missing',`${at}: production missing`);
  eq(await scene(page,'pending').getByTestId('github-workflow').getAttribute('data-wf'),'pending',`${at}: production pending`);
  eq(await scene(page,'on').getByTestId('github-workflow').getAttribute('data-wf'),'on',`${at}: production on`);
  ok((await scene(page,'confirm').textContent()).includes(REAUTH[lang]),`${at}: Check answers with the 5-minute rule`);
 }else{
  for(const [id,wf] of [['off','off'],['on','on'],['missing','missing'],['pending','pending'],['confirm','off']]){
   eq(await scene(page,id).getByTestId('gc-identity').getAttribute('data-native'),'connected',`${at}: ${id} connected`);
   ok((await scene(page,id).getByTestId('gc-who').textContent()).includes('maija-example'),`${at}: ${id} names the account`);
   eq(await scene(page,id).getByTestId('gc-wf').getAttribute('data-wf'),wf,`${at}: ${id} workflow ${wf}`);
   eq(await scene(page,id).getByTestId('github-scopes').count(),0,`${at}: no scope chips`);
  }
  for(const id of ['expired','none']){
   eq(await scene(page,id).getByTestId('gc-wf').count(),0,`${at}: ${id} no workflow row`);
   ok(await scene(page,id).getByTestId('gc-signin').isVisible(),`${at}: ${id} one way back`);
  }
  // Where the rare actions are, visible on the default view.
  const off=scene(page,'off');
  eq(await off.getByTestId('gc-details').count(),d===1?1:0,`${at}: details toggle only in 1`);
  if(d===1)eq(await off.getByTestId('gc-disconnect').isVisible(),false,`${at}: 1 disconnect folded`);
  eq(await off.getByTestId('gc-footer').count(),d===2?1:0,`${at}: footer only in 2`);
  if(d===2)ok(await off.getByTestId('gc-disconnect').isVisible(),`${at}: 2 disconnect visible`);
  eq(await off.getByTestId('gc-menu').count(),d===3?1:0,`${at}: menu only in 3`);
  eq(await scene(page,'confirm').locator('.gc-static').count(),2,`${at}: both dialogs drawn`);
 }
 ok(await fits(page),`${at}: document overflow`);
}

try{
const runs=[];
for(const width of quick?[1440]:[1440,390])for(const theme of quick?['light']:['light','dark','contrast'])runs.push([width,theme,'fi']);
if(!quick)runs.push([1440,'light','en'],[390,'light','en']);
for(const [width,theme,lang] of runs){
 const tag=`${width}-${theme}${lang==='en'?'-en':''}`;
 const page=await open(width,theme,lang);
 await checkPicker(page,round);
 eq(await page.getByTestId('recommendation').count(),1,'the recommendation is on the page');
 for(let d=0;d<4;d++){
  if(d>0)await pick(page,d);
  const at=`${names[d]} ${tag}`;
  eq(await page.locator('.gc-lines li[aria-current]').count(),1,`${at}: its line is marked`);
  await scenes(page,d,lang,at);
  await shot(page,d,tag);
 }
 await page.close();
}

{
 const page=await open(1440,'light');
 const signedIn=()=>page.waitForTimeout(1300);
 for(let d=1;d<4;d++){
  await pick(page,d);
  const at=`events ${names[d]}`;
  const wf=id=>scene(page,id).getByTestId('gc-wf');
  await scene(page,'off').getByTestId('gc-wf-allow').click();await signedIn();
  eq(await wf('off').getAttribute('data-wf'),'on',`${at}: allowed`);
  await scene(page,'on').getByTestId('gc-wf-remove').click();await signedIn();
  eq(await wf('on').getAttribute('data-wf'),'off',`${at}: removed`);
  await scene(page,'missing').getByTestId('gc-wf-keep-off').click();
  eq(await wf('missing').getAttribute('data-wf'),'off',`${at}: kept off`);
  await scene(page,'pending').getByTestId('gc-wf-cancel').click();
  eq(await wf('pending').getAttribute('data-wf'),'off',`${at}: cancelled`);
  await scene(page,'expired').getByTestId('gc-signin').click();await signedIn();
  eq(await scene(page,'expired').getByTestId('gc-identity').getAttribute('data-native'),'connected',`${at}: signed in again`);
  // Disconnect from the default view of each direction.
  const c=scene(page,'confirm');
  if(d===1){await c.locator('.gc-details summary').click();await c.getByTestId('gc-disconnect').click();}
  else if(d===2)await c.getByTestId('gc-disconnect').click();
  else{await c.getByTestId('gc-menu').click();await page.getByTestId('menu-scopes').click();
   ok((await c.getByTestId('gc-scopes-open').textContent()).includes('read:org'),`${at}: scopes from the menu`);
   await c.getByTestId('gc-menu').click();await page.getByTestId('menu-disconnect').click();}
  const dlg=page.getByTestId('gc-dialog');
  await dlg.waitFor();
  ok(await dlg.getByTestId('gc-dlg-verify').isVisible(),`${at}: old sign-in asks to confirm`);
  await page.screenshot({path:`${out}/${d}-${names[d]}-dialog-verify-1440-light.png`});
  await dlg.getByTestId('gc-dlg-verify-btn').click();
  await dlg.getByTestId('gc-dlg-back').waitFor();
  await page.screenshot({path:`${out}/${d}-${names[d]}-dialog-back-1440-light.png`});
  await dlg.getByTestId('gc-dlg-confirm').click();
  await dlg.waitFor({state:'detached'});
  eq(await c.getByTestId('gc-identity').getAttribute('data-native'),'disconnected',`${at}: disconnected`);
  ok(await c.getByTestId('gc-notice').isVisible(),`${at}: says what happened`);
  await shot(page,d,'after-1440-light');
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[],'console errors');
console.log(`${checks} checks passed`);
