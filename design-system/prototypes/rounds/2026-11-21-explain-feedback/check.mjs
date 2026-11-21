// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// First the round directory: no image or HTML file and nothing over 100 KB.
// Then each direction at 1440 and 390 px in Päivä and Yö (Korkea kontrasti
// once): the default view ("Palaute auki") differs visibly — A shows the
// form inside the card at the context ring, B the bar's Feedback sheet with
// the card chosen, C the end sheet listing the seen cards — the page does
// not scroll sideways, and the open feedback lies inside the viewport. Flows
// at both widths: A saves a note and says thanks, a "Helped" press saves at
// once; B picks a card, a choice and saves, and the bar counts it; C marks
// and saves on Stop, and "Stop without answering" saves nothing. Every saved
// item appears in "Where feedback goes", whose prefilled text names only the
// card, the choice and the note. English once, the picker, a clean console.
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
const round='2026-11-21-explain-feedback';
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
const names=['kortti','palkki','lopuksi'];
const settle=(page,ms=300)=>page.waitForTimeout(ms);
const tid=(page,id)=>page.getByTestId(id);
async function open(width,theme,query=''){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:900},deviceScaleFactor:phone?2:1,hasTouch:phone,isMobile:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto(`http://prototype.test/${query}`);
 await settle(page,500);
 await page.locator('#theme').selectOption(theme);
 await settle(page);
 return page;
}
const pick=async(page,d)=>{await page.locator('.proto-picker-item').nth(d).click();await page.locator(`.rq-review[data-direction="${d}"]`).waitFor({state:'attached'});await settle(page,500);};
const sel=async(page,id,v)=>{await page.locator(`#${id}`).selectOption(v);await settle(page,400);};
const shot=(page,d,what,tag)=>page.screenshot({path:`${out}/v${d+1}-${names[d]}-${what}-${tag}.png`});
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const inView=async loc=>{const b=await loc.boundingBox();const vp=loc.page().viewportSize();return b&&b.x>=0&&b.y>=0&&b.x+b.width<=vp.width+0.5&&b.y+b.height<=vp.height+0.5;};
const press=async(page,id)=>{const l=tid(page,id);await l.scrollIntoViewIfNeeded();await l.click();await settle(page);};
const mineCount=async page=>{await sel(page,'view','where');const n=await page.locator('[data-testid^="fb-mine-"]').count();return n;};

const widths=quick?[1440]:[1440,390];
const themes=quick?['light']:['light','dark'];
for(const width of widths)for(const theme of themes){
 const tag=`${width}-${theme}`;
 const page=await open(width,theme);
 if(width===1440&&theme==='light')await checkPicker(page,round);
 for(let d=0;d<3;d++){
  await pick(page,d);
  ok(await fits(page),`${tag} v${d+1}: sideways scroll`);
  eq(await tid(page,'direction-lines').locator('li').count(),3,'three direction lines');
  // The default view: each direction shows its own feedback moment.
  const own=[tid(page,'fb-card-note'),tid(page,'fb-bar-sheet'),tid(page,'fb-end')][d];
  ok(await own.isVisible(),`${tag} v${d+1}: default feedback not open`);
  ok(await inView(own),`${tag} v${d+1}: feedback outside viewport`);
  for(const [i,other] of [tid(page,'fb-card-note'),tid(page,'fb-bar-sheet'),tid(page,'fb-end')].entries())if(i!==d)eq(await other.count(),0,`${tag} v${d+1}: shows direction ${i+1}'s feedback`);
  if(d===0){
   eq(await tid(page,'explain-card').getAttribute('data-card'),'Y05','A explains the context ring');
   eq(await tid(page,'fb-card-missing').getAttribute('aria-checked'),'true','A: missing chosen');
  }
  if(d===1){eq(await tid(page,'fb-which-Y05').getAttribute('aria-checked'),'true','B: latest card chosen');eq(await tid(page,'explain-card').count(),0,'B: no card under the sheet');}
  if(d===2)eq(await page.locator('[data-testid^="fb-end-"][data-testid$="-helped"]').count(),4,'C lists four seen cards');
  await shot(page,d,'default',tag);
  // Flows.
  if(d===0){
   await press(page,'fb-card-note-save');
   ok(await tid(page,'fb-thanks').isVisible(),`${tag} A: thanks after save`);
   await shot(page,d,'saved',tag);
   await sel(page,'scenario','pointing');
   await pick(page,0);
   ok(await tid(page,'fb-card').isVisible(),`${tag} A: choices on the card`);
   await shot(page,d,'pointing',tag);
   await press(page,'fb-card-helped');
   ok(await tid(page,'fb-thanks').isVisible(),`${tag} A: helped saves at once`);
   await press(page,'where-link');
   ok(await tid(page,'where-panel').isVisible(),'A: link opens the destination');
   const row=tid(page,'fb-mine-Y05');eq(await row.getAttribute('data-choice'),'helped','A: helped kept');
   await sel(page,'view','mode');await sel(page,'scenario','giving');
  }
  if(d===1){
   await press(page,'fb-which-Y04');
   await press(page,'fb-bar-wrong');
   await tid(page,'fb-bar-note-text').fill('Synthetic note');
   await press(page,'fb-bar-note-save');
   eq(await tid(page,'fb-bar-sheet').count(),0,`${tag} B: sheet closes`);
   ok((await tid(page,'fb-bar-button').innerText()).includes('1'),`${tag} B: bar counts the feedback`);
   ok(await tid(page,'rq-toast').isVisible(),`${tag} B: toast`);
   await shot(page,d,'saved',tag);
   eq(await mineCount(page),3,`${tag} B: saved item listed`);
   eq(await tid(page,'fb-mine-Y04').getAttribute('data-choice'),'wrong','B: wrong on Git');
   await sel(page,'view','mode');
   await sel(page,'scenario','giving');await pick(page,1);
  }
  if(d===2){
   await press(page,'fb-end-Y04-wrong');
   await press(page,'fb-end-save');
   eq(await tid(page,'fb-end').count(),0,`${tag} C: sheet closes`);
   eq(await tid(page,'explain-bar').count(),0,`${tag} C: mode ends`);
   ok((await tid(page,'rq-toast').innerText()).match(/3/),`${tag} C: three saved`);
   await shot(page,d,'saved',tag);
   eq(await mineCount(page),5,`${tag} C: two seeds and three new`);
   await sel(page,'view','mode');await sel(page,'scenario','giving');await pick(page,2);
   await press(page,'fb-end-skip');
   eq(await tid(page,'explain-bar').count(),0,`${tag} C: skip ends the mode`);
   eq(await mineCount(page),2,`${tag} C: skip saves nothing`);
   await sel(page,'view','mode');
  }
 }
 // The destination panel.
 await pick(page,0);
 await sel(page,'view','where');
 for(const id of ['fb-mine','fb-send','fb-compare','fb-never','fb-dest-own','fb-dest-admin','fb-dest-agent'])ok(await tid(page,id).isVisible(),`${tag}: ${id} missing`);
 ok(await fits(page),`${tag}: panel scrolls sideways`);
 await press(page,'fb-send-open');
 const text=await tid(page,'fb-issue-preview').innerText();
 ok(text.includes('(V02)')&&text.includes('(X05)')&&!text.includes('kotisivu')&&!text.includes('Kirjautumisen'),`${tag}: prefilled text carries only card, choice and note`);
 await shot(page,0,'where',tag);
 await page.close();
}
if(!quick){
 const page=await open(1440,'contrast','?lang=en');
 ok((await tid(page,'fb-card').innerText()).includes('Something missing'),'English choices');
 ok((await tid(page,'explain-card').innerText()).includes('Context'),'English card from production');
 await shot(page,0,'default','1440-contrast-en');
 await sel(page,'view','where');
 await press(page,'fb-send-open');
 ok((await tid(page,'fb-issue-preview').innerText()).includes('Explain mode feedback'),'English issue text');
 await shot(page,0,'where','1440-contrast-en');
 const phone=await open(390,'dark','?lang=en');
 await pick(phone,2);await shot(phone,2,'default','390-dark-en');
 await pick(phone,1);await shot(phone,1,'default','390-dark-en');
 ok(await fits(phone),'English phone fits');
 await page.close();await phone.close();
}
await browser.close();
eq(errors.length,0,`console errors: ${errors.join(' | ')}`);
console.log(`${round}: ${checks} checks passed`);
