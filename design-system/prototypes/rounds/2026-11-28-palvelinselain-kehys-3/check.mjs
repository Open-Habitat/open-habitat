// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic lab, not a host-backed acceptance test. Walks both
// directions (1 Osoite palkissa, 2 Komentoarkki) in Päivä and Yö at
// 1440 × 900, 1440 × 780 (laptop) and 390 × 844 (reduced motion, touch):
// the picker contract; the bar keeps round 2's frame (no Take control, no
// Leikepöytä, one end action) and its controls' adjacency (no overlap, inside
// the bar, even gaps, one row); the address opens from the origin, ⋯ and
// Ctrl+L without taking control; the field starts with the page's address;
// typing suggests bookmarks and history, an origin match goes first, text
// that is not an address searches (named), a refused scheme cannot open;
// ↵ opens in the current tab and takes control, Alt+↵ and + open a new tab;
// while the agent is mid-step ↵ asks first and opens after Ota ohjaus nyt;
// history lists Tänään / Aiemmin and the source sentence, an entry opens,
// Tyhjennä historia opens Chrome's own page in a new tab and its button
// empties the list; a bookmark is added and removed; ⋯ Takaisin and Lataa
// uudelleen; Valmis still gives back. No external requests, no horizontal
// overflow, clean console.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-28-palvelinselain-kehys-3';
const [input,out,flag]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <out-dir> [--quick]');process.exit(2);}
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['palkki','arkki'];
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
const inView=(page,t)=>page.evaluate(t=>{const e=document.querySelector(`[data-testid="${t}"]`);if(!e)return false;const r=e.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1;},t);
const shot=(page,name)=>page.screenshot({path:`${out}/${name}.png`});
const rows=page=>id(page,'address-row').allInnerTexts();
const tabCount=async(page,phone)=>phone?+(await page.locator('.kh-tabcount').first().innerText()):await page.locator('.kh-tab').count();
async function menu(page,item){await id(page,'browser-more').first().click();await settle(page);await id(page,item).first().click();await settle(page);}
async function openAddress(page,phone){
 if(phone) await menu(page,'menu-address');
 else{await id(page,'browser-origin').first().click();await settle(page);}
}

async function adjacent(page,tag){
 const r=await page.evaluate(()=>{
  const bar=document.querySelector('[data-testid="browser-bar"]');const b=bar.getBoundingClientRect();
  const end=bar.querySelector('[data-testid="browser-bar-end"]');
  const items=[...end.children].filter(e=>e.getClientRects().length).map(e=>e.getBoundingClientRect());
  const lead=[...bar.querySelectorAll('.kh-tabs-wrap,.kh-tabmenu-wrap,.kh-addr')].filter(e=>e.getClientRects().length).map(e=>e.getBoundingClientRect());
  return {b:{l:b.left,r:b.right,t:b.top,bt:b.bottom},items:items.map(x=>({l:x.left,r:x.right,t:x.top,bt:x.bottom})),lead:lead.map(x=>({l:x.left,r:x.right}))};
 });
 ok(r.items.length>=1,`${tag}: bar end has its controls`);
 for(const x of r.items) ok(x.l>=r.b.l-0.5&&x.r<=r.b.r+0.5&&x.t>=r.b.t-0.5&&x.bt<=r.b.bt+0.5,`${tag}: control inside the bar`);
 const gaps=r.items.slice(1).map((x,i)=>x.l-r.items[i].r);
 ok(gaps.every(g=>g>=0&&g<=12),`${tag}: end controls adjacent ${JSON.stringify(gaps)}`);
 if(gaps.length) ok(Math.max(...gaps)-Math.min(...gaps)<=1,`${tag}: even gaps ${JSON.stringify(gaps)}`);
 const mids=r.items.map(x=>(x.t+x.bt)/2);
 ok(Math.max(...mids)-Math.min(...mids)<=2,`${tag}: one row`);
 for(const t of r.lead) ok(t.r<=r.items[0].l+0.5,`${tag}: tabs or field end before the end group`);
}

async function walk(d,theme,width,height){
 const phone=width<600;
 const tag=`${names[d]}-${theme}-${width}x${height}`;
 const page=await open(width,height,`?theme=${theme}`);
 if(d) await pick(page,d);
 await checkPicker(page,round);
 eq(await page.locator('.proto-picker-item').allInnerTexts(),['1 Osoite palkissa','2 Komentoarkki'],`${tag}: picker entries`);
 eq(await page.evaluate(()=>document.documentElement.dataset.theme),theme,`${tag}: theme`);
 // Round 2's frame stays.
 eq(await turn(page),'Agentti odottaa sinua',`${tag}: turn`);
 eq(await id(page,'browser-take-control').count(),0,`${tag}: no Take control button`);
 eq(await page.getByText('Leikepöytä',{exact:true}).count(),0,`${tag}: no Leikepöytä`);
 ok(await vis(page,'browser-close'),`${tag}: × while the agent drives`);
 ok(await fits(page),`${tag}: no horizontal overflow`);
 ok(await viewFits(page),`${tag}: view and bar fit`);
 if(!phone) ok(await vis(page,'browser-new-tab'),`${tag}: + new tab`);
 await adjacent(page,`${tag} agent`);
 await shot(page,`${tag}-1-odottaa`);
 // ⋯ holds address, history, bookmark, back, reload with shortcuts, and round 2's items.
 await id(page,'browser-more').first().click();await settle(page);
 for(const [t,l] of [['menu-address','Avaa osoite…'],['menu-history','Historia'],['menu-bookmark','Lisää kirjanmerkki'],['menu-back','Takaisin'],['menu-reload','Lataa uudelleen'],['menu-cut','Leikkaa'],['menu-paste','Liitä'],['menu-close-tab','Sulje välilehti'],['menu-stop','Sulje selain']])
  ok((await id(page,t).innerText()).includes(l),`${tag}: ${l} in ⋯`);
 if(!phone){
  ok((await id(page,'menu-address').innerText()).includes('Ctrl+L'),`${tag}: Ctrl+L shown`);
  ok((await id(page,'menu-history').innerText()).includes('Ctrl+H'),`${tag}: Ctrl+H shown`);
  ok((await id(page,'menu-back').innerText()).includes('Alt+←'),`${tag}: Alt+← shown`);
  await shot(page,`${tag}-1b-valikko`);
 }
 ok(await inView(page,'menu-stop'),`${tag}: ⋯ fits the screen`);
 await page.keyboard.press('Escape');await settle(page);
 // The address opens without taking control and starts with the page's address.
 await openAddress(page,phone);
 ok(await vis(page,'address-input'),`${tag}: address field`);
 eq(await page.evaluate(()=>document.activeElement?.dataset.testid),'address-input',`${tag}: field focused`);
 eq(await id(page,'address-input').inputValue(),'https://tunnistus.example/kirjaudu',`${tag}: prefilled with the page's address`);
 eq(await page.locator('.sb-frame[data-control="agent"]').count(),1,`${tag}: opening the field did not take control`);
 ok((await id(page,'address-gate').innerText()).includes('ottaa ohjauksen'),`${tag}: says opening takes control`);
 const empty=await rows(page);
 ok(empty.some(r=>r.includes('Laskut – Energia Oy')),`${tag}: bookmarks listed with an empty field`);
 if(d===0) await adjacent(page,`${tag} editing`);
 ok(await fits(page),`${tag}: field fits`);
 // Typing: an origin match goes first, then the search, named.
 await page.keyboard.type('kirj');await settle(page);
 const typed=await rows(page);
 ok(typed[0].includes('Lainat – Kirjasto'),`${tag}: origin match first ${JSON.stringify(typed[0])}`);
 ok(typed.some(r=>r.includes('Hae Googlella: kirj')),`${tag}: search named`);
 ok(await inView(page,'address-results'),`${tag}: suggestions on screen`);
 await shot(page,`${tag}-2-ehdotukset`);
 // ↵ opens it in this tab and takes control.
 await page.keyboard.press('Enter');await settle(page);
 eq(await id(page,'address-input').count(),0,`${tag}: field closed`);
 eq(await url(page),'https://kirjasto.example/lainat',`${tag}: opened in this tab`);
 eq(await turn(page),'Sinä ohjaat',`${tag}: opening took control`);
 eq(await tabCount(page,phone),2,`${tag}: still two tabs`);
 // Search fallback, and a refused scheme.
 await page.locator('.kh-picture').first().press('Control+l');await settle(page);
 ok(await vis(page,'address-input'),`${tag}: Ctrl+L opens the address`);
 await page.keyboard.type('javascript:alert(1)');await settle(page);
 eq((await rows(page))[0].startsWith('Vain http- ja https-osoitteet'),true,`${tag}: refused scheme`);
 await page.keyboard.press('Enter');await settle(page);
 eq(await url(page),'https://kirjasto.example/lainat',`${tag}: refused scheme did not open`);
 await id(page,'address-input').fill('sähkön hinta');await settle(page);
 eq((await rows(page))[0],'Hae Googlella: sähkön hinta\nPalvelinselaimen oletushaku',`${tag}: search first when nothing matches`);
 await page.keyboard.press('Alt+Enter');await settle(page);
 ok((await url(page)).startsWith('https://www.google.com/search?q='),`${tag}: searched`);
 eq(await tabCount(page,phone),3,`${tag}: Alt+Enter opened a new tab`);
 // + / Uusi välilehti opens an empty field for a new tab.
 if(phone){await id(page,'browser-tab-menu').first().click();await settle(page);await id(page,'menu-new-tab').click();await settle(page);}
 else{await id(page,'browser-new-tab').click();await settle(page);}
 eq(await id(page,'address-input').inputValue(),'',`${tag}: new tab's field is empty`);
 ok((await id(page,'address-foot').innerText()).includes('uuteen välilehteen'),`${tag}: says new tab`);
 await page.keyboard.type('sanomat.example');await settle(page);
 await page.keyboard.press('Enter');await settle(page);
 eq(await url(page),'https://sanomat.example/',`${tag}: + opened the address`);
 eq(await tabCount(page,phone),4,`${tag}: in a new tab`);
 // Back and reload from ⋯.
 await menu(page,'menu-close-tab');
 await menu(page,'menu-close-tab');
 eq(await url(page),'https://kirjasto.example/lainat',`${tag}: back on the library tab`);
 await menu(page,'menu-back');
 eq(await url(page),'https://tunnistus.example/kirjaudu',`${tag}: Takaisin`);
 await menu(page,'menu-reload');
 ok((await id(page,'browser-toast').first().innerText()).includes('ladattiin uudelleen'),`${tag}: Lataa uudelleen`);
 // Bookmarks: add the current page, see it, remove it.
 await menu(page,'menu-bookmark');
 ok((await id(page,'browser-toast').first().innerText()).startsWith('Kirjanmerkki lisätty'),`${tag}: bookmark added`);
 await menu(page,'menu-history');
 ok(await vis(page,'history-source'),`${tag}: history says where it comes from`);
 const hist=await rows(page);
 ok(hist.some(r=>r.startsWith('Kirjaudu – Tunnistus')),`${tag}: new bookmark listed`);
 const groups=await page.locator('.kh-group-label').allInnerTexts();
 for(const g of ['Kirjanmerkit','Tänään','Aiemmin']) ok(groups.includes(g),`${tag}: group ${g}`);
 await shot(page,`${tag}-3-historia`);
 const before=(await rows(page)).length;
 await page.locator('[data-kind="bookmark"]').filter({hasText:'Kirjaudu – Tunnistus'}).hover().catch(()=>{});
 await page.locator('[data-kind="bookmark"]').filter({hasText:'Kirjaudu – Tunnistus'}).getByTestId('bookmark-remove').click();await settle(page);
 eq((await rows(page)).length,before-1,`${tag}: bookmark removed`);
 // An entry opens in this tab.
 await page.locator('[data-kind="history"]').filter({hasText:'Jätehuolto – Kunta'}).click();await settle(page);
 eq(await url(page),'https://kunta.example/jatehuolto',`${tag}: history entry opened`);
 eq(await id(page,'history').count(),0,`${tag}: history closed`);
 // Clearing opens Chrome's own page in a new tab; its button empties the list.
 await menu(page,'menu-history');
 await id(page,'history-clear').click();await settle(page);
 eq(await url(page),'chrome://settings/clearBrowserData',`${tag}: Chrome's own clear page`);
 await shot(page,`${tag}-4-tyhjenna`);
 await id(page,'clear-data').click();await settle(page);
 ok((await id(page,'browser-toast').first().innerText()).includes('Kirjautumiset säilyivät'),`${tag}: cleared toast`);
 await menu(page,'menu-history');
 eq((await page.locator('[data-kind="history"]').count()),0,`${tag}: history empty`);
 await page.keyboard.press('Escape');await settle(page);
 // Mid-step: ↵ asks first, Ota ohjaus nyt then opens.
 await step(page,'agent');
 await openAddress(page,phone);
 ok((await id(page,'address-gate').innerText()).includes('kysyy ensin'),`${tag}: says it asks first`);
 await page.keyboard.type('energia.example/sopimus');await page.keyboard.press('Enter');await settle(page);
 ok(await vis(page,'browser-mid-step'),`${tag}: mid-step question`);
 eq(await url(page),'https://energia.example/laskut',`${tag}: nothing opened yet`);
 await shot(page,`${tag}-5-kesken`);
 await id(page,'browser-take-now').click();await settle(page);
 eq(await url(page),'https://energia.example/sopimus',`${tag}: opened after taking control`);
 eq(await turn(page),'Sinä ohjaat',`${tag}: and you drive`);
 if(!quick){
  // Mid-step, "take when it's done" opens after the step.
  await step(page,'agent');
  await menu(page,'menu-reload');
  ok(await vis(page,'browser-mid-step'),`${tag}: reload asks mid-step`);
  await id(page,'browser-take-after').click();await page.waitForTimeout(1800);
  ok((await id(page,'browser-toast').first().innerText()).includes('ladattiin uudelleen'),`${tag}: reloaded after the step`);
  // Bookmarks off: the minimal version disappears.
  await page.locator('#bookmarks').uncheck();await settle(page);
  await id(page,'browser-more').first().click();await settle(page);
  eq(await id(page,'menu-bookmark').count(),0,`${tag}: no bookmark item when off`);
  await page.keyboard.press('Escape');await settle(page);
  await page.locator('#bookmarks').check();await settle(page);
  // Many tabs still fit with + at the end.
  await page.locator('#many').check();await settle(page);
  ok(await viewFits(page),`${tag}: bar fits with many tabs`);
  await adjacent(page,`${tag} many`);
  await shot(page,`${tag}-6-monta`);
 }
 // Valmis gives back as in round 2.
 await step(page,'person');
 await id(page,'browser-done').first().click();await settle(page);
 eq(await id(page,'browser-view').count(),0,`${tag}: Valmis closed the view`);
 ok(await fits(page),`${tag}: no overflow at the end`);
 await page.close();
}

const themes=quick?['light']:['light','dark'];
for(const d of [0,1])for(const theme of themes)for(const [w,h] of [[1440,900],[1440,780],[390,844]]) await walk(d,theme,w,h);
// The theme picker starts in Habitat's theme when no ?theme= is given.
{const page=await open(1440,900,'#ah-theme=dark');eq(await page.evaluate(()=>document.documentElement.dataset.theme),'dark','#ah-theme=dark opens dark');await page.close();}
eq(external,[],'no external requests');
eq(errors,[],'clean console');
await browser.close();
console.log(`${checks} checks passed`);
