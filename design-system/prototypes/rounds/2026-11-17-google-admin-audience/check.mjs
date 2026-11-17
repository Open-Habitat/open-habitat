// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Walks the three guide directions at 1440 and 390 px, light and dark:
// the picker, the direction lines and recommendation, each direction's own
// default view (A radio cards, B one page with contents, C comparison), the
// six presets with what each must show (unconfirmed items marked), no
// document overflow, and English. At 1440 light it clicks each direction's
// path: choose personal -> through the steps -> save -> work accounts ->
// try it; Testing <-> In production; existing client; production's Google
// row reopens the guide; links open nothing. Screenshots at device scale 2
// named v<n>-<direction>-<case>-<width>-<theme>.png. Console must stay clean.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-17-google-admin-audience';
const [input,out,flag]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <out-dir> [--quick]');process.exit(2);}
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['kysymys','yksisivu','vertailu'];
const A=0,B=1,C=2;
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};

async function open(width,theme){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:900},deviceScaleFactor:2,reducedMotion:'reduce',hasTouch:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errors.push(`${m.type()}: ${m.text()}`);});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 return page;
}
const settle=page=>page.waitForTimeout(250);
const tid=(page,id)=>page.getByTestId(id);
const guide=page=>tid(page,'ga-guide');
const pick=async(page,d)=>{await page.locator('.proto-picker-item').nth(d).click();await page.locator(`.rq-review[data-direction="${d}"]`).waitFor();await settle(page);};
const preset=async(page,i)=>{await tid(page,`preset-${i}`).click();await guide(page).waitFor();await settle(page);};
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const dialogFits=page=>guide(page).evaluate(el=>el.scrollWidth<=el.clientWidth+1);
const shot=(page,d,c,tag)=>page.screenshot({path:`${out}/v${d+1}-${names[d]}-${c}-${tag}.png`});
const step=async(page,d,id)=>d===B?tid(page,`si-step-${id}`):tid(page,`si-step-${id}`);
const seeIn=async(page,id)=>{const l=tid(page,id);await l.first().scrollIntoViewIfNeeded();return l.first().isVisible();};

// What each preset must show, in every direction.
const expect={
 1:async(page,d)=>{eq(await tid(page,d===B?'segment-personal':'choose-personal').count(),1,'choice offered');if(d===A)eq(await tid(page,'ga-choice').count(),1,'A radio cards');if(d===B)eq(await tid(page,'ga-audience-switch').count(),1,'B switch');if(d===C)eq(await tid(page,'ga-compare').count(),1,'C table');
  if(d!==B)ok(await tid(page,'si-next').isDisabled(),'next waits for a choice');},
 2:async(page)=>{ok(await seeIn(page,'ga-existing'),'existing: Habitat cannot see audience');ok(await seeIn(page,'ga-keep'),'existing: connections kept');},
 3:async(page)=>{ok(await seeIn(page,'ga-testing'),'testing warned');ok(await seeIn(page,'ga-cap'),'cap and where to check');ok(await seeIn(page,'ga-publish-google'),'publishing is done in Google');},
 4:async(page)=>{ok(await seeIn(page,'ga-privacy'),'privacy policy');ok(await seeIn(page,'ga-domain'),'domain');ok(await seeIn(page,'ga-preview'),'warning preview');ok(await seeIn(page,'unconfirmed-preview'),'preview marked unconfirmed');},
 5:async(page)=>{ok(await seeIn(page,'ga-handoff'),'handoff message');ok((await tid(page,'ga-handoff-msg').innerText()).includes('704213598812-'),'exact client id');ok(await seeIn(page,'ga-trusted'),'trusted is not verification');ok(await seeIn(page,'unconfirmed-trusted'),'warning suppression unconfirmed');},
 6:async(page)=>{ok(await seeIn(page,'ga-saved'),'saved is not a test');eq(await tid(page,'ga-try').locator('li').count(),4,'four things to try');},
};

try{
for(const width of quick?[1440]:[1440,390])for(const theme of quick?['light']:['light','dark']){
 const tag=`${width}-${theme}`;
 const phone=width===390;
 const page=await open(width,theme);
 await checkPicker(page,round);
 eq(await tid(page,'recommendation').count(),1,'recommendation on the page');
 eq(await page.locator('.rq-lines li').count(),3,'three direction lines');
 for(let d=0;d<3;d++){
  await pick(page,d);
  await tid(page,'rq-reset').evaluate(b=>b.click());await settle(page);
  if(!(await guide(page).count())){await tid(page,'rq-open').click();await guide(page).waitFor();}
  eq(await page.locator('.rq-lines li[aria-current]').count(),1,`${tag} ${d}: line marked`);
  ok(await tid(page,'server-integrations').count()===1,`${tag} ${d}: production list behind`);
  ok(await fits(page),`${tag} ${d}: no overflow`);
  await shot(page,d,'oletus',tag);
  for(let i=1;i<=6;i++){
   await preset(page,i);
   const at=`${names[d]} preset ${i} ${tag}`;
   ok(await fits(page),`${at}: document overflow`);
   ok(await dialogFits(page),`${at}: dialog overflow`);
   await expect[i](page,d).catch(e=>{e.message=`${at}: ${e.message}`;throw e;});
   if(d===C&&i>2)ok(await tid(page,'ga-summary').isVisible(),`${at}: C carries the summary`);
   if(d===B)ok(await tid(page,'ga-toc').isVisible(),`${at}: B contents`);
   await guide(page).evaluate(el=>{el.closest('.ah-modal').scrollTop=0;el.querySelector('.ga-sections')?.scrollTo?.(0,el.querySelector('.ga-sections [data-current]')?.offsetTop||0);});
   await shot(page,d,`p${i}`,tag);
  }
  if(!phone||d===A){
   // English pass on the brand preset.
   await page.locator('#language').selectOption('en');await settle(page);
   await preset(page,4);
   ok((await guide(page).innerText()).includes('privacy policy'),`${names[d]} ${tag}: English`);
   await shot(page,d,'en',tag);
   await page.locator('#language').selectOption('fi');await settle(page);
  }
 }
 if(width===1440&&theme==='light'){
  // A: the whole new-installation path.
  await pick(page,A);await preset(page,1);
  await tid(page,'choose-personal').click();await settle(page);
  ok(!(await tid(page,'si-next').isDisabled()),'A: next after choice');
  const seen=[];
  for(let k=0;k<4;k++){await tid(page,'si-next').click();await settle(page);seen.push(await tid(page,'si-stepname').getAttribute('data-step'));}
  eq(seen.join(','),'apis,brand,scopes,publish','A: personal path order');
  await tid(page,'segment-production').click();await settle(page);
  ok(await tid(page,'ga-production').isVisible(),'A: in production state');
  await tid(page,'si-next').click();await settle(page);
  ok(await tid(page,'si-split').isVisible(),'A: client step beside values');
  await tid(page,'si-save').click();await settle(page);
  eq(await tid(page,'si-stepname').getAttribute('data-step'),'workspace','A: after save, work accounts');
  ok(await tid(page,'rq-toast').isVisible(),'A: synthetic save said');
  await tid(page,'si-copy').first().click();
  await tid(page,'si-next').click();await settle(page);
  eq(await tid(page,'si-stepname').getAttribute('data-step'),'ready','A: then try it');
  await tid(page,'ga-done').click();await settle(page);
  eq(await guide(page).count(),0,'A: done closes');
  // Production's Google row reopens the round's guide.
  await page.locator('[data-testid="si-menu-google"], [data-testid="si-setup-google"]').first().click();await settle(page);
  eq(await guide(page).count(),1,'production row opens the guide');
  // A org path is short.
  await preset(page,1);await tid(page,'choose-org').click();await tid(page,'si-next').click();await settle(page);
  eq(await page.locator('.si-progress span').count(),6,'A: organization path has six steps');
  // Links open nothing.
  await tid(page,'si-console-link').first().click();await settle(page);
  ok((await tid(page,'rq-toast').innerText()).includes('console.cloud.google.com'),'links open nothing');
  await shot(page,A,'org-apis','1440-light');
  // Existing client, organization: nothing to change.
  await page.locator('#scenario').selectOption('existing');await page.locator('#audience').selectOption('org');await settle(page);
  ok(await tid(page,'ga-org-already').first().isVisible(),'existing org: nothing to change');
  // Existing personal: make external, migration check.
  await preset(page,2);await tid(page,'si-next').click();await tid(page,'si-next').click();await settle(page);
  ok(await tid(page,'ga-make-external').isVisible(),'existing: make external');
  await tid(page,'si-next').click();await tid(page,'si-next').click();await settle(page);
  ok(await tid(page,'ga-migration').isVisible(),'existing: migration check');
  ok(await tid(page,'unconfirmed-migration').isVisible(),'existing: token survival unconfirmed');
  await shot(page,A,'migration','1440-light');
  // B: contents jump and inline save.
  await pick(page,B);await preset(page,1);
  await tid(page,'segment-personal').click();await settle(page);
  eq(await page.locator('[data-testid="ga-toc"] li').count(),8,'B: all sections listed');
  await tid(page,'toc-publish').click();await settle(page);
  eq(await tid(page,'toc-publish').getAttribute('aria-current'),'true','B: contents mark');
  await tid(page,'toc-client').click();await settle(page);
  await tid(page,'ga-save-inline').click();await settle(page);
  eq(await tid(page,'toc-workspace').getAttribute('aria-current'),'true','B: save moves to work accounts');
  eq(await tid(page,'ga-after').count(),1,'B: after-saving divider');
  await shot(page,B,'saved','1440-light');
  // C: choose a column, summary, change.
  await pick(page,C);await preset(page,1);
  await tid(page,'choose-personal').click();await settle(page);
  eq(await page.locator('.ga-compare td[data-chosen]').count(),6,'C: chosen column marked');
  await tid(page,'si-next').click();await settle(page);
  ok(await tid(page,'ga-summary').isVisible(),'C: summary rides along');
  await tid(page,'ga-change').click();await settle(page);
  eq(await tid(page,'si-stepname').getAttribute('data-step'),'audience','C: change returns to choice');
 }
 await page.close();
}
}finally{await browser.close();}
eq(errors.length,0,`console clean:\n${errors.join('\n')}`);
console.log(`ok ${checks} checks`);
