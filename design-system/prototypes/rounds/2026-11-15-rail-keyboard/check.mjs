// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Walks the three directions at 1440 (Päivä, Yö, Kontrasti) and 390 (touch,
// Päivä and Yö): each direction's line is marked, the production rail and
// the open conversation are there, the first-use tip shows on a desktop and
// not on touch, and the document does not overflow. Then at 1440 Päivä the
// keys really work, from inside the composer: Suoraan steps the rail order
// and jumps to the waiting ones while focus stays in the field and drafts
// stay with their conversation; Vaihtaja opens with Ctrl+K, swaps back to
// the previous conversation with Enter, filters by typing and returns focus
// on Esc; Selaa moves focus into the rail without opening, browses with
// plain arrows (the review picker does not take them), opens with Enter and
// returns with Esc. Mac and Windows/Linux labels, the Explain card and
// English last. Screenshots at device scale 2 named
// <n>-<direction>-<width>-<theme>.png; --quick takes only 1440 light.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-15-rail-keyboard';
const [input,out,flag]=process.argv.slice(2);
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['suoraan','vaihtaja','selaa'];
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};

async function open(width,theme,kbd='pc'){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:900},deviceScaleFactor:2,reducedMotion:'reduce',hasTouch:phone,isMobile:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto(`http://prototype.test/?kbd=${kbd}`);
 await page.locator('#theme').selectOption(theme);
 return page;
}
const pick=async(page,d)=>{await page.locator('.proto-picker-item').nth(d).click();await page.locator(`.rk-review[data-direction="${d}"]`).waitFor({state:'attached'});await page.waitForTimeout(150);};
const shot=(page,d,tag)=>page.screenshot({path:`${out}/${d+1}-${names[d]}-${tag}.png`});
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const opened=page=>page.evaluate(()=>document.querySelector('.ah-rail a[aria-current="page"]')?.closest('li[data-testid^="agent-item-"]')?.dataset.testid.slice(11));
const order=page=>page.evaluate(()=>[...document.querySelectorAll('.ah-rail li[data-testid^="agent-item-"]')].map(l=>l.dataset.testid.slice(11)));
const focusedRow=page=>page.evaluate(()=>document.activeElement?.closest('.ah-rail li[data-testid^="agent-item-"]')?.dataset.testid.slice(11));
const inField=page=>page.evaluate(()=>document.activeElement?.dataset.testid==='message-input');
const title=page=>page.locator('.ah-agent-header h1, .ah-agent-header [data-testid="agent-title"]').first().textContent();
const direction=page=>page.locator('.rk-review').getAttribute('data-direction');
const field=page=>page.getByTestId('message-input');
const settle=page=>page.waitForTimeout(120);

try{
for(const width of quick?[1440]:[1440,390])for(const theme of quick?['light']:width===390?['light','dark']:['light','dark','contrast']){
 const tag=`${width}-${theme}`;
 const page=await open(width,theme);
 await checkPicker(page,round);
 eq(await page.getByTestId('recommendation').count(),1,'the recommendation is on the page');
 for(let d=0;d<3;d++){
  await pick(page,d);
  const at=`${names[d]} ${tag}`;
  eq(await page.locator('.rk-lines li[aria-current]').count(),1,`${at}: its line is marked`);
  eq(await opened(page),'tiles',`${at}: the open conversation is selected in the rail`);
  eq(await field(page).count(),1,`${at}: the production composer`);
  ok(await page.getByTestId('next-waiting').isVisible(),`${at}: the Meanwhile row`);
  eq(await page.getByTestId('first-use-tip').isVisible(),width!==390,`${at}: the tip on a desktop only`);
  ok(await fits(page),`${at}: document overflow`);
  if(width===390){
   eq(await page.getByTestId('next-key').isVisible(),false,`${at}: no key cap on touch`);
   await shot(page,d,`${tag}-conversation`);
   await page.getByTestId('navigation-open').click();
   await page.waitForTimeout(250);
   ok(await page.locator('[data-testid="rail-yours"]').isVisible(),`${at}: the rail opens from the menu`);
  }
  await shot(page,d,tag);
  if(width===390){await page.keyboard.press('Escape');await page.waitForTimeout(150);}
 }
 await page.close();
}

{
 const page=await open(1440,'light');
 // 1 Suoraan
 await pick(page,0);
 const rail=await order(page);
 eq(rail.slice(0,5).join(','),'notice,a11y,backups,tiles,elevation','rail order: Sinun vuorosi, then Käynnissä by workspace');
 await field(page).click();
 await page.keyboard.press('Alt+ArrowDown');await settle(page);
 eq(await opened(page),'elevation','Suoraan: Alt+↓ opens the next row');
 ok(await inField(page),'Suoraan: focus stays in the field');
 await page.keyboard.type('Luonnos');
 await page.keyboard.press('Alt+ArrowUp');await page.keyboard.press('Alt+ArrowUp');await settle(page);
 eq(await opened(page),'backups','Suoraan: Alt+↑ twice goes up two rows');
 eq(await field(page).inputValue(),'','Suoraan: the draft stays with its conversation');
 await page.keyboard.press('Alt+ArrowDown');await page.keyboard.press('Alt+ArrowDown');await settle(page);
 eq(await field(page).inputValue(),'Luonnos','Suoraan: the draft returns with it');
 await page.keyboard.press('Alt+Shift+ArrowDown');await settle(page);
 eq(await opened(page),'notice','Suoraan: Alt+Shift+↓ goes to the first one waiting for you');
 await page.keyboard.press('Alt+Shift+ArrowDown');await settle(page);
 eq(await opened(page),'a11y','Suoraan: and on to the next one');
 ok((await page.getByTestId('next-key').textContent()).includes('Shift'),'Suoraan: the Meanwhile row names Alt+Shift+↓');
 for(let i=0;i<12;i++)await page.keyboard.press('Alt+ArrowDown');await settle(page);
 eq(await opened(page),rail[rail.length-1],'Suoraan: the end of the rail stops, no wrap');
 eq(await direction(page),'0','Suoraan: the picker kept its direction');
 await shot(page,0,'keys-1440-light');

 // 2 Vaihtaja
 await pick(page,1);
 await field(page).click();
 await page.keyboard.press('Control+KeyK');await settle(page);
 ok(await page.getByTestId('switcher').isVisible(),'Vaihtaja: Ctrl+K opens the switcher');
 ok(await page.evaluate(()=>document.activeElement?.dataset.testid==='switcher-input'),'Vaihtaja: focus in the search');
 eq(await page.locator('[role="option"][aria-selected="true"]').getAttribute('data-testid'),'switcher-option-notice','Vaihtaja: with no previous one, the first other is chosen');
 await shot(page,1,'switcher-1440-light');
 await page.keyboard.press('Enter');await settle(page);
 eq(await opened(page),'notice','Vaihtaja: Enter opens it');
 ok(await inField(page),'Vaihtaja: focus back in the field');
 await page.keyboard.press('Control+KeyK');await settle(page);
 ok((await page.locator('[role="option"][aria-selected="true"]').textContent()).includes('Karttatasojen'),'Vaihtaja: the previous conversation is chosen');
 await page.keyboard.press('Enter');await settle(page);
 eq(await opened(page),'tiles','Vaihtaja: Ctrl+K Enter swaps back');
 await page.keyboard.press('Control+KeyK');await page.keyboard.type('kuit');await settle(page);
 eq(await page.locator('[role="option"]').count(),1,'Vaihtaja: typing filters');
 await shot(page,1,'filter-1440-light');
 await page.keyboard.press('Enter');await settle(page);
 eq(await opened(page),'receipts','Vaihtaja: the match opens');
 await page.keyboard.press('Control+KeyK');await page.keyboard.press('ArrowDown');await page.keyboard.press('Escape');await settle(page);
 eq(await page.getByTestId('switcher').count(),0,'Vaihtaja: Esc closes');
 eq(await opened(page),'receipts','Vaihtaja: Esc changes nothing');
 ok(await inField(page),'Vaihtaja: Esc returns focus to the field');
 await page.keyboard.press('Alt+ArrowDown');await settle(page);
 eq(await opened(page),'notice','Vaihtaja: Alt+↓ stays the next waiting key');

 // 3 Selaa ensin
 await pick(page,2);
 await field(page).click();
 await page.keyboard.press('Alt+ArrowDown');await settle(page);
 eq(await opened(page),'tiles','Selaa: Alt+↓ does not open');
 eq(await focusedRow(page),'elevation','Selaa: focus on the next row');
 ok(await page.getByTestId('rail-mode').isVisible(),'Selaa: the band says the keys');
 await page.keyboard.press('ArrowDown');await settle(page);
 eq(await focusedRow(page),'glossary','Selaa: plain ↓ browses, on into Hiljaiset');
 eq(await direction(page),'2','Selaa: the picker does not take the arrows');
 await shot(page,2,'browse-1440-light');
 await page.keyboard.press('Enter');await settle(page);await page.waitForTimeout(100);
 eq(await opened(page),'glossary','Selaa: Enter opens');
 ok(await inField(page),'Selaa: and returns to the field');
 eq(await page.getByTestId('rail-mode').count(),0,'Selaa: the band goes');
 await page.keyboard.press('Alt+ArrowUp');await page.keyboard.press('ArrowUp');await page.keyboard.press('Escape');await settle(page);
 eq(await opened(page),'glossary','Selaa: Esc opens nothing');
 ok(await inField(page),'Selaa: Esc returns to the field');
 await page.keyboard.press('Alt+Shift+ArrowDown');await settle(page);
 eq(await opened(page),'notice','Selaa: Alt+Shift+↓ opens the next waiting');

 // Labels, Explain, English.
 await page.locator('#keyboard').selectOption('mac');await settle(page);
 ok((await page.locator('.rk-lines li[aria-current]').textContent()).includes('⌥↓'),'Mac labels use ⌥');
 await pick(page,1);
 ok((await page.locator('.rk-lines li[aria-current]').textContent()).includes('⌘K'),'Mac labels use ⌘');
 await page.locator('#keyboard').selectOption('pc');await settle(page);
 ok((await page.locator('.rk-lines li[aria-current]').textContent()).includes('Ctrl+K'),'Windows/Linux labels use Ctrl+');
 await page.locator('#explain').check();await settle(page);
 for(let d=0;d<3;d++){await pick(page,d);ok(await page.getByTestId('explain-card').isVisible(),`${names[d]}: the Explain card`);await shot(page,d,'explain-1440-light');}
 await page.locator('#explain').uncheck();
 await page.getByTestId('tip-ok').click();
 eq(await page.getByTestId('first-use-tip').count(),0,'the tip closes');
 await page.close();

 const mac=await open(1440,'dark','mac');
 await pick(mac,0);
 await shot(mac,0,'mac-1440-dark');
 await mac.close();
 const en=await open(1440,'light');
 await en.locator('#language').selectOption('en');
 await pick(en,0);
 ok((await en.locator('[data-testid="rail-yours"] h2').textContent()).includes('Your turn'),'English: production heading');
 ok((await en.getByTestId('first-use-tip').textContent()).includes('waiting for you'),'English: the tip');
 await shot(en,0,'en-1440-light');
 await pick(en,1);
 await field(en).click();await en.keyboard.press('Control+KeyK');await settle(en);
 await shot(en,1,'en-switcher-1440-light');
 await en.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[],'console errors');
console.log(`${checks} checks passed`);
