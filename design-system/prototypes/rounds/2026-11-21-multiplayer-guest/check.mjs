// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Walks the three directions at 1440 and 390 px in Päivä, Yö and Kontrasti
// with reduced motion. The default view: Ville has written, the agent
// answered with text only, two actions wait for Aino; every message names
// its author with an avatar and a role, and each direction shows the tool
// mode its own way (strip above the field, badge on each reply, card where
// the agent stopped) and only its own way. Then the flows in Päivä and Yö:
// a tool row's output is the owner's, Aino's Voit jatkaa runs both
// actions, per-action approval runs one and declines the other, marking
// Ville trusted turns his next message into a tools turn whose output he
// sees, and the invite: decline, join, write, wait. English last.
// Screenshots at device scale 2 into <out-dir>.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-21-multiplayer-guest';
const [input,out,flag]=process.argv.slice(2);
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['kaista','merkki','kortti'];
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};

async function open(width,theme,lang='fi'){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:1000},deviceScaleFactor:2,reducedMotion:'reduce',hasTouch:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 if(lang==='en')await page.locator('#language').selectOption('en');
 return page;
}
const pick=async(page,d)=>{await page.locator('.proto-picker-item').nth(d).click();await page.locator(`.ra-review[data-direction="${d}"]`).waitFor({state:'attached'});await page.waitForTimeout(150);};
const shot=(page,name)=>page.screenshot({path:`${out}/${name}.png`});
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const count=(page,id)=>page.getByTestId(id).count();
const text=async(page,id)=>(await page.getByTestId(id).allTextContents()).join(' | ');
const phase=page=>page.getByTestId('conversation').getAttribute('data-phase');
const step=async(page,s)=>{await page.locator('#step').selectOption(s);await page.waitForTimeout(150);};
const opStates=async page=>page.locator('[data-testid="card-op"]').evaluateAll(els=>els.map(e=>e.dataset.state));
const toBottom=page=>page.evaluate(()=>{for(const el of document.querySelectorAll('*'))if(el.scrollHeight>el.clientHeight+4&&getComputedStyle(el).overflowY.match(/auto|scroll/))el.scrollTop=el.scrollHeight;});
async function send(page,body){
 const field=page.getByTestId('message-input');
 await field.click();await field.fill(body);await field.press('Enter');
 await page.waitForTimeout(200);
}

/** What only one direction shows. */
async function onlyItsOwn(page,d,at){
 eq(await count(page,'mode-strip'),d===0?1:0,`${at}: strip only in 1`);
 eq((await count(page,'turn-badge'))>0,d===1,`${at}: badges only in 2`);
 eq(await count(page,'stop-card'),d===2?1:0,`${at}: card only in 3`);
}

async function defaultView(page,d,at){
 eq(await phase(page),'pending',`${at}: Ville's message waits`);
 for(const [who,name,role] of [['aino','Aino','Omistaja'],['sanna','Sanna','Luotettu'],['ville','Ville (Sinä)',null]]){
  const m=page.getByTestId(`msg-${who}`).first();
  eq(await m.locator('.mg-name').textContent(),name,`${at}: ${who} named`);
  eq(await m.locator('.mg-avatar').count(),1,`${at}: ${who} has an avatar`);
  ok(await m.locator('.mg-name').isVisible(),`${at}: ${who}'s name visible`);
  eq(await m.locator('[data-testid="role"]').count(),role?1:0,`${at}: ${who}'s role`);
  if(role)eq(await m.locator('[data-testid="role"]').textContent(),role,`${at}: ${who} is ${role}`);
 }
 ok(await page.getByTestId('text-only-reply').isVisible(),`${at}: the text-only reply`);
 ok((await text(page,'text-only-reply')).includes('ei ole työkaluja'),`${at}: the reply says why`);
 eq(await page.locator('[data-item^="t-"]').count(),2,`${at}: only the owner's and Sanna's turns used tools`);
 ok((await page.getByTestId('people').textContent()).includes('Omistaja'),`${at}: who is here`);
 await onlyItsOwn(page,d,at);
 if(d===0){
  ok((await text(page,'mode-strip')).includes('Vain teksti'),`${at}: strip says text only`);
  eq(await opStates(page),['waiting','waiting'],`${at}: two actions wait in the strip`);
 }
 if(d===1){
  eq(await page.locator('[data-testid="turn-badge"][data-tools="off"]').count(),1,`${at}: one text-only badge`);
  ok((await page.locator('[data-testid="turn-badge"][data-tools="off"]').textContent()).includes('Vain teksti · Ville'),`${at}: whose turn`);
  ok((await text(page,'turn-badge')).includes('Työkalut · Sanna'),`${at}: Sanna's turn had tools`);
  ok((await text(page,'pending-line')).includes('2 tointa'),`${at}: two actions wait`);
 }
 if(d===2){
  eq(await opStates(page),['waiting','waiting'],`${at}: the card's two actions wait`);
  ok((await text(page,'stop-card')).includes('pysähtyi'),`${at}: the card says where it stopped`);
 }
 ok(await fits(page),`${at}: overflow`);
}

async function flows(page,d,tag){
 const at=`${names[d]} ${tag}`;
 // Tool output is the owner's.
 await page.locator('[data-item="t-contact"] [data-testid="history-tool-toggle"]').click();
 ok(await page.getByTestId('hidden-output').first().isVisible(),`${at}: output hidden from a participant`);
 eq(await page.locator('.ah-tool-output').count(),0,`${at}: no output shown`);
 await shot(page,`${d}-${names[d]}-${tag}-output-hidden`);
 // Voit jatkaa.
 await page.getByTestId('event-continue').click();await page.waitForTimeout(150);
 eq(await phase(page),'continued',`${at}: continued`);
 eq(await page.getByTestId('msg-aino').count(),2,`${at}: Aino's Voit jatkaa is attributed`);
 eq(await page.locator('[data-item="t-deploy"]').count(),1,`${at}: the deploy ran`);
 eq(await count(page,'pending-line'),0,`${at}: nothing waits`);
 if(d===0)eq(await count(page,'strip-ops'),0,`${at}: strip has no waiting actions`);
 if(d===2)eq(await opStates(page),['done','done'],`${at}: card shows both done`);
 await toBottom(page);
 await shot(page,`${d}-${names[d]}-${tag}-continued`);
 // One action at a time.
 await step(page,'pending');
 await page.getByTestId('event-perop').click();await page.waitForTimeout(150);
 ok(await page.getByTestId('per-op-line').isVisible(),`${at}: Habitat says what Aino decided`);
 eq(await page.locator('[data-item="t-deploy"]').count(),0,`${at}: the declined deploy did not run`);
 if(d===2)eq(await opStates(page),['done','declined'],`${at}: card: edit done, deploy declined`);
 await toBottom(page);
 await shot(page,`${d}-${names[d]}-${tag}-per-op`);
 // Trusted.
 await page.getByTestId('event-trust').click();await page.waitForTimeout(150);
 ok(await page.getByTestId('trusted-line').isVisible(),`${at}: Habitat says Ville is trusted`);
 eq(await page.getByTestId('msg-ville').first().locator('[data-testid="role"]').textContent(),'Luotettu',`${at}: Ville's role`);
 if(d===0)ok((await text(page,'mode-strip')).includes('Työkalut käytössä'),`${at}: strip says tools on`);
 eq(await page.getByTestId('message-input').getAttribute('placeholder'),'Kirjoita Ainon agentille',`${at}: trusted placeholder`);
 await send(page,'Lisää vielä esityslista linkiksi.');
 eq(await page.locator('[data-item="tx0"]').count(),1,`${at}: a trusted message gets a tools turn`);
 if(d===1)ok((await page.locator('[data-item="rx0"] [data-testid="turn-badge"]').textContent()).includes('Työkalut · Ville'),`${at}: the badge names Ville`);
 await page.locator('[data-item="tx0"] [data-testid="history-tool-toggle"]').click();
 eq(await page.locator('[data-item="tx0"] .ah-tool-output').count(),1,`${at}: a trusted participant sees output`);
 ok(await fits(page),`${at}: overflow when trusted`);
 await toBottom(page);
 await shot(page,`${d}-${names[d]}-${tag}-trusted`);
 // The invite.
 await step(page,'invite');
 ok(await page.getByTestId('invite').isVisible(),`${at}: the invite`);
 eq(await page.getByTestId('message-input').count(),0,`${at}: no field before joining`);
 eq(await page.getByTestId('msg-aino').count(),0,`${at}: nothing of the conversation before joining`);
 ok((await text(page,'invite')).includes('Ainon mallia, kiintiötä ja yhteyksiä'),`${at}: whose agent`);
 ok(await fits(page),`${at}: invite overflow`);
 await shot(page,`${d}-${names[d]}-${tag}-invite`);
 await page.getByTestId('invite-decline').click();
 ok(await page.getByTestId('invite-declined').isVisible(),`${at}: declined says the invite stays`);
 await page.getByTestId('invite-join').click();await page.waitForTimeout(150);
 eq(await phase(page),'joined',`${at}: joined`);
 ok(await page.getByTestId('joined-line').isVisible(),`${at}: Habitat says you joined`);
 eq(await page.getByTestId('message-input').getAttribute('placeholder'),'Kirjoita Ainon agentille. Se vastaa sinulle tekstillä.',`${at}: the field says text only before sending`);
 if(d===0)ok((await text(page,'mode-strip')).includes('Vain teksti'),`${at}: the strip says text only before sending`);
 await send(page,'Voisitko lisätä kevään tapahtumat?');
 eq(await phase(page),'pending',`${at}: sent, waits`);
 eq(await page.getByTestId('msg-ville').locator('[data-testid="user-content"]').textContent(),'Voisitko lisätä kevään tapahtumat?',`${at}: Ville's own words`);
 await page.getByTestId('event-reset').click();await page.waitForTimeout(150);
}

try{
for(const width of quick?[1440]:[1440,390])for(const theme of quick?['light']:['light','dark','contrast']){
 const tag=`${width}-${theme}`;
 const page=await open(width,theme);
 await checkPicker(page,round);
 eq(await page.getByTestId('recommendation').count(),1,'the recommendation is on the page');
 for(let d=0;d<3;d++){
  await pick(page,d);
  await defaultView(page,d,`${names[d]} ${tag}`);
  await toBottom(page);
  await shot(page,`${d}-${names[d]}-${tag}`);
  if(width===1440)ok((await page.getByTestId('rail-shared').textContent()).includes('Kevään julkaisu'),`${tag}: shared row in the rail`);
  if(theme!=='contrast')await flows(page,d,tag);
 }
 await page.close();
}
{
 const en=await open(1440,'light','en');
 await pick(en,2);
 ok((await en.getByTestId('stop-card').textContent()).includes('The agent stopped here'),'English: card');
 ok((await en.getByTestId('msg-ville').locator('.mg-name').textContent())==='Ville (You)','English: own name');
 ok((await en.getByTestId('msg-aino').first().locator('[data-testid="role"]').textContent())==='Owner','English: owner role');
 await toBottom(en);
 await shot(en,'en-2-kortti-1440-light');
 await step(en,'invite');
 ok((await en.getByTestId('invite').textContent()).includes("Aino's model, quota and connections"),'English: invite');
 await shot(en,'en-invite-1440-light');
 await en.close();
 const enPhone=await open(390,'dark','en');
 await pick(enPhone,0);
 ok((await enPhone.getByTestId('mode-strip').textContent()).includes('Text only'),'English phone: strip');
 ok(await fits(enPhone),'English phone fits');
 await toBottom(enPhone);
 await shot(enPhone,'en-0-kaista-390-dark');
 await pick(enPhone,1);
 ok((await enPhone.getByTestId('turn-badge').allTextContents()).some(s=>s.includes('Text only · Ville')),'English phone: badge');
 ok(await fits(enPhone),'English phone badge fits');
 await toBottom(enPhone);
 await shot(enPhone,'en-1-merkki-390-dark');
 await enPhone.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[],'console errors');
console.log(`${checks} checks passed`);
