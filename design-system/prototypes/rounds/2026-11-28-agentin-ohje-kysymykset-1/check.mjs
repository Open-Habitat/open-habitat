// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Both directions (1 Lisäkysymykset, 2 Koko keskustelu), every situation of
// both views at 1440 light, 1440 dark and 390 light (--quick: 1440 light),
// with reduced motion: the picker contract, the round's route row after
// AI-tili with production marking no row of its own current, the panel,
// no document overflow, no running animation, a clean console and no
// external request. Adjacency in every state and in the states only a
// click reaches (the form open, a preview answer chosen, the person's
// choices, the free answer): no two visible controls in the page or an open
// dialog closer than --ah-control-gap (bounding boxes, so touching and
// overlapping fail; production's route list is one list of touching rows, a segmented control one track), and a removal (.rq-destructive) at least --ah-s4 from
// the control before it. Then at 1440 light: in 1, Habitat's questions have
// no controls, a site question moves only among the site's, the form edits
// it, a preview answer shows the sentence it puts on the note, a new
// question is added and an empty one disappears on Valmis, the sixth cannot
// be added; in 2, hiding Habitat's style question takes it out of the
// person's conversation and moving the language question changes the
// order. The person's onboarding walks every question to the note and the
// note carries the chosen sentences and the free answer under its heading;
// Settings shows the waiting question, Vastaa asks only it and the answer is
// added after the earlier note, which stays byte for byte. #ah-theme=dark
// opens dark. Screenshots r1-<d>-<view>-<situation>-<tag>.png.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-28-agentin-ohje-kysymykset-1';
const [input,out,flag]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <out-dir> [--quick]');process.exit(2);}
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const SITUATIONS={admin:['lista','tyhja','muokkaa','lisaa'],person:['kaytto','uusi']};
let checks=0;const errors=[];const external=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};

async function open(width,query){
 const phone=width<600;
 const page=await browser.newPage({viewport:{width,height:phone?844:900},deviceScaleFactor:phone?2:1,reducedMotion:'reduce',hasTouch:phone});
 page.on('pageerror',e=>errors.push(`${query}: ${e.message}`));
 page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errors.push(`${query}: ${m.text()}`);});
 await page.route('**/*',r=>{const u=r.request().url();
  if(u.startsWith('http://prototype.test/'))return r.fulfill({contentType:'text/html',body:html});
  if(u.startsWith('data:')||u.startsWith('blob:'))return r.continue();
  external.push(u);return r.abort();});
 await page.goto(`http://prototype.test/${query}`);
 await page.getByTestId('rq-page').waitFor();
 await page.waitForTimeout(250);
 return page;
}
const id=(page,t)=>page.getByTestId(t);
const vis=async(page,t)=>(await id(page,t).count())>0&&await id(page,t).first().isVisible();
const settle=page=>page.waitForTimeout(120);
const shot=(page,name)=>page.screenshot({path:`${out}/r1-${name}.png`,fullPage:true});
const noOverflow=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const running=page=>page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running'&&!a.effect?.target?.closest?.('.proto-picker')).length);

async function spacing(page,what){
 const r=await page.evaluate(()=>{
  const px=v=>{const e=document.createElement('div');e.style.width=`var(${v})`;document.body.append(e);const w=e.getBoundingClientRect().width;e.remove();return w;};
  const min=px('--ah-control-gap'),far=px('--ah-s4');
  const dialogs=[...document.querySelectorAll('[role=dialog]')];
  const scope=dialogs.at(-1)||document.querySelector('[data-testid=rq-page]');
  const els=[...scope.querySelectorAll('button,a[href],input,select,textarea,[role=button],summary')].filter(e=>{const b=e.getBoundingClientRect();return b.width>0&&b.height>0&&getComputedStyle(e).visibility!=='hidden';});
  const name=e=>(e.dataset.testid||e.getAttribute('aria-label')||e.textContent||e.tagName).trim().slice(0,40);
  const gap=(a,b)=>{const p=a.getBoundingClientRect(),q=b.getBoundingClientRect();const gx=Math.max(q.left-p.right,p.left-q.right),gy=Math.max(q.top-p.bottom,p.top-q.bottom);return gx<0&&gy<0?Math.max(gx,gy):gx<0?gy:gy<0?gx:Math.max(gx,gy);};
  const bad=[];
  for(let i=0;i<els.length;i++)for(let j=i+1;j<els.length;j++){
   const a=els[i],b=els[j];if(a.contains(b)||b.contains(a))continue;
   if(a.closest('.ob-steplist')&&b.closest('.ob-steplist'))continue; // production's route is one list of touching rows
   {const sa=a.closest('[data-ah-primitive="segmented"]');if(sa&&sa===b.closest('[data-ah-primitive="segmented"]'))continue;} // one segmented track
   const g=gap(a,b);if(g<min-0.5)bad.push(`${name(a)} | ${name(b)}: ${g.toFixed(1)}px < ${min}`);
  }
  for(const d of scope.querySelectorAll('.rq-destructive')){
   const i=els.indexOf(d);if(i<1)continue;const g=gap(els[i-1],d);
   if(g<far-0.5)bad.push(`removal ${name(d)} after ${name(els[i-1])}: ${g.toFixed(1)}px < ${far}`);
  }
  return bad;
 });
 eq(r.join('\n'),'',`${what}: spacing`);
}
async function state(page,what){
 ok(await noOverflow(page),`${what}: document overflow`);
 eq(await running(page),0,`${what}: animation under reduced motion`);
 await spacing(page,what);
}

// ---------- every situation ----------
const tags=quick?[[1440,'light']]:[[1440,'light'],[1440,'dark'],[390,'light']];
for(const [width,theme] of tags)for(const d of [0,1])for(const view of ['admin','person'])for(const s of SITUATIONS[view]){
 const what=`${d+1}-${view}-${s}-${width}${theme}`;
 const page=await open(width,`?v=${d+1}&view=${view}&s=${s}&theme=${theme}`);
 await checkPicker(page,round);
 eq(await page.locator('.proto-picker-item').allInnerTexts(),['1 Lisäkysymykset','2 Koko keskustelu'],`${what}: picker`);
 eq(await page.locator('.rq-review').getAttribute('data-direction'),String(d),`${what}: direction`);
 eq(await page.evaluate(()=>document.documentElement.dataset.theme),theme,`${what}: theme`);
 if(view==='admin'){
  ok(await vis(page,'onboarding-route-instructions'),`${what}: route row`);
  eq(await page.locator('.ob-steplist li:last-child [data-testid="onboarding-route-instructions"]').count(),1,`${what}: last on the route`);
  eq(await page.locator('.ob-steplist [aria-current="step"]').count(),1,`${what}: one current row`);
  eq(await id(page,'onboarding-route-instructions').getAttribute('aria-current'),'step',`${what}: ours current`);
  ok(await vis(page,'rq-note-panel'),`${what}: panel`);
  eq(await page.locator('.ob-cfg-card .ob-config:visible').count(),1,`${what}: only our panel shows`);
  const hint=await id(page,'onboarding-route-instructions-hint').innerText();
  if(d===0) eq(hint,s==='tyhja'?'Habitatin kysymykset':s==='lisaa'?'4 omaa kysymystä':'3 omaa kysymystä',`${what}: hint`);
  else ok(/kysymystä/.test(hint),`${what}: hint ${hint}`);
  if(s==='muokkaa'||s==='lisaa') ok(await vis(page,'rq-form'),`${what}: form open`);
  if(s==='tyhja'&&d===0) ok(await vis(page,'rq-none'),`${what}: nothing written says so`);
  ok(await vis(page,'rq-after'),`${what}: what a change does`);
 }else if(s==='kaytto'){
  ok(await vis(page,'instructions-step'),`${what}: note step`);
  eq(await page.locator('.ah-onboarding-frame').getAttribute('data-step'),'instructions',`${what}: last step of the route`);
 }else{
  ok(await vis(page,'rq-waiting'),`${what}: waiting question`);
  ok(await vis(page,'instructions-editor'),`${what}: production editor`);
 }
 await state(page,what);
 await shot(page,`${d+1}-${view}-${s}-${width}${theme}`);
 // states only a click reaches
 if(view==='admin'&&s==='muokkaa'){
  await page.locator('[data-testid="rq-preview-chips"] button').first().click();await settle(page);
  ok(await vis(page,'rq-lands'),`${what}: chosen answer shows its sentence`);
  await state(page,`${what} preview chosen`);
 }
 if(view==='person'&&s==='kaytto'){
  await state(page,`${what} first question`);
 }
 await page.close();
}

// ---------- interactions, 1440 light ----------
const texts=page=>page.locator('[data-testid^="rq-q-"]').evaluateAll(es=>es.map(e=>e.dataset.testid.slice(5)));
{ // 1: list
 const page=await open(1440,'?v=1&view=admin&s=lista&theme=light');
 eq(await texts(page),['lang','style','ask','team','publish','projects','own'],'1: order');
 eq(await page.locator('[data-kind="builtin"] button').count(),0,'1: Habitat questions have no controls');
 ok(await page.getByTestId('rq-q-team').getByTestId('rq-up').isDisabled(),'1: first site question cannot rise above Habitat');
 ok(await page.getByTestId('rq-q-projects').getByTestId('rq-down').isDisabled(),'1: last site question stays before omin sanoin');
 await page.getByTestId('rq-q-publish').getByTestId('rq-up').click();await settle(page);
 eq(await texts(page),['lang','style','ask','publish','team','projects','own'],'1: moved up');
 await page.getByTestId('rq-q-team').getByTestId('rq-edit').click();await settle(page);
 ok(await vis(page,'rq-form'),'1: form');
 await page.getByTestId('rq-add-choice').click();await settle(page);
 eq(await page.getByTestId('rq-choice').count(),4,'1: fourth choice');
 ok(await page.getByTestId('rq-add-choice').isDisabled(),'1: at most four choices');
 const f=page.getByTestId('rq-choice').nth(3).locator('input');
 await f.nth(0).fill('Myynti');await f.nth(1).fill('Työskentelen myynnissä.');
 await page.locator('[data-testid="rq-preview-chips"] button',{hasText:'Myynti'}).click();await settle(page);
 ok((await id(page,'rq-lands').innerText()).includes('Työskentelen myynnissä.'),'1: preview sentence');
 await state(page,'1 form edited');
 await shot(page,'1-admin-form-1440');
 await id(page,'rq-done').click();await settle(page);
 ok((await id(page,'rq-q-team').innerText()).includes('4 vaihtoehtoa'),'1: summary updated');
 await id(page,'rq-add').click();await settle(page);
 await id(page,'rq-done').click();await settle(page);
 eq((await texts(page)).length,7,'1: an empty question disappears');
 for(const q of ['Mikä on roolisi?','Mitä kieltä koodaat?']){
  await id(page,'rq-add').click();await settle(page);
  await page.locator('[data-testid="rq-form-text"] input, input[data-testid="rq-form-text"]').fill(q);
  await page.getByTestId('rq-form-mode').getByText('Omin sanoin').click();
  await id(page,'rq-done').click();await settle(page);
 }
 eq(await id(page,'onboarding-route-instructions-hint').innerText(),'5 omaa kysymystä','1: five');
 ok(await id(page,'rq-add').isDisabled(),'1: no sixth');
 await state(page,'1 five');
 // production's own row still works, and ours returns
 await id(page,'onboarding-route-ai').click();await settle(page);
 eq(await id(page,'rq-note-panel').count(),0,'1: production step replaces our panel');
 await id(page,'onboarding-route-instructions').click();await settle(page);
 ok(await vis(page,'rq-note-panel'),'1: our panel again');
 await page.close();
}
{ // 2: conversation; hiding style and moving lang reach the person
 const page=await open(1440,'?v=2&view=admin&s=lista&theme=light');
 ok(await vis(page,'rq-convo'),'2: conversation editor');
 await page.getByTestId('rq-q-style').getByTestId('rq-toggle').click();await settle(page);
 eq(await page.getByTestId('rq-q-style').getAttribute('data-off'),'true','2: style hidden');
 eq(await id(page,'onboarding-route-instructions-hint').innerText(),'6 kysymystä · 1 piilotettu','2: hint');
 for(let i=0;i<2;i++){await page.getByTestId('rq-q-lang').getByTestId('rq-down').click();await settle(page);}
 eq((await texts(page)).slice(0,3),['style','ask','lang'],'2: language moved after ask');
 await page.getByTestId('rq-q-publish').getByTestId('rq-edit').click();await settle(page);
 ok(await vis(page,'rq-form'),'2: edits in place');
 await state(page,'2 form');
 await shot(page,'2-admin-form-1440');
 await id(page,'rq-done').click();await settle(page);
 await id(page,'rq-view-person').click();await settle(page);
 eq(await id(page,'current-question').getAttribute('data-kind'),'ask','2: person: style hidden, ask first, then language');
 await page.close();
}
async function answerAll(page,tag){
 for(let n=0;n<12;n++){
  if(await vis(page,'reveal'))break;
  if(await vis(page,'own-field')){
   const q=await id(page,'current-question').getAttribute('data-kind');
   await page.locator('[data-testid="own-field"] textarea, textarea[data-testid="own-field"]').fill(q==='own'?'Teen verkkosivuja.':'Hinnasto ja tukisivut.');
   await state(page,`${tag} free answer`);
   await id(page,'own-submit').click();await settle(page);
   if(await vis(page,'quick-replies')&&(await id(page,'quick-replies').getAttribute('data-question'))==='tidy'){await id(page,'quick-reply').first().click();await settle(page);}
   continue;
  }
  await state(page,`${tag} choices ${n}`);
  await id(page,'quick-reply').first().click();await settle(page);
 }
 ok(await vis(page,'reveal'),`${tag}: the note revealed`);
}
{ // person onboarding
 const page=await open(1440,'?v=1&view=person&s=kaytto&theme=light');
 eq(await id(page,'current-question').getAttribute('data-kind'),'lang','person: language first');
 // site questions carry who asks
 for(let i=0;i<3;i++){await id(page,'quick-reply').first().click();await settle(page);}
 eq(await id(page,'current-question').getAttribute('data-kind'),'site','person: the site question after Habitat\'s');
 ok(await page.getByTestId('current-question').getByTestId('rq-asker').isVisible(),'person: marked as the administrator\'s');
 ok(await vis(page,'quick-own')&&await vis(page,'quick-skip'),'person: omin sanoin and skip');
 await shot(page,'1-person-site-question-1440');
 await answerAll(page,'person');
 const note=await page.locator('[data-testid="reveal"]').innerText();
 for(const s of ['Työskentelen tuotekehitystiimissä.','Älä koskaan vie muutoksia suoraan päähaaraan.','Mitä projekteja teet juuri nyt?','Hinnasto ja tukisivut.'])ok(note.includes(s),`person: note has ${s}`);
 await state(page,'person revealed');
 await shot(page,'1-person-note-1440');
 await page.close();
}
{ // person settings
 const page=await open(1440,'?v=1&view=person&s=uusi&theme=light');
 const before=await id(page,'instructions-editor').innerText();
 ok((await id(page,'rq-waiting').innerText()).includes('Mitä projekteja teet juuri nyt?'),'settings: names the waiting question');
 await id(page,'rq-waiting').getByRole('button',{name:'Vastaa'}).click();await settle(page);
 eq(await id(page,'current-question').getAttribute('data-kind'),'site','settings: only the waiting question');
 await answerAll(page,'settings');
 ok((await id(page,'reveal').innerText()).includes('Hinnasto ja tukisivut.'),'settings: answer added');
 await shot(page,'1-person-settings-answer-1440');
 await id(page,'reveal').getByRole('button',{name:'Lisää ohjeisiin'}).click();await settle(page);
 eq(await id(page,'rq-waiting').count(),0,'settings: nothing waits after saving');
 ok(before.length>0,'settings: earlier note shown');
 await page.close();
}
{const page=await open(1440,'?view=admin#ah-theme=dark');eq(await page.evaluate(()=>document.documentElement.dataset.theme),'dark','#ah-theme=dark opens dark');await page.close();}

eq(external,[],'no external requests');
eq(errors,[],'clean console');
await browser.close();
console.log(`${checks} checks passed`);
