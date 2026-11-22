// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// First the round directory: no image or HTML file and nothing over 100 KB.
// Review page (1440 × 900, Päivä and Yö): the three direction lines and the
// recommendation are visible, both phone frames (390 × 844 and 360 × 640) are
// on screen side by side with the menu open inside each; the picker.
// Every direction on both phones (touch), Päivä and Yö: the menu is open on
// load in the direction's shape (A a full-width sheet on the bottom edge, B a
// popover in the drawer, C a page over the whole screen); the items come in
// round 1's A order with an icon in front of each and Selitä's "?" mark; the
// quick rows Teema, Agentin työ, Äänet sit between help and sign out; every
// row is at least 44 px high; everything is inside the window and nothing
// scrolls sideways; A's sheet needs no scrolling even at 360 × 640.
// Interactions once per direction (390 × 844, Päivä): the quick toggles
// (theme changes the page, Agentin työ flips, muting shows the badge and the
// note); dismissal by Back (one history entry per layer), Esc, and the
// direction's own gesture (A: tap above the sheet and swipe it down, B: tap
// outside, C: back arrow and edge swipe), each leaving no stray layer;
// Selitä closes everything and the drawer and shows its stand-in; Palaute
// opens the panel in the direction's shape (A, B sheet with the drawer
// closed under it, C a sub-page), says it is public and what is included,
// nudges on an empty send, previews text and version without the person,
// Back closes it (C back to the account page) and a reopen keeps the draft;
// Kirjaudu ulos opens production's confirmation, Peru closes it (C back to
// the account page), confirming closes everything. At 360 × 640 the feedback
// panel fits and its field is not squeezed. Non-admin once per direction: no
// Palvelimen ylläpito. English once. A clean console.
// Screenshots: d<n>-<what>-<w>x<h>-<theme>.png.
import {createRequire} from 'node:module';
import {dirname,resolve,join,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync,readdirSync,statSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-22-account-menu-phone';
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
const wait=(page,ms=250)=>page.waitForTimeout(ms);
const PHONES=[[390,844],[360,640]];
async function open(w,h,query,phone=true){
 const page=await browser.newPage({viewport:{width:w,height:h},deviceScaleFactor:phone?2:1,hasTouch:phone,isMobile:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto(`http://prototype.test/${query}`);
 await wait(page,900);
 return page;
}
const menu=page=>page.locator('[data-testid="account-menu"]');
const layers=page=>page.locator('[data-testid="layers"]').textContent();
const drawerOpen=page=>page.locator('.ah-mobile-open').count().then(n=>n>0);
const order=page=>menu(page).locator('[data-menu-item]').evaluateAll(els=>els.map(e=>e.getAttribute('data-menu-item')));
const expected=admin=>['settings',...(admin?['administration']:[]),'explain','feedback','logout'];
const SHAPE=['sheet','popover','page'];
// Visible is not enough: the element must be the one a tap at its centre hits.
const onTop=loc=>loc.evaluate(e=>{const r=e.getBoundingClientRect();const hit=document.elementFromPoint(r.left+r.width/2,r.top+Math.min(r.height/2,40));return !!hit&&e.contains(hit);});
const shot=(page,name)=>page.screenshot({path:join(out,`${name}.png`)});
const back=async page=>{await page.evaluate(()=>history.back());await wait(page,400);};
const reopen=async(page,d)=>{
 if(!(await drawerOpen(page))){await page.getByTestId('navigation-open').tap();await wait(page,300);}
 await page.getByTestId('account-menu-trigger').tap();await wait(page,450);
 ok(await menu(page).isVisible(),`d${d}: menu reopens from the person row`);
};
const closed=async(page,label,expect='')=>{
 eq(await menu(page).count(),0,`${label}: menu closed`);
 eq(await layers(page),expect,`${label}: layers left ${expect||'none'}`);
};

async function structure(page,d,admin,label,[w,h]){
 ok(await menu(page).isVisible(),`${label}: menu open on load`);
 ok(await onTop(menu(page)),`${label}: menu on top`);
 eq(await menu(page).getAttribute('data-shape'),SHAPE[d],`${label}: shape`);
 eq((await order(page)).join(','),expected(admin).join(','),`${label}: item order`);
 const leads=await menu(page).locator('[data-menu-item]').evaluateAll(els=>els.map(e=>{const l=e.querySelector('.am-lead'),t=e.querySelector('.am-label');return !!l&&!!t&&l.getBoundingClientRect().right<=t.getBoundingClientRect().left+1;}));
 ok(leads.every(Boolean),`${label}: an icon in front of every item`);
 eq(await menu(page).locator('[data-menu-item="explain"] .ah-explain-q').count(),1,`${label}: Selitä has the top bar's ? mark`);
 eq((await menu(page).locator('[data-quick]').evaluateAll(els=>els.map(e=>e.dataset.quick))).join(','),'theme,work,sounds',`${label}: quick rows in today's order`);
 const q=await menu(page).getByTestId('quick-rows').boundingBox(),f=await menu(page).locator('[data-menu-item="feedback"]').boundingBox(),l=await menu(page).locator('[data-menu-item="logout"]').boundingBox();
 ok(q.y>f.y&&q.y<l.y,`${label}: quick rows between help and sign out`);
 const clear=await menu(page).locator('[data-quick]').evaluateAll(els=>els.map(e=>{const t=e.querySelector('.am-label').getBoundingClientRect(),s=e.querySelector('fieldset').getBoundingClientRect();return t.right<=s.left+1&&e.querySelector('.am-label').scrollWidth<=Math.ceil(t.width)+1;}));
 ok(clear.every(Boolean),`${label}: quick-row names not covered (${clear.join(',')})`);
 const hs=await menu(page).locator('[data-menu-item],[data-quick]').evaluateAll(els=>els.map(e=>Math.round(e.getBoundingClientRect().height)));
 ok(hs.every(x=>x>=44),`${label}: touch-height rows (${hs.join(',')})`);
 ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${label}: no sideways scroll`);
 const b=await menu(page).boundingBox();
 ok(b.y>=-1&&b.y+b.height<=h+1&&b.x>=-1&&b.x+b.width<=w+1,`${label}: menu inside the window`);
 for(const x of await menu(page).locator('[data-menu-item],[data-quick]').all()){const r=await x.boundingBox();ok(r.y+r.height<=h+1,`${label}: row visible without scrolling`);}
 if(d===0){
  ok(Math.abs(b.y+b.height-h)<2&&b.x<=1&&b.width>=w-1,`${label}: sheet on the bottom edge, full width`);
  ok(await page.locator('.am-sheet-body').evaluate(e=>e.scrollHeight<=e.clientHeight+1),`${label}: sheet needs no scrolling`);
 }
 if(d===1)ok(await drawerOpen(page)&&b.x+b.width<=Math.min(316,w-44)+24,`${label}: popover inside the drawer`);
 if(d===2)ok(b.y<=1&&b.height>=h-1&&b.width>=w-1,`${label}: page covers the screen`);
}

async function panel(page,d,label,[w,h]){
 const p=page.getByTestId('feedback-panel');
 ok(await p.isVisible(),`${label}: feedback panel open`);
 ok(await onTop(p),`${label}: panel on top`);
 eq(await p.getAttribute('data-shape'),d===2?'page':'sheet',`${label}: panel shape`);
 const b=await p.boundingBox();
 if(d===2)ok(b.y<=1&&b.height>=h-1,`${label}: panel is a sub-page`);
 else{ok(Math.abs(b.y+b.height-h)<2&&b.width>=w-1,`${label}: panel is a bottom sheet`);ok(!(await drawerOpen(page)),`${label}: drawer closed under the sheet`);}
 ok(b.y>=-1,`${label}: panel inside the window`);
 const ta=await p.getByTestId('feedback-text').boundingBox();
 ok(ta.height>=70,`${label}: field not squeezed (${Math.round(ta.height)})`);
 const text=await p.innerText();
 ok(/julkinen|public/i.test(text),`${label}: says the issue is public`);
 ok(/automaattisesti|automatically/i.test(text),`${label}: says what is included`);
}

const dirs=quick?[0]:[0,1,2];
// Review page.
for(const theme of quick?['light']:['light','dark']){
 for(const d of dirs){
  const page=await open(1440,900,`?v=${d+1}&theme=${theme}`,false);
  const label=`review d${d} ${theme}`;
  eq(await page.getByTestId('direction-lines').locator('li').count(),3,`${label}: three direction lines`);
  ok(await page.getByTestId('recommendation').isVisible(),`${label}: recommendation visible`);
  const frames=page.locator('[data-testid="phone-frame"]');
  eq(await frames.count(),2,`${label}: two phone frames`);
  const a=await page.getByTestId('phone-844').boundingBox(),c=await page.getByTestId('phone-640').boundingBox();
  ok(a.x+a.width<=c.x&&a.y+a.height<=900&&c.y+c.height<=900,`${label}: both phones on screen side by side`);
  await wait(page,800);
  for(const i of [0,1])ok(await page.frameLocator(`[data-testid="phone-frame"] >> nth=${i}`).locator('[data-testid="account-menu"]').isVisible(),`${label}: frame ${i} shows the menu`);
  if(theme==='light'&&d===0)await checkPicker(page,round);
  await shot(page,`d${d}-review-1440-${theme}`);
  await page.close();
 }
}
for(const d of dirs){
 // Structure on both phones.
 for(const theme of quick?['light']:['light','dark']){
  for(const size of PHONES){
   const page=await open(...size,`?bare=1&d=${d}&theme=${theme}`);
   await structure(page,d,true,`d${d} ${theme} ${size.join('x')}`,size);
   await shot(page,`d${d}-menu-${size.join('x')}-${theme}`);
   await page.close();
  }
 }
 {const page=await open(390,844,`?bare=1&d=${d}&admin=0`);
  await structure(page,d,false,`d${d} member`,[390,844]);
  await page.close();}
 // Interactions.
 {const size=[390,844];const page=await open(...size,`?bare=1&d=${d}`);
  const label=`d${d} touch`;
  eq(await layers(page),'menu',`${label}: one layer on load`);
  // Quick toggles.
  await menu(page).getByTestId('theme-choice').getByTestId('segment-dark').tap();await wait(page);
  eq(await page.evaluate(()=>document.documentElement.dataset.theme),'dark',`${label}: theme switch changes the theme`);
  await menu(page).getByTestId('work-choice').getByTestId('segment-visible').tap();await wait(page);
  eq(await menu(page).getByTestId('work-choice').getByTestId('segment-visible').getAttribute('aria-pressed'),'true',`${label}: Agentin työ flips`);
  await menu(page).getByTestId('sound-choice').getByTestId('segment-quiet').tap();await wait(page);
  ok(await menu(page).getByTestId('sound-note').isVisible(),`${label}: muted note`);
  eq(await page.getByTestId('sound-muted-badge').count(),1,`${label}: muted badge on the person row`);
  ok(await menu(page).isVisible(),`${label}: toggles keep the menu open`);
  await shot(page,`d${d}-quick-390x844-dark`);
  // Back.
  await back(page);await closed(page,`${label} Back`);
  ok(await drawerOpen(page),`${label}: Back leaves the drawer open`);
  // Esc.
  await reopen(page,d);await page.keyboard.press('Escape');await wait(page,400);await closed(page,`${label} Esc`);
  // The direction's own gestures.
  if(d===0){
   await reopen(page,d);await page.mouse.click(200,30);await wait(page,400);await closed(page,`${label} tap above the sheet`);
   await reopen(page,d);
   const hb=await page.getByTestId('sheet-head').boundingBox();
   const x=hb.x+hb.width/2,y=hb.y+8;
   await page.mouse.move(x,y);await page.mouse.down();
   for(let i=1;i<=6;i++)await page.mouse.move(x,y+i*30);
   await page.mouse.up();await wait(page,400);await closed(page,`${label} swipe down`);
   await reopen(page,d);
   await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x,y+30);await page.mouse.up();await wait(page,300);
   ok(await menu(page).isVisible(),`${label}: a short drag springs back`);
  }else if(d===1){
   await reopen(page,d);await page.mouse.click(size[0]-8,300);await wait(page,400);await closed(page,`${label} tap outside`);
   await reopen(page,d);
  }else{
   await reopen(page,d);await page.getByTestId('page-back').tap();await wait(page,400);await closed(page,`${label} back arrow`);
   await reopen(page,d);
   await page.mouse.move(4,400);await page.mouse.down();
   for(let i=1;i<=6;i++)await page.mouse.move(4+i*40,400);
   await page.mouse.up();await wait(page,400);await closed(page,`${label} edge swipe`);
   await reopen(page,d);
  }
  // Selitä.
  await menu(page).locator('[data-menu-item="explain"]').tap();await wait(page,500);
  await closed(page,`${label} Selitä`);
  ok(!(await drawerOpen(page)),`${label}: Selitä closes the drawer`);
  ok(await page.getByTestId('toast').isVisible(),`${label}: Selitä stand-in`);
  // Palaute.
  await reopen(page,d);
  await menu(page).locator('[data-menu-item="feedback"]').tap();await wait(page,500);
  await panel(page,d,label,size);
  const p=page.getByTestId('feedback-panel');
  await p.getByTestId('feedback-send').tap();
  ok(await p.getByRole('alert').isVisible(),`${label}: empty send nudges`);
  await p.getByTestId('feedback-text').fill('Puhelimessa valikko on pitkä.');
  await p.getByTestId('feedback-preview-toggle').tap();
  const pre=await p.getByTestId('feedback-preview').innerText();
  ok(pre.includes('Puhelimessa valikko on pitkä.')&&pre.includes('0.0.0-proto')&&!pre.includes('Habitat ·')&&!/aino/i.test(pre),`${label}: preview has text and version, no server or person`);
  await shot(page,`d${d}-feedback-390x844-light`);
  await back(page);
  eq(await page.getByTestId('feedback-panel').count(),0,`${label}: Back closes the panel`);
  if(d===2){eq(await layers(page),'menu',`${label}: Back returns to the account page`);ok(await menu(page).isVisible(),`${label}: account page still open`);}
  else{eq(await layers(page),'',`${label}: Back returns to the conversation`);await reopen(page,d);}
  await menu(page).locator('[data-menu-item="feedback"]').tap();await wait(page,500);
  eq(await page.getByTestId('feedback-text').inputValue(),'Puhelimessa valikko on pitkä.',`${label}: reopen keeps the draft`);
  await page.getByTestId('feedback-send').tap();await wait(page);
  ok(await page.getByTestId('feedback-done').isVisible(),`${label}: done state`);
  await page.getByTestId('feedback-close').tap();await wait(page,400);
  eq(await page.getByTestId('feedback-panel').count(),0,`${label}: close button closes the panel`);
  // Kirjaudu ulos.
  if(d!==2)await reopen(page,d);
  await menu(page).locator('[data-menu-item="logout"]').tap();await wait(page,500);
  ok(await page.getByTestId('logout-dialog').isVisible(),`${label}: sign-out confirmation`);
  ok(await onTop(page.getByTestId('logout-confirm')),`${label}: confirmation on top`);
  await shot(page,`d${d}-logout-390x844-light`);
  await page.getByTestId('cancel').tap();await wait(page,400);
  eq(await page.getByTestId('logout-dialog').count(),0,`${label}: Peru closes it`);
  eq(await layers(page),d===2?'menu':'',`${label}: Peru returns ${d===2?'to the account page':'to the drawer'}`);
  if(d!==2)await reopen(page,d);
  await menu(page).locator('[data-menu-item="logout"]').tap();await wait(page,500);
  await page.getByTestId('logout-confirm').tap();await wait(page,500);
  eq(await layers(page),'',`${label}: confirming closes everything`);
  ok(/ulos|signed out/i.test(await page.getByTestId('toast').innerText()),`${label}: sign-out stand-in`);
  await page.close();}
 // The panel on the small phone.
 {const size=[360,640];const page=await open(...size,`?bare=1&d=${d}&show=feedback`);
  await wait(page,400);
  await panel(page,d,`d${d} 360x640`,size);
  await shot(page,`d${d}-feedback-360x640-light`);
  await page.close();}
}
{const page=await open(390,844,'?bare=1&d=0&lang=en');
 ok((await menu(page).innerText()).includes('Feedback about Habitat…'),'English labels');
 await shot(page,'d0-menu-390x844-en');
 await page.close();}
await browser.close();
const real=errors.filter(e=>!/favicon/.test(e));
eq(real.length,0,`console errors: ${real.join(' | ')}`);
console.log(`ok: ${checks} checks; screenshots in ${out}`);
