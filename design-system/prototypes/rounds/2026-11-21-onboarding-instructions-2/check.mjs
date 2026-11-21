// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic walkthrough check, not a host-backed acceptance test.
// Default view (every direction, 1440 and 390 px, Päivä, Yö and Kontrasti,
// reduced motion): the direction's line is marked, the route shows four
// steps with "Ohjeet agentille" current and the three before it done, and the
// direction's own body is on screen (A a chat with a draft and quick replies,
// B a file with inline choices and a side chat, C a form with agent helpers);
// no document overflow. Flows (Päivä and Yö, both widths): A answers both
// questions by quick reply and one in own words, B picks inline and writes to
// the side chat, C asks the helper and uses its suggestion, opens the file;
// each saves, sees both files written and the route finished, and enters
// Habitat without a reminder. Every direction: Tee myöhemmin writes nothing,
// the route marks the step skipped and still finishes, Habitat shows the
// reminder and its Tee nyt opens the same step in Settings. Existing file:
// the lead says so, the file keeps the old text first and marks additions,
// the language is not asked, saving edits both files, Jätä ennalleen writes
// nothing. Walkthrough: Alkuun kirjautumisesta clicks sign-in, repositories
// and the AI step to the last step. English last. Screenshots at device
// scale 2 into <out-dir>; the console must stay clean.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-21-onboarding-instructions-2';
const [input,out,flag]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <out-dir> [--quick]');process.exit(2);}
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['keskustelu','tiedosto','lomake'];
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};

async function open(width,theme,{lang='fi',scenario='fresh'}={}){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:1000},deviceScaleFactor:2,reducedMotion:'reduce',hasTouch:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 if(lang==='en')await page.locator('#language').selectOption('en');
 if(scenario==='existing')await page.locator('#scenario').selectOption('existing');
 return page;
}
const settle=page=>page.waitForTimeout(120);
const pick=async(page,d)=>{await page.locator('.proto-picker-item').nth(d).click();await page.locator(`.ra-review[data-direction="${d}"]`).waitFor({state:'attached'});await settle(page);};
const shot=(page,name)=>page.screenshot({path:`${out}/${name}.png`,fullPage:true});
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const has=async(page,id)=>(await page.getByTestId(id).count())>0;
const tid=(page,id)=>page.getByTestId(id);
const stepState=(page,id)=>page.getByTestId(`onboarding-step-${id}`).getAttribute('data-state');
const fileText=async page=>(await tid(page,'file-text').last().textContent());
const press=async(page,id)=>{await tid(page,id).first().click();await settle(page);};
const reset=async page=>{await press(page,'event-reset');};

async function defaultView(page,d,at,{scenario='fresh',lang='fi'}={}){
 eq(await page.locator('.ra-lines li[aria-current]').count(),1,`${at}: its line is marked`);
 eq(await page.getByTestId('onboarding-steps').locator('li').count(),4,`${at}: four route steps`);
 eq(await stepState(page,'instructions'),'current',`${at}: instructions current`);
 for(const s of ['github','repositories','ai'])eq(await stepState(page,s),'done',`${at}: ${s} done`);
 ok((await tid(page,'onboarding-step-instructions').textContent()).includes(lang==='en'?'Agent instructions':'Ohjeet agentille'),`${at}: step label`);
 eq(await has(page,'step-chat'),d===0,`${at}: chat only in A`);
 eq(await has(page,'step-file'),d===1,`${at}: file only in B`);
 eq(await has(page,'step-form'),d===2,`${at}: form only in C`);
 if(d===0){ok(await tid(page,'quick-reply').first().isVisible(),`${at}: quick replies`);ok(await has(page,'file-preview'),`${at}: draft in the chat`);}
 if(d===1){ok(await tid(page,'inline-pick').first().isVisible(),`${at}: inline choices`);ok(await tid(page,'side-chat').isVisible(),`${at}: side chat`);}
 if(d===2)ok(await tid(page,'helper-call').isVisible(),`${at}: helper`);
 ok(await tid(page,'step-later').isVisible(),`${at}: later`);
 ok(await tid(page,'step-save').isVisible(),`${at}: save`);
 ok(await tid(page,'claude-note').isVisible(),`${at}: Claude note`);
 if(scenario==='existing'){
  ok((await tid(page,'instructions-lead').textContent()).includes(lang==='en'?'already':'jo'),`${at}: lead names the existing file`);
  if(d!==2){const text=await fileText(page);ok(text.includes(lang==='en'?'Use type hints':'tyyppivihjeitä'),`${at}: old text kept`);ok(!text.includes(lang==='en'?'## Language':'## Kieli'),`${at}: language not asked`);}
  if(d===2)ok(await has(page,'form-lang-has'),`${at}: form says the language is there`);
 }else if(d!==2){ok((await fileText(page)).includes(lang==='en'?'Librarian':'Kirjastonhoitaja'),`${at}: draft from the GitHub bio`);}
 ok(await fits(page),`${at}: document overflow`);
}

async function finish(page,at,{scenario='fresh',expect}){
 await press(page,'step-save');
 ok(await has(page,'route-done'),`${at}: route done card`);
 const tool=scenario==='existing'?'edit':'write';
 eq(await page.locator(`[data-testid="file-tool"][data-tool="${tool}"]`).count(),2,`${at}: both files ${tool}`);
 eq(await stepState(page,'instructions'),'done',`${at}: step done in the route`);
 const text=await fileText(page);
 for(const e of expect)ok(text.includes(e),`${at}: file has ${e}`);
 ok(!/Open Habitat environment|~\/src|site\.origin/.test(text),`${at}: nothing of the environment block`);
 if(scenario==='existing')ok((await page.locator('.oi-row[data-added]').count())>0,`${at}: additions marked`);
 ok(await fits(page),`${at}: done overflow`);
}

async function enter(page,at,reminder){
 await press(page,'enter-habitat');
 ok(await has(page,'home'),`${at}: Habitat home`);
 eq(await has(page,'home-reminder'),reminder,`${at}: reminder ${reminder}`);
}

async function flowA(page,tag,fi=true){
 const at=`A ${tag}`;
 await page.getByTestId('quick-reply').nth(1).click();await settle(page);
 ok((await fileText(page)).includes(fi?'Selitä mitä teet':'Explain what you do'),`${at}: style in draft`);
 await tid(page,'step-field').fill(fi?'Asun Tampereella.':'I live in Tampere.');await press(page,'step-send');
 ok((await tid(page,'person-message').last().textContent()).includes(fi?'Tampereella':'Tampere'),`${at}: own words posted`);
 await page.getByTestId('quick-reply').nth(0).click();await settle(page);
 eq(await has(page,'quick-replies'),false,`${at}: questions done`);
 await shot(page,`a-${tag}-answered`);
 await finish(page,at,{expect:[fi?'Kysy ennen kuin julkaiset':'Ask before you publish',fi?'Asun Tampereella.':'I live in Tampere.']});
 await shot(page,`a-${tag}-done`);
 await enter(page,at,false);
}
async function flowB(page,tag){
 const at=`B ${tag}`;
 await page.getByTestId('inline-pick').nth(0).getByTestId('inline-choice').nth(0).click();await settle(page);
 await page.getByTestId('inline-pick').nth(1).getByTestId('inline-choice').nth(1).click();await settle(page);
 ok((await tid(page,'side-chat').textContent()).includes('valmis'),`${at}: agent says ready`);
 await tid(page,'step-field').fill('Pidän lyhyistä commit-viesteistä.');await press(page,'step-send');
 ok((await fileText(page)).includes('commit-viesteistä'),`${at}: own words in the file`);
 await shot(page,`b-${tag}-answered`);
 await finish(page,at,{expect:['Vastaa lyhyesti','Kysy ennen kuin poistat','commit-viesteistä','Vastaa suomeksi.']});
 await shot(page,`b-${tag}-done`);
 await enter(page,at,false);
}
async function flowC(page,tag){
 const at=`C ${tag}`;
 eq(await tid(page,'form-call').inputValue(),'Aino Laine',`${at}: name from GitHub`);
 await press(page,'helper-call');
 ok(await tid(page,'helper-call-reply').isVisible(),`${at}: helper answers`);
 await press(page,'helper-call-use');
 eq(await tid(page,'form-call').inputValue(),'Aino',`${at}: suggestion used`);
 await press(page,'helper-ask');await press(page,'helper-ask-use');
 await tid(page,'form-style-0').check();
 await press(page,'form-preview');
 ok((await fileText(page)).includes('Kysy ennen kuin poistat'),`${at}: preview follows the form`);
 await shot(page,`c-${tag}-filled`);
 await finish(page,at,{expect:['Puhuttele minua nimellä Aino.','Kysy ennen kuin julkaiset','Vastaa lyhyesti']});
 await enter(page,at,false);
}
const flows=[flowA,flowB,flowC];

async function later(page,d,tag){
 const at=`${names[d]} later ${tag}`;
 await press(page,'step-later');
 eq(await tid(page,'route-done').getAttribute('data-outcome'),'later',`${at}: later outcome`);
 eq(await page.locator('[data-testid="file-tool"]').count(),0,`${at}: nothing written`);
 eq(await stepState(page,'instructions'),'skipped',`${at}: step skipped in the route`);
 await shot(page,`${d}-${tag}-later`);
 await enter(page,at,true);
 await press(page,'reminder-start');
 ok(await has(page,'settings'),`${at}: settings open`);
 ok(await has(page,'instructions-step'),`${at}: same step in settings`);
 ok(await fits(page),`${at}: settings overflow`);
 await shot(page,`${d}-${tag}-settings`);
 await press(page,'step-save');
 eq(await has(page,'home-reminder'),false,`${at}: reminder gone after saving`);
}

async function walkthrough(page,tag){
 const at=`walkthrough ${tag}`;
 await reset(page);
 ok(await has(page,'login-heading'),`${at}: sign-in`);
 eq(await stepState(page,'instructions'),'next',`${at}: last step ahead`);
 await shot(page,`w-${tag}-1-login`);
 await press(page,'github-sign-in');
 ok(await has(page,'stage-repos'),`${at}: repositories`);
 await shot(page,`w-${tag}-2-repos`);
 await press(page,'repository-proceed');
 ok(await has(page,'pi-sign-in-title'),`${at}: AI step`);
 eq(await stepState(page,'repositories'),'done',`${at}: repositories done`);
 await shot(page,`w-${tag}-3-ai`);
 await press(page,'simulate-signed-in');
 ok(await has(page,'instructions-step'),`${at}: last step`);
 eq(await stepState(page,'ai'),'done',`${at}: AI done`);
}

const themes=quick?['light']:['light','dark','contrast'];
for(const width of [1440,390]){
 for(const theme of themes){
  const page=await open(width,theme);
  const tag=`${width}-${theme}`;
  await checkPicker(page,round);
  for(let d=0;d<3;d++){
   await pick(page,d);
   await defaultView(page,d,`${names[d]} ${tag}`);
   await shot(page,`${d}-${names[d]}-${tag}`);
   if(theme==='contrast')continue;
   await flows[d](page,tag);
   await pick(page,(d+1)%3);await pick(page,d);
   await later(page,d,tag);
  }
  if(theme==='light'){await pick(page,1);await walkthrough(page,tag);}
  await page.close();
 }
 // An existing file: additions only, never an overwrite.
 for(const theme of quick?['light']:['light','dark']){
  const page=await open(width,theme,{scenario:'existing'});
  const tag=`${width}-${theme}-existing`;
  for(let d=0;d<3;d++){
   await pick(page,d);
   await defaultView(page,d,`${names[d]} ${tag}`,{scenario:'existing'});
   await shot(page,`${d}-${names[d]}-${tag}`);
   await finish(page,`${names[d]} ${tag}`,{scenario:'existing',expect:['tyyppivihjeitä','Puhuttele minua']});
   await shot(page,`${d}-${names[d]}-${tag}-done`);
   await pick(page,(d+1)%3);await pick(page,d);
   await press(page,'step-later');
   eq(await tid(page,'route-done').getAttribute('data-outcome'),'kept',`${names[d]} ${tag}: kept`);
   eq(await page.locator('[data-testid="file-tool"]').count(),0,`${names[d]} ${tag}: kept writes nothing`);
  }
  await page.close();
 }
}
// English last.
for(const width of [1440,390]){
 const page=await open(width,'dark',{lang:'en'});
 for(let d=0;d<3;d++){
  await pick(page,d);
  await defaultView(page,d,`${names[d]} en ${width}`,{lang:'en'});
  await shot(page,`${d}-${names[d]}-${width}-en`);
 }
 await pick(page,0);await flowA(page,`${width}-en`,false);
 await page.close();
 const ex=await open(width,'light',{lang:'en',scenario:'existing'});
 await pick(ex,1);
 await defaultView(ex,1,`tiedosto en existing ${width}`,{lang:'en',scenario:'existing'});
 await shot(ex,`1-tiedosto-${width}-en-existing`);
 await ex.close();
}
await browser.close();
if(errors.length){console.error('console errors:\n'+[...new Set(errors)].join('\n'));process.exit(1);}
console.log(`${checks} checks passed, console clean; screenshots in ${out}`);
