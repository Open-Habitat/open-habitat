// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. For
// each riff, at 1440 px and 390 px (touch), light and dark, device scale
// factor 2, named r3-<riff>-<step>-<width>-<theme>:
//   0-oletus     the default view: on desktop the PDF open beside and the
//                public view drawn hovered; on a phone nothing open and the
//                riff's touch state (A icons, B the long-pressed bar, C marks);
//   0-kortit     a tall window with all six cards and nothing open;
//   1-nakyma … 5-kansio  each kind opened from its card;
//   6-hover      the pointer on the CSV card (desktop); 6-kosketus on a phone:
//                A the icons, B a long press, C the open panel's top bar;
//   7-julkinen   the CSV made public from the card (C from its mark);
//   8-valilehti  the CSV in its own tab from the card's action (C's ⋯);
//   9-lataus     Lataa from the card, its note.
// It asserts that the same card's press closes the panel it opened, that the
// open card is marked, where each riff keeps its actions, that the console
// stays clean and that nothing overflows sideways.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-08-tarjouskortit-3';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['a-kulma','b-palkki','c-jako'];
const steps=[['1-nakyma','view'],['2-taulukko','csv'],['3-kuva','image'],['4-asiakirja','pdf'],['5-kansio','folder']];
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const runs=[{width:1440,theme:'light'},{width:1440,theme:'dark'},{width:390,theme:'light'},{width:390,theme:'dark'}];
try{
for(const {width,theme} of runs){
 const mobile=width===390,H=mobile?844:900;
 const ctx=await browser.newContext({viewport:{width,height:H},deviceScaleFactor:2,reducedMotion:'reduce',isMobile:mobile,hasTouch:mobile,permissions:['clipboard-read','clipboard-write']});
 const page=await ctx.newPage();
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 await checkPicker(page,round);
 const tag=`${width}-${theme}`;
 const fits=async()=>ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'document overflow');
 const press=async(loc)=>{await loc.scrollIntoViewIfNeeded();await (mobile?loc.tap():loc.click());};
 const away=async()=>{if(!mobile) await page.mouse.move(width-5,H-5);};
 for(const d of [0,1,2]){
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.rq-review.variant-${d}`).waitFor({state:'attached'});
  await page.waitForTimeout(300);
  const shot=async(step)=>{await page.waitForTimeout(350);await fits();await page.screenshot({path:`${out}/r3-${names[d]}-${step}-${tag}.png`});};
  assert.match(await page.getByTestId('direction-lines').locator('li[aria-current]').innerText(),new RegExp(`^${'ABC'[d]} `));checks++;
  ok(await page.getByTestId('oc-card').count()===6,'six cards of one shape');
  const panel=page.getByTestId('oc-panel');
  const cardOf=kind=>page.locator(`[data-testid="oc-card"][data-kind="${kind}"]`).first();
  const hitOf=kind=>cardOf(kind).getByTestId('oc-hit');
  const viewCard=page.locator('[data-testid="oc-card"][data-kind="view"]').nth(1);
  // The default view.
  await away();
  if(!mobile){
   await panel.waitFor();checks++;
   ok(await panel.getAttribute('data-kind')==='pdf','the PDF is open on the default view');
   ok(await cardOf('pdf').getAttribute('data-open')==='true','the open card is marked');
   ok(await hitOf('pdf').getAttribute('aria-expanded')==='true','the open card says it is expanded');
   ok(await viewCard.getAttribute('data-hover')==='true','one card is drawn hovered');
   ok(await viewCard.getByTestId('oc-acts').or(viewCard.getByTestId('oc-more')).first().isVisible(),'the hovered card shows its actions');
  }else{
   ok(await panel.count()===0,'a phone opens nothing on the default view');
   if(d===0) ok(await cardOf('csv').getByTestId('oc-acts').isVisible(),'A: icons always visible on touch');
   if(d===1) ok(await cardOf('pdf').getAttribute('data-pressed')==='true'&&await cardOf('pdf').getByTestId('oc-acts').isVisible(),'B: the long-pressed bar is drawn');
   if(d===2) ok(await cardOf('csv').getByTestId('oc-more').count()===0&&await cardOf('csv').getByTestId('oc-pill').isVisible(),'C: on touch only the mark, no ⋯');
  }
  await shot('0-oletus');
  // The same card's press closes what it opened (desktop); a phone closes with ✕.
  if(!mobile){
   await press(hitOf('pdf'));
   await panel.waitFor({state:'detached'});checks++;
   ok(await cardOf('pdf').getAttribute('data-open')===null,'closed card is no longer marked');
  }
  await away();
  await page.setViewportSize({width,height:mobile?3000:2300});
  await page.waitForTimeout(200);
  await shot('0-kortit');
  await page.setViewportSize({width,height:H});
  for(const [step,kind] of steps){
   const card=cardOf(kind);
   await press(hitOf(kind));
   await panel.waitFor();checks++;
   ok(await panel.getAttribute('data-kind')===kind,`${kind} opens beside`);
   ok(await card.getAttribute('data-open')==='true',`${kind}: the open card is marked`);
   const tools=page.getByTestId('oc-panel-tools');
   if(d===0) ok(await tools.getByTestId('oc-act-tab').isVisible()&&await tools.getByTestId('oc-public').isVisible(),'A: the same row in the top bar');
   if(d===1) ok((await tools.locator('.ah-button').count()===1)&&(await page.locator('.oc-pane-bar').count()===(mobile?1:0)),'B: only ✕ in the top bar (a phone adds the bar)');
   if(d===2) ok(await tools.getByTestId('oc-pill').isVisible()&&await tools.getByTestId('oc-more').isVisible(),'C: the mark and ⋯ in the top bar');
   if(d===1&&!mobile) ok(await card.getByTestId('oc-acts').isVisible(),'B: the open card pins its bar');
   if(kind==='csv') ok(await page.getByTestId('oc-table').isVisible(),'table');
   if(kind==='pdf') ok(await page.getByTestId('oc-doc').isVisible(),'document');
   if(kind==='folder') ok(await page.getByTestId('oc-folder-row').count()===5,'five files in the folder');
   await away();
   await shot(step);
   if(!mobile){
    await press(hitOf(kind));
    await panel.waitFor({state:'detached'});checks++;
   }else{
    await press(page.getByTestId('oc-panel-close'));
    await panel.waitFor({state:'detached'});checks++;
   }
  }
  // The card's own actions on the CSV.
  const csv=cardOf('csv');
  if(!mobile){
   await csv.scrollIntoViewIfNeeded();
   await csv.hover();
   ok(await (d===2?csv.getByTestId('oc-more'):csv.getByTestId('oc-acts')).isVisible(),'the pointer shows the actions');
   await shot('6-hover');
  }else if(d===1){
   await csv.scrollIntoViewIfNeeded();
   const hit=csv.getByTestId('oc-hit');
   await hit.dispatchEvent('pointerdown',{pointerType:'touch',isPrimary:true});
   await page.waitForTimeout(600);
   await hit.dispatchEvent('pointerup',{pointerType:'touch',isPrimary:true});
   await hit.dispatchEvent('click');
   ok(await csv.getAttribute('data-pressed')==='true','B: a long press shows the bar');
   ok(await panel.count()===0,'B: the long press does not open');
   await shot('6-kosketus');
  }else if(d===0){
   await csv.scrollIntoViewIfNeeded();
   await shot('6-kosketus');
  }else{
   await press(hitOf('csv'));
   await panel.waitFor();checks++;
   await press(page.getByTestId('oc-panel-tools').getByTestId('oc-more'));
   await page.getByTestId('oc-more-menu').waitFor();checks++;
   await shot('6-kosketus');
   await page.keyboard.press('Escape');
   await press(page.getByTestId('oc-panel-close'));
   await panel.waitFor({state:'detached'});checks++;
  }
  // Publish from the card.
  if(d<2){
   await csv.hover().catch(()=>{});
   await press(csv.getByTestId('oc-public'));
   ok(await csv.getByTestId('oc-copy').isVisible(),'Kopioi linkki on the card when public');
   ok(await csv.getByTestId('oc-until').isVisible(),'the date on the card when public');
   await shot('7-julkinen');
   await press(csv.getByTestId('oc-until'));
   await page.locator('.ah-view-offer-durations').waitFor();checks++;
   await page.keyboard.press('Escape');
   await press(csv.getByTestId('oc-public'));
   ok(await csv.getByTestId('oc-copy').count()===0,'private again');
  }else{
   await press(csv.getByTestId('oc-pill'));
   await page.getByTestId('oc-share-pop').waitFor();checks++;
   ok(await panel.count()===0,'the mark shares without opening the item');
   await press(page.locator('[data-testid="oc-share-pop"] [data-testid="oc-public"]'));
   ok(await csv.getByTestId('oc-pill').getAttribute('data-public')==='true','the card shows the globe');
   await shot('7-julkinen');
   await press(page.locator('[data-testid="oc-share-pop"] [data-testid="oc-public"]'));
   await page.keyboard.press('Escape');
   await page.getByTestId('oc-share-pop').waitFor({state:'detached'});checks++;
  }
  // Own tab and download from the card (C: its ⋯; on a phone the top bar's ⋯).
  const fromCard=async(id)=>{
   if(d===2){
    if(mobile){if(!await panel.count()){await press(hitOf('csv'));await panel.waitFor();}await press(page.getByTestId('oc-panel-tools').getByTestId('oc-more'));}
    else{await csv.hover();await press(csv.getByTestId('oc-more'));}
    await page.getByTestId('oc-more-menu').waitFor();
    await press(page.getByTestId('oc-more-menu').getByTestId(id));
   }else{
    if(mobile&&d===1){
     const hit=csv.getByTestId('oc-hit');
     if(await csv.getAttribute('data-pressed')!=='true'){
      await hit.dispatchEvent('pointerdown',{pointerType:'touch',isPrimary:true});await page.waitForTimeout(600);
      await hit.dispatchEvent('pointerup',{pointerType:'touch',isPrimary:true});await hit.dispatchEvent('click');
     }
    }else if(!mobile) await csv.hover();
    await press(csv.getByTestId(id));
   }
  };
  await fromCard('oc-act-tab');
  await page.getByTestId('oc-tab').waitFor();checks++;
  ok(await page.getByTestId('oc-tab').getAttribute('data-kind')==='csv','the CSV opens in its own tab from the card');
  await shot('8-valilehti');
  await press(page.getByTestId('oc-tab-close'));
  await page.getByTestId('oc-tab').waitFor({state:'detached'});
  await fromCard('oc-act-download');
  await page.getByTestId('oc-toast').waitFor();checks++;
  ok(/kysely-siivottu\.csv/.test(await page.getByTestId('oc-toast').innerText()),'Lataa names the file');
  await shot('9-lataus');
  if(await panel.count()) { await press(page.getByTestId('oc-panel-close')); await panel.waitFor({state:'detached'}); }
  // The conversation's list still opens in the same place.
  await press(page.getByTestId('oc-chip'));
  await page.getByTestId('oc-list').waitFor();checks++;
  ok(await page.getByTestId('oc-list-row').count()===6,'six entries in the list');
  await press(page.getByTestId('oc-list-row').nth(2));
  await panel.waitFor();checks++;
  await press(page.getByTestId('oc-back'));
  await page.getByTestId('oc-list').waitFor();checks++;
  await press(page.locator('[data-testid="oc-list"] [aria-label="Sulje"]'));
  await page.getByTestId('oc-list').waitFor({state:'detached'});checks++;
 }
 await ctx.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
