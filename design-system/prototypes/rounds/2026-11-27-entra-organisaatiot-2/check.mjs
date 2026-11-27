// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Every direction (Nyt, A1, A2, A3), both top-bar views and every situation
// at 1440 light, 390 light, 1440 dark and 1440 light in English (--quick:
// 1440 light Finnish only), with reduced motion: asserts the situation's
// view (the list collapsed by default, the dialog or panel it opens), no
// document or dialog overflow, no running animation, a clean console and
// the picker. Then at 1440 light: each direction opens its list, adds an
// organisation (validation, consent follows, the list grows), removes one,
// copies the message and opens Lisätietoja; the person view is reached from
// the top bar and connects the third organisation as a guest to a files-only
// card, and the device step's refusal names the organisation. A2's phone
// sheet at 390. Screenshots r2-<d>-<view>-<situation>-<tag>.png.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-27-entra-organisaatiot-2';
const [input,out,flag]=process.argv.slice(2);
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const SITUATIONS={admin:['lista','auki','lisaa','hyvaksynta','poisto'],person:['henkilo','taso','koodi','valmis','kielto']};
const NOW={admin:['lista'],person:['henkilo','taso']};
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};

async function open(width,theme,d,view,s,lang='fi'){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:900},deviceScaleFactor:phone?2:1,reducedMotion:'reduce',hasTouch:phone});
 page.on('pageerror',e=>errors.push(`${d} ${view} ${s} ${lang}: ${e.message}`));
 page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errors.push(`${d} ${view} ${s} ${lang}: ${m.text()}`);});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto(`http://prototype.test/?v=${d+1}&view=${view}&s=${s}&theme=${theme}&lang=${lang}`);
 await page.locator(`.rq-review[data-direction="${d}"]`).waitFor({state:'attached'});
 await page.getByTestId('rq-page').waitFor();
 await page.waitForTimeout(300);
 return page;
}
const shot=(page,name)=>page.screenshot({path:`${out}/r2-${name}.png`,fullPage:true});
const noOverflow=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const dialogNoOverflow=page=>page.evaluate(()=>[...document.querySelectorAll('[role=dialog]')].every(d=>d.scrollWidth<=d.clientWidth+1));
const running=page=>page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running'&&!a.effect?.target?.closest?.('.proto-picker')).length);
const vis=async(page,id)=>(await page.getByTestId(id).count())>0&&await page.getByTestId(id).first().isVisible();
const count=page=>page.getByTestId('rq-rowline').getAttribute('data-count');

async function assertView(page,d,view,s,what,lang){
 ok(await noOverflow(page),`${what}: document overflow`);
 ok(await dialogNoOverflow(page),`${what}: dialog overflow`);
 eq(await running(page),0,`${what}: animation under reduced motion`);
 eq(await page.getByTestId(`rq-view-${view}`).getAttribute('aria-pressed'),'true',`${what}: view marked`);
 eq(await page.locator('.rq-review').getAttribute('data-scenario'),s,`${what}: situation`);
 if(d===0){
  if(view==='admin'){ok(await vis(page,'si-row-microsoft'),`${what}: production row`);eq(await page.getByTestId('rq-rowline').count(),0,`${what}: nothing added`);}
  else{ok(await vis(page,'integration-account-microsoft'),`${what}: production card`);if(s==='taso')ok(await vis(page,'integration-dialog'),`${what}: production connect`);}
  return;
 }
 if(view==='admin'){
  eq(await page.getByTestId('rq-rowline').count(),1,`${what}: row line`);
  const open=s==='auki';
  eq(await vis(page,'rq-orgs-panel'),open,`${what}: list ${open?'open':'collapsed'}`);
  if(open)eq(await page.locator('[data-testid^="rq-org-"]').count(),3,`${what}: three organisations`);
  if(d===3&&!open&&s==='lista')eq(await page.locator('[data-testid^="rq-chip-"]').count(),3,`${what}: three chips`);
  if(s==='lisaa')ok(await vis(page,'rq-add-dialog'),`${what}: add dialog`);
  if(s==='hyvaksynta'){
   const m=await page.getByTestId('rq-message').innerText();
   ok(m.includes('Asiakas Yksi Oy')&&m.includes('adminconsent')&&m.includes(lang==='fi'?'vahvistamattomana':'unverified'),`${what}: message`);
   eq(await page.locator('[data-testid^="rq-link-"]').count(),4,`${what}: four level links`);
   eq(await vis(page,'rq-more-consent-body'),false,`${what}: explanations folded`);
  }
  if(s==='poisto')ok((await page.getByTestId('rq-remove').innerText()).includes(lang==='fi'?'Microsoftissa ei peruta mitään':'Nothing is revoked'),`${what}: removal`);
  if(s==='lista'||s==='auki')eq(await page.locator('[role=dialog]').count(),d===2&&open?1:d===3&&open?1:0,`${what}: dialogs`);
 } else {
  eq(await page.locator('[data-testid^="rq-card-"]').count(),2,`${what}: two connected organisations`);
  ok(await page.getByTestId('rq-row-c2').count()===1,`${what}: third not connected`);
  if(s==='henkilo'){ok(await vis(page,'rq-row-c2'),`${what}: row visible`);ok(await vis(page,'rq-guest-off'),`${what}: guest line`);eq(await page.locator('[role=dialog]').count(),0,`${what}: no dialog`);}
  if(s==='taso'||s==='koodi'||s==='valmis'){ok(await vis(page,'integration-dialog'),`${what}: production connect`);eq(await page.getByTestId('rq-orgline').getAttribute('data-org'),'c2',`${what}: organisation line`);}
  if(s==='koodi')ok((await page.getByText('R4TW9KQ2M').count())>0,`${what}: device code`);
  if(s==='valmis')ok(await vis(page,'rq-guest-files'),`${what}: files only`);
  if(s==='kielto'){ok(await vis(page,'rq-refusal-consent_required'),`${what}: refusal`);ok((await page.getByTestId('rq-refused').innerText()).includes('Asiakas Kaksi Oy'),`${what}: names it`);}
 }
}

const tags=quick?[[1440,'light','fi']]:[[1440,'light','fi'],[390,'light','fi'],[1440,'dark','fi'],[1440,'light','en']];
for(let d=0;d<=3;d++)for(const view of ['admin','person'])for(const s of (d===0?NOW:SITUATIONS)[view])for(const [w,theme,lang] of tags){
 const tag=`${w}-${theme}${lang==='en'?'-en':''}`;
 const page=await open(w,theme,d,view,s,lang);
 await assertView(page,d,view,s,`${d} ${view} ${s} ${tag}`,lang);
 if(d===0&&view==='admin'&&tag==='1440-light'){await checkPicker(page,round);checks++;}
 await shot(page,`${d}-${view}-${s}-${tag}`);
 await page.close();
}

// Flows, 1440 light.
for(let d=1;d<=3;d++){
 let page=await open(1440,'light',d,'admin','lista');
 await page.getByTestId('rq-orgs-toggle').click();
 ok(await vis(page,'rq-orgs-panel'),`${d}: list opens`);
 await page.getByTestId('rq-more-list-toggle').click();
 ok(await vis(page,'rq-more-list-body'),`${d}: Lisätietoja opens`);
 await shot(page,`${d}-admin-auki-lisatietoja-1440-light`);
 await page.getByTestId('rq-add-open').click();
 ok(await vis(page,'rq-add-dialog'),`${d}: add from the list`);
 await page.getByTestId('rq-add-label').fill('Asiakas Kolme Oy');
 await page.getByTestId('rq-add-tenant').fill('asiakaskolme.example');
 await page.getByTestId('rq-add-save').click();
 ok((await page.getByTestId('rq-add-dialog').innerText()).includes('GUID'),`${d}: domain refused`);
 await page.getByTestId('rq-add-tenant').fill('9A4E7B21-5C3D-4F60-8E1A-7B2C9D0E4F35');
 await page.getByTestId('rq-add-save').click();
 ok((await page.getByTestId('rq-add-dialog').innerText()).includes('Asiakas Yksi Oy'),`${d}: duplicate named`);
 await page.getByTestId('rq-add-tenant').fill('4c2b8e61-0d7a-4e93-b5f2-8a1c6e9d3b70');
 await page.getByTestId('rq-add-save').click();
 ok((await page.getByTestId('rq-message').innerText()).includes('Asiakas Kolme Oy'),`${d}: consent for the new one`);
 await page.getByTestId('rq-message-copy').click();
 ok(await vis(page,'rq-toast'),`${d}: copy toast`);
 await page.getByTestId('rq-close').click();
 eq(await count(page),'4',`${d}: list grew`);
 ok(await vis(page,'rq-orgs-panel'),`${d}: list open again after the action`);
 eq(await page.locator('[data-testid^="rq-org-"]').count(),4,`${d}: four rows`);
 await shot(page,`${d}-admin-lisatty-1440-light`);
 await page.getByTestId('rq-remove-open-c2').click();
 ok(await vis(page,'rq-remove'),`${d}: removal confirmation`);
 await page.getByTestId('rq-more-remove-toggle').click();
 ok(await vis(page,'rq-more-remove-body'),`${d}: removal Lisätietoja`);
 await page.getByTestId('rq-remove-confirm').click();
 eq(await count(page),'3',`${d}: list shrank`);
 await page.close();
 // Collapsing again.
 page=await open(1440,'light',d,'admin','auki');
 if(d===1){await page.getByTestId('rq-orgs-toggle').click();}
 else await page.keyboard.press('Escape');
 await page.waitForTimeout(100);
 eq(await vis(page,'rq-orgs-panel'),false,`${d}: list closes`);
 await page.close();
 // Person, reached from the top bar.
 page=await open(1440,'light',d,'admin','lista');
 await page.getByTestId('rq-view-person').click();
 await page.locator('[data-side="person"]').waitFor();
 eq(await page.getByTestId('rq-view-person').getAttribute('aria-pressed'),'true',`${d}: person view`);
 await page.getByTestId('rq-connect-row-c2').click();
 eq(await page.getByTestId('rq-orgline').getAttribute('data-org'),'c2',`${d}: level step names the organisation`);
 await page.locator('[data-testid="integration-dialog"] [data-testid="integration-continue"], [data-testid="integration-dialog"] button:has-text("Jatka")').first().click();
 ok((await page.getByText('R4TW9KQ2M').count())>0,`${d}: device code`);
 await page.getByTestId('rq-sim-guest').click();
 ok(await vis(page,'rq-guest-files'),`${d}: files only`);
 await page.getByTestId('integration-done').click();
 eq(await page.locator('[data-testid^="rq-card-"]').count(),3,`${d}: three connected`);
 ok((await page.getByTestId('rq-card-c2').getByTestId('rq-cardorg').innerText()).includes('Asiakas Kaksi Oy'),`${d}: card names it`);
 await shot(page,`${d}-person-kolme-1440-light`);
 await page.close();
 page=await open(1440,'light',d,'person','koodi');
 await page.getByTestId('rq-sim-consent_required').click();
 ok(await vis(page,'rq-refusal-consent_required'),`${d}: refusal`);
 await page.getByTestId('rq-ask-copy').click();
 ok(await vis(page,'rq-toast'),`${d}: request copied`);
 await page.getByTestId('rq-restart').click();
 ok(await vis(page,'integration-dialog'),`${d}: restart to the level step`);
 await page.close();
}
// A2's sheet on a phone.
{
 const page=await open(390,'light',2,'admin','lista');
 await page.getByTestId('rq-orgs-toggle').click();
 ok(await vis(page,'rq-orgs-panel'),'A2 390: sheet opens');
 ok(await dialogNoOverflow(page),'A2 390: sheet fits');
 await shot(page,'2-admin-auki-sheet-390-light');
 await page.close();
}
await browser.close();
assert.deepEqual(errors,[],'console clean');
console.log(`ok ${checks} checks`);
