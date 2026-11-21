// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic walkthrough check, not a host-backed acceptance test.
// Default view (every variant, 1440 and 390 px, Päivä, Yö and Kontrasti,
// reduced motion): the variant's line is marked, the route shows four steps
// with "Ohjeet agentille" current, A2's title and lead, nothing technical
// (paths, AGENTS.md, Pi, Claude) in the step, no Tallenna before the note is
// shown, and each variant's own default: A4.1 asks the language first with
// Habitat's language as the first, primary chip; A4.2 shows the own-words
// card with the language preselected; A4.3 shows the note beside the
// conversation, locked for editing, with the language at its top and the
// own-words box under it. Flow (Päivä and Yö, both widths): every question
// answered, own words written (A4.1 keeps them as written, A4.2 takes the
// tidied version, A4.3 adds them from the box), the note shown in the shared
// editor in Esikatselu with the answer language, Muokkaa shows the raw
// Markdown, an edit marks it unsaved, Peru (A4.2) returns the agent's text,
// Esikatselu renders the edit, Tallenna finishes the route; "Missä ohjeet
// ovat?" shows both files written with the edited text; Habitat's rail has
// no step conversation. A4.2 also changes the language before continuing.
// Tee myöhemmin writes nothing. Existing file: no language question or line,
// the old text drawn unchanged and the addition as new, both files edited,
// Jätä ennalleen writes nothing. Jump, the walkthrough from sign-in, and
// English last. Screenshots at device scale 2 into <out-dir>; console clean.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-21-onboarding-instructions-4';
const [input,out,flag]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <out-dir> [--quick]');process.exit(2);}
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['keskustelussa','omin-sanoin-ensin','lappu-vieressa'];
const W={
 fi:{title:'Muistilappu agentille',lang:'Vastaa minulle suomeksi.',langEn:'Vastaa minulle englanniksi.',chip:'Suomeksi',own:'asun tampereella ja mulla on kaks kissaa. en tykkää pitkistä selityksistä',tidied:'Asun Tampereella ja mulla on kaks kissaa. En tykkää pitkistä selityksistä.',ownHead:'## Omin sanoin',preview:'Esikatselu',edit:'Muokkaa',kept:'tyyppivihjeitä',work:'kirjastonhoitaja'},
 en:{title:'A note for your agent',lang:'Answer me in English.',langEn:'Answer me in English.',chip:'In English',own:'i live in tampere and have two cats. i dont like long explanations',tidied:'I live in Tampere and have two cats. I don\'t like long explanations.',ownHead:'## In my own words',preview:'Preview',edit:'Edit',kept:'type hints',work:'librarian'},
};
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
const settle=page=>page.waitForTimeout(150);
const pick=async(page,d)=>{await page.locator('.proto-picker-item').nth(d).click();await page.locator(`.ra-review[data-direction="${d}"]`).waitFor({state:'attached'});await settle(page);};
const shot=(page,name)=>page.screenshot({path:`${out}/${name}.png`,fullPage:true});
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const has=async(page,id)=>(await page.getByTestId(id).count())>0;
const tid=(page,id)=>page.getByTestId(id);
const stepState=(page,id)=>page.getByTestId(`onboarding-step-${id}`).getAttribute('data-state');
const press=async(page,id)=>{await tid(page,id).first().click();await settle(page);};
const chip=async(page,i)=>{await tid(page,'quick-reply').nth(i).click();await settle(page);};
const question=page=>tid(page,'quick-replies').getAttribute('data-question');
const stepText=async page=>(await tid(page,'instructions-step').textContent());
const previewText=async page=>(await tid(page,'editor-preview').textContent());
const tab=async(page,name)=>{await page.getByRole('tab',{name,exact:true}).click();await settle(page);};
const writeOwn=async(page,box,text)=>{await tid(page,box).getByTestId('own-field').fill(text);await tid(page,box).getByTestId('own-submit').click();await settle(page);};

async function defaultView(page,d,at,{scenario='fresh',lang='fi'}={}){
 const w=W[lang];
 eq(await page.locator('.ra-lines li[aria-current]').count(),1,`${at}: its line is marked`);
 eq(await tid(page,'onboarding-steps').locator('li').count(),4,`${at}: four route steps`);
 eq(await stepState(page,'instructions'),'current',`${at}: instructions current`);
 eq((await tid(page,'instructions-title').textContent()).trim(),w.title,`${at}: A2's title`);
 ok(!technical.test(await stepText(page)),`${at}: nothing technical in the step`);
 eq(await has(page,'editor-save'),false,`${at}: no save before the note is shown`);
 eq(await tid(page,'step-later').count(),1,`${at}: one later`);
 if(d===0){
  eq(await question(page),scenario==='existing'?'confirm':'lang',`${at}: first question`);
  if(scenario==='fresh'){
   eq((await tid(page,'quick-reply').first().textContent()).trim(),w.chip,`${at}: Habitat's language first`);
   ok((await tid(page,'quick-reply').first().getAttribute('class')).length>0,`${at}: chip drawn`);
  }
  eq(await has(page,'reveal'),false,`${at}: no note yet`);
 }
 if(d===1){
  ok(await tid(page,'own-card').isVisible(),`${at}: own-words card first`);
  eq(await has(page,'quick-replies'),false,`${at}: no questions before the card`);
  if(scenario==='fresh')eq(await tid(page,'lang-choice').locator('select').inputValue(),lang,`${at}: language preselected`);
  else eq(await tid(page,'lang-choice').getAttribute('data-existing'),'true',`${at}: existing language kept`);
 }
 if(d===2){
  ok(await tid(page,'reveal').isVisible(),`${at}: note beside the chat`);
  ok(await tid(page,'editor-locked').isVisible(),`${at}: locked while asking`);
  eq(await page.getByRole('tab').count(),0,`${at}: no tabs while locked`);
  ok(await tid(page,'own-side').isVisible(),`${at}: own-words box`);
  eq(await question(page),'confirm',`${at}: first question`);
  ok(await tid(page,'lang-choice').isVisible(),`${at}: language on the note`);
  if(scenario==='fresh')ok((await previewText(page)).includes(w.lang),`${at}: language already on the note`);
 }
 ok(await fits(page),`${at}: document overflow`);
}

/** Every question to the reveal. own: keep (as written), tidy, or skip. */
async function answerAll(page,d,{lang='fi',own='keep'}={}){
 const w=W[lang];
 if(d===1){if(own==='skip')await press(page,'own-skip');else await writeOwn(page,'own-card',w.own);}
 if(d===2&&own!=='skip')await writeOwn(page,'own-side',w.own);
 for(let guard=0;guard<12;guard++){
  if(await has(page,'own-step')){if(own==='skip')await press(page,'own-skip');else await writeOwn(page,'own-step',w.own);continue;}
  if(!await has(page,'quick-replies'))break;
  const q=await question(page);
  await chip(page,q==='tidy'?(own==='tidy'?1:0):q==='style'?1:0);
 }
}

async function reveal(page,d,at,{scenario='fresh',lang='fi'}={}){
 const w=W[lang];
 ok(await has(page,'reveal'),`${at}: note shown`);
 ok(await tid(page,'editor-save').isVisible(),`${at}: save offered`);
 eq(await page.getByRole('tab',{name:w.preview,exact:true}).getAttribute('aria-selected'),'true',`${at}: opens in Esikatselu`);
 const text=await previewText(page);
 ok(!technical.test(text),`${at}: the note speaks plainly`);
 if(scenario==='existing'){
  ok((await tid(page,'editor-kept').textContent()).includes(w.kept),`${at}: old text kept`);
  ok(await has(page,'editor-added'),`${at}: addition marked`);
  ok(!text.includes(lang==='fi'?'Vastaa minulle':'Answer me in'),`${at}: no language line added`);
 }else{
  ok(text.includes('Aino'),`${at}: the name`);
  ok(text.includes(lang==='fi'?'Vastaa minulle':'Answer me in'),`${at}: the answer language`);
 }
 ok(await fits(page),`${at}: reveal overflow`);
}

async function flow(page,d,tag){
 const at=`${names[d]} ${tag}`;const w=W.fi;
 if(d===1){
  await tid(page,'lang-choice').locator('select').selectOption('en');await settle(page);
  ok((await tid(page,'lang-default').textContent()).length>0,`${at}: other-language hint`);
 }
 if(d===2){
  await chip(page,0);
  ok((await previewText(page)).includes(w.work),`${at}: the note grows as she answers`);
  await writeOwn(page,'own-side',w.own);
  eq(await question(page),'tidy',`${at}: tidy offered`);
  ok((await previewText(page)).includes(w.own),`${at}: own words on the note as written`);
  await chip(page,0);
  eq(await has(page,'own-side'),false,`${at}: box closes once used`);
  await chip(page,1);await chip(page,0);
 }else await answerAll(page,d,{own:d===1?'tidy':'keep'});
 await reveal(page,d,at,{lang:'fi'});
 const text=await previewText(page);
 if(d!==1)ok(text.includes(w.lang),`${at}: Habitat's language`);
 if(d===0)ok(text.includes(w.own),`${at}: own words kept as written`);
 if(d===1){ok(text.includes(w.tidied),`${at}: tidied own words`);ok(text.includes(w.langEn),`${at}: changed language`);}
 if(d===2)ok(text.includes(w.own),`${at}: own words from the box`);
 ok(text.includes('Kysy minulta ennen kuin julkaiset'),`${at}: ask-first answer`);
 await shot(page,`${d}-${names[d]}-${tag}-reveal`);
 await tab(page,w.edit);
 const raw=await tid(page,'editor-text').inputValue();
 ok(raw.startsWith('# Muistilappu agentille'),`${at}: raw Markdown`);
 ok(raw.includes(w.ownHead),`${at}: own words under their heading`);
 if(d===1){
  await tid(page,'editor-text').fill(raw+'\n\nPoistetaan tämä.');await settle(page);
  ok(await has(page,'editor-unsaved'),`${at}: unsaved`);
  await press(page,'editor-cancel');
  eq(await has(page,'editor-unsaved'),false,`${at}: Peru returns the agent's text`);
  ok(!(await previewText(page)).includes('Poistetaan tämä.'),`${at}: Peru dropped the edit`);
  await tab(page,w.edit);
 }
 await tid(page,'editor-text').fill((await tid(page,'editor-text').inputValue())+'\n\nKirjoitin tämän itse.');await settle(page);
 ok(await has(page,'editor-unsaved'),`${at}: edit marked unsaved`);
 await shot(page,`${d}-${names[d]}-${tag}-edit`);
 await tab(page,w.preview);
 ok((await previewText(page)).includes('Kirjoitin tämän itse.'),`${at}: preview renders the edit`);
 await press(page,'editor-save');
 ok(await has(page,'route-done'),`${at}: done card`);
 eq(await stepState(page,'instructions'),'done',`${at}: step done`);
 ok(!technical.test(await tid(page,'route-done').locator('header').textContent()),`${at}: done card plain`);
 await tid(page,'where').locator('summary').click();await settle(page);
 eq(await page.locator('[data-testid="file-tool"][data-tool="write"]').count(),2,`${at}: both files written`);
 const written=await tid(page,'written-file').textContent();
 ok(written.includes('Kirjoitin tämän itse.'),`${at}: written file is the edited note`);
 ok(!/Open Habitat environment|~\/src|site\.origin/.test(written),`${at}: nothing of the environment block`);
 await shot(page,`${d}-${names[d]}-${tag}-done`);
 await press(page,'enter-habitat');
 ok(await has(page,'home'),`${at}: Habitat`);
 if(!tag.startsWith('390'))ok(!/Ohjeet agentille|Muistilappu|~/.test(await page.locator('.ah-rail').first().textContent()),`${at}: the step's conversation is not in the rail`);
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
  if(theme==='light'){await pick(page,0);await walkthrough(page,tag);}
  await page.close();
 }
 for(const theme of quick?['light']:['light','dark']){
  const page=await open(width,theme,{scenario:'existing'});
  const tag=`${width}-${theme}-existing`;
  for(let d=0;d<3;d++){
   await pick(page,d);
   await defaultView(page,d,`${names[d]} ${tag}`,{scenario:'existing'});
   await answerAll(page,d,{scenario:'existing',own:'skip'});
   await reveal(page,d,`${names[d]} ${tag}`,{scenario:'existing'});
   await shot(page,`${d}-${names[d]}-${tag}-reveal`);
   await press(page,'editor-save');
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
  await answerAll(page,d,{lang:'en',own:'keep'});
  await reveal(page,d,`${names[d]} en ${width}`,{lang:'en'});
  await shot(page,`${d}-${names[d]}-${width}-en-reveal`);
 }
 await page.close();
 const ex=await open(width,'light',{lang:'en',scenario:'existing'});
 await pick(ex,0);await press(ex,'event-reveal');
 await reveal(ex,0,`keskustelussa en existing ${width}`,{lang:'en',scenario:'existing'});
 await shot(ex,`0-keskustelussa-${width}-en-existing`);
 await ex.close();
}
await browser.close();
if(errors.length){console.error('console errors:\n'+[...new Set(errors)].join('\n'));process.exit(1);}
console.log(`${checks} checks passed, console clean; screenshots in ${out}`);
