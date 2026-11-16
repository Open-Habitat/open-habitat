// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Walks the three card directions at 1440 and 390 px, light and dark, in
// every situation (stop kinds and who brought the card on the waiting and
// counted states, question 4 both ways): no document overflow, the
// direction's line and the four presets with their lines, production's
// conversation, the card last in the timeline, the rail mark, the bell, and
// what the direction shows in that state. Then at 1440 light it clicks each
// direction's flow: count (A, C) or details (B) -> continue -> running ->
// done and the folded receipt; cancel; a change after the count is refused
// (B recounts); too many deletions need the checkbox; C's names expand;
// question 4's late cloud deletion with the guard on and off; ask the agent;
// another conversation open; the bell-only fallback's dialog; English; and
// one flow at 390 px. Screenshots at device scale 2 named
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
const round='2026-11-16-sync-consent-3';
const [input,out,flag]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <out-dir> [--quick]');process.exit(2);}
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['pyynnosta','valmiina','nimelta'];
const A=0,B=1,C=2;
// situation -> [phase, where]
const cases={pysahtyi:['stopped','here'],lasketaan:['counting','here'],laskettu:['counted','here'],kaynnissa:['running','here'],
 valmis:['done','here'],peruttu:['stopped','here'],torjuttu:['refused','here'],epaonnistui:['failed','here'],livahti:['done','here'],
 muualla:['stopped','elsewhere'],eikeskustelua:['stopped','none']};
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};

async function open(width,theme){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:900},deviceScaleFactor:2,reducedMotion:'reduce',hasTouch:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 return page;
}
const settle=page=>page.waitForTimeout(300);
const closeModal=async page=>{while(await page.locator('.ah-overlay, .ah-popover').count()){await page.keyboard.press('Escape');await settle(page);}};
const ready=async page=>{await page.locator('.ah-conversation-stream').waitFor();await settle(page);};
const pick=async(page,d)=>{await closeModal(page);await page.locator('.proto-picker-item').nth(d).click();await page.locator(`.rq-review[data-direction="${d}"]`).waitFor({state:'attached'});await ready(page);};
const sel=async(page,id,v)=>{await closeModal(page);await page.locator(`#${id}`).selectOption(v);await ready(page);};
const setAll=async(page,{s='pysahtyi',data='few',origin='habitat',q4='safe'})=>{await sel(page,'q4',q4);await sel(page,'origin',origin);await sel(page,'data',data);await sel(page,'scenario',s);};
const shot=(page,d,c,tag)=>page.screenshot({path:`${out}/v${d+1}-${names[d]}-${c}-${tag}.png`});
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const card=page=>page.locator('[data-testid="sync-stop"]');
const phase=page=>card(page).getAttribute('data-phase');
const waitPhase=(page,p)=>page.waitForFunction(p=>document.querySelector('[data-testid="sync-stop"]')?.getAttribute('data-phase')===p,p);
const tid=(page,id)=>page.getByTestId(id);

try{
for(const width of quick?[1440]:[1440,390])for(const theme of quick?['light']:['light','dark']){
 const tag=`${width}-${theme}`;
 const phone=width===390;
 const page=await open(width,theme);
 await checkPicker(page,round);
 eq(await tid(page,'recommendation').count(),1,'the recommendation is on the page');
 for(let i=1;i<=4;i++){
  ok(await tid(page,`preset-${i}`).isVisible(),`${tag}: preset ${i} visible`);
  if(!phone)ok(await tid(page,`preset-line-${i}`).isVisible(),`${tag}: preset ${i} has its line`);
 }
 for(let d=0;d<3;d++){
  await pick(page,d);
  const runs=[];
  for(const c of Object.keys(cases))runs.push({s:c});
  for(const s of ['pysahtyi','laskettu']){
   for(const data of ['mixed','moved'])runs.push({s,data});
   for(const origin of ['agent','yes'])runs.push({s,origin});
  }
  runs.push({s:'livahti',q4:'open'},{s:'laskettu',q4:'open'});
  for(const r of runs){
   const {s,data='few',origin='habitat',q4='safe'}=r;
   await setAll(page,r);
   const [ph,where]=cases[s];
   const sit=[s,data!=='few'?data:'',origin!=='habitat'?origin:'',q4!=='safe'?'q4open':''].filter(Boolean).join('-');
   const at=`${names[d]} ${sit} ${tag}`;
   ok(await fits(page),`${at}: document overflow`);
   eq(await page.locator('.rq-lines li[aria-current]').count(),1,`${at}: its line is marked`);
   eq(await page.locator('.ah-conversation-stream .ah-feed').count(),1,`${at}: production's timeline`);
   ok(await page.locator('.ah-composer, [data-testid="composer"]').count()>0,`${at}: production's composer`);
   const stopped=!['running','done'].includes(ph);
   const slipHeld=s==='livahti'&&q4==='safe'&&data==='few';
   eq(await tid(page,'status-bell').count(),stopped||slipHeld||where==='none'?1:0,`${at}: the bell`);
   if(!phone){
    eq(await page.locator('[data-testid="agent-item-sync"]').count(),where==='none'?0:1,`${at}: the causing conversation in the rail`);
    if(where!=='none')eq((await page.locator('[data-testid="agent-item-sync"]').getAttribute('data-ball'))==='you',stopped,`${at}: rail mark while stopped`);
   }
   if(where!=='here'){
    eq(await card(page).count(),0,`${at}: no card in an unrelated conversation`);
    await shot(page,d,sit,tag);continue;
   }
   eq(await page.locator('.ah-feed > li[data-kind="sync-stop"]:last-child [data-testid="sync-stop"]').count(),1,`${at}: the card last in the timeline`);
   eq(await phase(page),ph,`${at}: phase`);
   if(origin!=='habitat'){
    const cmds=await page.locator('.ah-feed').getByText('open-habitat agent sync request-consent').count();
    ok(cmds>=(origin==='yes'?2:1),`${at}: the agent ran the command`);
    // The opened work sits in the turn's content column, not the 18 px rail.
    const narrow=await page.locator('.ah-feed .ah-pi-tool-use').evaluateAll(els=>els.filter(e=>e.offsetParent).map(e=>e.getBoundingClientRect().width).filter(w=>w<200).length);
    eq(narrow,0,`${at}: the agent's commands have room`);
    if(stopped&&!(s==='peruttu'&&d===B))ok((await card(page).innerText()).includes('agentin pyynnöstä'),`${at}: the card says the agent brought it`);
    if(origin==='yes')eq(await page.locator('.ah-feed li[data-kind="user"]').filter({hasText:'Kyllä, jatka vaan.'}).count(),1,`${at}: the person's yes`);
    eq(await card(page).getByTestId('sync-cause').count(),0,`${at}: no cause claimed when the agent brought it`);
   }
   const del=data==='mixed'?'few':data==='moved'?'many':'none';
   const shows=ph==='counted'||(d===B&&(ph==='stopped'||ph==='refused')&&s!=='peruttu');
   if(shows){
    ok(await tid(page,'dry-summary').isVisible(),`${at}: the count`);
    eq(await tid(page,'dry-summary').getAttribute('data-deletions'),del,`${at}: deletions`);
    eq(await tid(page,'dry-summary').getAttribute('data-guarded'),q4==='safe'&&data==='few'?'true':'false',`${at}: question 4 guard`);
    ok(await tid(page,'dry-binding').isVisible(),`${at}: what the consent covers`);
    if(d===A)ok(await tid(page,'dry-table').isVisible(),`${at}: A's table`);
    if(d===B){eq(await tid(page,'dry-table').count(),0,`${at}: B's details folded`);ok(await tid(page,'show-detail').isVisible(),`${at}: B's details on request`);}
    if(d===C)ok(await tid(page,'dry-names').isVisible(),`${at}: C's names`);
    eq(await tid(page,'consent-confirm').isDisabled(),data==='moved',`${at}: too many deletions gate the confirm`);
    const label=await tid(page,'consent-confirm').innerText();
    if(data==='moved')ok(label.includes('212'),`${at}: confirm names the deletions`);
    if(data==='mixed')ok(label.includes('3'),`${at}: confirm names the 3 deletions`);
    if(data==='few'&&d===B)ok(label.includes('16'),`${at}: B's confirm names the action`);
    if(data==='moved')ok(await tid(page,'dry-many').isVisible(),`${at}: the strong warning`);
    if(data==='mixed')ok(await tid(page,'dry-few-del').isVisible(),`${at}: the deletions named`);
   }else if(ph==='stopped'&&s!=='peruttu'){
    ok(await tid(page,'open-consent').isVisible(),`${at}: count on request`);
    eq(await tid(page,'ask-agent').count(),origin==='habitat'?1:0,`${at}: ask the agent only on Habitat's own card`);
    if(origin==='habitat')ok((await card(page).innerText()).includes(data==='moved'?'212':data==='mixed'?'13':'14'),`${at}: says which edits`);
   }
   if(ph==='counting')ok(await tid(page,'dry-counting').isVisible(),`${at}: counting in place`);
   if(['refused','failed','running'].includes(ph))eq(await tid(page,'sync-outcome').getAttribute('data-phase'),ph,`${at}: outcome said`);
   if(['refused','failed'].includes(ph)&&!shows)eq(await tid(page,'open-consent').count(),1,`${at}: can count again`);
   if(s==='peruttu'){
    if(d===B){eq(await card(page).getAttribute('data-collapsed'),'true',`${at}: B folds when cancelled`);eq(await tid(page,'show-count').count(),1,`${at}: B's count on request`);}
    else{eq(await card(page).getAttribute('data-collapsed'),null,`${at}: stays open when cancelled`);eq(await tid(page,'open-consent').count(),1,`${at}: can count`);}
   }
   if(ph==='done'){
    eq(await card(page).getAttribute('data-collapsed'),'true',`${at}: folds when done`);
    eq(await tid(page,'receipt-toggle').count(),d===B?0:1,`${at}: receipt opens in A and C`);
    if(s==='livahti')eq(await tid(page,'slip').getAttribute('data-slip'),slipHeld?'held':'deleted',`${at}: question 4 outcome`);
   }
   await shot(page,d,sit,tag);
  }
 }
 await page.close();
}

// Flows at 1440 light.
const page=await open(1440,'light');
for(const d of [A,B,C]){
 const at=names[d];
 await pick(page,d);await setAll(page,{});
 if(d===B){
  await tid(page,'show-detail').click();
  ok(await tid(page,'dry-table').isVisible(),`${at}: details open the table`);
 }else{
  await tid(page,'open-consent').click();
  ok(await tid(page,'dry-counting').isVisible(),`${at}: look -> counting`);
  await tid(page,'dry-summary').waitFor();
 }
 eq(await tid(page,'consent-confirm').isDisabled(),false,`${at}: no deletions, confirm open`);
 await shot(page,d,'laskelma-flow','1440-light');
 await tid(page,'consent-confirm').click();await settle(page);
 eq(await phase(page),'running',`${at}: running`);
 ok((await tid(page,'sync-outcome').innerText()).includes('Ajo ei voi poistaa'),`${at}: running says the pass cannot delete`);
 eq(await tid(page,'status-bell').count(),0,`${at}: bell clears`);
 await waitPhase(page,'done');await settle(page);
 ok((await tid(page,'sync-outcome').innerText()).includes('14'),`${at}: done says what went`);
 if(d!==B){
  await tid(page,'receipt-toggle').click();
  ok(await tid(page,d===A?'dry-table':'dry-names').isVisible(),`${at}: receipt opens`);
  await shot(page,d,'kuitti-auki','1440-light');
 }
 // Cancel.
 await sel(page,'scenario','laskettu');
 await tid(page,'consent-cancel').click();await settle(page);
 eq(await phase(page),'stopped',`${at}: cancel -> still stopped`);
 if(d===B){
  eq(await card(page).getAttribute('data-collapsed'),'true',`${at}: B folds on cancel`);
  await tid(page,'show-count').click();await settle(page);
  ok(await tid(page,'dry-summary').isVisible(),`${at}: B's count comes back`);
 }else{
  eq(await tid(page,'sync-outcome').count(),1,`${at}: cancel says nothing changed`);
  await tid(page,'open-consent').click();await tid(page,'dry-summary').waitFor();
 }
 // A change after the count is refused; B recounts by itself.
 await tid(page,'rq-change').click();
 await tid(page,'consent-confirm').click();await settle(page);
 eq(await phase(page),'refused',`${at}: changed after the count -> refused`);
 if(d===B){ok(await tid(page,'dry-summary').isVisible(),`${at}: B shows the new count`);eq(await tid(page,'consent-confirm').count(),1,`${at}: B can consent to the new count`);}
 else eq(await tid(page,'open-consent').count(),1,`${at}: count again`);
 await shot(page,d,'torjuttu-flow','1440-light');
 // Too many deletions need the checkbox.
 await setAll(page,{s:'laskettu',data:'moved'});
 eq(await tid(page,'consent-confirm').isDisabled(),true,`${at}: many deletions gate`);
 if(d===C){
  await tid(page,'more-upDeleted').click();await settle(page);
  eq(await page.locator('[data-group="upDeleted"] li').count(),212,`${at}: all 212 deletions by name`);
  await shot(page,d,'nimet-auki','1440-light');
 }
 await tid(page,'consent-agree').click();
 eq(await tid(page,'consent-confirm').isDisabled(),false,`${at}: checkbox opens the confirm`);
 await tid(page,'consent-confirm').click();await settle(page);
 await waitPhase(page,'done');
 ok((await tid(page,'sync-outcome').innerText()).includes('212'),`${at}: done names the moves`);
 // Question 4: 150 deleted in the cloud just before the pass.
 for(const q4 of ['safe','open']){
  await setAll(page,{s:d===B?'pysahtyi':'laskettu',q4});
  await tid(page,'rq-slip').click();
  await tid(page,'consent-confirm').click();await waitPhase(page,'done');await settle(page);
  eq(await tid(page,'slip').getAttribute('data-slip'),q4==='safe'?'held':'deleted',`${at}: question 4 ${q4}`);
  eq(await tid(page,'status-bell').count(),q4==='safe'?1:0,`${at}: question 4 ${q4}, the next stop in the bell`);
  await shot(page,d,`kysymys4-${q4}-flow`,'1440-light');
 }
 await sel(page,'q4','safe');
}
// A: ask the agent drafts a message in the field.
await pick(page,A);await setAll(page,{});
await tid(page,'ask-agent').click();await settle(page);
ok((await page.locator('.ah-composer textarea, textarea').first().inputValue()).length>40,'ask the agent drafts a message');
// The bell shows the stop in the conversation.
await tid(page,'status-bell').click();await settle(page);
eq(await tid(page,'bell-show').count(),1,'bell offers to show it');
await closeModal(page);
// Another conversation open: the bell and the rail open the one that caused it.
await sel(page,'scenario','muualla');
await tid(page,'status-bell').click();await settle(page);
eq(await tid(page,'bell-open').count(),1,'elsewhere: bell opens the conversation');
await closeModal(page);
await page.locator('[data-testid="agent-item-sync"] a').first().click();await ready(page);
eq(await phase(page),'stopped','rail mark -> the conversation with its card');
// Fallback: the bell opens the same card in a dialog, in every direction.
for(const d of [A,B,C]){
 await pick(page,d);await setAll(page,{s:'eikeskustelua'});
 await tid(page,'status-bell').click();await settle(page);
 if(d===A)await shot(page,d,'eikeskustelua-kello','1440-light');
 await tid(page,'bell-look').click();await settle(page);
 eq(await page.locator('[data-testid="sync-stop"][data-place="dialog"]').count(),1,`${names[d]} fallback: the card in a dialog`);
 await tid(page,'dry-summary').waitFor();
 await shot(page,d,'eikeskustelua-laskelma','1440-light');
 await tid(page,'consent-confirm').click();await settle(page);
 await tid(page,'status-bell').click();await settle(page);
 eq(await page.locator('[data-testid="status-item"][data-phase]').count(),1,`${names[d]} fallback: the bell says it is continuing`);
 await closeModal(page);
}
// English.
await pick(page,A);
await sel(page,'language','en');await setAll(page,{s:'laskettu'});
ok((await tid(page,'dry-would').innerText()).includes('this pass cannot delete'),'English count');
ok((await card(page).innerText()).includes('this conversation'),'English card');
await shot(page,A,'laskettu-en','1440-light');
for(const d of [A,B,C]){
 await pick(page,d);await setAll(page,{origin:'yes'});
 ok((await card(page).innerText()).includes('at the agent\'s request'),`${names[d]} English agent card`);
 await shot(page,d,'agentti-kylla-en','1440-light');
 await setAll(page,{s:'laskettu',data:'moved'});
 await shot(page,d,'liikaa-en','1440-light');
}
await sel(page,'language','fi');
await page.close();
// One flow at 390 px: presets and B's consent are reachable on a phone.
const phone=await open(390,'light');
await pick(phone,B);
await tid(phone,'preset-2').click();await ready(phone);
eq(await tid(phone,'preset-2').getAttribute('aria-pressed'),'true','phone: preset 2 pressed');
ok(await tid(phone,'preset-line-2').isVisible(),'phone: the pressed preset says what it shows');
await tid(phone,'consent-confirm').scrollIntoViewIfNeeded();
await tid(phone,'consent-confirm').click();await waitPhase(phone,'done');
ok(await fits(phone),'phone: done fits');
await shot(phone,B,'agentti-valmis-flow','390-light');
await phone.close();
}finally{await browser.close();}
assert.deepEqual(errors,[],`console: ${errors.join('\n')}`);
console.log(`${checks} checks, console clean`);
