// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic lab, not a host-backed acceptance test. Walks the three
// directions in Päivä and Yö at 1440 × 900 and 390 × 844 (reduced motion):
// the picker contract; the lighter frame (no Take control button, no
// Leikepöytä, ⋯ holds the rare actions and the truth sentence); a click on
// the picture takes control; ⌘/Ctrl+V types; the long-paste refusal and its
// own button; tabs (close, the last-tab guard, the phone's tab menu); a
// popup as a marked tab; the mid-step question and "take when it's done";
// Valmis gives back, closes and says the remote clipboard was cleared;
// Close browser from ⋯; several tabs. Then it measures the picture in every
// direction and in production's sheet (?measure=1 hides the review chrome)
// at 1440 × 900, 1440 × 780 (a laptop screen minus the browser's own
// chrome), 1280 × 720 and 390 × 844 and writes <out-dir>/sizes.json.
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
const round='2026-11-27-palvelinselain-kehys-1';
const [input,out,flag]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <out-dir> [--quick]');process.exit(2);}
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['paneeli','koko-ikkuna','pilleri'];
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

async function walk(d,theme,width){
 const phone=width<600;
 const tag=`${names[d]}-${theme}-${width}`;
 const page=await open(width,phone?844:900,`?theme=${theme}`);
 await pick(page,d);
 await checkPicker(page,round);
 // Default: the agent waits for you in the sign-in tab.
 ok(await vis(page,'browser-view'),`${tag}: view open`);
 eq(await turn(page),'Agentti odottaa sinua',`${tag}: turn`);
 ok(await vis(page,'browser-says'),`${tag}: the agent's request shows`);
 eq(await id(page,'browser-take-control').count(),0,`${tag}: no Take control button`);
 eq(await id(page,'browser-clip-toggle').count(),0,`${tag}: no Leikepöytä`);
 eq(await page.getByText('Leikepöytä',{exact:true}).count(),0,`${tag}: no Leikepöytä text`);
 ok(await vis(page,'browser-close'),`${tag}: × while the agent drives`);
 eq(await id(page,'browser-done').count(),0,`${tag}: no Valmis while the agent drives`);
 eq(await page.locator('.sb-truth').count(),0,`${tag}: no truth line on screen`);
 ok(await fits(page),`${tag}: no horizontal overflow`);
 ok(await viewFits(page),`${tag}: view and bar fit`);
 await shot(page,`${tag}-1-odottaa`);
 // ⋯ holds the rare actions and the truth sentence.
 await id(page,'browser-more').first().click();await settle(page);
 ok(await vis(page,'browser-truth'),`${tag}: truth in ⋯`);
 ok(await vis(page,'menu-stop'),`${tag}: Close browser in ⋯`);
 eq(await id(page,'menu-paste').first().getAttribute('aria-disabled'),'true',`${tag}: long paste only while you drive`);
 await page.keyboard.press('Escape');await settle(page);
 ok(await vis(page,'browser-view'),`${tag}: Escape closed only the menu`);
 // A click on the picture takes control.
 await page.locator('.kh-picture').first().click({position:{x:40,y:40}});await settle(page);
 eq(await turn(page),'Sinä ohjaat',`${tag}: click took control`);
 ok(await vis(page,'browser-done'),`${tag}: Valmis while you drive`);
 eq(await id(page,'browser-close').count(),0,`${tag}: no × while you drive`);
 eq(await id(page,'browser-says').count(),0,`${tag}: request leaves the picture once you drive`);
 eq(await page.locator('.sb-frame[data-control="person"]').count(),1,`${tag}: solid frame`);
 if(phone) ok(await vis(page,'browser-keys'),`${tag}: phone keyboard button`);
 ok(await viewFits(page),`${tag}: view and bar fit while you drive`);
 // ⌘/Ctrl+V types the text.
 await page.locator('.kh-picture').first().press('Control+v');await settle(page);
 eq(await field(page,'user'),'aino.laine',`${tag}: Ctrl+V typed`);
 ok((await id(page,'browser-toast').first().innerText()).includes('näppäilyinä · 10 merkkiä'),`${tag}: typed toast`);
 await shot(page,`${tag}-2-ohjaat`);
 // Text too long for keystrokes: the refusal carries its own button.
 await id(page,'event-long-paste').click();await settle(page);
 ok(await vis(page,'browser-toast-action'),`${tag}: refusal button`);
 await id(page,'browser-toast-action').click();await settle(page);
 ok((await id(page,'browser-toast').first().innerText()).includes('etäkoneen leikepöydän kautta'),`${tag}: pasted via clipboard`);
 if(!quick){
  // Long paste dialog from ⋯ says the text is not hidden from the agent.
  await menu(page,'menu-paste');
  ok(await vis(page,'browser-text-dialog'),`${tag}: paste dialog`);
  ok((await id(page,'browser-text-dialog').innerText()).includes('ole agentilta piilossa'),`${tag}: honesty line`);
  await id(page,'browser-text').fill('pitkä teksti');
  await id(page,'browser-text-send').click();await settle(page);
  eq(await id(page,'browser-text-dialog').count(),0,`${tag}: dialog closed`);
 }
 // Valmis gives back, empties the remote clipboard and closes.
 await id(page,'browser-done').first().click();await settle(page);
 eq(await id(page,'browser-view').count(),0,`${tag}: Valmis closed the view`);
 ok((await id(page,'app-toast').innerText()).includes('leikepöytä tyhjennettiin'),`${tag}: cleared toast`);
 eq(await id(page,'browser-rail-row').first().getAttribute('data-state'),'agent',`${tag}: rail says agent`);
 await shot(page,`${tag}-3-annettu`);
 // Popup: a marked tab; × closes it and returns to its opener.
 await step(page,'popup');
 if(phone||d===2){
  await id(page,'browser-tab-menu').first().click();await settle(page);
  ok(await page.locator('.kh-menu-tab').filter({hasText:'ponnahdus'}).isVisible(),`${tag}: popup in the tab menu`);
  await shot(page,`${tag}-4-ponnahdus-valikko`);
  await id(page,'menu-close-tab').first().click();await settle(page);
 }else{
  ok(await page.locator('.kh-tab[data-popup]').isVisible(),`${tag}: popup tab`);
  eq(await page.locator('.kh-tab[data-active]').getAttribute('data-tab'),'vahvista',`${tag}: popup in front`);
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
 await page.waitForTimeout(1700);
 eq(await turn(page),'Sinä ohjaat',`${tag}: took after the step`);
 // ⋯ Give back and keep watching.
 await menu(page,'menu-give-keep');
 ok(await vis(page,'browser-view'),`${tag}: still open after give back and keep`);
 eq(await turn(page),'Agentti toimii',`${tag}: agent again`);
 if(!quick){
  // Several tabs; the last tab is not closed.
  await page.locator('#many').check();await settle(page);
  if(!phone&&d!==2) eq(await page.locator('.kh-tab').count(),4,`${tag}: four tabs`);
  else ok((await id(page,'browser-tab-menu').first().innerText()).includes('4'),`${tag}: tab count`);
  ok(await fits(page),`${tag}: many tabs fit`);
  await shot(page,`${tag}-6-monta`);
  await page.locator('#many').uncheck();await settle(page);
  await step(page,'person');
  for(let i=0;i<2;i++) await menu(page,'menu-close-tab');
  ok((await id(page,'browser-toast').first().innerText()).includes('Viimeistä välilehteä'),`${tag}: last tab guard`);
  // Close browser from ⋯.
  await menu(page,'menu-stop');
  eq(await id(page,'browser-view').count(),0,`${tag}: browser closed`);
  eq(await id(page,'browser-rail-row').first().getAttribute('data-state'),'stopped',`${tag}: rail says off`);
  // Production's sheet for comparison still opens.
  await step(page,'ask');
  await page.locator('#compare').check();await settle(page);
  ok(await vis(page,'browser-sheet'),`${tag}: production sheet`);
  await shot(page,`${tag}-7-nykyinen`);
 }
 ok(await fits(page),`${tag}: no overflow at the end`);
 await page.close();
}

const themes=quick?['light']:['light','dark'];
for(const d of [0,1,2])for(const theme of themes)for(const width of [1440,390]){
 await walk(d,theme,width);
}

// Picture sizes, review chrome hidden.
const sizes=[];
for(const [w,h] of [[1440,900],[1440,780],[1280,720],[390,844]]){
 for(const v of [...[0,1,2].map(d=>({d,compare:false})),{d:1,compare:true}]){
  for(const follow of v.compare?[false]:[false,true]){
   const page=await open(w,h,`?v=${v.d+1}&measure=1&state=person${v.compare?'&compare=1':''}${follow?'&follow=1':''}`);
   await page.waitForTimeout(120);
   const o=id(page,'picture-size');
   const row={viewport:`${w}x${h}`,view:v.compare?'nykyinen':names[v.d],follow,width:+await o.getAttribute('data-width'),height:+await o.getAttribute('data-height'),scale:+await o.getAttribute('data-scale')};
   ok(row.width>0,`size ${JSON.stringify(row)}`);
   sizes.push(row);
   if(follow===false&&w!==1280) await shot(page,`koko-${row.view}-${w}`);
   await page.close();
  }
 }
}
writeFileSync(`${out}/sizes.json`,JSON.stringify(sizes,null,1));
console.table(sizes);
eq(external,[],'no external requests');
eq(errors,[],'clean console');
await browser.close();
console.log(`${checks} checks passed`);
