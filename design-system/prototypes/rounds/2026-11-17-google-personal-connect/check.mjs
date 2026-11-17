// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Walks the three directions in every situation at 1440 and 390 px, light
// and dark: no document overflow, the direction's line marked, production's
// Google dialog, and what each direction shows in that state (A's note and
// help panel, B's route and branch, C's check card and chooser), with the
// same answer and "who acts" chip for each help case. Then at 1440 light it
// clicks each direction's flow: open Google -> help -> paste a return
// address -> connected with the grant listed; a pasted address carrying
// Google's error says the person stopped at Google; C's "I don't recognise
// the server" stops and returns; the client ID copies; English; and one flow
// at 390 px. Screenshots at device scale 2 named
// v<n>-<direction>-<situation>-<width>-<theme>.png; --quick takes 1440 light.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-17-google-personal-connect';
const [input,out,flag]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <out-dir> [--quick]');process.exit(2);}
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['muistutus','reitti','tarkistus'];
const A=0,B=1,C=2;
const help={varoitus:'warning',tuntematon:'unfamiliar','esto-org':'org','esto-sisainen':'internal','esto-testi':'testing','esto-raja':'cap','esto-tahti':'rate'};
const who={warning:'self',unfamiliar:'server',org:'org',internal:'server',testing:'server',cap:'server',rate:'wait'};
const scenarios=['taso','ennen','odottaa',...Object.keys(help),'peruttu','vanhentui','yhdistetty','osittain','ei-mitaan','tasonvaihto','uudelleen'];
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};

async function open(width,theme){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:900},deviceScaleFactor:2,reducedMotion:'reduce',hasTouch:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.context().grantPermissions(['clipboard-read','clipboard-write'],{origin:'http://prototype.test'});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 return page;
}
const settle=page=>page.waitForTimeout(250);
const tid=(page,id)=>page.getByTestId(id);
const dialog=page=>tid(page,'integration-dialog');
const ready=async(page,s)=>{
 if(s==='osittain'||s==='yhdistetty'){await tid(page,'grant-summary').waitFor();}
 else await dialog(page).waitFor();
 if(Object.keys(help).includes(s)||s==='odottaa')await tid(page,'integration-redirect-input').waitFor();
 await settle(page);
};
const pick=async(page,d)=>{await page.locator('.proto-picker-item').nth(d).click();await page.locator(`.rq-review[data-direction="${d}"]`).waitFor({state:'attached'});await settle(page);};
const sel=async(page,id,v)=>{await page.locator(`#${id}`).selectOption(v);await settle(page);};
const scen=async(page,s)=>{await sel(page,'scenario',s);await ready(page,s);};
const shot=(page,d,c,tag)=>page.screenshot({path:`${out}/v${d+1}-${names[d]}-${c}-${tag}.png`});
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const answer=page=>page.locator('[data-testid="help-answer"]');

try{
for(const width of quick?[1440]:[1440,390])for(const theme of quick?['light']:['light','dark']){
 const tag=`${width}-${theme}`;
 const page=await open(width,theme);
 await checkPicker(page,round);
 eq(await tid(page,'recommendation').count(),1,'the recommendation is on the page');
 for(let d=0;d<3;d++){
  await pick(page,d);
  for(const s of scenarios){
   await scen(page,s);
   const at=`${names[d]} ${s} ${tag}`;
   ok(await fits(page),`${at}: document overflow`);
   eq(await page.locator('.rq-lines li[aria-current]').count(),1,`${at}: its line is marked`);
   const h=help[s];
   const pre=s==='ennen'||s==='uudelleen';
   const waiting=s==='odottaa'||!!h;
   if(pre){
    eq(await tid(page,'integration-provider-link').count(),1,`${at}: production's open button`);
    eq(await tid(page,'a-note').count(),d===A?1:0,`${at}: A's note`);
    eq(await tid(page,'route').count(),d===B?1:0,`${at}: B's route`);
    eq(await tid(page,'c-check').count(),d===C?1:0,`${at}: C's check card`);
    eq(await tid(page,'integration-redirect-expected').isVisible(),d!==B,`${at}: production's error-page note (B replaces it)`);
    if(s==='uudelleen')ok((await tid(page,'integration-title').innerText()).includes('uudelleen'),`${at}: relogin title`);
   }
   if(waiting){
    ok(await tid(page,'integration-redirect-input').isVisible(),`${at}: the paste field`);
    eq(await tid(page,d===A?'a-wait':d===B?'route':'c-wait').count(),1,`${at}: the direction's help while waiting`);
    if(d===B)ok(await tid(page,'route-here').isVisible(),`${at}: B marks the step that returns here`);
    if(h){
     eq(await answer(page).count(),1,`${at}: one answer`);
     eq(await answer(page).getAttribute('data-help'),h,`${at}: the answer for ${h}`);
     eq(await answer(page).getByTestId('help-who').getAttribute('data-who'),who[h],`${at}: who acts`);
     if(h==='warning'){ok(await answer(page).getByTestId('help-path').isVisible(),`${at}: Google's English path`);ok((await answer(page).innerText()).includes('accounts.google.com'),`${at}: the address to check`);}
     if(h==='org')ok((await tid(page,'help-client-id').innerText()).includes('.apps.googleusercontent.com'),`${at}: the client ID`);
     if(h==='internal')ok((await answer(page).innerText()).includes('org_internal'),`${at}: org_internal`);
     if(h==='rate')ok((await answer(page).innerText()).includes('rate_limit_exceeded'),`${at}: rate_limit_exceeded`);
    }else eq(await answer(page).count(),0,`${at}: no help open`);
   }
   if(s==='peruttu')ok(await tid(page,'cancelled-at-google').isVisible(),`${at}: stopped at Google`);
   if(s==='ei-mitaan')ok(await tid(page,'integration-nothing-granted').isVisible(),`${at}: nothing granted`);
   if(s==='yhdistetty'||s==='osittain'){
    ok(await tid(page,'integration-connected').isVisible(),`${at}: connected`);
    eq(await tid(page,'grant-summary').locator('li[data-access="none"]').count(),s==='osittain'?2:0,`${at}: what was not granted`);
   }
   if(s==='taso'||s==='tasonvaihto')ok(await tid(page,'integration-continue').isVisible(),`${at}: continue to Google`);
   if(s==='tasonvaihto')ok(await tid(page,'integration-level-change').isVisible(),`${at}: what the change does`);
   await shot(page,d,s,tag);
  }
 }
 await page.close();
}

// Flows at 1440 light.
const page=await open(1440,'light');
const ret='http://localhost/?state=prototype-state&code=4/0Aexample&scope=email';
for(const d of [A,B,C]){
 const at=names[d];
 await pick(page,d);await scen(page,'taso');
 await tid(page,'integration-continue').click();await settle(page);
 ok(await tid(page,'integration-provider-link').isVisible(),`${at}: intro -> before Google`);
 if(d===A){await tid(page,'a-more').click();ok(await tid(page,'help-panel').isVisible(),`${at}: help before Google`);
  await tid(page,'help-unfamiliar').click();eq(await answer(page).getAttribute('data-help'),'unfamiliar',`${at}: unfamiliar opens`);}
 if(d===B){await tid(page,'b-more').click();eq(await answer(page).getAttribute('data-help'),'warning',`${at}: the warning step opens`);
  await tid(page,'b-unfamiliar').click();eq(await answer(page).getAttribute('data-help'),'unfamiliar',`${at}: I don't recognise`);}
 if(d===C){
  await tid(page,'c-notsure').click();await settle(page);
  ok(await tid(page,'c-stopped').isVisible(),`${at}: stopping is its own choice`);
  eq(await tid(page,'integration-provider-link').isVisible(),false,`${at}: Google not offered after stopping`);
  await shot(page,d,'pysahtyi-flow','1440-light');
  await tid(page,'c-back').click();await settle(page);
 }
 await shot(page,d,'ennen-flow','1440-light');
 await tid(page,'integration-provider-link').click();
 await tid(page,'integration-redirect-input').waitFor();await settle(page);
 ok(await tid(page,'rq-toast').isVisible(),`${at}: the prototype stays here`);
 // Help while waiting.
 if(d===A){if(!(await tid(page,'help-panel').count()))await tid(page,'a-more').click();await tid(page,'help-org').click();}
 if(d===B){await tid(page,'b-stop').click();await tid(page,'help-cap').click();eq(await answer(page).getAttribute('data-help'),'cap',`${at}: the branch answers cap`);await tid(page,'help-org').click();}
 if(d===C){await tid(page,'c-other').click();await tid(page,'help-org').click();}
 eq(await answer(page).getAttribute('data-help'),'org',`${at}: the organisation answer`);
 await tid(page,'help-client-id').getByRole('button').click();
 ok((await tid(page,'help-client-id').innerText()).includes(TEXTcopied()),`${at}: the client ID copied`);
 await shot(page,d,'odottaa-org-flow','1440-light');
 // A return address carrying Google's error.
 await tid(page,'integration-redirect-input').fill('http://localhost/?error=access_denied&state=prototype-state');
 await tid(page,'integration-connect').click();await settle(page);
 ok(await tid(page,'cancelled-at-google').isVisible(),`${at}: stopped at Google, said so`);
 await page.getByRole('button',{name:'Aloita alusta'}).click();await settle(page);
 await tid(page,'integration-provider-link').click();await tid(page,'integration-redirect-input').waitFor();
 await tid(page,'integration-redirect-input').fill(ret);
 await tid(page,'integration-connect').click();
 await tid(page,'grant-summary').waitFor();await settle(page);
 eq(await tid(page,'grant-summary').locator('li').count(),4,`${at}: four services listed`);
 await shot(page,d,'yhdistetty-flow','1440-light');
 await tid(page,'integration-done').click();await settle(page);
 ok(await tid(page,'rq-reopen').isVisible(),`${at}: dialog closed onto the settings page`);
}
// Partial grant: the card on the settings page says what is missing.
await scen(page,'osittain');
await tid(page,'integration-done').click();await settle(page);
await tid(page,'integration-account-google').getByTestId('integration-account-narrowed').waitFor();
ok(await tid(page,'integration-account-google').getByTestId('integration-account-narrowed').isVisible(),'partial: the card names the missing permissions');
await tid(page,'integration-account-google').scrollIntoViewIfNeeded();await shot(page,A,'osittain-kortti','1440-light');
// English.
await sel(page,'language','en');
for(const d of [A,B,C]){
 await pick(page,d);await scen(page,'ennen');
 await shot(page,d,'ennen-en','1440-light');
 await scen(page,'varoitus');
 ok((await answer(page).innerText()).includes('Google has not reviewed it'),`${names[d]}: English warning`);
 await shot(page,d,'varoitus-en','1440-light');
 await scen(page,'esto-raja');
 ok((await answer(page).innerText()).includes('whole lifetime'),`${names[d]}: English cap`);
}
await sel(page,'language','fi');
await page.close();
// One flow at 390 px.
const phone=await open(390,'light');
await pick(phone,B);await scen(phone,'ennen');
await tid(phone,'b-more').click();await settle(phone);
ok(await fits(phone),'phone: the opened warning step fits');
await tid(phone,'integration-provider-link').scrollIntoViewIfNeeded();
await tid(phone,'integration-provider-link').click();
await tid(phone,'integration-redirect-input').waitFor();
await tid(phone,'b-stop').scrollIntoViewIfNeeded();await tid(phone,'b-stop').click();await settle(phone);
ok(await fits(phone),'phone: the branch fits');
await shot(phone,B,'haara-flow','390-light');
await phone.close();
}finally{await browser.close();}
function TEXTcopied(){return 'Kopioitu';}
assert.deepEqual(errors,[],`console: ${errors.join('\n')}`);
console.log(`${checks} checks, console clean`);
