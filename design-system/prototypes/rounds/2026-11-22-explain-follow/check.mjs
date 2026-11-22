// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// First the round directory: no image or HTML file and nothing over 100 KB.
// Desktop (1440 px, Päivä and Yö, mouse), every direction: a pointed part
// shows its card with the F reminder and no report button; the card lets the
// pointer through; moving the pointer onto where the card was never leaves
// the pointer under the card (A trails it, B slides away, C changes corner);
// A follows within a part, B holds still within a part, C keeps its corner
// across parts and marks the part. A click on a part acts (toast) and never
// opens the report. F pins the card and opens the field with focus; the
// pinned card stays over other parts and takes the pointer; text survives a
// click elsewhere (nudge); Esc unpins and the card follows again; a second
// Esc ends the mode. Empty send asks for text; a sent report lets go when
// the pointer leaves. Reduced motion once (A does not trail, no transition).
// Keyboard once: Tab to a part explains it, F pins and focuses the field.
// English once; phone (390 px, touch): a tap explains in a bottom sheet, the
// report is a button there, no sideways scroll. The picker; a clean console.
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
const round='2026-11-22-explain-follow';
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
const names=['vierella','vaistaa','kulma'];
const wait=(page,ms=250)=>page.waitForTimeout(ms);
const tid=(page,id)=>page.getByTestId(id);
const card=page=>tid(page,'explain-card');
const cardId=page=>card(page).getAttribute('data-card',{timeout:1500}).catch(()=>null);
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

async function desktop(theme){
 const page=await open(1440,theme);
 if(theme==='light')await checkPicker(page,round);
 for(let d=0;d<3;d++){
  await pick(page,d);
  const tag=`1440-${theme}`;
  // A pointed part explains itself; the report is F, not a button.
  const at=await pointAt(page,'Y05');
  eq(await cardId(page),'Y05',`v${d+1} ${theme}: context ring card`);
  ok(await tid(page,'explain-report-key').isVisible(),`v${d+1}: F reminder shown`);
  eq(await tid(page,'explain-report').count(),0,`v${d+1}: no report button on a following card`);
  ok(await inView(card(page)),`v${d+1}: card in view`);
  const b0=await box(card(page));
  ok(!within(at,b0),`v${d+1}: pointer not under the card`);
  ok(!(await takesPointer(page,{x:b0.x+b0.width/2,y:b0.y+b0.height/2})),`v${d+1}: card lets the pointer through`);
  if(d===2){
   ok(await tid(page,'explain-marker').isVisible(),'v3: marker on the pointed part');
   const mb=await box(tid(page,'explain-marker'));const pb=await box(part(page,'Y05'));
   ok(Math.abs(mb.x+mb.width/2-(pb.x+pb.width))<12&&Math.abs(mb.y+mb.height/2-pb.y)<12,'v3: marker at the part\'s corner');
  }
  await shot(page,d,'card',tag);
  // Moving onto the card does not hold it: the pointer never ends under it.
  const target={x:b0.x+b0.width/2,y:b0.y+Math.min(60,b0.height/2)};
  await glide(page,at,target,12);
  const b1=await box(card(page));
  ok(!within(target,b1),`v${d+1}: moving onto the card leaves the pointer clear of it`);
  ok(!(await takesPointer(page,target)),`v${d+1}: the card still lets the pointer through`);
  // Within one large part.
  const a=await pointAt(page,'K11',0,-120,0);
  const ba=await box(card(page));
  await glide(page,a,{x:a.x+60,y:a.y},6);
  const bb=await box(card(page));
  eq(await cardId(page),'K11',`v${d+1}: still the answer`);
  if(d===0)ok(Math.abs(bb.x-ba.x)>40,'v1: card trails the pointer within a part');
  if(d===1)ok(Math.abs(bb.x-ba.x)<2&&Math.abs(bb.y-ba.y)<2||!within({x:a.x+60,y:a.y},bb,0),'v2: card holds still within a part unless the pointer comes near');
  // C keeps its corner across parts.
  if(d===2){
   await pointAt(page,'Y04');const c1=await box(card(page));
   await pointAt(page,'Y01');const c2=await box(card(page));
   ok(Math.abs(c1.x-c2.x)<2,'v3: same corner for parts far from it');
   ok(Math.abs((c1.y+c1.height)-(c2.y+c2.height))<2,'v3: bottom edge holds');
  }
  // B: pointing near the bottom-right composer still keeps the card clear.
  const send=await pointAt(page,'V06');
  ok(!within(send,await box(card(page)),d===1?20:0),`v${d+1}: send button's card clear of the pointer`);
  // A click acts and never opens the report.
  await pointAt(page,'Y04');
  await page.mouse.down();await page.mouse.up();await wait(page,200);
  ok(await tid(page,'rq-toast').isVisible(),`v${d+1}: click acts (toast)`);
  eq(await tid(page,'explain-feedback-text').count(),0,`v${d+1}: click opens no report`);
  // F pins and opens the field.
  const p=await pointAt(page,'Y06');
  await page.keyboard.press('f');await wait(page,200);
  ok(await tid(page,'explain-pinned').isVisible(),`v${d+1}: F pins`);
  ok(await tid(page,'explain-feedback-text').evaluate(e=>e===document.activeElement),`v${d+1}: F focuses the field`);
  ok(await inView(card(page)),`v${d+1}: pinned card in view`);
  const pinnedBox=await box(card(page));
  ok(await takesPointer(page,{x:pinnedBox.x+pinnedBox.width/2,y:pinnedBox.y+20}),`v${d+1}: pinned card takes the pointer`);
  await glide(page,p,await center(part(page,'K01')),8);
  eq(await cardId(page),'Y06',`v${d+1}: pinned card stays over other parts`);
  const pb2=await box(card(page));
  ok(Math.abs(pb2.x-pinnedBox.x)<2&&Math.abs(pb2.y-pinnedBox.y)<2,`v${d+1}: pinned card does not move`);
  // Empty send asks for text.
  await tid(page,'explain-feedback-send').click();
  ok(await tid(page,'explain-feedback-need').isVisible(),`v${d+1}: empty send asks for text`);
  await tid(page,'explain-feedback-text').fill('Kortti ei kerro, voiko mallia vaihtaa kesken keskustelun.');
  await shot(page,d,'report',tag);
  // Text survives a click elsewhere.
  const k=await center(part(page,'S34'));
  await page.mouse.click(k.x,k.y);await wait(page,200);
  ok(await tid(page,'explain-feedback-nudge').isVisible(),`v${d+1}: nudge`);
  eq(await tid(page,'explain-feedback-text').inputValue(),'Kortti ei kerro, voiko mallia vaihtaa kesken keskustelun.',`v${d+1}: text kept`);
  // Esc unpins; the card follows again.
  await page.keyboard.press('Escape');await wait(page,200);
  eq(await tid(page,'explain-pinned').count(),0,`v${d+1}: Esc unpins`);
  ok(await tid(page,'explain-bar').isVisible(),`v${d+1}: first Esc keeps the mode`);
  await pointAt(page,'V02');
  eq(await cardId(page),'V02',`v${d+1}: follows again after Esc`);
  // Send: the sent card lets go when the pointer leaves.
  await page.keyboard.press('f');await wait(page,150);
  await page.keyboard.type('Puuttuu, mitä liitteille tapahtuu.');
  await tid(page,'explain-feedback-send').click();await wait(page,150);
  ok(await tid(page,'explain-feedback-done').isVisible(),`v${d+1}: sent`);
  await pointAt(page,'S03');
  eq(await cardId(page),'S03',`v${d+1}: sent card lets go when the pointer leaves`);
  // Second Esc ends the mode.
  await page.keyboard.press('Escape');await wait(page,200);
  eq(await tid(page,'explain-bar').count(),0,`v${d+1}: Esc ends the mode`);
  if(quick)break;
 }
 await page.close();
}

async function reduced(){
 const page=await open(1440,'light','?motion=less');
 await pick(page,0);
 const a=await pointAt(page,'K11',0,-120,0);
 const ba=await box(card(page));
 eq(await card(page).evaluate(e=>getComputedStyle(e).transitionDuration),'0s','reduced: no transition');
 await glide(page,a,{x:a.x+60,y:a.y},6);
 const bb=await box(card(page));
 ok(Math.abs(bb.x-ba.x)<2&&Math.abs(bb.y-ba.y)<2,'reduced: A does not trail within a part');
 await pointAt(page,'Y04');
 eq(await cardId(page),'Y04','reduced: a new part still moves the card');
 await page.close();
}

async function keyboard(){
 const page=await open(1440,'light','?v=2');
 await page.mouse.move(700,4);
 let id=null;
 for(let i=0;i<20&&!id;i++){await page.keyboard.press('Tab');await wait(page,60);id=await page.evaluate(()=>document.activeElement?.closest('.fw-stage')?document.activeElement.getAttribute('data-card'):null);}
 ok(id,'keyboard: Tab reaches a part');
 await wait(page,200);
 eq(await cardId(page),id,'keyboard: a focused part explains itself');
 eq(await card(page).getAttribute('data-src'),'keyboard','keyboard: card from focus');
 await page.keyboard.press('Tab');await wait(page,200);
 const id2=await page.evaluate(()=>document.activeElement?.getAttribute('data-card'));
 eq(await cardId(page),id2,'keyboard: the next part explains itself');
 await page.keyboard.press('f');await wait(page,200);
 ok(await tid(page,'explain-feedback-text').evaluate(e=>e===document.activeElement),'keyboard: F pins and focuses the field');
 await page.keyboard.press('Escape');await wait(page,150);
 eq(await tid(page,'explain-pinned').count(),0,'keyboard: Esc unpins');
 await shot(page,1,'keyboard','1440-light');
 await page.close();
}

async function english(){
 const page=await open(1440,'dark','?lang=en&v=2');
 await page.mouse.move(700,4);
 await pointAt(page,'Y05');
 const h=await card(page).locator('h2').textContent();
 eq(h,'Context','english: card in English');
 ok((await tid(page,'explain-report-key').textContent()).includes('Press F'),'english: F reminder in English');
 await shot(page,1,'english','1440-dark');
 await page.close();
}

async function phone(){
 for(const theme of ['light','dark']){
  const page=await open(390,theme,'?v=2');
  const c=await center(part(page,'Y04'));
  await page.touchscreen.tap(c.x,c.y);await wait(page,300);
  eq(await cardId(page),'Y04',`phone ${theme}: a tap explains`);
  ok(await card(page).getAttribute('data-touch')!==null,`phone ${theme}: touch sheet`);
  ok(await inView(card(page)),`phone ${theme}: sheet in view`);
  ok(await fits(page),`phone ${theme}: no sideways scroll`);
  await tid(page,'explain-report').tap();await wait(page,200);
  ok(await tid(page,'explain-feedback-text').isVisible(),`phone ${theme}: report button opens the field`);
  ok(await inView(card(page)),`phone ${theme}: report in view`);
  await shot(page,1,'phone',`390-${theme}`);
  await page.close();
 }
}

await desktop('light');
if(!quick){await desktop('dark');await reduced();await keyboard();await english();await phone();}
await browser.close();
eq(errors.length,0,`console errors: ${errors.join(' | ')}`);
console.log(`ok ${checks} checks; screenshots in ${out}`);
