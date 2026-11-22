// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// First the round directory: no image or HTML file and nothing over 100 KB.
// Desktop (1440 × 900, Päivä and Yö, mouse), every direction: the menu is
// open on load over the shell with the phone frame beside it; the action
// items come in the direction's order (Asetukset and Palvelimen ylläpito
// together, then Selitä and Palaute), every item has its icon in front of the
// label and Selitä's icon is the top bar's "?"; A has the named quick rows
// below the actions, B has none of them and a checkable Hiljaa item, C has
// the icon row above the actions; Kirjaudu ulos is last. Non-admin once per
// direction: no Palvelimen ylläpito. Keyboard once per direction: Enter on
// the account button opens the menu with focus on the first item, the arrow
// keys reach Palaute, Enter opens the feedback panel with its field
// focused, Esc closes it and gives focus back to the account button. The
// panel: says it is a public GitHub issue and what is included
// automatically, an empty send nudges, the preview shows the text and the
// version and not the server name, sending shows the done state. Quick
// choices change: the theme switch changes the page theme, muting shows the
// badge on the account button. English once. Phone (390 × 844, touch, Päivä
// and Yö) every direction: the menu is a sheet on the bottom edge, rows are
// at least 44 px high, no sideways scroll, Palaute opens the panel as a sheet.
// The picker; a clean console.
// Screenshots: d<n>-<what>-<width>-<theme>.png.
import {createRequire} from 'node:module';
import {dirname,resolve,join,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync,readdirSync,statSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-22-account-menu';
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
async function open(width,query){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:900},deviceScaleFactor:phone?2:1,hasTouch:phone,isMobile:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto(`http://prototype.test/${query}`);
 await wait(page,700);
 return page;
}
const scope=page=>page.locator('[data-testid="desktop-stage"]').count().then(n=>n?page.locator('[data-testid="desktop-stage"]'):page.locator('body'));
const menu=page=>page.locator('[data-testid="account-menu"]');
const order=page=>menu(page).locator('[data-menu-item]').evaluateAll(els=>els.map(e=>e.getAttribute('data-menu-item')));
const expected=(d,admin)=>['settings',...(admin?['administration']:[]),'explain','feedback','logout'];
const shot=(page,name)=>page.screenshot({path:join(out,`${name}.png`)});

async function structure(page,d,admin,label){
 ok(await menu(page).isVisible(),`${label}: menu open on load`);
 eq((await order(page)).join(','),expected(d,admin).join(','),`${label}: item order`);
 // Every item: the icon first, then the label.
 const leads=await menu(page).locator('[data-menu-item]').evaluateAll(els=>els.map(e=>{const l=e.querySelector('.am-lead'),t=e.querySelector('.am-label');return !!l&&!!t&&l.getBoundingClientRect().right<=t.getBoundingClientRect().left+1;}));
 ok(leads.every(Boolean),`${label}: an icon in front of every item`);
 ok(await menu(page).locator('[data-menu-item="explain"] .am-lead .ah-explain-q').count()===1,`${label}: Selitä has the top bar's ? mark`);
 const quickRows=await menu(page).locator('[data-testid="quick-rows"]').count();
 const icons=await menu(page).locator('[data-testid="quick-icons"]').count();
 const mute=await menu(page).locator('[data-testid="menu-mute"]').count();
 eq(quickRows,d===0?1:0,`${label}: quick rows only in A`);
 eq(icons,d===2?1:0,`${label}: icon row only in C`);
 eq(mute,d===1?1:0,`${label}: Hiljaa item only in B`);
 if(d===1)eq(await menu(page).locator('[data-testid="theme-choice"]').count(),0,`${label}: B has no theme in the menu`);
 if(d===0){
  const q=await menu(page).locator('[data-testid="quick-rows"]').boundingBox();
  const f=await menu(page).locator('[data-menu-item="feedback"]').boundingBox();
  const l=await menu(page).locator('[data-menu-item="logout"]').boundingBox();
  ok(q.y>f.y&&q.y<l.y,`${label}: A's quick rows between help and sign out`);
 }
 if(d===2){
  const q=await menu(page).locator('[data-testid="quick-icons"]').boundingBox();
  const s=await menu(page).locator('[data-menu-item="settings"]').boundingBox();
  ok(q.y<s.y,`${label}: C's icon row above the actions`);
 }
 // The menu fits the window.
 const b=await menu(page).boundingBox();const vw=await page.evaluate(()=>innerWidth),vh=await page.evaluate(()=>innerHeight);
 ok(b.y>=0&&b.y+b.height<=vh+1&&b.x+b.width<=vw+1,`${label}: menu inside the window`);
}

async function panelChecks(page,label,phone){
 const p=page.locator('[data-testid="feedback-panel"]');
 ok(await p.isVisible(),`${label}: feedback panel open`);
 const text=await p.innerText();
 ok(/julkinen|public/i.test(text),`${label}: panel says the issue is public`);
 ok(/automaattisesti|automatically/i.test(text),`${label}: panel says what is included`);
 if(phone){
  const b=await p.boundingBox();const vh=await page.evaluate(()=>innerHeight);
  ok(Math.abs(b.y+b.height-vh)<2&&b.width>=388,`${label}: panel is a bottom sheet`);
 }else ok(await page.evaluate(()=>document.activeElement?.getAttribute('data-testid'))==='feedback-text',`${label}: field focused`);
 await p.getByTestId('feedback-send').click();
 ok(await p.getByRole('alert').isVisible(),`${label}: empty send nudges`);
 await p.getByTestId('feedback-text').fill('Puhelimessa valikko on pitkä.');
 await p.getByTestId('feedback-preview-toggle').click();
 const pre=await p.getByTestId('feedback-preview').innerText();
 ok(pre.includes('Puhelimessa valikko on pitkä.')&&pre.includes('0.0.0-proto')&&!pre.includes('Habitat ·')&&!/aino/i.test(pre),`${label}: preview has the text and version, no server or person`);
}

const dirs=quick?[0]:[0,1,2];
for(const d of dirs){
 for(const theme of quick?['light']:['light','dark']){
  const page=await open(1440,`?v=${d+1}&theme=${theme}`);
  const label=`d${d} ${theme} desktop`;
  await structure(page,d,true,label);
  ok(await page.getByTestId('phone-frame').isVisible(),`${label}: phone frame beside the shell`);
  await wait(page,600);
  await shot(page,`d${d}-menu-1440-${theme}`);
  if(theme==='light'&&d===0)await checkPicker(page,round);
  // The phone frame's own menu is open too.
  const frame=page.frameLocator('[data-testid="phone-frame"]');
  ok(await frame.locator('[data-testid="account-menu"]').isVisible(),`${label}: phone frame shows the menu`);
  await page.close();
 }
 // Non-admin.
 {const page=await open(1440,`?v=${d+1}&admin=0&device=desktop`);
  await structure(page,d,false,`d${d} member`);
  await shot(page,`d${d}-member-1440-light`);
  await page.close();}
 // Keyboard and the panel.
 {const page=await open(1440,`?v=${d+1}&device=desktop`);
  const label=`d${d} keyboard`;
  await page.keyboard.press('Escape');await wait(page);
  ok(!(await menu(page).count()),`${label}: Esc closes the menu`);
  const trig=page.getByTestId('account-menu-trigger');
  await trig.focus();await page.keyboard.press('Enter');await wait(page,400);
  eq(await page.evaluate(()=>document.activeElement?.getAttribute('data-menu-item')),'settings',`${label}: focus on the first item`);
  for(let i=0;i<8;i++){
   if(await page.evaluate(()=>document.activeElement?.getAttribute('data-menu-item'))==='feedback')break;
   await page.keyboard.press('ArrowDown');await wait(page,60);
  }
  eq(await page.evaluate(()=>document.activeElement?.getAttribute('data-menu-item')),'feedback',`${label}: arrows reach Palaute`);
  await page.keyboard.press('Enter');await wait(page,400);
  await panelChecks(page,label,false);
  await shot(page,`d${d}-feedback-1440-light`);
  await page.getByTestId('feedback-send').click();await wait(page);
  ok(await page.getByTestId('feedback-done').isVisible(),`${label}: done state`);
  await page.keyboard.press('Escape');await wait(page,300);
  ok(!(await page.getByTestId('feedback-panel').count()),`${label}: Esc closes the panel`);
  eq(await page.evaluate(()=>document.activeElement?.getAttribute('data-testid')),'account-menu-trigger',`${label}: focus back on the account button`);
  // Quick choices.
  await trig.click();await wait(page,400);
  if(d===0){
   await menu(page).getByTestId('theme-choice').getByTestId('segment-dark').click();await wait(page);
   eq(await page.evaluate(()=>document.documentElement.dataset.theme),'dark',`${label}: theme switch changes the theme`);
   await menu(page).getByTestId('sound-choice').getByTestId('segment-quiet').click();
  }else if(d===1){
   await menu(page).getByTestId('menu-mute').click();
   eq(await menu(page).getByTestId('menu-mute').getAttribute('aria-checked'),'true',`${label}: Hiljaa is checked`);
  }else{
   await menu(page).getByTestId('theme-choice').getByTestId('segment-dark').click();await wait(page);
   eq(await page.evaluate(()=>document.documentElement.dataset.theme),'dark',`${label}: theme switch changes the theme`);
   await menu(page).getByTestId('sound-toggle').click();
   eq(await menu(page).getByTestId('sound-toggle').getAttribute('aria-pressed'),'true',`${label}: sound toggle pressed`);
  }
  await wait(page);
  ok(await page.getByTestId('sound-muted-badge').isVisible(),`${label}: muted badge on the account button`);
  await shot(page,`d${d}-quick-1440-dark`);
  await page.close();}
 // Phone.
 for(const theme of quick?['light']:['light','dark']){
  const page=await open(390,`?bare=1&d=${d}&theme=${theme}`);
  const label=`d${d} ${theme} phone`;
  await wait(page,500);
  await structure(page,d,true,label);
  const b=await menu(page).boundingBox();
  ok(Math.abs(b.y+b.height-844)<2&&b.x<=1&&b.width>=388,`${label}: menu is a bottom sheet`);
  const hs=await menu(page).locator('[data-menu-item]').evaluateAll(els=>els.map(e=>e.getBoundingClientRect().height));
  ok(hs.every(h=>h>=43.5),`${label}: touch-height items (${hs.join(',')})`);
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${label}: no sideways scroll`);
  await shot(page,`d${d}-menu-390-${theme}`);
  if(theme==='light'){
   await menu(page).locator('[data-menu-item="feedback"]').tap();await wait(page,500);
   await panelChecks(page,label,true);
   await shot(page,`d${d}-feedback-390-light`);
  }
  await page.close();
 }
}
// English once.
{const page=await open(1440,'?v=1&lang=en&device=desktop');
 ok((await menu(page).innerText()).includes('Feedback about Habitat…'),'English labels');
 await shot(page,'d0-menu-1440-en');
 await page.close();}
await browser.close();
const real=errors.filter(e=>!/favicon/.test(e));
eq(real.length,0,`console errors: ${real.join(' | ')}`);
console.log(`ok: ${checks} checks; screenshots in ${out}`);
