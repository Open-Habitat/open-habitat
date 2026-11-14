// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Walks the three directions at 1440 and 390 px, light and dark, in every
// situation: no document overflow, the direction's line marked, production's
// conversation (timeline, composer), the stop in the direction's place, the
// rail's mark on the conversation that caused it, the bell, and the count
// where the direction shows it. Then at 1440 light it clicks each
// direction's flow: look -> counting -> count -> continue once -> running ->
// done; cancel says nothing changed; a change after the count is refused;
// many deletions need the checkbox; ask the agent drafts a message; the
// rail's mark opens the conversation; the fallback's bell opens the count;
// English. Screenshots at device scale 2 named
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
const round='2026-11-14-sync-consent-2';
const [input,out,flag]=process.argv.slice(2);
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['kortti','agentti','kentta'];
const A=0,B=1,C=2;
const places=['card','consent','strip'];
// situation -> [phase, where]; B's agent turn owns stopped and counting.
const cases={pysahtyi:['stopped','here'],lasketaan:['counting','here'],laskettu:['counted','here'],kaynnissa:['running','here'],
 valmis:['done','here'],torjuttu:['refused','here'],epaonnistui:['failed','here'],muualla:['stopped','elsewhere'],eikeskustelua:['stopped','none']};
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
const setCase=async(page,c)=>{await closeModal(page);await page.locator('#scenario').selectOption(c);await ready(page);};
const setData=async(page,v)=>{await closeModal(page);await page.locator('#data').selectOption(v);await ready(page);};
const shot=(page,d,c,tag)=>page.screenshot({path:`${out}/v${d+1}-${names[d]}-${c}-${tag}.png`});
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const stop=page=>page.getByTestId('sync-stop');
const phase=page=>stop(page).getAttribute('data-phase');
const doneWait=page=>page.waitForFunction(()=>document.querySelector('[data-testid="sync-stop"]')?.getAttribute('data-phase')==='done');

try{
for(const width of quick?[1440]:[1440,390])for(const theme of quick?['light']:['light','dark']){
 const tag=`${width}-${theme}`;
 const phone=width===390;
 const page=await open(width,theme);
 await checkPicker(page,round);
 eq(await page.getByTestId('recommendation').count(),1,'the recommendation is on the page');
 for(let d=0;d<3;d++){
  await pick(page,d);
  for(const [c,[ph,where]] of Object.entries(cases))for(const data of c==='laskettu'?['few','many']:['few']){
   await setData(page,data);await setCase(page,c);
   const sit=c==='laskettu'?`${c}-${data}`:c;
   const at=`${names[d]} ${sit} ${tag}`;
   ok(await fits(page),`${at}: document overflow`);
   eq(await page.locator('.rq-lines li[aria-current]').count(),1,`${at}: its line is marked`);
   eq(await page.locator('.ah-conversation-stream .ah-feed').count(),1,`${at}: production's timeline`);
   eq(await page.locator('.ah-composer, [data-testid="composer"]').count()>0,true,`${at}: production's composer`);
   const stopped=!['running','done'].includes(ph);
   eq(await page.getByTestId('status-bell').count(),stopped?1:0,`${at}: the bell carries the stop`);
   if(!phone){
    eq(await page.locator('[data-testid="agent-item-sync"]').count(),where==='none'?0:1,`${at}: the causing conversation in the rail`);
    if(where!=='none')eq((await page.locator('[data-testid="agent-item-sync"]').getAttribute('data-ball'))==='you',stopped,`${at}: rail mark while stopped`);
   }
   if(where!=='here'){
    eq(await stop(page).count(),0,`${at}: no stop piece in an unrelated conversation`);
    await shot(page,d,sit,tag);
    continue;
   }
   const agentOwns=d===B&&['stopped','counting'].includes(ph);
   eq(await stop(page).count(),agentOwns?0:1,`${at}: one stop piece`);
   if(agentOwns){
    eq(await page.getByTestId('told-agent').count(),1,`${at}: Habitat told the agent`);
    ok(await page.locator('.ah-feed > li[data-kind="assistant"]').count()>=2,`${at}: the agent's turn`);
    await shot(page,d,sit,tag);
    continue;
   }
   eq(await stop(page).getAttribute('data-place'),places[d],`${at}: in the direction's place`);
   eq(await phase(page),ph,`${at}: phase`);
   if(d===A)eq(await page.locator('.ah-feed > li[data-kind="sync-stop"]:last-child [data-testid="sync-stop"]').count(),1,`${at}: A last in the timeline, after the turn`);
   if(d===B)eq(await page.locator('.ah-feed > li[data-kind="assistant"]:last-child [data-testid="sync-stop"]').count(),1,`${at}: B under the agent's reply`);
   if(d===C)eq(await page.locator('.ah-feed [data-testid="sync-stop"]').count(),0,`${at}: C not in the timeline`);
   if(['refused','failed'].includes(ph)){
    eq(await page.getByTestId('open-consent').count(),1,`${at}: can look again`);
    eq(await page.getByTestId('sync-outcome').getAttribute('data-phase'),ph,`${at}: outcome said`);
   }
   if(['running','done'].includes(ph))eq(await page.getByTestId('sync-outcome').getAttribute('data-phase'),ph,`${at}: outcome said`);
   if(ph==='stopped'&&d===A){
    ok((await stop(page).innerText()).includes(data==='few'?'14':'4'),`${at}: says which edits`);
    eq(await page.getByTestId('ask-agent').count(),1,`${at}: can ask the agent`);
   }
   if(ph==='counting'&&d!==C)ok(await page.getByTestId('dry-counting').isVisible(),`${at}: counting in place`);
   if(ph==='counted'){
    if(d===C){eq(await page.getByTestId('consent-dialog').count(),0,`${at}: C's count waits for the dialog`);}
    else{
     ok(await page.getByTestId('dry-table').isVisible(),`${at}: the counts`);
     ok(await page.getByTestId('dry-binding').isVisible(),`${at}: what the consent covers`);
     const many=data==='many';
     eq(await page.getByTestId('dry-summary').getAttribute('data-deletions'),many?'many':'none',`${at}: deletions`);
     eq(await page.getByTestId('consent-confirm').isDisabled(),many,`${at}: many deletions gate the confirm`);
     if(many)ok((await page.getByTestId('consent-confirm').innerText()).includes('212'),`${at}: confirm names the deletions`);
    }
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
 await pick(page,d);await setData(page,'few');await setCase(page,d===B?'laskettu':'pysahtyi');
 if(d!==B){
  await page.getByTestId('open-consent').click();
  ok(await page.getByTestId('dry-counting').isVisible(),`${at}: look -> counting`);
  await page.getByTestId('dry-table').waitFor();
  if(d===C)eq(await page.getByTestId('consent-dialog').count(),1,`${at}: count in the dialog`);
 }
 eq(await page.getByTestId('consent-confirm').isDisabled(),false,`${at}: no deletions, confirm open`);
 await shot(page,d,'laskelma-flow','1440-light');
 await page.getByTestId('consent-confirm').click();await settle(page);
 eq(await phase(page),'running',`${at}: running`);
 eq(await page.getByTestId('status-bell').count(),0,`${at}: bell clears`);
 await doneWait(page);await settle(page);
 ok((await page.getByTestId('sync-outcome').innerText()).includes('14'),`${at}: done says what went`);
 // Cancel.
 await setCase(page,'laskettu');
 if(d===C){await page.getByTestId('open-consent').click();await page.getByTestId('dry-table').waitFor();}
 await page.getByTestId('consent-cancel').click();await settle(page);
 eq(await phase(page),'stopped',`${at}: cancel -> still stopped`);
 eq(await page.getByTestId('sync-outcome').count(),1,`${at}: cancel says nothing changed`);
 // A change after the count is refused.
 await page.getByTestId('open-consent').click();await page.getByTestId('dry-table').waitFor();
 await page.getByTestId('rq-change').click();
 await page.getByTestId('consent-confirm').click();await settle(page);
 eq(await phase(page),'refused',`${at}: changed after the count -> refused`);
 // Many deletions need the checkbox.
 await setData(page,'many');await setCase(page,'laskettu');
 if(d===C){await page.getByTestId('open-consent').click();await page.getByTestId('dry-table').waitFor();}
 eq(await page.getByTestId('consent-confirm').isDisabled(),true,`${at}: many deletions gate`);
 await page.getByTestId('consent-agree').click();
 eq(await page.getByTestId('consent-confirm').isDisabled(),false,`${at}: checkbox opens the confirm`);
 await page.getByTestId('consent-confirm').click();await settle(page);
 await doneWait(page);
 ok((await page.getByTestId('sync-outcome').innerText()).includes('212'),`${at}: done names the moves`);
 await setData(page,'few');
}
// A: ask the agent drafts a message in the field.
await pick(page,A);await setCase(page,'pysahtyi');
await page.getByTestId('ask-agent').click();await settle(page);
ok((await page.locator('.ah-composer textarea, textarea').first().inputValue()).length>40,'ask the agent drafts a message');
await shot(page,A,'kysy-agentilta','1440-light');
// B: the bell shows the stop in the conversation.
await pick(page,B);await setCase(page,'laskettu');
await page.getByTestId('status-bell').click();await settle(page);
eq(await page.getByTestId('bell-show').count(),1,'B: bell offers to show it');
await shot(page,B,'kello','1440-light');
await closeModal(page);
// Another conversation open: the rail's mark opens the one that caused it.
await pick(page,A);await setCase(page,'muualla');
await page.getByTestId('status-bell').click();await settle(page);
eq(await page.getByTestId('bell-open').count(),1,'elsewhere: bell opens the conversation');
await shot(page,A,'muualla-kello','1440-light');
await closeModal(page);
await page.locator('[data-testid="agent-item-sync"] a').first().click();await ready(page);
eq(await phase(page),'stopped','rail mark -> the conversation with its card');
// Fallback: the bell opens the count in a dialog.
await setCase(page,'eikeskustelua');
await page.getByTestId('status-bell').click();await settle(page);
await shot(page,A,'eikeskustelua-kello','1440-light');
await page.getByTestId('bell-look').click();await settle(page);
eq(await page.getByTestId('consent-dialog').count(),1,'fallback: dialog');
await page.getByTestId('dry-table').waitFor();
await shot(page,A,'eikeskustelua-laskelma','1440-light');
await page.getByTestId('consent-confirm').click();await settle(page);
await page.getByTestId('status-bell').click();await settle(page);
eq(await page.locator('[data-testid="status-item"][data-phase]').count(),1,'fallback: the bell says it is continuing');
await closeModal(page);
// English.
await pick(page,A);
await page.locator('#language').selectOption('en');await settle(page);await setCase(page,'laskettu');
ok((await page.getByTestId('dry-would').innerText()).includes('Nothing is deleted'),'English count');
ok((await stop(page).innerText()).includes('this conversation'),'English card');
await shot(page,A,'laskettu-en','1440-light');
await setCase(page,'pysahtyi');
await shot(page,A,'pysahtyi-en','1440-light');
await pick(page,B);await setCase(page,'laskettu');
await shot(page,B,'laskettu-en','1440-light');
await page.close();
}finally{await browser.close();}
assert.deepEqual(errors,[],`console: ${errors.join('\n')}`);
console.log(`${checks} checks, console clean`);
