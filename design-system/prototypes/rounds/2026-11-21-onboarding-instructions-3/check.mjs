// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic walkthrough check, not a host-backed acceptance test.
// Default view (every variant, 1440 and 390 px, Päivä, Yö and Kontrasti,
// reduced motion): the variant's line is marked, the route shows four steps
// with "Ohjeet agentille" current, the variant's own title and first agent
// turn are on screen with quick replies, nothing technical (paths,
// AGENTS.md, Pi, Claude) is said, Tallenna is not offered before the file is
// shown, and the document does not overflow. Flow (Päivä and Yö, both
// widths): answer every question by quick reply, the file is revealed with
// what each part means, words of one's own land in it, A2 opens the raw
// file and back, A3 edits the introduction; saving finishes the route, says
// nothing technical until "Missä ohjeet ovat?" is opened, which shows both
// files written; entering Habitat shows a rail without the step's
// conversation. Tee myöhemmin writes nothing and marks the step skipped.
// Existing file: the old text is kept and the additions marked, the language
// is not added, saving edits both files, Jätä ennalleen writes nothing.
// "Hyppää valmiiseen tiedostoon" opens the reveal directly. Walkthrough:
// Alkuun kirjautumisesta clicks sign-in, repositories and the AI step to the
// last step. English last. Screenshots at device scale 2 into <out-dir>; the
// console must stay clean.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-21-onboarding-instructions-3';
const [input,out,flag]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <out-dir> [--quick]');process.exit(2);}
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['lyhyesti','muistilappu','esittely'];
const kinds=['list','note','letter'];
const titles={fi:['Kerro agentille itsestäsi','Muistilappu agentille','Esittele itsesi agentille'],en:['Tell the agent about yourself','A note for your agent','Introduce yourself to the agent']};
const technical=/AGENTS\.md|CLAUDE\.md|~\/\.pi|\bPi\b|Claude/;
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
const press=async(page,id)=>{await tid(page,id).first().click();await settle(page);};
const stepText=async page=>(await tid(page,'instructions-step').textContent());
const revealText=async page=>(await tid(page,'reveal').textContent());

async function defaultView(page,d,at,{scenario='fresh',lang='fi'}={}){
 eq(await page.locator('.ra-lines li[aria-current]').count(),1,`${at}: its line is marked`);
 eq(await tid(page,'onboarding-steps').locator('li').count(),4,`${at}: four route steps`);
 eq(await stepState(page,'instructions'),'current',`${at}: instructions current`);
 for(const s of ['github','repositories','ai'])eq(await stepState(page,s),'done',`${at}: ${s} done`);
 eq((await tid(page,'instructions-title').textContent()).trim(),titles[lang][d],`${at}: the variant's title`);
 ok(await tid(page,'quick-reply').first().isVisible(),`${at}: quick replies`);
 eq(await tid(page,'quick-replies').getAttribute('data-question'),d===1?'confirm':'style',`${at}: first question`);
 if(d===2)ok((await tid(page,'agent-reply').first().textContent()).includes(lang==='en'?"I'm Aino":'olen Aino'),`${at}: the letter starts in the first turn`);
 ok(!technical.test(await stepText(page)),`${at}: nothing technical in the step`);
 eq(await has(page,'reveal'),false,`${at}: no file before the answers`);
 eq(await has(page,'step-save'),false,`${at}: no save before the file is shown`);
 ok(await tid(page,'step-later').isVisible(),`${at}: later`);
 if(scenario==='existing')ok((await tid(page,'instructions-lead').textContent()).includes(lang==='en'?'already':'jo'),`${at}: lead names the existing file`);
 ok(await fits(page),`${at}: document overflow`);
}

async function answerAll(page,d){
 const n=d===1?3:2;
 for(let i=0;i<n;i++){await tid(page,'quick-reply').nth(i===n-1?0:1).click();await settle(page);}
}

async function reveal(page,d,at,{scenario='fresh',lang='fi'}={}){
 const fi=lang==='fi';
 ok(await has(page,'reveal'),`${at}: file revealed`);
 eq(await tid(page,'reveal').getAttribute('data-kind'),kinds[d],`${at}: the variant's reveal`);
 ok(await tid(page,'step-save').isVisible(),`${at}: save offered`);
 ok((await tid(page,'means').count())>0,`${at}: says what it means`);
 const text=await revealText(page);
 ok(!technical.test(text),`${at}: the reveal speaks plainly`);
 if(scenario==='fresh')ok(text.includes('Aino'),`${at}: the name`);
 if(scenario==='existing'){
  ok(text.includes(fi?'tyyppivihjeitä':'type hints'),`${at}: old text kept`);
  ok(!text.includes(fi?'Puhu minulle suomea':'Speak English with me'),`${at}: language not added`);
  ok(await has(page,'reveal-kept'),`${at}: kept block`);
 }else ok(text.includes(fi?'suomea':'English'),`${at}: language from Habitat`);
 ok(await fits(page),`${at}: reveal overflow`);
}

async function flow(page,d,tag){
 const at=`${names[d]} ${tag}`;
 await answerAll(page,d);
 await reveal(page,d,at);
 const text=await revealText(page);
 if(d===1)ok(!text.includes('Kirjastonhoitaja'),`${at}: "Jätä pois" left the GitHub bio out`);
 else ok(/kirjastonhoitaja/i.test(text),`${at}: the GitHub bio`);
 ok(text.includes(d===2?'Kysy minulta ennen kuin julkaiset':'Kysy ennen kuin julkaiset'),`${at}: ask-first answer`);
 await tid(page,'step-field').fill('Asun Tampereella.');await press(page,'step-send');
 ok((await revealText(page)).includes('Asun Tampereella.'),`${at}: own words in the file`);
 await shot(page,`${d}-${names[d]}-${tag}-reveal`);
 if(d===1){
  await press(page,'toggle-raw');
  ok((await tid(page,'raw-file').textContent()).includes('~/.pi/agent/AGENTS.md'),`${at}: raw file names its path on request`);
  ok((await tid(page,'raw-file').textContent()).includes('## Miten vastaat'),`${at}: raw markdown`);
  await shot(page,`${d}-${names[d]}-${tag}-raw`);
  await press(page,'toggle-raw');
  ok(await has(page,'means'),`${at}: back to the note`);
 }
 if(d===2){
  await press(page,'letter-edit');
  await tid(page,'letter-text').fill('Hei, olen Aino. Kirjoitin tämän itse.');
  await press(page,'letter-edit');
  ok((await revealText(page)).includes('Kirjoitin tämän itse.'),`${at}: edited introduction`);
 }
 await press(page,'step-save');
 ok(await has(page,'route-done'),`${at}: done card`);
 eq(await stepState(page,'instructions'),'done',`${at}: step done`);
 ok(!technical.test(await tid(page,'route-done').locator('header').textContent()),`${at}: done card plain`);
 await tid(page,'where').locator('summary').click();await settle(page);
 eq(await page.locator('[data-testid="file-tool"][data-tool="write"]').count(),2,`${at}: both files written`);
 const written=await tid(page,'written-file').textContent();
 ok(written.includes(d===2?'Kirjoitin tämän itse.':'Asun Tampereella.'),`${at}: written file matches the reveal`);
 ok(!/Open Habitat environment|~\/src|site\.origin/.test(written),`${at}: nothing of the environment block`);
 await shot(page,`${d}-${names[d]}-${tag}-done`);
 await press(page,'enter-habitat');
 ok(await has(page,'home'),`${at}: Habitat`);
 if(!tag.startsWith('390'))ok(!/Ohjeet agentille|~/.test(await page.locator('.ah-rail').first().textContent()),`${at}: the step's conversation is not in the rail`);
}

async function later(page,d,tag){
 const at=`${names[d]} later ${tag}`;
 await press(page,'step-later');
 eq(await tid(page,'route-done').getAttribute('data-outcome'),'later',`${at}: later`);
 eq(await page.locator('[data-testid="file-tool"]').count(),0,`${at}: nothing written`);
 eq(await stepState(page,'instructions'),'skipped',`${at}: skipped`);
}

async function walkthrough(page,tag){
 const at=`walkthrough ${tag}`;
 await press(page,'event-reset');
 ok(await has(page,'login-heading'),`${at}: sign-in`);
 eq(await stepState(page,'instructions'),'next',`${at}: last step ahead`);
 await press(page,'github-sign-in');
 ok(await has(page,'stage-repos'),`${at}: repositories`);
 await press(page,'repository-proceed');
 ok(await has(page,'pi-sign-in-title'),`${at}: AI step`);
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
   if(theme==='contrast'){await press(page,'event-reveal');await reveal(page,d,`${names[d]} jump ${tag}`);await shot(page,`${d}-${names[d]}-${tag}-jump`);continue;}
   await flow(page,d,tag);
   await pick(page,(d+1)%3);await pick(page,d);
   await later(page,d,tag);
  }
  if(theme==='light'){await pick(page,1);await walkthrough(page,tag);}
  await page.close();
 }
 for(const theme of quick?['light']:['light','dark']){
  const page=await open(width,theme,{scenario:'existing'});
  const tag=`${width}-${theme}-existing`;
  for(let d=0;d<3;d++){
   await pick(page,d);
   await defaultView(page,d,`${names[d]} ${tag}`,{scenario:'existing'});
   await answerAll(page,d);
   await reveal(page,d,`${names[d]} ${tag}`,{scenario:'existing'});
   ok((await tid(page,'reveal-new').count())>0||d===2,`${names[d]} ${tag}: additions marked`);
   await shot(page,`${d}-${names[d]}-${tag}-reveal`);
   await press(page,'step-save');
   eq(await page.locator('[data-testid="file-tool"][data-tool="edit"]').count(),2,`${names[d]} ${tag}: both files edited`);
   ok((await tid(page,'written-file').textContent()).startsWith('# Omat ohjeet'),`${names[d]} ${tag}: old text first`);
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
  await answerAll(page,d);
  await reveal(page,d,`${names[d]} en ${width}`,{lang:'en'});
  await shot(page,`${d}-${names[d]}-${width}-en-reveal`);
 }
 await page.close();
 const ex=await open(width,'light',{lang:'en',scenario:'existing'});
 await pick(ex,1);await press(ex,'event-reveal');
 await reveal(ex,1,`muistilappu en existing ${width}`,{lang:'en',scenario:'existing'});
 await shot(ex,`1-muistilappu-${width}-en-existing`);
 await ex.close();
}
await browser.close();
if(errors.length){console.error('console errors:\n'+[...new Set(errors)].join('\n'));process.exit(1);}
console.log(`${checks} checks passed, console clean; screenshots in ${out}`);
