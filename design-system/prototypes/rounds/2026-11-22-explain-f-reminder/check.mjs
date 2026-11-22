// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// First the round directory: no image or HTML file and nothing over 100 KB.
// Desktop (1440 px, Päivä and Yö, mouse), every direction: the card follows
// beside the pointer (round explain-follow's A) and lets the pointer
// through; it has no report button; the bar always shows the F chip; the
// card always carries the hidden screen-reader line. Where the row shows:
// A never (not even after resting); B on the first three different cards,
// not on the fourth, where the bar chip nods, again on an already hinted
// card, and never after F has been used (the tester select follows, and
// "First time" brings it back); C not at once, after a rest, not while the
// pointer keeps moving within a part, and gone on the next part. In every
// direction a click acts and opens no report, F pins and focuses the field,
// the bar chip leaves while pinned, Esc unpins and a second Esc ends the
// mode. Reduced motion once (no row animation, no nod). Keyboard once in A
// and C (focus explains; in C the row shows after focus rests). English
// once; phone (390 px, touch, Päivä and Yö): no F chip and no row, the report
// is a button on the sheet, no sideways scroll. The picker; a clean console.
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
const round='2026-11-22-explain-f-reminder';
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
const names=['palkissa','alussa','viipyessa'];
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
const pick=async(page,d)=>{await page.mouse.move(2,2);await page.locator('.proto-picker-item').nth(d).click();await page.locator(`.rq-review[data-direction="${d}"]`).waitFor({state:'attached'});if(d===1)await page.locator('#persona').selectOption('new');await page.getByTestId('rq-reset').click();await page.mouse.move(700,4);await wait(page,300);};
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

async function desktop(theme){
 const page=await open(1440,theme);
 if(theme==='light')await checkPicker(page,round);
 for(let d=0;d<3;d++){
  await pick(page,d);
  const tag=`1440-${theme}`,m=`v${d+1} ${theme}`;
  const at=await pointAt(page,'Y05');
  eq(await cardId(page),'Y05',`${m}: context ring card`);
  eq(await tid(page,'explain-report').count(),0,`${m}: no report button on a following card`);
  ok(await inView(card(page)),`${m}: card in view`);
  const b0=await box(card(page));
  ok(!within(at,b0),`${m}: pointer not under the card`);
  ok(!(await takesPointer(page,{x:b0.x+b0.width/2,y:b0.y+b0.height/2})),`${m}: card lets the pointer through`);
  ok(await tid(page,'explain-bar-f').isVisible(),`${m}: bar chip shown`);
  ok((await tid(page,'explain-bar-f').textContent()).startsWith('F'),`${m}: bar chip has the F keycap`);
  await srLine(page,m);
  if(d===0){
   eq(await row(page),0,`${m}: no row on the card`);
   await shot(page,d,'card',tag);
   await wait(page,REST+400);
   eq(await row(page),0,`${m}: no row after resting either`);
  }
  if(d===1){
   eq(await row(page),1,`${m}: first card shows the row`);
   await shot(page,d,'card',tag);
   await pointAt(page,'Y06');eq(await row(page),1,`${m}: second card shows the row`);
   await pointAt(page,'Y04');eq(await row(page),1,`${m}: third card shows the row`);
   ok(await tid(page,'explain-bar-f').getAttribute('data-nod')===null,`${m}: chip has not nodded yet`);
   await pointAt(page,'S03');eq(await row(page),0,`${m}: fourth card has no row`);
   ok(await tid(page,'explain-bar-f').getAttribute('data-nod')!==null,`${m}: chip nods when the row retires`);
   await shot(page,d,'retired',tag);
   await pointAt(page,'Y05');eq(await row(page),1,`${m}: an already hinted card keeps its row`);
  }
  if(d===2){
   eq(await row(page),0,`${m}: no row at once`);
   await wait(page,REST+300);
   eq(await row(page),1,`${m}: row after a rest`);
   ok(await inView(card(page)),`${m}: grown card in view`);
   ok(!within(at,await box(card(page))),`${m}: grown card clear of the pointer`);
   await shot(page,d,'card',tag);
   await pointAt(page,'Y06');
   eq(await row(page),0,`${m}: row gone on the next part`);
   // Keep moving within one large part: no row.
   let p=await pointAt(page,'K11',0,-150,0);
   for(let i=0;i<6;i++){p={x:p.x+(i%2?-20:20),y:p.y};await page.mouse.move(p.x,p.y);await wait(page,REST/3);}
   eq(await cardId(page),'K11',`${m}: still the answer`);
   eq(await row(page),0,`${m}: no row while the pointer keeps moving`);
   await wait(page,REST+300);
   eq(await row(page),1,`${m}: row once the pointer stops`);
  }
  // Moving onto the card does not hold it.
  const s=await pointAt(page,'Y01');const sb=await box(card(page));
  const onto={x:sb.x+sb.width/2,y:sb.y+Math.min(40,sb.height/2)};
  await glide(page,s,onto,10);
  ok(!within(onto,await box(card(page))),`${m}: moving onto the card leaves the pointer clear`);
  // A click acts and never opens the report.
  await pointAt(page,'Y04');
  await page.mouse.down();await page.mouse.up();await wait(page,200);
  ok(await tid(page,'rq-toast').isVisible(),`${m}: click acts (toast)`);
  eq(await tid(page,'explain-feedback-text').count(),0,`${m}: click opens no report`);
  // F pins and opens the field, whatever the row shows.
  const q=await pointAt(page,'Y06');
  await page.keyboard.press('f');await wait(page,200);
  ok(await tid(page,'explain-pinned').isVisible(),`${m}: F pins`);
  ok(await tid(page,'explain-feedback-text').evaluate(e=>e===document.activeElement),`${m}: F focuses the field`);
  eq(await tid(page,'explain-bar-f').count(),0,`${m}: bar chip leaves while pinned`);
  const pinnedBox=await box(card(page));
  ok(await takesPointer(page,{x:pinnedBox.x+pinnedBox.width/2,y:pinnedBox.y+20}),`${m}: pinned card takes the pointer`);
  await glide(page,q,await center(part(page,'K01')),6);
  eq(await cardId(page),'Y06',`${m}: pinned card stays`);
  await page.keyboard.press('Escape');await wait(page,200);
  eq(await tid(page,'explain-pinned').count(),0,`${m}: Esc unpins`);
  ok(await tid(page,'explain-bar-f').isVisible(),`${m}: chip back after unpinning`);
  if(d===1){
   // F has been used: the card never shows the row again.
   eq(await page.locator('#persona').inputValue(),'learned',`${m}: tester select follows F`);
   await pointAt(page,'S01');eq(await row(page),0,`${m}: no row on a new card after F`);
   await pointAt(page,'Y05');eq(await row(page),0,`${m}: no row on a hinted card after F`);
   await page.locator('#persona').selectOption('new');await page.mouse.move(700,4);await wait(page,200);
   await pointAt(page,'Y05');eq(await row(page),1,`${m}: First time brings the row back`);
   await page.locator('#persona').selectOption('learned');await page.mouse.move(700,4);await wait(page,200);
   await pointAt(page,'Y05');eq(await row(page),0,`${m}: Has used F starts without the row`);
   await shot(page,d,'learned',tag);
  }
  await pointAt(page,'V02');
  eq(await cardId(page),'V02',`${m}: follows again after Esc`);
  await page.keyboard.press('Escape');await wait(page,200);
  eq(await tid(page,'explain-bar').count(),0,`${m}: Esc ends the mode`);
  if(quick)break;
 }
 await page.close();
}

async function reduced(){
 const page=await open(1440,'light','?motion=less&v=3');
 await page.mouse.move(700,4);
 await pointAt(page,'Y05');await wait(page,REST+300);
 eq(await row(page),1,'reduced: C row after a rest');
 eq(await tid(page,'explain-report-key').evaluate(e=>getComputedStyle(e).animationName),'none','reduced: the row does not animate');
 await page.mouse.move(2,2);await page.locator('.proto-picker-item').nth(1).click();await page.locator('#persona').selectOption('new');await page.mouse.move(700,4);await wait(page,300);
 for(const id of ['Y05','Y06','Y04','S03'])await pointAt(page,id);
 eq(await tid(page,'explain-bar-f').getAttribute('data-nod'),null,'reduced: the chip does not nod');
 await page.close();
}

async function keyboard(){
 for(const v of [1,3]){
  const page=await open(1440,'light',`?v=${v}`);
  await page.mouse.move(700,4);
  let id=null;
  for(let i=0;i<20&&!id;i++){await page.keyboard.press('Tab');await wait(page,60);id=await page.evaluate(()=>document.activeElement?.closest('.fw-stage')?document.activeElement.getAttribute('data-card'):null);}
  ok(id,`keyboard v${v}: Tab reaches a part`);
  await wait(page,200);
  eq(await cardId(page),id,`keyboard v${v}: a focused part explains itself`);
  await srLine(page,`keyboard v${v}`);
  eq(await row(page),0,`keyboard v${v}: no row at once`);
  await wait(page,REST+300);
  eq(await row(page),v===3?1:0,`keyboard v${v}: row after focus rests only in C`);
  await page.keyboard.press('f');await wait(page,200);
  ok(await tid(page,'explain-feedback-text').evaluate(e=>e===document.activeElement),`keyboard v${v}: F pins and focuses the field`);
  await page.keyboard.press('Escape');await wait(page,150);
  if(v===3)await shot(page,2,'keyboard','1440-light');
  await page.close();
 }
}

async function english(){
 const page=await open(1440,'dark','?lang=en&v=2');
 await page.mouse.move(700,4);
 await pointAt(page,'Y05');
 eq(await card(page).locator('h2').textContent(),'Context','english: card in English');
 ok((await tid(page,'explain-report-key').textContent()).includes('Press F'),'english: row in English');
 ok((await tid(page,'explain-bar-f').textContent()).includes('Report a mistake'),'english: bar chip in English');
 ok((await tid(page,'explain-report-sr').textContent()).startsWith('F: report'),'english: screen-reader line in English');
 await shot(page,1,'english','1440-dark');
 await page.close();
}

async function phone(){
 for(const theme of ['light','dark']){
  const page=await open(390,theme,'?v=2');
  const c=await center(part(page,'Y04'));
  await page.touchscreen.tap(c.x,c.y);await wait(page,REST+300);
  eq(await cardId(page),'Y04',`phone ${theme}: a tap explains`);
  ok(await card(page).getAttribute('data-touch')!==null,`phone ${theme}: touch sheet`);
  eq(await tid(page,'explain-bar-f').count(),0,`phone ${theme}: no F chip`);
  eq(await row(page),0,`phone ${theme}: no F row`);
  ok(await tid(page,'explain-report').isVisible(),`phone ${theme}: report is a button`);
  ok(await inView(card(page)),`phone ${theme}: sheet in view`);
  ok(await fits(page),`phone ${theme}: no sideways scroll`);
  await shot(page,1,'phone',`390-${theme}`);
  await tid(page,'explain-report').tap();await wait(page,200);
  ok(await tid(page,'explain-feedback-text').isVisible(),`phone ${theme}: report button opens the field`);
  await page.close();
 }
}

await desktop('light');
if(!quick){await desktop('dark');await reduced();await keyboard();await english();await phone();}
await browser.close();
eq(errors.length,0,`console errors: ${errors.join(' | ')}`);
console.log(`ok ${checks} checks; screenshots in ${out}`);
