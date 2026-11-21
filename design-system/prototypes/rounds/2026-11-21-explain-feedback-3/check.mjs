// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// First the round directory: no image or HTML file and nothing over 100 KB.
// Desktop (1440 px, Päivä and Yö, mouse), every direction: the default card
// is in view, has the single "Report a mistake" path and the direction's own
// destination line (the three default views differ), and lets the pointer
// through. Scripted pointer paths, sampled every step: from the context ring
// (card below) and from the attach button (card above, the path crossing the
// message field) straight to the report button; the card never changes on
// the way. The report opens a required note: sending empty does nothing but
// ask for text; with text, A opens GitHub (the address carries the text and
// the card id, nothing of the conversation), B keeps it and offers sending,
// C sends it. A negative control (`?path=off`, production) loses the attach
// button's card to the message field on the same path. A neighbour still
// takes the card at once. An open note with text survives a click elsewhere
// (nudge) and Esc; a second Esc stops the mode. B's sending sheet holds only
// unsent reports and marks them; A and C keep no list. Keyboard once: a
// focused part explains itself, F moves to the report, Enter opens the note,
// typing and Tab/Enter send. Phone (390 px, touch): a tap explains, the
// report works, card in view, no sideways scroll. English and High contrast
// once, the picker, a clean console.
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
const round='2026-11-21-explain-feedback-3';
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
const names=['github','oma-tili','kehittajille'];
const routes=['github','batch','inbox'];
const wait=(page,ms=250)=>page.waitForTimeout(ms);
const tid=(page,id)=>page.getByTestId(id);
const card=page=>tid(page,'explain-card');
const cardId=page=>card(page).getAttribute('data-card').catch(()=>null);
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
const pick=async(page,d)=>{await page.locator('.proto-picker-item').nth(d).click();await page.locator(`.rq-review[data-direction="${d}"]`).waitFor({state:'attached'});await wait(page,400);};
const fresh=async(page,d,s='card')=>{await page.mouse.move(2,2);await page.locator('#scenario').selectOption(s);await pick(page,d);await wait(page,300);};
const shot=(page,d,what,tag)=>page.screenshot({path:`${out}/v${d+1}-${names[d]}-${what}-${tag}.png`});
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const inView=async loc=>{const b=await loc.boundingBox();const vp=loc.page().viewportSize();return b&&b.x>=0&&b.y>=0&&b.x+b.width<=vp.width+0.5&&b.y+b.height<=vp.height+0.5;};
const center=async loc=>{const b=await loc.boundingBox();return {x:b.x+b.width/2,y:b.y+b.height/2};};
/** Moves the mouse in a straight line, sampling the card after every step. */
async function path(page,from,to,steps=14){
 const seen=new Set();
 for(let i=1;i<=steps;i++){
  await page.mouse.move(from.x+(to.x-from.x)*i/steps,from.y+(to.y-from.y)*i/steps);
  await wait(page,25);
  seen.add(await cardId(page));
 }
 return [...seen];
}
async function pointAt(page,part){
 const c=await center(page.locator(`.ef-stage [data-card="${part}"]`));
 await page.mouse.move(c.x-6,c.y);await page.mouse.move(c.x,c.y,{steps:3});await wait(page,80);
 eq(await cardId(page),part,`pointing ${part} shows its card`);
 return c;
}
/** Part → report button; the card must not change on the way. */
async function reachReport(page,d,part){
 const from=await pointAt(page,part);
 const target=await center(tid(page,'fb-report'));
 const seen=await path(page,from,target);
 eq(seen.join(),part,`v${d+1}: ${part} → report keeps the card (saw ${seen})`);
 await page.mouse.click(target.x,target.y);await wait(page,150);
 ok(await tid(page,'fb-note').isVisible(),`v${d+1}: ${part} report opens the note`);
 eq(await page.evaluate(()=>document.activeElement?.dataset.testid),'fb-note-text',`v${d+1}: the note takes focus`);
}
/** Writing is required: an empty send asks for text and sends nothing. */
async function emptySend(page,d,tap=false){
 eq(await tid(page,'fb-send').getAttribute('aria-disabled'),'true',`v${d+1}: send disabled while empty`);
 await (tap?tid(page,'fb-send').tap({force:true}):tid(page,'fb-send').click({force:true}));await wait(page,120);
 ok(await tid(page,'fb-need').isVisible(),`v${d+1}: empty send asks for text`);
 eq(await tid(page,'fb-done').count(),0,`v${d+1}: nothing sent empty`);
}
/** Each route's done state after a send with text. */
async function afterSend(page,d,tag){
 ok(await tid(page,'fb-done').isVisible(),`${tag} v${d+1}: done`);
 const done=await tid(page,'fb-done').innerText();
 if(d===0)ok(/GitHub/.test(done)&&/Submit/.test(done),`${tag} A: done says Submit in GitHub`);
 if(d===1)ok(await tid(page,'fb-send-now').isVisible(),`${tag} B: send now offered`);
 if(d===2)ok(/kehittäjille|developers/.test(done),`${tag} C: sent`);
 if(d!==1)ok(await tid(page,'rq-toast').isVisible(),`${tag} v${d+1}: prototype says it does not really send`);
}

const widths=quick?[1440]:[1440,390];
const themes=quick?['light']:['light','dark'];
for(const width of widths)for(const theme of themes){
 const tag=`${width}-${theme}`;
 const page=await open(width,theme);
 const phone=width===390;
 if(width===1440&&theme==='light')await checkPicker(page,round);
 const dests=new Set();
 for(let d=0;d<3;d++){
  await fresh(page,d);
  ok(await fits(page),`${tag} v${d+1}: sideways scroll`);
  eq(await tid(page,'direction-lines').locator('li').count(),3,'three direction lines');
  eq(await cardId(page),'Y05',`${tag} v${d+1}: default card`);
  ok(await inView(card(page)),`${tag} v${d+1}: card outside viewport`);
  eq(await tid(page,'fb-report').count(),1,`${tag} v${d+1}: one report path`);
  eq(await page.locator('.ef-card [data-testid^="fb-helped"], .ef-card [data-choice]').count(),0,`${tag} v${d+1}: no positive choice`);
  eq(await card(page).getAttribute('data-route'),routes[d],`${tag} v${d+1}: route`);
  dests.add(await tid(page,'fb-dest').innerText());
  eq(await tid(page,'bar-mine').count(),d===1?1:0,`${tag} v${d+1}: unsent count only in B`);
  if(!phone)eq(await card(page).evaluate(e=>getComputedStyle(e).pointerEvents),'none',`${tag} v${d+1}: card lets the pointer through at rest`);
  await shot(page,d,'default',tag);
  if(!phone){
   // Header part, card below.
   await reachReport(page,d,'Y05');
   await emptySend(page,d);
   await tid(page,'fb-note-text').fill('Synthetic note about the card');
   eq(await tid(page,'fb-send').getAttribute('aria-disabled'),null,`${tag} v${d+1}: send enabled with text`);
   await tid(page,'fb-what').click();await wait(page,80);
   const pre=await tid(page,'fb-preview').innerText();
   ok(pre.includes('Synthetic note about the card')&&pre.includes('(Y05)')&&pre.includes('0.42'),`${tag} v${d+1}: preview holds text, card id, version`);
   ok(!pre.includes('kotisivu')&&!pre.includes('Kirjautumisen'),`${tag} v${d+1}: preview holds no conversation or workspace`);
   await shot(page,d,'note',tag);
   // A click elsewhere keeps what was typed.
   const dot=await center(page.locator('.ef-stage [data-card="Y03"]'));
   await page.mouse.click(dot.x,dot.y);await wait(page,150);
   eq(await cardId(page),'Y05',`${tag} v${d+1}: open note survives a click elsewhere`);
   ok(await tid(page,'fb-nudge').isVisible(),`${tag} v${d+1}: nudge`);
   eq(await tid(page,'fb-note-text').inputValue(),'Synthetic note about the card','note kept');
   await tid(page,'fb-send').click();await wait(page,150);
   await afterSend(page,d,tag);
   await shot(page,d,'done',tag);
   // Composer part, card above, the path crossing the message field.
   await page.mouse.move(400,300);await wait(page,100);
   await reachReport(page,d,'V02');
   await tid(page,'fb-cancel').click();await wait(page,100);
   // A neighbour still takes the card at once.
   await page.mouse.move(400,300);await wait(page,100);
   await pointAt(page,'Y05');
   const to=await center(page.locator('.ef-stage [data-card="Y06"]'));
   await page.mouse.move(to.x,to.y,{steps:4});await wait(page,80);
   eq(await cardId(page),'Y06',`${tag} v${d+1}: a neighbour still takes the card at once`);
   // Esc cancels an open note, a second Esc stops the mode.
   await fresh(page,d,'note');
   ok(await tid(page,'fb-note').isVisible(),`${tag} v${d+1}: note scenario`);
   await page.keyboard.press('Escape');await wait(page,100);
   eq(await tid(page,'fb-note').count(),0,`${tag} v${d+1}: Esc cancels the report`);
   eq(await cardId(page),'Y05','card stays after Esc');
   await page.keyboard.press('Escape');await wait(page,100);
   eq(await tid(page,'explain-bar').count(),0,`${tag} v${d+1}: second Esc stops`);
  }else{
   // Touch: a tap explains, then the report works.
   await tid(page,'attach-file').tap();await wait(page,200);
   eq(await cardId(page),'V02',`${tag} v${d+1}: tap explains`);
   await tid(page,'fb-report').tap();await wait(page,150);
   ok(await tid(page,'fb-note').isVisible(),`${tag} v${d+1}: touch note`);
   await emptySend(page,d,true);
   await tid(page,'fb-note-text').fill('Synthetic');
   ok(await inView(card(page)),`${tag} v${d+1}: touch card in view`);
   ok(await fits(page),`${tag} v${d+1}: touch sideways`);
   await shot(page,d,'note',tag);
   await tid(page,'fb-send').tap();await wait(page,150);
   await afterSend(page,d,tag);
  }
 }
 eq(dests.size,3,`${tag}: the three default views say different destinations`);
 // B: sending what has gathered, from the card's done state.
 await fresh(page,1,'done');
 await (phone?tid(page,'fb-send-now').tap():tid(page,'fb-send-now').click());await wait(page,200);
 const sheet=tid(page,'send-sheet');
 ok(await sheet.isVisible(),`${tag}: B sending opens in one step`);
 ok(await inView(tid(page,'send-github')),`${tag}: Open in GitHub in view`);
 const text=await tid(page,'send-preview').innerText();
 ok(text.includes('(Y05)')&&text.includes('(V02)')&&text.includes('0.42'),`${tag}: preview names cards and version`);
 ok(!text.includes('kotisivu')&&!text.includes('Kirjautumisen')&&!text.includes('X05'),`${tag}: preview holds no conversation, workspace or already sent item`);
 ok((await tid(page,'send-url').innerText()).startsWith('https://github.com/Open-Habitat/open-habitat/issues/new?'),`${tag}: GitHub address`);
 ok(await tid(page,'send-noaccount').isVisible(),`${tag}: no-account line`);
 ok(await fits(page),`${tag}: sheet sideways`);
 await shot(page,1,'send',tag);
 await tid(page,'send-github').click();await wait(page,150);
 eq(await sheet.count(),0,`${tag}: sheet closes`);
 await tid(page,'bar-mine').click();await wait(page,150);
 eq(await page.locator('[data-testid^="fb-mine-"]:not([data-sent])').count(),0,`${tag}: all marked opened in GitHub`);
 ok(await tid(page,'mine-send').isDisabled(),`${tag}: nothing left to send`);
 await shot(page,1,'mine',tag);
 // A and C keep no list.
 for(const d of [0,2]){await pick(page,d);await wait(page,150);ok(await tid(page,'mine-none').isVisible(),`${tag} v${d+1}: no stored list`);}
 await page.locator('#view').selectOption('mode');
 await page.close();
}
// Negative control: with the path off (production), the attach button's card
// is lost to the message field on the way up.
{
 const page=await open(1440,'light','?path=off');
 await fresh(page,0);
 const from=await pointAt(page,'V02');
 const box=await card(page).boundingBox();
 const seen=await path(page,from,{x:box.x+box.width/2,y:box.y+box.height-30});
 ok(seen.includes('V01'),`path off: the field takes the card, as in production (saw ${seen})`);
 await page.close();
}
if(!quick){
 // Keyboard.
 const page=await open(1440,'light');
 for(const d of [0,1,2]){
  await fresh(page,d);
  await page.locator('.ef-stage [data-card="Y04"]').focus();await wait(page,150);
  eq(await cardId(page),'Y04',`keyboard v${d+1}: focus explains`);
  await page.keyboard.press('f');await wait(page,150);
  eq(await page.evaluate(()=>document.activeElement?.dataset.testid),'fb-report',`keyboard v${d+1}: F moves to the report`);
  eq(await cardId(page),'Y04',`keyboard v${d+1}: card held`);
  await page.keyboard.press('Enter');await wait(page,150);
  eq(await page.evaluate(()=>document.activeElement?.dataset.testid),'fb-note-text',`keyboard v${d+1}: Enter opens the note`);
  await page.keyboard.type('Synthetic');
  await page.keyboard.press('Tab');await page.keyboard.press('Enter');await wait(page,150);
  ok(await tid(page,'fb-done').isVisible(),`keyboard v${d+1}: sent`);
  if(d===1){
   eq(await page.evaluate(()=>document.activeElement?.dataset.testid),'fb-send-now','keyboard B: focus on send now');
   await page.keyboard.press('Enter');await wait(page,150);
   ok(await tid(page,'send-sheet').isVisible(),'keyboard B: sending opens');
   await page.keyboard.press('Escape');await wait(page,100);
   eq(await tid(page,'send-sheet').count(),0,'keyboard B: Esc closes the sheet');
   ok(await tid(page,'explain-bar').isVisible(),'keyboard B: the mode stays');
  }
 }
 await page.close();
 // English, High contrast.
 const en=await open(1440,'contrast','?lang=en');
 ok((await tid(en,'fb-report').innerText()).includes('Report a mistake'),'English report');
 ok((await card(en).innerText()).includes('Context'),'English card from production');
 await shot(en,0,'default','1440-contrast-en');
 await en.locator('#scenario').selectOption('note');await wait(en,200);
 await tid(en,'fb-what').click();await wait(en,80);
 ok((await tid(en,'fb-preview').innerText()).includes('Explanation wrong or incomplete'),'English issue title');
 await shot(en,0,'note','1440-contrast-en');
 await en.close();
 const ph=await open(390,'dark','?lang=en');
 await pick(ph,2);await shot(ph,2,'default','390-dark-en');
 ok(await fits(ph),'English phone fits');
 await ph.close();
}
await browser.close();
eq(errors.length,0,`console errors: ${errors.join(' | ')}`);
console.log(`${round}: ${checks} checks passed`);
