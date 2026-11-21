// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic walkthrough check, not a host-backed acceptance test.
// Walks the three directions at 1440 and 390 px in Päivä, Yö and Kontrasti
// with reduced motion. Default view: the direction's line is marked, the
// conversation is open with the onboarding band, and the direction's own
// first move is on screen (1 a question with quick replies, 2 a draft file
// card, 3 a form card); no overflow. Flows (Päivä and Yö): 1 answers by
// quick reply, own words and Ohita, sees the draft, changes it (the older
// draft is marked replaced), saves (write of both files) and opens the
// settings section, edits as text and saves; 2 adds by quick reply and own
// words and saves by quick reply, then goes to the workspaces without a
// reminder; 3 fills the form, makes the draft and saves. Every direction:
// Tee myöhemmin writes nothing and the home shows the reminder. The walkthrough from
// the end of onboarding: the landing, its later path and its start. Existing
// file: the landing says so, the draft is an addition with marked lines, the
// language question is skipped and saving edits both files. English last.
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
const round='2026-11-21-onboarding-instructions';
const [input,out,flag]=process.argv.slice(2);
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['haastattelu','luonnos','lomake'];
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
const pick=async(page,d)=>{await page.locator('.proto-picker-item').nth(d).click();await page.locator(`.ra-review[data-direction="${d}"]`).waitFor({state:'attached'});await page.waitForTimeout(150);};
const shot=(page,name)=>page.screenshot({path:`${out}/${name}.png`});
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const has=async(page,id)=>(await page.getByTestId(id).count())>0;
const settle=page=>page.waitForTimeout(150);
const toBottom=page=>page.evaluate(()=>{const s=document.querySelector('[data-testid="conversation-stream"]');if(s)s.scrollTop=s.scrollHeight;});
const chip=async(page,label)=>{await page.getByTestId('quick-reply').filter({hasText:label}).first().click();await settle(page);};
const field=page=>page.locator('.ah-composer textarea, [data-testid="composer-input"]').first();
const say=async(page,text)=>{await field(page).fill(text);await field(page).focus();await page.keyboard.press('Enter');await settle(page);};
const openDraft=page=>page.locator('[data-testid="draft-card"][data-state="open"]');
const draftText=async page=>(await openDraft(page).getByTestId('draft-file').textContent());
const reset=async page=>{await page.getByTestId('event-reset').click();await settle(page);};
const lastAgent=page=>page.getByTestId('agent-reply').last();

async function defaultView(page,d,at){
 eq(await page.locator('.ra-lines li[aria-current]').count(),1,`${at}: its line is marked`);
 ok(await page.getByTestId('conversation').isVisible(),`${at}: conversation open`);
 ok(await page.getByTestId('onboarding-band').isVisible(),`${at}: onboarding band`);
 ok(await page.getByTestId('band-later').isVisible(),`${at}: later in the band`);
 eq(await has(page,'quick-replies'),d!==2,`${at}: quick replies in 1 and 2`);
 eq(await openDraft(page).count(),d===1?1:0,`${at}: a draft at once only in 2`);
 eq(await has(page,'form-card'),d===2,`${at}: form only in 3`);
 if(d===0)ok((await page.getByTestId('band-where').textContent()).includes('1/6'),`${at}: question 1/6`);
 if(d===1)ok((await draftText(page)).includes('Kirjastonhoitaja'),`${at}: draft from the GitHub bio`);
 ok(await fits(page),`${at}: document overflow`);
}

async function interview(page,tag){
 const at=`haastattelu ${tag}`;
 await chip(page,'Aino Laine');
 ok((await page.getByTestId('band-where').textContent()).includes('2/6'),`${at}: question 2`);
 await chip(page,'tekniset termit');
 await say(page,'Ylläpidän yhdistyksen verkkosivuja.');
 eq((await page.getByTestId('person-message').last().textContent()).includes('Ylläpidän'),true,`${at}: own words posted`);
 await chip(page,'Lyhyesti ja suoraan');
 await page.getByTestId('quick-skip').click();await settle(page);
 await toBottom(page);await shot(page,`0-${names[0]}-${tag}-last-question`);
 await chip(page,'näytä luonnos');
 const text=await draftText(page);
 ok(text.includes('Puhuttele minua nimellä Aino Laine.'),`${at}: name line`);
 ok(text.includes('Ylläpidän yhdistyksen verkkosivuja.'),`${at}: own words in the file`);
 ok(text.includes('tekniset termit englanniksi'),`${at}: language line`);
 ok(!text.includes('## Kysy ensin'),`${at}: skipped section left out`);
 ok(!/Open Habitat environment|site\.origin|~\/src/.test(text),`${at}: nothing of the environment block`);
 ok((await openDraft(page).getByTestId('draft-claude').textContent()).includes('CLAUDE.md'),`${at}: Claude reference named`);
 ok(await fits(page),`${at}: overflow with draft`);
 await toBottom(page);await shot(page,`0-${names[0]}-${tag}-draft`);
 await openDraft(page).getByTestId('draft-change').click();await settle(page);
 await chip(page,'Kysy ennen pushia');
 eq(await page.locator('[data-testid="draft-card"][data-state="replaced"]').count(),1,`${at}: older draft replaced`);
 ok((await draftText(page)).includes('## Kysy ensin'),`${at}: change in the new draft`);
 await openDraft(page).getByTestId('draft-save').click();await settle(page);
 eq(await page.locator('[data-testid="file-tool"][data-tool="write"]').count(),2,`${at}: two files written`);
 ok(await has(page,'done-line'),`${at}: onboarding done`);
 ok(!(await has(page,'onboarding-band')),`${at}: band gone`);
 await toBottom(page);await shot(page,`0-${names[0]}-${tag}-saved`);
 await page.getByTestId('to-settings').click();await settle(page);
 ok((await page.getByTestId('settings-file').textContent()).includes('Kysy ennen'),`${at}: settings shows the saved file`);
 ok(await fits(page),`${at}: settings overflow`);
 await shot(page,`0-${names[0]}-${tag}-settings`);
 await page.getByTestId('settings-edit').click();await settle(page);
 const editor=page.getByTestId('settings-editor');
 await editor.fill((await editor.inputValue())+'\n- Pidän lyhyistä commit-viesteistä.');
 await page.getByTestId('settings-save').click();await settle(page);
 ok((await page.getByTestId('settings-file').textContent()).includes('commit-viesteistä'),`${at}: edited as text`);
 await reset(page);
}

async function draftFirst(page,tag){
 const at=`luonnos ${tag}`;
 await chip(page,'Lyhyesti ja suoraan');
 eq(await page.locator('[data-testid="draft-card"][data-state="replaced"]').count(),1,`${at}: first draft replaced`);
 ok((await draftText(page)).includes('## Miten vastaat'),`${at}: style added`);
 await say(page,'Kirjoita koodikommentit englanniksi.');
 ok((await draftText(page)).includes('## Muuta'),`${at}: own words under Muuta`);
 await toBottom(page);await shot(page,`1-${names[1]}-${tag}-tweaked`);
 await chip(page,'tallenna');
 eq(await page.locator('[data-testid="file-tool"]').count(),2,`${at}: saved by quick reply`);
 await page.getByTestId('to-workspaces').click();await settle(page);
 ok(await page.getByTestId('home').isVisible(),`${at}: home`);
 ok(!(await has(page,'home-reminder')),`${at}: no reminder after saving`);
 await reset(page);
}

async function form(page,tag){
 const at=`lomake ${tag}`;
 await page.getByTestId('form-work-0').check();
 await page.getByTestId('form-work-free').fill('Opettelen Pythonia.');
 await page.getByTestId('form-style-1').check();
 await page.getByTestId('form-ask-0').check();
 await page.getByTestId('form-extra').fill('Asun Tampereella.');
 ok(await fits(page),`${at}: filled form overflow`);
 await toBottom(page);await shot(page,`2-${names[2]}-${tag}-filled`);
 await page.getByTestId('form-submit').click();await settle(page);
 eq(await page.locator('[data-testid="form-card"][data-state="sent"]').count(),1,`${at}: form sent`);
 ok((await page.getByTestId('person-message').last().textContent()).includes('lomakkeella'),`${at}: summary as the person's message`);
 const text=await draftText(page);
 ok(text.includes('Opettelen Pythonia.')&&text.includes('Asun Tampereella.'),`${at}: free text in the file`);
 ok(text.includes('## Kysy ensin'),`${at}: ask first`);
 await toBottom(page);await shot(page,`2-${names[2]}-${tag}-draft`);
 await openDraft(page).getByTestId('draft-save').click();await settle(page);
 eq(await page.locator('[data-testid="file-tool"]').count(),2,`${at}: saved`);
 await reset(page);
}

async function laterFlow(page,d,tag){
 const at=`${names[d]} ${tag} later`;
 await pick(page,d);
 await page.getByTestId('band-later').click();await settle(page);
 ok((await lastAgent(page).textContent()).includes('En kirjoittanut'),`${at}: says nothing was written`);
 eq(await page.getByTestId('file-tool').count(),0,`${at}: no write`);
 eq(await openDraft(page).count(),0,`${at}: no open draft`);
 await page.getByTestId('to-workspaces').click();await settle(page);
 ok(await page.getByTestId('home-reminder').isVisible(),`${at}: reminder on home`);
}

async function landing(page,tag){
 const at=`landing ${tag}`;
 await reset(page);
 ok(await page.getByTestId('landing').isVisible(),`${at}: landing`);
 ok((await page.getByTestId('onboarding-steps').textContent()).includes('GitHub'),`${at}: production route`);
 ok(await fits(page),`${at}: overflow`);
 await shot(page,`landing-${tag}`);
 await page.getByTestId('landing-later').click();await settle(page);
 ok(await page.getByTestId('home-reminder').isVisible(),`${at}: later lands home with reminder`);
 await shot(page,`home-later-${tag}`);
 await page.getByTestId('reminder-start').click();await settle(page);
 ok(await page.getByTestId('conversation').isVisible(),`${at}: reminder starts the conversation`);
 await reset(page);
 await page.getByTestId('landing-start').click();await settle(page);
 ok(await page.getByTestId('conversation').isVisible(),`${at}: start opens the conversation`);
}

async function existing(width){
 const tag=`existing-${width}`;
 const page=await open(width,'light',{scenario:'existing'});
 await reset(page);
 ok(await page.getByTestId('landing-existing').isVisible(),`${tag}: landing names the file`);
 await shot(page,`landing-${tag}`);
 await page.getByTestId('landing-start').click();await settle(page);
 ok((await page.getByTestId('band-where').textContent()).includes('1/5'),`${tag}: five questions`);
 await chip(page,'Aino');
 ok((await lastAgent(page).textContent()).includes('ohitan'),`${tag}: language question skipped`);
 await say(page,'Ylläpidän yhdistyksen sivuja.');
 await chip(page,'Selitä vaiheet');
 await chip(page,'Ennen kuin poistat');
 await chip(page,'näytä luonnos');
 eq(await openDraft(page).getAttribute('data-mode'),'merge',`${tag}: an addition`);
 ok((await draftText(page)).startsWith('# Omat ohjeet') || (await draftText(page)).trimStart().startsWith('# Omat ohjeet'),`${tag}: existing content kept first`);
 ok((await openDraft(page).locator('.oi-row[data-added]').count())>3,`${tag}: added lines marked`);
 eq(await openDraft(page).locator('.oi-row[data-added]').filter({hasText:'Vastaa suomeksi'}).count(),0,`${tag}: no duplicate language`);
 ok((await openDraft(page).getByTestId('draft-save').textContent()).includes('Lisää'),`${tag}: add, not overwrite`);
 ok(await fits(page),`${tag}: overflow`);
 await toBottom(page);await shot(page,`0-${tag}-merge`);
 await openDraft(page).getByTestId('draft-save').click();await settle(page);
 eq(await page.locator('[data-testid="file-tool"][data-tool="edit"]').count(),2,`${tag}: both files edited`);
 eq(await page.locator('[data-testid="file-tool"][data-tool="write"]').count(),0,`${tag}: nothing written over`);
 await pick(page,1);
 eq(await openDraft(page).getAttribute('data-mode'),'merge',`${tag} 2: an addition`);
 await toBottom(page);await shot(page,`1-${tag}-merge`);
 await pick(page,2);
 ok((await page.getByTestId('form-card').textContent()).includes('Ohjeissasi on jo kieli'),`${tag} 3: language already set`);
 await shot(page,`2-${tag}-form`);
 await page.close();
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
  await toBottom(page);await shot(page,`${d}-${names[d]}-${tag}`);
  if(theme==='contrast')continue;
  if(d===0)await interview(page,tag);
  if(d===1)await draftFirst(page,tag);
  if(d===2)await form(page,tag);
 }
 if(theme!=='contrast'){
  await page.close();
  for(let d=0;d<3;d++){const p=await open(width,theme);await laterFlow(p,d,tag);await p.close();}
  const p=await open(width,theme);await landing(p,tag);await p.close();
 }else await page.close();
}
if(!quick)for(const width of [1440,390])await existing(width);
for(const width of [1440,390]){
 const en=await open(width,width===390?'dark':'light',{lang:'en'});
 for(let d=0;d<3;d++){
  await pick(en,d);
  ok((await en.getByTestId('agent-reply').first().textContent()).includes('Hi Aino'),`English ${width} ${d}: greeting`);
  ok((await en.getByTestId('band-later').textContent()).includes('later'),`English ${width} ${d}: band`);
  ok(await fits(en),`English ${width} ${d}: fits`);
  await toBottom(en);await shot(en,`en-${d}-${names[d]}-${width}`);
 }
 await en.getByTestId('form-submit').click();await settle(en);
 ok((await draftText(en)).includes('## Language'),`English ${width}: English template`);
 await en.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[],'console errors');
console.log(`${checks} checks passed`);
