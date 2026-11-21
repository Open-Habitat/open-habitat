// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// First the round directory: no image or HTML file and nothing over 100 KB.
// Desktop (1440 px, Päivä and Yö, mouse): each direction's default card is
// in view and shows its own way of holding (A the footer, B the pin, C the
// settled footer). Scripted pointer paths, sampled every step: from the
// context ring (card below) and from the attach button (card above, the path
// crossing the message field) straight to the footer's "Something missing";
// the card never changes on the way, the choice opens the note, and saving
// thanks. A negative control shows the hazard is real: in B, unpinned, the
// same path from the attach button loses the card to the message field, as
// production does. A keeps switching at once to a neighbour; a settled C
// card ignores a quick pass and gives way after a rest. An open note with
// text survives a click elsewhere (nudge) and Esc; a second Esc stops the
// mode. Keyboard once: a focused part explains itself, F moves into the
// footer, Tab/Enter save, the thanks link opens sending. Sending: the sheet
// shows the full prefilled issue (card name and id, choice, note, version;
// no conversation or workspace name), the GitHub address it opens, the
// no-account line; opening marks the items in "Your feedback". Phone
// (390 px, touch): a tap explains, A's footer, B's "Give feedback", C's
// choices work, the card is in view, no sideways scroll. English and High
// contrast once, the picker, a clean console.
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
const round='2026-11-21-explain-feedback-2';
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
const names=['kulkureitti','nasta','asettuminen'];
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
async function pointAt(page,part,d){
 const c=await center(page.locator(`.ef-stage [data-card="${part}"]`));
 await page.mouse.move(c.x-6,c.y);await page.mouse.move(c.x,c.y,{steps:3});await wait(page,d===2?350:80);
 eq(await cardId(page),part,`pointing ${part} shows its card`);
 if(d===2){await wait(page,750);ok(await card(page).getAttribute('data-settled')!==null,'C settles after a rest');}
 return c;
}
/** Part → footer in each direction; returns the cards seen on the way. */
async function reachFooter(page,d,part){
 let from=await pointAt(page,part,d);
 if(d===1){
  const pin=await center(tid(page,'fb-pin'));
  const seen=await path(page,from,pin,6);
  eq(seen.join(),part,`B: on the way to the pin the card stays ${part} (saw ${seen})`);
  await page.mouse.click(pin.x,pin.y);await wait(page,150);
  eq(await tid(page,'fb-pin').getAttribute('aria-pressed'),'true','B: pin pressed');
  from=pin;
 }
 const target=await center(tid(page,'fb-missing'));
 const seen=await path(page,from,target);
 eq(seen.join(),part,`v${d+1}: ${part} → footer keeps the card (saw ${seen})`);
 await page.mouse.click(target.x,target.y);await wait(page,150);
 ok(await tid(page,'fb-note').isVisible(),`v${d+1}: ${part} footer choice opens the note`);
}

const widths=quick?[1440]:[1440,390];
const themes=quick?['light']:['light','dark'];
for(const width of widths)for(const theme of themes){
 const tag=`${width}-${theme}`;
 const page=await open(width,theme);
 const phone=width===390;
 if(width===1440&&theme==='light')await checkPicker(page,round);
 for(let d=0;d<3;d++){
  await fresh(page,d);
  ok(await fits(page),`${tag} v${d+1}: sideways scroll`);
  eq(await tid(page,'direction-lines').locator('li').count(),3,'three direction lines');
  eq(await cardId(page),'Y05',`${tag} v${d+1}: default card`);
  ok(await inView(card(page)),`${tag} v${d+1}: card outside viewport`);
  if(!phone){
   eq(await tid(page,'fb-choices').count(),d===1?0:1,`${tag} v${d+1}: footer at start`);
   eq(await tid(page,'fb-pin').count(),d===1?1:0,`${tag} v${d+1}: pin only in B`);
   eq(await card(page).evaluate(e=>getComputedStyle(e).pointerEvents),d===2?'auto':'none',`${tag} v${d+1}: card lets the pointer through until held`);
  }
  await shot(page,d,'default',tag);
  if(!phone){
   // Header part, card below.
   await reachFooter(page,d,'Y05');
   await shot(page,d,'note',tag);
   await tid(page,'fb-note-text').fill('Synthetic note');
   // A click elsewhere keeps what was typed.
   const dot=await center(page.locator('.ef-stage [data-card="Y03"]'));
   await page.mouse.click(dot.x,dot.y);await wait(page,150);
   eq(await cardId(page),'Y05',`${tag} v${d+1}: open note survives a click elsewhere`);
   ok(await tid(page,'fb-nudge').isVisible(),`${tag} v${d+1}: nudge`);
   eq(await tid(page,'fb-note-text').inputValue(),'Synthetic note','note kept');
   await tid(page,'fb-save').click();await wait(page,150);
   ok(await tid(page,'fb-thanks').isVisible(),`${tag} v${d+1}: thanks`);
   await shot(page,d,'thanks',tag);
   // Composer part, card above, the path crossing the message field.
   await page.mouse.move(400,300);await wait(page,(d===2?400:100));
   await reachFooter(page,d,'V02');
   await tid(page,'fb-cancel').click();await wait(page,100);
   if(d===1){
    // Negative control: unpinned, B is production, and the field takes the card.
    await page.mouse.move(400,300);await wait(page,100);
    const from=await pointAt(page,'V02',1);
    const box=await card(page).boundingBox();
    const seen=await path(page,from,{x:box.x+box.width/2,y:box.y+box.height-30});
    ok(seen.includes('V01'),`${tag} B unpinned: the path loses the card to the field, as in production (saw ${seen})`);
   }
   if(d===0){
    await page.mouse.move(400,300);await wait(page,100);
    const from=await pointAt(page,'Y05',0);
    const to=await center(page.locator('.ef-stage [data-card="Y06"]'));
    await page.mouse.move(to.x,to.y,{steps:4});await wait(page,80);
    eq(await cardId(page),'Y06',`${tag} A: a neighbour still takes the card at once`);
   }
   if(d===2){
    await page.mouse.move(400,300);await wait(page,100);
    const from=await pointAt(page,'Y05',2);
    const y4=await center(page.locator('.ef-stage [data-card="Y04"]'));
    await page.mouse.move(y4.x,y4.y,{steps:2});await wait(page,60);
    await page.mouse.move(from.x,from.y+60,{steps:2});await wait(page,300);
    eq(await cardId(page),'Y05',`${tag} C: a quick pass does not take a settled card`);
    await page.mouse.move(y4.x,y4.y,{steps:3});await wait(page,450);
    eq(await cardId(page),'Y04',`${tag} C: a rest does`);
   }
   // Esc cancels an open note, a second Esc stops the mode.
   await fresh(page,d,'note');
   ok(await tid(page,'fb-note').isVisible(),`${tag} v${d+1}: note scenario`);
   await page.keyboard.press('Escape');await wait(page,100);
   eq(await tid(page,'fb-note').count(),0,`${tag} v${d+1}: Esc cancels feedback`);
   eq(await cardId(page),'Y05','card stays after Esc');
   await page.keyboard.press('Escape');await wait(page,100);
   eq(await tid(page,'explain-bar').count(),0,`${tag} v${d+1}: second Esc stops`);
  }else{
   // Touch: a tap explains, then the footer works.
   await tid(page,'attach-file').tap();await wait(page,200);
   eq(await cardId(page),'V02',`${tag} v${d+1}: tap explains`);
   if(d===1){eq(await tid(page,'fb-choices').count(),0,'B touch: choices wait');await tid(page,'fb-pin-touch').tap();await wait(page,150);}
   await tid(page,'fb-wrong').tap();await wait(page,150);
   ok(await tid(page,'fb-note').isVisible(),`${tag} v${d+1}: touch note`);
   ok(await inView(card(page)),`${tag} v${d+1}: touch card in view`);
   ok(await fits(page),`${tag} v${d+1}: touch sideways`);
   await shot(page,d,'note',tag);
   await tid(page,'fb-save').tap();await wait(page,150);
   ok(await tid(page,'fb-thanks').isVisible(),`${tag} v${d+1}: touch thanks`);
  }
 }
 // Sending, from a card's thanks.
 await fresh(page,0,'thanks');
 await (phone?tid(page,'fb-send-now').tap():tid(page,'fb-send-now').click());await wait(page,200);
 const sheet=tid(page,'send-sheet');
 ok(await sheet.isVisible(),`${tag}: sending opens in one step`);
 ok(await inView(tid(page,'send-github')),`${tag}: Open in GitHub in view`);
 const text=await tid(page,'send-preview').innerText();
 ok(text.includes('(Y05)')&&text.includes('(V02)')&&text.includes('0.42'),`${tag}: preview names cards and version`);
 ok(!text.includes('kotisivu')&&!text.includes('Kirjautumisen')&&!text.includes('X05'),`${tag}: preview holds no conversation, workspace or already sent item`);
 ok((await tid(page,'send-url').innerText()).startsWith('https://github.com/Open-Habitat/open-habitat/issues/new?'),`${tag}: GitHub address`);
 ok(await tid(page,'send-noaccount').isVisible(),`${tag}: no-account line`);
 ok(await fits(page),`${tag}: sheet sideways`);
 await shot(page,0,'send',tag);
 await tid(page,'send-github').click();await wait(page,150);
 eq(await sheet.count(),0,`${tag}: sheet closes`);
 ok(await tid(page,'rq-toast').isVisible(),`${tag}: toast`);
 await tid(page,'bar-mine').click();await wait(page,150);
 eq(await page.locator('[data-testid^="fb-mine-"]:not([data-sent])').count(),0,`${tag}: all marked opened in GitHub`);
 ok(await tid(page,'mine-send').isDisabled(),`${tag}: nothing left to send`);
 await shot(page,0,'mine',tag);
 await page.locator('#view').selectOption('mode');
 await page.close();
}
if(!quick){
 // Keyboard.
 const page=await open(1440,'light');
 await fresh(page,0);
 await page.locator('.ef-stage [data-card="Y04"]').focus();await wait(page,150);
 eq(await cardId(page),'Y04','keyboard: focus explains');
 await page.keyboard.press('f');await wait(page,150);
 eq(await page.evaluate(()=>document.activeElement?.dataset.testid),'fb-helped','keyboard: F moves into the footer');
 eq(await cardId(page),'Y04','keyboard: card held');
 await page.keyboard.press('Tab');await page.keyboard.press('Enter');await wait(page,150);
 ok(await tid(page,'fb-note').isVisible(),'keyboard: Enter opens the note');
 eq(await page.evaluate(()=>document.activeElement?.dataset.testid),'fb-note-text','keyboard: the note takes focus');await page.keyboard.type('Synthetic');
 await page.keyboard.press('Tab');await page.keyboard.press('Enter');await wait(page,150);
 ok(await tid(page,'fb-thanks').isVisible(),'keyboard: saved');
 eq(await page.evaluate(()=>document.activeElement?.dataset.testid),'fb-send-now','keyboard: focus on send');
 await page.keyboard.press('Enter');await wait(page,150);
 ok(await tid(page,'send-sheet').isVisible(),'keyboard: sending opens');
 await page.keyboard.press('Escape');await wait(page,100);
 eq(await tid(page,'send-sheet').count(),0,'keyboard: Esc closes the sheet');
 ok(await tid(page,'explain-bar').isVisible(),'keyboard: the mode stays');
 for(const d of [1,2]){
  await fresh(page,d);
  await page.locator('.ef-stage [data-card="Y06"]').focus();await wait(page,150);
  await page.keyboard.press('f');await wait(page,150);
  eq(await page.evaluate(()=>document.activeElement?.dataset.testid),'fb-helped',`keyboard v${d+1}: F`);
 }
 await page.close();
 // English, High contrast.
 const en=await open(1440,'contrast','?lang=en');
 ok((await tid(en,'fb-choices').innerText()).includes('Something missing'),'English choices');
 ok((await card(en).innerText()).includes('Context'),'English card from production');
 await shot(en,0,'default','1440-contrast-en');
 await tid(en,'bar-mine').click();await tid(en,'mine-send').click();await wait(en,150);
 ok((await tid(en,'send-title').innerText()).includes('Explain mode feedback'),'English issue');
 ok((await tid(en,'send-noaccount').innerText()).includes('No GitHub account'),'English no-account');
 await shot(en,0,'send','1440-contrast-en');
 await en.close();
 const ph=await open(390,'dark','?lang=en');
 await pick(ph,1);await shot(ph,1,'default','390-dark-en');
 ok(await fits(ph),'English phone fits');
 await ph.close();
}
await browser.close();
eq(errors.length,0,`console errors: ${errors.join(' | ')}`);
console.log(`${round}: ${checks} checks passed`);
