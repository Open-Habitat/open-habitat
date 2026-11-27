// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic lab, not a host-backed acceptance test. Walks 1 Paneeli
// in Päivä and Yö at 1440 × 900, 1440 × 780 (a laptop screen minus the
// browser's own chrome) and 390 × 844 (reduced motion): the picker contract;
// the bar (tabs with the active tab's origin, who drives, ⋯, one end action;
// no < / >, no Take control, no Leikepöytä) and its controls' adjacency (no
// overlap, inside the bar, even gaps, one row); no Chrome strip in the
// picture; ⋯ holds Cut / Copy / Paste with shortcuts and none of the removed
// items; a click takes control; ⌘/Ctrl+V types, ⌘/Ctrl+C and Cut copy; the
// long-paste refusal and its button; the phone's keyboard field; the panel
// narrows from production's Keskustelu strip and a click widens it; Valmis
// gives back, closes and says the remote clipboard was cleared; a popup is a
// marked tab filling the picture; the mid-step question; give back and keep
// watching; Paste from ⋯ while the agent waits takes control; several tabs,
// the last-tab guard, Close browser. Nykyinen: production's sheet with
// Chrome's strip drawn. Then it measures the picture and the page's height in
// both at 1440 × 900, 1440 × 780, 1280 × 720 and 390 × 844 (?measure=1 hides
// the review chrome) into <out-dir>/sizes.json. No external requests, no
// horizontal overflow, clean console.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-27-palvelinselain-kehys-2';
const [input,out,flag]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <out-dir> [--quick]');process.exit(2);}
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['paneeli','nykyinen'];
const mod=k=>`Ctrl+${k}`; // headless Linux
let checks=0;const errors=[];const external=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};

async function open(width,height,query=''){
 const phone=width<600;
 const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:phone?2:1,reducedMotion:'reduce',hasTouch:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('dialog',d=>d.accept());
 await page.route('**/*',r=>{const u=r.request().url();
  if(u.startsWith('http://prototype.test/'))return r.fulfill({contentType:'text/html',body:html});
  if(u.startsWith('data:')||u.startsWith('blob:'))return r.continue();
  external.push(u);return r.abort();});
 await page.goto('http://prototype.test/'+query);
 await settle(page);
 return page;
}
const settle=page=>page.waitForTimeout(150);
const id=(page,t)=>page.getByTestId(t);
const vis=async(page,t)=>(await id(page,t).count())>0&&await id(page,t).first().isVisible();
const pick=async(page,d)=>{await page.locator('.proto-picker-item').nth(d).click();await page.locator(`.ra-review[data-direction="${d}"]`).waitFor({state:'attached'});await settle(page);};
const step=async(page,p)=>{await page.locator(`.ra-step[data-phase="${p}"]`).click();await settle(page);};
const turn=page=>id(page,'browser-turn').first().innerText();
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const viewFits=page=>page.evaluate(()=>{const v=document.querySelector('[data-testid="browser-view"]'),b=v?.querySelector('[data-testid="browser-bar"]');
 if(!v||!b)return false;return v.getBoundingClientRect().right<=innerWidth+1&&b.getBoundingClientRect().right<=innerWidth+1&&b.scrollWidth<=b.clientWidth+1;});
const shot=(page,name)=>page.screenshot({path:`${out}/${name}.png`});
const field=(page,f)=>page.locator(`.kh-picture [data-field="${f}"]`).first().innerText();
async function menu(page,item){await id(page,'browser-more').first().click();await settle(page);await id(page,item).first().click();await settle(page);}

// The bar's controls sit side by side: none overlaps another or leaves the
// bar, the end group's gaps are even and small, and all share one row.
async function adjacent(page,tag){
 const r=await page.evaluate(()=>{
  const bar=document.querySelector('[data-testid="browser-bar"]');const b=bar.getBoundingClientRect();
  const end=bar.querySelector('[data-testid="browser-bar-end"]');
  const items=[...end.children].filter(e=>e.getClientRects().length).map(e=>e.getBoundingClientRect());
  const tabs=[...bar.querySelectorAll('.kh-tabs-wrap,.kh-tabmenu-wrap')].filter(e=>e.getClientRects().length).map(e=>e.getBoundingClientRect());
  return {b:{l:b.left,r:b.right,t:b.top,bt:b.bottom},items:items.map(x=>({l:x.left,r:x.right,t:x.top,bt:x.bottom})),tabs:tabs.map(x=>({l:x.left,r:x.right}))};
 });
 ok(r.items.length>=3,`${tag}: bar end has its controls`);
 for(const x of r.items) ok(x.l>=r.b.l-0.5&&x.r<=r.b.r+0.5&&x.t>=r.b.t-0.5&&x.bt<=r.b.bt+0.5,`${tag}: control inside the bar`);
 const gaps=r.items.slice(1).map((x,i)=>x.l-r.items[i].r);
 ok(gaps.every(g=>g>=0&&g<=12),`${tag}: end controls adjacent ${JSON.stringify(gaps)}`);
 ok(Math.max(...gaps)-Math.min(...gaps)<=1,`${tag}: even gaps ${JSON.stringify(gaps)}`);
 const mids=r.items.map(x=>(x.t+x.bt)/2);
 ok(Math.max(...mids)-Math.min(...mids)<=2,`${tag}: one row`);
 for(const t of r.tabs) ok(t.r<=r.items[0].l+0.5,`${tag}: tabs end before the end group`);
}

async function walk(theme,width,height){
 const phone=width<600;
 const tag=`paneeli-${theme}-${width}x${height}`;
 const page=await open(width,height,`?theme=${theme}`);
 await checkPicker(page,round);
 eq(await page.locator('.proto-picker-item').allInnerTexts(),['1 Paneeli','Nykyinen'],`${tag}: picker entries`);
 // Default: the agent waits for you in the sign-in tab.
 ok(await vis(page,'browser-view'),`${tag}: view open`);
 eq(await turn(page),'Agentti odottaa sinua',`${tag}: turn`);
 ok(await vis(page,'browser-says'),`${tag}: the agent's request shows`);
 eq(await id(page,'browser-take-control').count(),0,`${tag}: no Take control button`);
 eq(await page.getByText('Leikepöytä',{exact:true}).count(),0,`${tag}: no Leikepöytä`);
 eq(await id(page,'expand-view').count(),0,`${tag}: no < / >`);
 eq(await id(page,'chrome-strip').count(),0,`${tag}: no Chrome strip in the picture`);
 ok((await id(page,'browser-origin').first().innerText()).includes('tunnistus.example'),`${tag}: active tab's origin`);
 ok(await vis(page,'browser-close'),`${tag}: × while the agent drives`);
 eq(await id(page,'browser-done').count(),0,`${tag}: no Valmis while the agent drives`);
 eq(await page.locator('.sb-truth').count(),0,`${tag}: no truth line on screen`);
 ok(await fits(page),`${tag}: no horizontal overflow`);
 ok(await viewFits(page),`${tag}: view and bar fit`);
 await adjacent(page,`${tag} agent`);
 await shot(page,`${tag}-1-odottaa`);
 // ⋯: turn, Cut / Copy / Paste with shortcuts, the tab, the browser, the truth.
 await id(page,'browser-more').first().click();await settle(page);
 ok(await vis(page,'browser-truth'),`${tag}: truth in ⋯`);
 ok(await vis(page,'menu-stop'),`${tag}: Close browser in ⋯`);
 ok(await vis(page,'menu-take'),`${tag}: Take control in ⋯`);
 for(const [i,l,k] of [['cut','Leikkaa','X'],['copy','Kopioi','C'],['paste','Liitä','V']]){
  ok((await id(page,`menu-${i}`).innerText()).startsWith(l),`${tag}: ${l} in ⋯`);
  if(!phone) ok((await id(page,`menu-${i}`).innerText()).includes(mod(k)),`${tag}: ${l} shortcut`);
 }
 eq(await id(page,'menu-close-tab').innerText(),'Sulje välilehti',`${tag}: Sulje välilehti`);
 for(const gone of ['Liitä pitkä teksti','Kirjoita sivulle','Kopioi valinta']) eq(await page.getByText(gone).count(),0,`${tag}: no ${gone}`);
 if(!phone) await shot(page,`${tag}-1b-valikko`);
 await page.keyboard.press('Escape');await settle(page);
 ok(await vis(page,'browser-view'),`${tag}: Escape closed only the menu`);
 // A click on the picture takes control.
 await page.locator('.kh-picture').first().click({position:{x:40,y:40}});await settle(page);
 eq(await turn(page),'Sinä ohjaat',`${tag}: click took control`);
 ok(await vis(page,'browser-done'),`${tag}: Valmis while you drive`);
 eq(await id(page,'browser-done').first().innerText(),'Valmis',`${tag}: Valmis as in round 1`);
 eq(await id(page,'browser-close').count(),0,`${tag}: no × while you drive`);
 eq(await id(page,'browser-says').count(),0,`${tag}: request leaves the picture once you drive`);
 eq(await page.locator('.sb-frame[data-control="person"]').count(),1,`${tag}: solid frame`);
 if(phone) ok(await vis(page,'browser-keys'),`${tag}: phone keyboard button`);
 ok(await viewFits(page),`${tag}: view and bar fit while you drive`);
 await adjacent(page,`${tag} person`);
 // ⌘/Ctrl+V types the text; ⌘/Ctrl+C and Cut copy it to your machine.
 await page.locator('.kh-picture').first().press('Control+v');await settle(page);
 eq(await field(page,'user'),'aino.laine',`${tag}: Ctrl+V typed`);
 ok((await id(page,'browser-toast').first().innerText()).includes('näppäilyinä · 10 merkkiä'),`${tag}: typed toast`);
 await shot(page,`${tag}-2-ohjaat`);
 await page.locator('.kh-picture').first().press('Control+c');await settle(page);
 ok((await id(page,'browser-toast').first().innerText()).startsWith('Kopioitu etäsivulta koneesi leikepöydälle · 10'),`${tag}: Ctrl+C copied`);
 await menu(page,'menu-cut');
 eq(await field(page,'user'),'',`${tag}: Cut emptied the field`);
 ok((await id(page,'browser-toast').first().innerText()).startsWith('Leikattu'),`${tag}: cut toast`);
 await menu(page,'menu-paste');
 eq(await field(page,'user'),'aino.laine',`${tag}: Paste from ⋯ typed`);
 if(phone){
  // The phone's keyboard: the button focuses a hidden field; typing goes to the page.
  await id(page,'browser-keys').click();await settle(page);
  ok(await vis(page,'browser-ime-note'),`${tag}: keyboard note`);
  ok(await page.evaluate(()=>document.activeElement?.dataset.testid==='browser-ime'),`${tag}: keyboard field focused`);
  await page.keyboard.type('x');await settle(page);
  eq(await field(page,'user'),'aino.lainex',`${tag}: phone typed`);
  await page.keyboard.press('Backspace');await settle(page);
  eq(await field(page,'user'),'aino.laine',`${tag}: phone backspace`);
  await shot(page,`${tag}-2b-nappaimisto`);
  await id(page,'browser-keys').click();await settle(page);
  eq(await id(page,'browser-ime-note').count(),0,`${tag}: keyboard closed`);
 }else{
  // Production's Keskustelu strip narrows the panel; a click on the picture widens it.
  await id(page,'view-show-conversation').click();await settle(page);
  eq(await page.locator('.ah-view-expanded').count(),0,`${tag}: narrowed`);
  await page.locator('.kh-picture').first().click({position:{x:30,y:30}});await settle(page);
  eq(await page.locator('.ah-view-expanded').count(),1,`${tag}: click widened`);
 }
 // Text too long for keystrokes: the refusal carries its own button, and the
 // paste says the agent can see the remote clipboard.
 await id(page,'event-long-paste').click();await settle(page);
 ok(await vis(page,'browser-toast-action'),`${tag}: refusal button`);
 await id(page,'browser-toast-action').click();await settle(page);
 const pasted=await id(page,'browser-toast').first().innerText();
 ok(pasted.includes('etäkoneen leikepöydän kautta')&&pasted.includes('Agentti näkee leikepöydän'),`${tag}: pasted via clipboard, honestly`);
 // Valmis gives back, empties the remote clipboard and closes.
 await id(page,'browser-done').first().click();await settle(page);
 eq(await id(page,'browser-view').count(),0,`${tag}: Valmis closed the view`);
 ok((await id(page,'app-toast').innerText()).includes('leikepöytä tyhjennettiin'),`${tag}: cleared toast`);
 eq(await id(page,'browser-rail-row').first().getAttribute('data-state'),'agent',`${tag}: rail says agent`);
 await shot(page,`${tag}-3-annettu`);
 // Popup: a marked tab filling the picture; × closes it and returns to its opener.
 await step(page,'popup');
 ok(await page.locator('.fp-popup').isVisible(),`${tag}: popup page`);
 const fill=await page.evaluate(()=>{const a=document.querySelector('.fp-popup').getBoundingClientRect(),b=document.querySelector('.kh-remote').getBoundingClientRect();return Math.abs(a.width-b.width)<2&&Math.abs(a.height-b.height)<2;});
 ok(fill,`${tag}: popup fills the picture`);
 if(phone){
  ok((await id(page,'browser-origin').first().innerText()).includes('tunnistus.example'),`${tag}: popup origin`);
  await id(page,'browser-tab-menu').first().click();await settle(page);
  ok(await page.locator('.kh-menu-tab').filter({hasText:'ponnahdus'}).isVisible(),`${tag}: popup in the tab menu`);
  await shot(page,`${tag}-4-ponnahdus-valikko`);
  await id(page,'menu-close-tab').first().click();await settle(page);
 }else{
  ok(await page.locator('.kh-tab[data-popup]').isVisible(),`${tag}: popup tab`);
  eq(await page.locator('.kh-tab[data-active]').getAttribute('data-tab'),'vahvista',`${tag}: popup in front`);
  ok(await page.locator('.kh-tab[data-active] [data-testid="browser-origin"]').isVisible(),`${tag}: popup origin`);
  await adjacent(page,`${tag} popup`);
  await shot(page,`${tag}-4-ponnahdus`);
  await page.locator('.kh-tab[data-tab="vahvista"] [data-testid="browser-tab-close"]').click();await settle(page);
 }
 eq(await page.locator('.fp-popup').count(),0,`${tag}: popup closed`);
 ok((await id(page,'browser-toast').first().innerText()).includes('Välilehti suljettu'),`${tag}: tab closed toast`);
 // The agent mid-step: a click asks; "take when it's done" waits.
 await step(page,'agent');
 eq(await turn(page),'Agentti toimii',`${tag}: agent at work`);
 await page.locator('.kh-picture').first().click({position:{x:60,y:60}});await settle(page);
 ok(await vis(page,'browser-mid-step'),`${tag}: mid-step question`);
 await shot(page,`${tag}-5-kesken`);
 await id(page,'browser-take-after').click();await settle(page);
 ok((await turn(page)).startsWith('Otat ohjauksen'),`${tag}: waiting`);
 ok(await vis(page,'browser-cancel-wait'),`${tag}: Peru while waiting`);
 await adjacent(page,`${tag} waiting`);
 await page.waitForTimeout(1700);
 eq(await turn(page),'Sinä ohjaat',`${tag}: took after the step`);
 // ⋯ Give back and keep watching.
 await menu(page,'menu-give-keep');
 ok(await vis(page,'browser-view'),`${tag}: still open after give back and keep`);
 eq(await turn(page),'Agentti toimii',`${tag}: agent again`);
 // Paste from ⋯ while the agent waits takes control first, like a key.
 await step(page,'ask');
 await menu(page,'menu-paste');
 eq(await turn(page),'Sinä ohjaat',`${tag}: Paste took control`);
 eq(await field(page,'user'),'aino.laine',`${tag}: and typed`);
 if(!quick){
  // Several tabs; the last tab is not closed.
  await page.locator('#many').check();await settle(page);
  if(!phone) eq(await page.locator('.kh-tab').count(),4,`${tag}: four tabs`);
  else ok((await id(page,'browser-tab-menu').first().innerText()).includes('4'),`${tag}: tab count`);
  ok(await fits(page),`${tag}: many tabs fit`);
  ok(await viewFits(page),`${tag}: bar fits with many tabs`);
  await adjacent(page,`${tag} many`);
  await shot(page,`${tag}-6-monta`);
  await page.locator('#many').uncheck();await settle(page);
  await step(page,'person');
  for(let i=0;i<2;i++) await menu(page,'menu-close-tab');
  ok((await id(page,'browser-toast').first().innerText()).includes('Viimeistä välilehteä'),`${tag}: last tab guard`);
  // Close browser from ⋯.
  await menu(page,'menu-stop');
  eq(await id(page,'browser-view').count(),0,`${tag}: browser closed`);
  eq(await id(page,'browser-rail-row').first().getAttribute('data-state'),'stopped',`${tag}: rail says off`);
 }
 ok(await fits(page),`${tag}: no overflow at the end`);
 await page.close();
}

async function today(theme,width,height){
 const tag=`nykyinen-${theme}-${width}x${height}`;
 const page=await open(width,height,`?theme=${theme}`);
 await pick(page,1);
 await checkPicker(page,round);
 ok(await vis(page,'browser-sheet'),`${tag}: production sheet`);
 ok(await vis(page,'chrome-strip'),`${tag}: Chrome's strip in today's picture`);
 ok(await fits(page),`${tag}: no overflow`);
 await shot(page,`${tag}`);
 await page.close();
}

const themes=quick?['light']:['light','dark'];
const sizesWalk=[[1440,900],[1440,780],[390,844]];
for(const theme of themes)for(const [w,h] of sizesWalk){
 await walk(theme,w,h);
 await today(theme,w,h);
}

// Picture sizes, review chrome hidden.
const sizes=[];
for(const [w,h] of [[1440,900],[1440,780],[1280,720],[390,844]]){
 for(const d of [0,1]){
  const page=await open(w,h,`?v=${d+1}&measure=1&state=person`);
  await page.waitForTimeout(120);
  const o=id(page,'picture-size');
  const row={viewport:`${w}x${h}`,view:names[d],width:+await o.getAttribute('data-width'),height:+await o.getAttribute('data-height'),page:+await o.getAttribute('data-page'),scale:+await o.getAttribute('data-scale')};
  ok(row.width>0,`size ${JSON.stringify(row)}`);
  sizes.push(row);
  if(w!==1280) await shot(page,`koko-${row.view}-${w}x${h}`);
  await page.close();
 }
}
writeFileSync(`${out}/sizes.json`,JSON.stringify(sizes,null,1));
console.table(sizes);
eq(external,[],'no external requests');
eq(errors,[],'clean console');
await browser.close();
console.log(`${checks} checks passed`);
