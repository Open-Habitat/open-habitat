// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic lab, not a host-backed acceptance test. Walks
// 1 Koko ikkuna in Päivä and Yö at 1440 × 900, 1440 × 780 (a laptop screen
// minus the browser's own chrome) and 390 × 844 (reduced motion, touch): the
// picker contract; Habitat's bar has nothing about tabs (no tab list or menu,
// no origin, no Sulje välilehti, no address, history or bookmarks) and keeps
// who drives, ⋯ and one end action, side by side (no overlap, inside the bar,
// even gaps, one row); the picture holds Chrome's whole window (tab strip,
// back, reload, address, star); ⋯ holds exactly the turn item, Leikkaa /
// Kopioi / Liitä with shortcuts, Sulje selain, the truth and (desktop) the
// own-keys sentence; a click on a Chrome tab takes control and switches; the
// address bar in the picture navigates; + opens a new tab; × closes one; back
// and reload; star and the bookmarks bar; Ctrl+L and Ctrl+V in the picture;
// the phone's keyboard; mid-step a click asks and runs after Ota ohjaus nyt;
// a popup covers the picture with no close control of its own, ⋯ Sulje
// ponnahdusikkuna closes it and its own button too; Valmis gives back and
// closes; closing the last tab in the picture closes the browser. Nykyinen:
// production's sheet around the same window. Then it measures the picture
// and the page's height in both at 1440 × 900, 1440 × 780, 1280 × 720 and
// 390 × 844 (?measure=1 hides the review chrome) into <out-dir>/sizes.json.
// No external requests, no horizontal overflow, clean console.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-28-palvelinselain-kehys-4';
const [input,out,flag]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <out-dir> [--quick]');process.exit(2);}
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['ikkuna','nykyinen'];
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
const url=page=>id(page,'browser-page').getAttribute('data-url');
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const viewFits=page=>page.evaluate(()=>{const v=document.querySelector('[data-testid="browser-view"]'),b=v?.querySelector('[data-testid="browser-bar"]');
 if(!v||!b)return false;return v.getBoundingClientRect().right<=innerWidth+1&&b.getBoundingClientRect().right<=innerWidth+1&&b.scrollWidth<=b.clientWidth+1;});
const shot=(page,name)=>page.screenshot({path:`${out}/${name}.png`});
const field=(page,f)=>page.locator(`.kh-picture [data-field="${f}"]`).first().innerText();
const tabs=page=>page.locator('[data-testid="chrome-tab"] .cr-tab-title').allInnerTexts();
const click=async(page,t,n=0)=>{await id(page,t).nth(n).click();await settle(page);};
async function menu(page,item){await id(page,'browser-more').first().click();await settle(page);await id(page,item).first().click();await settle(page);}

// The bar's controls sit side by side: none overlaps another or leaves the
// bar, the end group's gaps are even and small, and all share one row.
async function adjacent(page,tag){
 const r=await page.evaluate(()=>{
  const bar=document.querySelector('[data-testid="browser-bar"]');const b=bar.getBoundingClientRect();
  const end=bar.querySelector('[data-testid="browser-bar-end"]');
  const items=[...end.children].filter(e=>e.getClientRects().length).map(e=>e.getBoundingClientRect());
  const lead=[...bar.querySelectorAll('.kh-bar-title')].filter(e=>e.getClientRects().length).map(e=>e.getBoundingClientRect());
  return {b:{l:b.left,r:b.right,t:b.top,bt:b.bottom},items:items.map(x=>({l:x.left,r:x.right,t:x.top,bt:x.bottom})),lead:lead.map(x=>({l:x.left,r:x.right}))};
 });
 ok(r.items.length>=3,`${tag}: bar end has its controls`);
 for(const x of r.items) ok(x.l>=r.b.l-0.5&&x.r<=r.b.r+0.5&&x.t>=r.b.t-0.5&&x.bt<=r.b.bt+0.5,`${tag}: control inside the bar`);
 const gaps=r.items.slice(1).map((x,i)=>x.l-r.items[i].r);
 ok(gaps.every(g=>g>=0&&g<=12),`${tag}: end controls adjacent ${JSON.stringify(gaps)}`);
 ok(Math.max(...gaps)-Math.min(...gaps)<=1,`${tag}: even gaps ${JSON.stringify(gaps)}`);
 const mids=r.items.map(x=>(x.t+x.bt)/2);
 ok(Math.max(...mids)-Math.min(...mids)<=2,`${tag}: one row`);
 for(const t of r.lead) ok(t.r<=r.items[0].l+0.5,`${tag}: title ends before the end group`);
}

// Nothing about tabs in Habitat's own bar.
async function noTabs(page,tag){
 const bar=id(page,'browser-bar');
 for(const t of ['browser-tabs','browser-tab','browser-tab-menu','browser-origin','browser-new-tab','address-input','history']) eq(await page.locator(`[data-testid="browser-view"] [data-testid="${t}"]`).count(),0,`${tag}: no ${t} in Habitat's view`);
 const text=await bar.innerText();
 for(const word of ['välilehti','Välilehti','.example','Historia','Kirjanmerk']) ok(!text.includes(word),`${tag}: bar does not say ${word}`);
}

async function walk(theme,width,height){
 const phone=width<600;
 const tag=`ikkuna-${theme}-${width}x${height}`;
 const page=await open(width,height,`?theme=${theme}`);
 await checkPicker(page,round);
 eq(await page.locator('.proto-picker-item').allInnerTexts(),['1 Koko ikkuna','Nykyinen'],`${tag}: picker entries`);
 eq(await page.evaluate(()=>document.documentElement.dataset.theme),theme,`${tag}: theme`);
 // Default: the agent waits for you in the sign-in tab.
 ok(await vis(page,'browser-view'),`${tag}: view open`);
 eq(await turn(page),'Agentti odottaa sinua',`${tag}: turn`);
 ok(await vis(page,'browser-says'),`${tag}: the agent's request shows`);
 eq(await id(page,'browser-take-control').count(),0,`${tag}: no Take control button`);
 await noTabs(page,tag);
 // Chrome's whole window is in the picture.
 ok(await vis(page,'chrome-window'),`${tag}: Chrome's window in the picture`);
 eq(await tabs(page),['Laskut – Energia Oy','Kirjaudu – Tunnistus'],`${tag}: Chrome's own tabs`);
 eq(await id(page,'chrome-url').innerText(),'tunnistus.example/kirjaudu',`${tag}: Chrome's own address`);
 for(const t of ['chrome-back','chrome-reload','chrome-new-tab','chrome-star']) ok(await vis(page,t),`${tag}: ${t}`);
 ok(await vis(page,'browser-close'),`${tag}: × while the agent drives`);
 ok(await fits(page),`${tag}: no horizontal overflow`);
 ok(await viewFits(page),`${tag}: view and bar fit`);
 await adjacent(page,`${tag} agent`);
 await shot(page,`${tag}-1-odottaa`);
 // ⋯: exactly the turn, cut / copy / paste, close browser, and the sentences.
 await id(page,'browser-more').first().click();await settle(page);
 const items=await page.evaluate(()=>[...document.querySelectorAll('.kh-more [role="menuitem"]')].map(e=>{const c=e.cloneNode(true);c.querySelector('kbd')?.remove();return c.textContent.trim();}));
 eq(items,['Ota ohjaus','Leikkaa','Kopioi','Liitä','Sulje selain'],`${tag}: ⋯ items`);
 if(!phone) for(const [i,k] of [['cut','X'],['copy','C'],['paste','V']]) ok((await id(page,`menu-${i}`).innerText()).includes(mod(k)),`${tag}: ${i} shortcut`);
 ok(await vis(page,'browser-truth'),`${tag}: truth in ⋯`);
 eq(await vis(page,'browser-own-keys'),!phone,`${tag}: own-keys sentence on desktop only`);
 if(!phone){ok((await id(page,'browser-own-keys').innerText()).includes('Ctrl+T, Ctrl+W ja Ctrl+N'),`${tag}: names the keys`);await shot(page,`${tag}-1b-valikko`);}
 await page.keyboard.press('Escape');await settle(page);
 // A click on Chrome's first tab takes control and brings that tab forward.
 await click(page,'chrome-tab',0);
 eq(await turn(page),'Sinä ohjaat',`${tag}: tab click took control`);
 eq(await url(page),'https://energia.example/laskut',`${tag}: and switched the tab`);
 ok(await vis(page,'browser-done'),`${tag}: Valmis while you drive`);
 eq(await id(page,'browser-close').count(),0,`${tag}: no × while you drive`);
 eq(await id(page,'browser-says').count(),0,`${tag}: request leaves once you drive`);
 eq(await page.locator('.sb-frame[data-control="person"]').count(),1,`${tag}: solid frame`);
 if(phone) ok(await vis(page,'browser-keys'),`${tag}: phone keyboard button`);
 await adjacent(page,`${tag} person`);
 await noTabs(page,`${tag} person`);
 // Back to the sign-in tab; Ctrl+V types into the field.
 await click(page,'chrome-tab',1);
 await page.locator('.kh-picture').first().press('Control+v');await settle(page);
 eq(await field(page,'user'),'aino.laine',`${tag}: Ctrl+V typed`);
 ok((await id(page,'browser-toast').first().innerText()).includes('näppäilyinä · 10 merkkiä'),`${tag}: typed toast`);
 await shot(page,`${tag}-2-ohjaat`);
 await menu(page,'menu-copy');
 ok((await id(page,'browser-toast').first().innerText()).startsWith('Kopioitu etäsivulta'),`${tag}: Copy from ⋯`);
 // Chrome's back button, then the address bar in the picture.
 await click(page,'chrome-back');
 eq(await url(page),'https://energia.example/laskut',`${tag}: Chrome's back`);
 await click(page,'chrome-reload');
 eq(await id(page,'browser-page').getAttribute('data-reloads'),'1',`${tag}: Chrome's reload`);
 await click(page,'chrome-omni');
 ok((await id(page,'chrome-omni-text').innerText()).includes('https://energia.example/laskut'),`${tag}: address selected for editing`);
 if(phone){
  await click(page,'browser-keys');
  ok(await vis(page,'browser-ime-note'),`${tag}: keyboard note`);
  await page.keyboard.type('kirjasto.example');await page.keyboard.press('Enter');await settle(page);
  await shot(page,`${tag}-2b-nappaimisto`);
  await click(page,'browser-keys');
 }else{
  await page.keyboard.type('kirjasto.example');await settle(page);
  await shot(page,`${tag}-3-osoite`);
  await page.keyboard.press('Enter');await settle(page);
 }
 eq(await url(page),'https://kirjasto.example/lainat',`${tag}: typed address opened`);
 // Ctrl+L reaches the remote Chrome.
 await page.locator('.kh-picture').first().press('Control+l');await settle(page);
 ok(await vis(page,'chrome-omni-text'),`${tag}: Ctrl+L focused Chrome's address bar`);
 await page.locator('.kh-picture').first().press('Escape');await settle(page);
 // + opens a new tab with the address bar ready; a search.
 await click(page,'chrome-new-tab');
 eq((await tabs(page)).length,3,`${tag}: + opened a tab`);
 eq(await url(page),'',`${tag}: new tab page`);
 const ime=phone?(await click(page,'browser-keys'),true):false;
 await page.keyboard.type('sähkön hinta');await page.keyboard.press('Enter');await settle(page);
 if(ime) await click(page,'browser-keys');
 ok((await url(page)).startsWith('https://www.google.com/search?q='),`${tag}: searched in the new tab`);
 // Star, and the bookmarks bar when Chrome shows it.
 await click(page,'chrome-star');
 eq(await id(page,'chrome-star').getAttribute('data-on'),'true',`${tag}: starred`);
 await page.locator('#bookmarks-bar').check();await settle(page);
 ok(await vis(page,'chrome-bookmarks'),`${tag}: bookmarks bar`);
 if(!phone) await shot(page,`${tag}-4-kirjanmerkit`);
 await page.locator('[data-testid="chrome-bookmark"]').filter({hasText:'Laskut'}).click();await settle(page);
 eq(await url(page),'https://energia.example/laskut',`${tag}: bookmark opened`);
 await page.locator('#bookmarks-bar').uncheck();await settle(page);
 // × on a Chrome tab closes it.
 await click(page,'chrome-tab-close',2);
 eq((await tabs(page)).length,2,`${tag}: tab closed in the picture`);
 if(!phone){
  // Production's Keskustelu strip narrows the panel; a click widens it.
  await id(page,'view-show-conversation').click();await settle(page);
  eq(await page.locator('.ah-view-expanded').count(),0,`${tag}: narrowed`);
  await page.locator('.kh-picture').first().click({position:{x:60,y:200}});await settle(page);
  eq(await page.locator('.ah-view-expanded').count(),1,`${tag}: click widened`);
 }
 // Long paste: the refusal carries its own button.
 await id(page,'event-long-paste').click();await settle(page);
 await id(page,'browser-toast-action').click();await settle(page);
 ok((await id(page,'browser-toast').first().innerText()).includes('Agentti näkee leikepöydän'),`${tag}: pasted via clipboard, honestly`);
 // Valmis gives back, empties the remote clipboard and closes.
 await id(page,'browser-done').first().click();await settle(page);
 eq(await id(page,'browser-view').count(),0,`${tag}: Valmis closed the view`);
 ok((await id(page,'app-toast').innerText()).includes('leikepöytä tyhjennettiin'),`${tag}: cleared toast`);
 eq(await id(page,'browser-rail-row').first().getAttribute('data-state'),'agent',`${tag}: rail says agent`);
 // Popup: covers the picture, has no close control; ⋯ closes it.
 await step(page,'popup');
 ok(await vis(page,'chrome-popup'),`${tag}: popup in the picture`);
 const fill=await page.evaluate(()=>{const a=document.querySelector('.cr-popup').getBoundingClientRect(),b=document.querySelector('.kh-remote').getBoundingClientRect();return Math.abs(a.width-b.width)<2&&Math.abs(a.height-b.height)<2;});
 ok(fill,`${tag}: popup covers the display`);
 eq(await page.locator('.cr-popup [data-cr="tab-close"]').count(),0,`${tag}: popup has no close control`);
 await noTabs(page,`${tag} popup`);
 await adjacent(page,`${tag} popup`);
 await id(page,'browser-more').first().click();await settle(page);
 ok(await vis(page,'menu-close-popup'),`${tag}: Sulje ponnahdusikkuna in ⋯`);
 await shot(page,`${tag}-5-ponnahdus`);
 await id(page,'menu-close-popup').click();await settle(page);
 eq(await id(page,'chrome-popup').count(),0,`${tag}: popup closed from ⋯`);
 ok((await id(page,'browser-toast').first().innerText()).includes('Ponnahdusikkuna suljettu'),`${tag}: popup toast`);
 await id(page,'browser-more').first().click();await settle(page);
 eq(await id(page,'menu-close-popup').count(),0,`${tag}: no popup item without a popup`);
 await page.keyboard.press('Escape');await settle(page);
 // …and its own button closes it as the page does.
 await step(page,'popup');
 await click(page,'popup-confirm');
 eq(await id(page,'chrome-popup').count(),0,`${tag}: popup closed itself`);
 // Mid-step: a click on a tab asks; Ota ohjaus nyt runs it.
 await step(page,'agent');
 eq(await turn(page),'Agentti toimii',`${tag}: agent at work`);
 await click(page,'chrome-tab',1);
 ok(await vis(page,'browser-mid-step'),`${tag}: mid-step question`);
 eq(await url(page),'https://energia.example/laskut',`${tag}: nothing switched yet`);
 await shot(page,`${tag}-6-kesken`);
 await click(page,'browser-take-now');
 eq(await turn(page),'Sinä ohjaat',`${tag}: took control`);
 eq(await url(page),'https://tunnistus.example/kirjaudu',`${tag}: the click ran after Ota ohjaus nyt`);
 // ⋯ Give back and keep watching.
 await menu(page,'menu-give-keep');
 ok(await vis(page,'browser-view'),`${tag}: still open after give back and keep`);
 eq(await turn(page),'Agentti toimii',`${tag}: agent again`);
 if(!quick){
  // Take when it's done.
  await page.locator('.kh-picture').first().click({position:{x:80,y:200}});await settle(page);
  await click(page,'browser-take-after');
  ok((await turn(page)).startsWith('Otat ohjauksen'),`${tag}: waiting`);
  await adjacent(page,`${tag} waiting`);
  await page.waitForTimeout(1700);
  eq(await turn(page),'Sinä ohjaat',`${tag}: took after the step`);
  // Many tabs fit Chrome's strip; Habitat's bar is unchanged.
  await page.locator('#many').check();await settle(page);
  eq((await tabs(page)).length,4,`${tag}: four Chrome tabs`);
  ok(await viewFits(page),`${tag}: bar fits with many tabs`);
  await adjacent(page,`${tag} many`);
  await shot(page,`${tag}-7-monta`);
  await page.locator('#many').uncheck();await settle(page);
  // Closing the last tab in the picture closes Chrome.
  await step(page,'person');
  await click(page,'chrome-tab-close',0);
  await click(page,'chrome-tab-close',0);
  eq(await id(page,'browser-view').count(),0,`${tag}: last tab closed the browser`);
  ok((await id(page,'app-toast').innerText()).includes('viimeinen välilehti'),`${tag}: says why`);
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
 ok(await vis(page,'chrome-window'),`${tag}: the same Chrome window`);
 ok(await fits(page),`${tag}: no overflow`);
 await shot(page,`${tag}`);
 await page.close();
}

const themes=quick?['light']:['light','dark'];
for(const theme of themes)for(const [w,h] of [[1440,900],[1440,780],[390,844]]){
 await walk(theme,w,h);
 await today(theme,w,h);
}
// The theme picker starts in Habitat's theme when no ?theme= is given.
{const page=await open(1440,900,'#ah-theme=dark');eq(await page.evaluate(()=>document.documentElement.dataset.theme),'dark','#ah-theme=dark opens dark');await page.close();}

// Picture sizes, review chrome hidden; Chrome's bookmarks bar off (its default) and on.
const sizes=[];
for(const [w,h] of [[1440,900],[1440,780],[1280,720],[390,844]]){
 for(const d of [0,1]) for(const bm of [0,1]){
  const page=await open(w,h,`?v=${d+1}&measure=1&state=person&bookmarks=${bm}`);
  await page.waitForTimeout(120);
  const o=id(page,'picture-size');
  const row={viewport:`${w}x${h}`,view:names[d],bookmarks:!!bm,width:+await o.getAttribute('data-width'),height:+await o.getAttribute('data-height'),page:+await o.getAttribute('data-page'),scale:+await o.getAttribute('data-scale')};
  ok(row.width>0,`size ${JSON.stringify(row)}`);
  sizes.push(row);
  if(w!==1280&&!bm) await shot(page,`koko-${row.view}-${w}x${h}`);
  await page.close();
 }
}
writeFileSync(`${out}/sizes.json`,JSON.stringify(sizes,null,1));
console.table(sizes);
eq(external,[],'no external requests');
eq(errors,[],'clean console');
await browser.close();
console.log(`${checks} checks passed`);
