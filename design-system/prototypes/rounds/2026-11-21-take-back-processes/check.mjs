// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Walks the three directions at 1440 and 390 px in Päivä, Yö and Kontrasti
// with reduced motion. Default view: just after the take-back, the run going
// on text only with Pysäytä ajo on the take-back line, and the direction's
// offer (1: the card with both processes identified; 2: the process panel
// open above the composer, Ville's group first; 3: the compact question,
// details closed). Ville's view at the side (toggled on the phone), no
// overflow. Flows (Päivä and Yö): show the starting message, stop one, the
// tests ending by themselves, stop all, ignoring the offer (owner carries on),
// reopening it, stopping the run, the run ending text only, and what Ville
// sees after each. English last. Screenshots at device scale 2.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-21-take-back-processes';
const [input,out,flag]=process.argv.slice(2);
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['kortti','merkit','kysymys'];
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
 await settle(page);
 return page;
}
const settle=page=>page.waitForTimeout(250);
const pick=async(page,d)=>{await page.locator('.proto-picker-item').nth(d).click();await page.locator(`.ra-review[data-direction="${d}"]`).waitFor({state:'attached'});await settle(page);};
const shot=(page,name)=>page.screenshot({path:`${out}/${name}.png`});
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const has=async(page,id)=>(await page.getByTestId(id).count())>0;
const text=async(page,id)=>(await page.getByTestId(id).first().textContent())||'';
const reset=async page=>{await page.getByTestId('event-reset').click();await settle(page);};
const phoneOf=page=>page.viewportSize().width===390;
const toOffer=page=>page.evaluate(()=>document.querySelector('[data-item="offer"]')?.scrollIntoView({block:'center'}));
async function side(page,f){
 const phone=phoneOf(page);
 if(phone){await page.getByTestId('event-side').click();await settle(page);}
 ok(await page.getByTestId('side').isVisible(),'side visible');
 await f();
 if(phone){await page.getByTestId('side-close').click();await settle(page);ok(!(await page.getByTestId('side').isVisible()),'side closed');
  await page.mouse.move(10,700);await page.keyboard.press('Escape');await settle(page);}
}
/** Every process row names its command, its message, when, and its output. */
async function identified(page,at,dense){
 for(const id of ['preview','tests']){
  ok((await text(page,`proc-${id}`)).includes(id==='preview'?'npm run preview':'npm test -- --watch'),`${at}: ${id} command`);
  ok((await text(page,`from-${id}`)).includes(id==='preview'?'14.20':'14.24'),`${at}: ${id} message time`);
  ok(await page.getByTestId(`show-${id}`).isVisible(),`${at}: ${id} show message`);
  ok((await text(page,`started-${id}`)).includes(id==='preview'?'11 min':'7 min'),`${at}: ${id} started`);
  eq(await page.getByTestId(`output-${id}`).getAttribute('data-output'),id==='preview'?'live':'quiet',`${at}: ${id} output state`);
  eq(await has(page,`last-${id}`),!dense,`${at}: ${id} last line ${dense?'hidden':'shown'}`);
  ok(await page.getByTestId(`stop-${id}`).isVisible(),`${at}: ${id} stop`);
 }
 eq(await page.locator('[data-testid="proc-watch"]').count(),0,`${at}: Aino's own process is not offered`);
}

async function defaultView(page,d,at){
 eq(await page.locator('.ra-lines li[aria-current]').count(),1,`${at}: its line is marked`);
 ok((await text(page,'taken-line')).includes('14.31'),`${at}: take-back line`);
 ok(await page.getByTestId('stop-run').isVisible(),`${at}: Pysäytä ajo on the line`);
 eq(await page.locator('[data-reply="rv2"]').getAttribute('data-mode'),'text',`${at}: run text only`);
 eq(await page.locator('[data-testid="tool"][data-state="running"]').count(),1,`${at}: started call still running`);
 eq(await has(page,'offer-card'),d===0,`${at}: card only in 1`);
 eq(await has(page,'panel'),d===1,`${at}: panel only in 2`);
 eq(await has(page,'offer-ask'),d===2,`${at}: question only in 3`);
 eq(await has(page,'band-procs'),d===0,`${at}: band reminder only in 1`);
 if(d===0){ok((await text(page,'offer-card')).includes('2'),`${at}: card counts two`);await identified(page,at,false);ok(await page.getByTestId('offer-stop-all').isVisible(),`${at}: stop all`);ok(await page.getByTestId('own-note').isVisible(),`${at}: own processes noted`);}
 if(d===1){ok(await page.getByTestId('offer-strip-line').isVisible(),`${at}: strip line`);ok((await text(page,'pill-ville')).includes('2'),`${at}: pill marks Ville's two`);await identified(page,at,true);ok(await page.getByTestId('own-watch').isVisible(),`${at}: own process in its own group`);ok(await page.getByTestId('panel-stop-ville').isVisible(),`${at}: stop Ville's`);}
 if(d===2){eq(await page.getByTestId('ask-cmds').locator('code').allTextContents(),['npm run preview','npm test -- --watch'],`${at}: commands named`);eq(await has(page,'ask-list'),false,`${at}: details closed`);eq(await page.getByTestId('ask-details').getAttribute('aria-expanded'),'false',`${at}: disclosure closed`);}
 await side(page,async()=>{
  ok((await text(page,'side-strip')).includes('14.31'),`${at}: Ville sees the take-back`);
  ok((await text(page,'side-run')).includes('tekstinä')||(await text(page,'side-run')).includes('text only'),`${at}: Ville's run text only`);
  ok(await page.getByTestId('side-no-offer').isVisible(),`${at}: Ville gets no offer`);
  eq(await page.locator('[data-testid="side"] [data-testid^="stop-"]').count(),0,`${at}: no stop buttons for Ville`);
 });
 ok(await fits(page),`${at}: document overflow`);
}

async function villeSeesLine(page,at,needle){
 await side(page,async()=>ok((await text(page,'side-lines')).includes(needle),`${at}: Ville sees "${needle}"`));
}

async function flows(page,d,tag){
 const at=`${names[d]} ${tag}`;
 const f=at.replace(/ /g,'-');
 // Show the starting message.
 if(d===2){await page.getByTestId('ask-details').click();await settle(page);ok(await page.getByTestId('ask-list').isVisible(),`${at}: details open`);await identified(page,`${at} details`,false);await shot(page,`${f}-details`);}
 await page.getByTestId('show-preview').click();await settle(page);
 eq(await page.locator('[data-msg="v1"]').getAttribute('data-flash'),'true',`${at}: message highlighted`);
 ok(await page.locator('[data-msg="v1"]').isVisible(),`${at}: message in view`);
 if(d===1){eq(await has(page,'panel'),false,`${at}: panel closed by show`);await page.getByTestId('pill').click();await settle(page);}
 else await toOffer(page);
 // Stop one.
 await page.getByTestId('stop-preview').click();await settle(page);
 eq(await page.getByTestId('proc-preview').getAttribute('data-state'),'stopped',`${at}: preview stopped`);
 ok((await page.getByTestId('habitat-line').last().textContent()).includes('npm run preview'),`${at}: line says so`);
 if(d===1)ok((await text(page,'pill-ville')).includes('1'),`${at}: pill now one`);
 else if(d===0)ok((await text(page,'offer-card')).includes('1 prosessi'),`${at}: card now one`);
 await shot(page,`${f}-stopped-one`);
 await villeSeesLine(page,at,'npm run preview');
 // The tests end by themselves: the offer resolves.
 await page.getByTestId('event-exit').click();await settle(page);
 ok(await page.getByTestId('offer-done').isVisible(),`${at}: nothing left, offer folds to done`);
 if(d===1)eq(await has(page,'pill-ville'),false,`${at}: pill loses Ville's mark`);
 eq(await has(page,'band-procs'),false,`${at}: no band reminder`);
 await reset(page);
 // Stop all.
 if(d===1){await page.getByTestId('panel-stop-ville').click();}
 else await page.getByTestId('offer-stop-all').click();
 await settle(page);
 ok(await page.getByTestId('offer-done').isVisible(),`${at}: stop all resolves`);
 ok((await page.getByTestId('habitat-line').last().textContent()).match(/2 /),`${at}: one line for both`);
 await villeSeesLine(page,at,'npm test');
 await reset(page);
 // Ignore: the owner carries on.
 await page.getByTestId('event-owner').click();await settle(page);
 if(d===0){ok(await page.getByTestId('offer-card').isVisible()||(await page.getByTestId('offer-card').count())===1,`${at}: card stays`);ok(await page.getByTestId('band-procs').isVisible(),`${at}: band reminder`);
  await page.getByTestId('offer-keep').click();await settle(page);ok(await page.getByTestId('offer-folded').isVisible(),`${at}: kept folds`);ok(await page.getByTestId('band-procs').isVisible(),`${at}: reminder stays while running`);
  await page.getByTestId('band-procs').click();await settle(page);ok(await page.getByTestId('offer-card').isVisible(),`${at}: reminder reopens the card`);}
 if(d===1){eq(await has(page,'panel'),false,`${at}: panel closed`);ok((await text(page,'pill-ville')).includes('2'),`${at}: pill keeps Ville's mark`);
  await page.getByTestId('offer-open-panel').click();await settle(page);ok(await page.getByTestId('panel').isVisible(),`${at}: line reopens panel`);}
 if(d===2){ok(await page.getByTestId('offer-folded').isVisible(),`${at}: folds into a line`);ok((await text(page,'offer-folded')).includes('npm run preview'),`${at}: folded names commands`);
  await page.getByTestId('offer-reopen').click();await settle(page);ok(await page.getByTestId('ask-list').isVisible(),`${at}: reopens with details`);
  await page.getByTestId('offer-keep').click();await settle(page);ok(await page.getByTestId('offer-folded').isVisible(),`${at}: Jätä käyntiin folds`);}
 await shot(page,`${f}-ignored`);
 eq(await page.getByTestId('authored-message').last().getAttribute('data-author'),'aino',`${at}: owner wrote on`);
 await reset(page);
 // The run: stop it, and separately let it end text only.
 // In 2 the panel opens with the take-back and, on the phone, covers the line.
 if(d===1){await page.getByTestId('panel-close').click();await settle(page);}
 await page.getByTestId('stop-run').click();await settle(page);
 eq(await has(page,'stop-run'),false,`${at}: run stopped`);
 eq(await page.locator('[data-testid="tool"][data-state="interrupted"]').count(),1,`${at}: call interrupted`);
 await side(page,async()=>ok((await text(page,'side-run')).match(/pysäytti|stopped/),`${at}: Ville sees the stop`));
 await reset(page);
 await page.getByTestId('event-advance').click();await settle(page);
 eq(await page.locator('[data-testid="tool"][data-state="blocked"]').count(),1,`${at}: next call blocked`);
 eq(await has(page,'stop-run'),false,`${at}: no stop after the end`);
 ok(await page.locator('[data-testid="proc-preview"]').count()>0||d===2,`${at}: offer unaffected by run end`);
 ok(await fits(page),`${at}: no overflow after flows`);
 await reset(page);
}

const widths=quick?[1440]:[1440,390];
const themes=quick?['light']:['light','dark','contrast'];
for(const width of widths)for(const theme of themes){
 const page=await open(width,theme);
 if(width===1440&&theme==='light'){await checkPicker(page,round);checks++;}
 for(let d=0;d<3;d++){
  await pick(page,d);
  const at=`${names[d]} ${width} ${theme}`;
  await defaultView(page,d,at);
  await toOffer(page);
  await shot(page,`${names[d]}-${width}-${theme}`);
  if(theme!=='contrast'&&!(quick&&width===390))await flows(page,d,`${width} ${theme}`);
 }
 await page.close();
}
for(const width of widths){
 const page=await open(width,'light','en');
 for(let d=0;d<3;d++){
  await pick(page,d);
  const at=`${names[d]} ${width} en`;
  ok((await text(page,'taken-line')).includes('took full rights back'),`${at}: English line`);
  ok((await text(page,'recommendation')).startsWith('Recommendation'),`${at}: English recommendation`);
  if(d===0)ok((await text(page,'offer-card')).includes("From Ville's message"),`${at}: English card`);
  if(d===1)ok((await text(page,'panel')).includes("From Ville's requests"),`${at}: English panel`);
  if(d===2)ok((await text(page,'offer-ask')).includes('Stop them?'),`${at}: English question`);
  ok(await fits(page),`${at}: no overflow`);
  await toOffer(page);await shot(page,`${names[d]}-${width}-en`);
 }
 await page.close();
}
await browser.close();
eq(errors,[],'clean console');
console.log(`${checks} checks passed`);
