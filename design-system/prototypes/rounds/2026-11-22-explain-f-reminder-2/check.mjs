// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// First the round directory: no image or HTML file and nothing over 100 KB.
// Desktop (1440 px, Päivä and Yö, mouse), every direction: the card follows
// beside the pointer and lets the pointer through, has no report button and
// never shows the F row (not even after resting); it carries the hidden
// screen-reader line. The bar's hint is a button inside the bar with the F
// keycap, in the direction's place: A right after the title and before the
// instructions, B just before Stop, C centred in the bar as part of a sentence.
// Pointing at the hint makes no new card. Clicking it opens the general
// feedback panel under the bar: no part's card, no part's name, no part report
// field; its field has focus; Esc closes it, gives focus back to the hint and
// keeps the mode; a press outside with typed text only nudges; sending shows
// the sent state. A click on a part acts and opens no report; F pins and
// focuses the field; the hint leaves while pinned; Esc unpins and a second Esc
// ends the mode. Keyboard once per direction: Tab reaches the hint, its name
// says "Ilmoita virheestä" and its description says what a click does, Enter
// opens the panel. A narrow window with a mouse (700 px) per direction: the
// hint keeps its keycap, does not reach Stop, no sideways scroll. Reduced
// motion once (the card does not ease). English once. Phone (390 px, touch,
// Päivä and Yö): no hint, the report is a button on the sheet, no sideways
// scroll. The picker; a clean console.
// Screenshots: v<n>-<what>-<width>-<theme>.png.
import {createRequire} from 'node:module';
import {dirname,resolve,join,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync,readdirSync,statSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-22-explain-f-reminder-2';
const [input,out,flag]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <out-dir> [--quick]');process.exit(2);}
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};
for(const f of readdirSync(here)){
 ok(!['.png','.jpg','.jpeg','.avif','.webp','.html'].includes(extname(f).toLowerCase()),`round directory holds ${f}`);
 ok(statSync(join(here,f)).size<100*1024,`${f} is over 100 KB`);
}
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['otsikossa','lopussa','keskella'];
const REST=900;
const wait=(page,ms=250)=>page.waitForTimeout(ms);
const tid=(page,id)=>page.getByTestId(id);
const card=page=>tid(page,'explain-card');
const cardId=page=>card(page).getAttribute('data-card',{timeout:1500}).catch(()=>null);
const row=page=>tid(page,'explain-report-key').count();
async function open(width,theme,query=''){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:900},deviceScaleFactor:phone?2:1,hasTouch:phone,isMobile:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto(`http://prototype.test/${query}`);
 await wait(page,500);
 await page.locator('#theme').selectOption(theme);
 await wait(page);
 return page;
}
const pick=async(page,d)=>{await page.mouse.move(2,2);await page.locator('.proto-picker-item').nth(d).click();await page.locator(`.rq-review[data-direction="${d}"]`).waitFor({state:'attached'});await page.getByTestId('rq-reset').click();await page.mouse.move(700,4);await wait(page,300);};
const shot=(page,d,what,tag)=>page.screenshot({path:`${out}/v${d+1}-${names[d]}-${what}-${tag}.png`});
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const box=async loc=>loc.boundingBox();
const inView=async loc=>{const b=await box(loc);const vp=loc.page().viewportSize();return b&&b.x>=-0.5&&b.y>=-0.5&&b.x+b.width<=vp.width+0.5&&b.y+b.height<=vp.height+0.5;};
const part=(page,id,n=0)=>page.locator(`.fw-stage [data-card="${id}"]`).nth(n);
const center=async loc=>{const b=await box(loc);return {x:b.x+b.width/2,y:b.y+b.height/2};};
const within=(p,b,pad=0)=>p.x>=b.x-pad&&p.x<=b.x+b.width+pad&&p.y>=b.y-pad&&p.y<=b.y+b.height+pad;
async function glide(page,from,to,steps=10){for(let i=1;i<=steps;i++){await page.mouse.move(from.x+(to.x-from.x)*i/steps,from.y+(to.y-from.y)*i/steps);await wait(page,30);}await wait(page,260);}
async function pointAt(page,id,n=0,dx=0,dy=0){const c=await center(part(page,id,n));await glide(page,{x:c.x-30,y:c.y-20},{x:c.x+dx,y:c.y+dy},4);return {x:c.x+dx,y:c.y+dy};}
const takesPointer=(page,p)=>page.evaluate(({x,y})=>!!document.elementFromPoint(x,y)?.closest('[data-testid="explain-card"]'),p);
// The hidden line is in the card (so its live region reads it) and takes no room.
async function srLine(page,m){
 eq(await tid(page,'explain-report-sr').count(),1,`${m}: screen-reader line in the card`);
 const b=await box(tid(page,'explain-report-sr'));
 ok(!b||b.width<=1.5&&b.height<=1.5,`${m}: screen-reader line takes no room`);
 ok((await card(page).getAttribute('aria-live'))==='polite',`${m}: card is a live region`);
}

const hint=page=>tid(page,'explain-bar-f');
const panel=page=>tid(page,'general-feedback');
const focused=(loc)=>loc.evaluate(e=>e===document.activeElement);
// Where the hint sits in the bar, by direction.
async function placed(page,d,m){
 const bar=await box(tid(page,'explain-bar')),h=await box(hint(page)),stop=await box(tid(page,'explain-stop'));
 const title=await box(tid(page,'explain-bar').locator('b'));
 ok(h.y>=bar.y-0.5&&h.y+h.height<=bar.y+bar.height+0.5,`${m}: hint inside the bar`);
 ok(h.x+h.width<=stop.x-4,`${m}: hint does not reach Stop`);
 if(d===0){
  ok(h.x>title.x+title.width&&h.x-(title.x+title.width)<=24,`${m}: A hint right after the title`);
  const base=await box(tid(page,'explain-bar').locator('.ah-explain-hint'));
  ok(base.x>=h.x+h.width,`${m}: A hint before the instructions`);
 }
 if(d===1)ok(stop.x-(h.x+h.width)<=24&&h.x>bar.width/2,`${m}: B hint just before Stop`);
 if(d===2){
  const line=await box(tid(page,'explain-bar-line'));
  ok(Math.abs(line.x+line.width/2-(bar.x+bar.width/2))<=4,`${m}: C line centred in the bar`);
  ok(h.x>=line.x&&h.x+h.width<=line.x+line.width+0.5,`${m}: C hint is part of the line`);
 }
}

async function desktop(theme){
 const page=await open(1440,theme);
 if(theme==='light')await checkPicker(page,round);
 for(let d=0;d<3;d++){
  await pick(page,d);
  const tag=`1440-${theme}`,m=`v${d+1} ${theme}`;
  const at=await pointAt(page,'Y05');
  eq(await cardId(page),'Y05',`${m}: context ring card`);
  const name=await card(page).locator('h2').textContent();
  eq(await tid(page,'explain-report').count(),0,`${m}: no report button on a following card`);
  eq(await row(page),0,`${m}: no F row on the card`);
  ok(await inView(card(page)),`${m}: card in view`);
  const b0=await box(card(page));
  ok(!within(at,b0),`${m}: pointer not under the card`);
  ok(!(await takesPointer(page,{x:b0.x+b0.width/2,y:b0.y+b0.height/2})),`${m}: card lets the pointer through`);
  ok(await hint(page).isVisible(),`${m}: hint shown`);
  ok((await hint(page).textContent()).startsWith('F'),`${m}: hint has the F keycap`);
  eq(await hint(page).evaluate(e=>e.tagName),'BUTTON',`${m}: hint is a button`);
  await placed(page,d,m);
  await srLine(page,m);
  await shot(page,d,'card',tag);
  await wait(page,REST+300);
  eq(await row(page),0,`${m}: no row after resting either`);
  // Pointing at the hint explains nothing new; the card only lingers.
  // Straight up into the bar, then along it, so no other part is crossed.
  const hc=await center(hint(page));
  await glide(page,at,{x:at.x,y:hc.y},6);
  await glide(page,{x:at.x,y:hc.y},hc,8);
  eq(await cardId(page),'Y05',`${m}: pointing at the hint makes no new card`);
  await shot(page,d,'hover',tag);
  // Clicking the hint opens general feedback, never a report for Y05.
  await page.mouse.down();await page.mouse.up();await wait(page,250);
  ok(await panel(page).isVisible(),`${m}: click opens the general feedback panel`);
  eq(await card(page).count(),0,`${m}: the part's card lets go`);
  eq(await tid(page,'explain-feedback-text').count(),0,`${m}: no part report field`);
  ok(!(await panel(page).textContent()).includes(name),`${m}: panel does not name the last part`);
  ok(await focused(tid(page,'general-text')),`${m}: panel field has focus`);
  eq(await hint(page).getAttribute('aria-expanded'),'true',`${m}: hint says it is expanded`);
  const pb=await box(panel(page)),bar=await box(tid(page,'explain-bar'));
  ok(pb.y>=bar.y+bar.height&&await inView(panel(page)),`${m}: panel under the bar, in view`);
  const hb=await box(hint(page));
  ok(pb.x<=hb.x+hb.width&&pb.x+pb.width>=hb.x,`${m}: panel hangs under the hint`);
  await shot(page,d,'general',tag);
  // Pointing while the panel is open explains nothing.
  await pointAt(page,'K01');
  eq(await card(page).count(),0,`${m}: no card while the panel is open`);
  await page.keyboard.press('Escape');await wait(page,200);
  eq(await panel(page).count(),0,`${m}: Esc closes the panel`);
  ok(await tid(page,'explain-bar').isVisible(),`${m}: mode stays on`);
  ok(await focused(hint(page)),`${m}: focus back on the hint`);
  // Typed text survives a press outside; sending shows the sent state.
  await hint(page).click();await wait(page,200);
  await tid(page,'general-text').fill('Synthetic feedback');
  await page.mouse.click(700,600);await wait(page,200);
  ok(await panel(page).isVisible(),`${m}: press outside keeps a typed panel`);
  ok(await tid(page,'general-nudge').isVisible(),`${m}: and nudges`);
  eq(await tid(page,'general-text').inputValue(),'Synthetic feedback',`${m}: text kept`);
  await tid(page,'general-send').click();await wait(page,200);
  ok(await tid(page,'general-done').isVisible(),`${m}: sent state`);
  await page.mouse.click(700,600);await wait(page,200);
  eq(await panel(page).count(),0,`${m}: press outside closes a sent panel`);
  // A click on a part acts and never opens the report.
  await pointAt(page,'Y04');
  eq(await cardId(page),'Y04',`${m}: pointing works again`);
  await page.mouse.down();await page.mouse.up();await wait(page,200);
  ok(await tid(page,'rq-toast').isVisible(),`${m}: click acts (toast)`);
  eq(await tid(page,'explain-feedback-text').count(),0,`${m}: click opens no report`);
  // F pins and opens the field.
  const q=await pointAt(page,'Y06');
  await page.keyboard.press('f');await wait(page,200);
  ok(await tid(page,'explain-pinned').isVisible(),`${m}: F pins`);
  ok(await focused(tid(page,'explain-feedback-text')),`${m}: F focuses the field`);
  eq(await hint(page).count(),0,`${m}: hint leaves while pinned`);
  await glide(page,q,await center(part(page,'K01')),6);
  eq(await cardId(page),'Y06',`${m}: pinned card stays`);
  await page.keyboard.press('Escape');await wait(page,200);
  eq(await tid(page,'explain-pinned').count(),0,`${m}: Esc unpins`);
  ok(await hint(page).isVisible(),`${m}: hint back after unpinning`);
  await pointAt(page,'V02');
  eq(await cardId(page),'V02',`${m}: follows again after Esc`);
  await page.keyboard.press('Escape');await wait(page,200);
  eq(await tid(page,'explain-bar').count(),0,`${m}: Esc ends the mode`);
  if(quick)break;
 }
 await page.close();
}

async function keyboard(){
 for(const v of [1,2,3]){
  const page=await open(1440,'light',`?v=${v}`);
  await page.mouse.move(700,4);
  let on=false;
  for(let i=0;i<40&&!on;i++){await page.keyboard.press('Tab');await wait(page,40);on=await page.evaluate(()=>document.activeElement?.getAttribute('data-testid')==='explain-bar-f');}
  ok(on,`keyboard v${v}: Tab reaches the hint`);
  const acc=await page.evaluate(()=>{const e=document.activeElement;return {name:e.textContent,desc:document.getElementById(e.getAttribute('aria-describedby'))?.textContent||''};});
  ok(/Ilmoita virheestä|ilmoittaa virheestä/.test(acc.name),`keyboard v${v}: name says it reports a mistake`);
  ok(acc.desc.includes('yleisen palautteen'),`keyboard v${v}: description says what a click does`);
  await page.keyboard.press('Enter');await wait(page,200);
  ok(await panel(page).isVisible(),`keyboard v${v}: Enter opens the panel`);
  ok(await focused(tid(page,'general-text')),`keyboard v${v}: field focused`);
  await page.keyboard.press('Escape');await wait(page,150);
  ok(await focused(hint(page)),`keyboard v${v}: Esc returns to the hint`);
  // Tab on into the view: a focused part explains itself, with the hidden line.
  let id=null;
  for(let i=0;i<20&&!id;i++){await page.keyboard.press('Tab');await wait(page,60);id=await page.evaluate(()=>document.activeElement?.closest('.fw-stage')?document.activeElement.getAttribute('data-card'):null);}
  ok(id,`keyboard v${v}: Tab reaches a part`);
  await wait(page,200);
  eq(await cardId(page),id,`keyboard v${v}: a focused part explains itself`);
  await srLine(page,`keyboard v${v}`);
  eq(await row(page),0,`keyboard v${v}: no row`);
  await page.close();
 }
}

async function narrow(){
 for(let d=0;d<3;d++){
  const page=await open(700,d===0?'light':'dark',`?v=${d+1}`);
  await page.mouse.move(350,4);
  const m=`narrow v${d+1}`;
  ok(await hint(page).isVisible(),`${m}: hint shown`);
  ok(await hint(page).locator('kbd').isVisible(),`${m}: hint keeps its keycap`);
  const h=await box(hint(page)),stop=await box(tid(page,'explain-stop')),title=await box(tid(page,'explain-bar').locator('b'));
  ok(h.x>=title.x+title.width&&h.x+h.width<=stop.x-4,`${m}: hint between title and Stop`);
  const full=await hint(page).evaluate(e=>e.scrollWidth<=e.clientWidth+1);
  ok(full,`${m}: hint not clipped`);
  ok(await fits(page),`${m}: no sideways scroll`);
  await pointAt(page,'Y05');
  await shot(page,d,'narrow',`700-${d===0?'light':'dark'}`);
  await hint(page).click();await wait(page,200);
  ok(await inView(panel(page)),`${m}: panel in view`);
  await page.close();
 }
}

async function reduced(){
 const page=await open(1440,'light','?motion=less&v=1');
 await page.mouse.move(700,4);
 await pointAt(page,'Y05');
 eq(await card(page).evaluate(e=>getComputedStyle(e).transitionDuration),'0s','reduced: the card does not ease');
 await page.close();
}

async function english(){
 const page=await open(1440,'dark','?lang=en&v=1');
 await page.mouse.move(700,4);
 await pointAt(page,'Y05');
 eq(await card(page).locator('h2').textContent(),'Context','english: card in English');
 ok((await hint(page).textContent()).includes('Report a mistake'),'english: hint in English');
 ok((await tid(page,'explain-report-sr').textContent()).startsWith('F: report'),'english: screen-reader line in English');
 await hint(page).click();await wait(page,200);
 ok((await panel(page).textContent()).includes('Feedback about Habitat'),'english: panel in English');
 await shot(page,0,'english','1440-dark');
 await page.close();
}

async function phone(){
 for(const theme of ['light','dark']){
  const page=await open(390,theme,'?v=1');
  const c=await center(part(page,'Y04'));
  await page.touchscreen.tap(c.x,c.y);await wait(page,400);
  eq(await cardId(page),'Y04',`phone ${theme}: a tap explains`);
  ok(await card(page).getAttribute('data-touch')!==null,`phone ${theme}: touch sheet`);
  eq(await hint(page).count(),0,`phone ${theme}: no F hint`);
  eq(await row(page),0,`phone ${theme}: no F row`);
  ok(await tid(page,'explain-report').isVisible(),`phone ${theme}: report is a button`);
  ok(await inView(card(page)),`phone ${theme}: sheet in view`);
  ok(await fits(page),`phone ${theme}: no sideways scroll`);
  await shot(page,0,'phone',`390-${theme}`);
  await tid(page,'explain-report').tap();await wait(page,200);
  ok(await tid(page,'explain-feedback-text').isVisible(),`phone ${theme}: report button opens the field`);
  await page.close();
 }
}

await desktop('light');
if(!quick){await desktop('dark');await keyboard();await narrow();await reduced();await english();await phone();}
await browser.close();
eq(errors.length,0,`console errors: ${errors.join(' | ')}`);
console.log(`ok ${checks} checks; screenshots in ${out}`);
