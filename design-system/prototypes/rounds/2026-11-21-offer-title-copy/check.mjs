// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component check, not a host-backed acceptance test.
// Walks Nyt and the three directions at 1440 (Päivä, Yö, Kontrasti), at
// 1024 in English and on a 390 px touch phone (Päivä, Yö). In every case:
// the picker is sound, the direction's line is marked, four offers are in
// the conversation, each offer's right edge is the replies' right edge, and
// the document does not overflow sideways. Then each direction's own
// behaviour: Nyt cannot select the title (the defect); 1 selects the title
// by triple-click and with the keyboard's Copy puts it on the clipboard, a
// click on the title does not open the card, the rest of the card does;
// 2's button follows the card's open press in Tab order, is named after the
// title, copies the plain title or kind and title, and stays inside the
// long-titled card; 3's Viittaa puts the title in the field unsent, with the
// caret after it, and a second Viittaa continues the sentence. On the phone
// 2's button is fully visible at rest and 3's has a 32 px target. The
// console stays clean. Screenshots at device scale 2,
// <n>-<direction>-<case>.png; --quick takes only 1440 light.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-21-offer-title-copy';
const [input,out,flag]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <out-dir> [--quick]');process.exit(2);}
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['nyt','valinta','kopioi','viittaa'];
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};
const TITLE={fi:'Retkireitit kartalla – kesä 2026',en:'Hiking routes on a map – summer 2026'};
const CSV_FI='Nuuksion ja Sipoonkorven reittivertailu, pituudet, nousut ja pysäköintipaikat, päivitetty kesäkuun maastokäyntien jälkeen';

async function open({width,theme='light',lang='fi',d=0}){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:900},deviceScaleFactor:2,reducedMotion:'reduce',hasTouch:phone,isMobile:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto(`http://prototype.test/?${new URLSearchParams({theme,lang,v:String(d+1)})}`);
 await page.locator(`.ot-review[data-direction="${d}"]`).waitFor({state:'attached'});
 await page.locator('[data-testid="view-offer"]').waitFor();
 await page.waitForTimeout(150);
 return page;
}
const shot=(page,d,tag)=>page.screenshot({path:`${out}/${d+1}-${names[d]}-${tag}.png`});
const clip=page=>page.locator('[data-testid="clipboard"] q').innerText();

async function common(page,d,tag,lang='fi'){
 await checkPicker(page,round);checks++;
 eq(await page.locator('.ot-lines li[aria-current]').count(),1,`${tag}: one line marked`);
 const marked=await page.locator('.ot-lines li[aria-current]').innerText();
 ok(marked.startsWith(d===0?(lang==='fi'?'Nyt':'Now'):String(d)),`${tag}: the direction's own line is marked`);
 eq(await page.locator('.ot-offer').count(),4,`${tag}: four offers in a row`);
 const g=await page.evaluate(()=>{
  const r=e=>e.getBoundingClientRect();
  const msgs=[...document.querySelectorAll('.ah-feed .ah-message')].map(e=>Math.round(r(e).right));
  const offers=[...document.querySelectorAll('.ah-feed .ah-offer')].map(e=>Math.round(r(e).right));
  const lefts=[...document.querySelectorAll('.ah-feed .ah-offer, .ah-feed .ah-message[data-reply-complete], .ah-feed .ah-message:not([data-voice])')].map(e=>Math.round(r(e).left));
  return {msgs,offers,over:document.documentElement.scrollWidth-innerWidth,titles:[...document.querySelectorAll('.ah-offer-title')].map(t=>t.getBoundingClientRect().right-t.closest('.ah-offer').getBoundingClientRect().right)};
 });
 const replyRight=Math.max(...g.msgs);
 for(const r of g.offers)ok(Math.abs(r-replyRight)<=1,`${tag}: offer right edge ${r} is the replies' ${replyRight}`);
 ok(g.over<=0,`${tag}: no sideways overflow (${g.over})`);
 for(const t of g.titles)ok(t<=0,`${tag}: titles stay inside their cards`);
}

async function behaviour(page,d,phone,lang='fi'){
 const view=page.locator('[data-testid="view-offer"]');
 const title=view.locator('.ah-offer-title');
 if(d===0||d===1){
  // Nyt: the press layer takes the pointer over the title, which is the
  // defect; click where the title is, as a person would.
  await title.click({clickCount:3,force:d===0});
  const sel=await page.evaluate(()=>document.getSelection().toString().trim());// the selection itself may end in the paragraph break
  if(d===0){ok(sel==='',`Nyt: the title cannot be selected (got "${sel}")`);ok(await view.getAttribute('data-open')==='true',`Nyt: a press on the title opens`);}
  else{
   eq(sel,TITLE[lang],'1: triple-click selects the whole title');
   await page.keyboard.press('Control+C');
   eq(await clip(page),TITLE[lang],'1: the browser Copy puts the title on the clipboard');
   eq(await view.getAttribute('data-open'),null,'1: clicking the title does not open the card');
   await view.locator('.ah-offer-facts').first().click({force:true});// the press layer beneath takes it
   eq(await view.getAttribute('data-open'),'true','1: the rest of the card still opens it');
   await view.locator('.ah-offer-facts').first().click({force:true});// the press layer beneath takes it
   await page.locator('[data-testid="file-offer"]').first().locator('[data-testid="offer-open"]').focus();
   await page.keyboard.press('Enter');
   eq(await page.locator('[data-testid="file-offer"]').first().getAttribute('data-open'),'true','1: Enter on the card opens it');
  }
 }
 if(d===2){
  const btn=view.locator('[data-testid="offer-copy-title"]');
  eq(await btn.getAttribute('aria-label'),(lang==='fi'?'Kopioi otsikko: ':'Copy title: ')+TITLE[lang],'2: the button is named after the title');
  if(phone){
   eq(await btn.evaluate(e=>getComputedStyle(e).opacity),'1','2: on the phone the button is clear at rest');
  }else{
   ok(Number(await btn.evaluate(e=>getComputedStyle(e).opacity))<1,'2: faint at rest on the desktop');
   await view.hover({position:{x:200,y:40}});
   eq(await btn.evaluate(e=>getComputedStyle(e).opacity),'1','2: clear under the pointer');
   await view.locator('[data-testid="offer-open"]').focus();
   await page.keyboard.press('Tab');
   ok(await btn.evaluate(e=>e===document.activeElement),'2: Tab from the card press reaches its copy button');
  }
  await btn.click();
  eq(await clip(page),TITLE[lang],'2: copies the plain title');
  eq(await btn.getAttribute('data-copied'),'yes','2: production CopyButton says Copied');
  eq(await view.getAttribute('data-open'),null,'2: copying does not open the card');
  const csv=page.locator('[data-testid="file-offer"]').first();
  const box=await csv.locator('[data-testid="offer-copy-title"]').boundingBox(),card=await csv.boundingBox();
  ok(box.x>=card.x&&box.x+box.width<=card.x+card.width+0.5,'2: the long title\'s button stays inside its card');
  if(!phone&&lang==='fi'){
   await page.selectOption('#format','kind');
   await page.locator('[data-testid="file-offer"]').first().locator('[data-testid="offer-copy-title"]').click();
   eq(await clip(page),`taulukko ”${CSV_FI}”`,'2: kind and title when chosen');
   await page.selectOption('#format','plain');
  }
 }
 if(d===3){
  const field=page.locator('.ah-composer textarea');
  const csv=page.locator('[data-testid="file-offer"]').first();
  if(phone){const h=(await csv.locator('[data-testid="offer-refer"]').boundingBox()).height;ok(h>=32,`3: 32 px touch target (${h})`);}
  await csv.locator('[data-testid="offer-refer"]').click();
  await page.waitForTimeout(80);
  const t1=lang==='fi'?CSV_FI:await csv.locator('.ah-offer-title').innerText();
  eq(await field.inputValue(),`${t1} `,'3: the title is in the field, unsent');
  ok(await field.evaluate(e=>e===document.activeElement&&e.selectionStart===e.value.length),'3: the field has focus with the caret after it');
  eq(await csv.getAttribute('data-open'),null,'3: Viittaa does not open the card');
  await page.keyboard.type(lang==='fi'?'ja ':'and ');
  await view.locator('[data-testid="offer-refer"]').click();
  await page.waitForTimeout(80);
  eq(await field.inputValue(),`${t1} ${lang==='fi'?'ja':'and'} ${TITLE[lang]} `,'3: a second reference continues the sentence');
  eq(await view.locator('[data-testid="offer-refer"]').getAttribute('aria-label'),(lang==='fi'?'Viittaa viestissä: ':'Refer to in a message: ')+TITLE[lang],'3: named after the title');
 }
}

const cases=quick?[{width:1440}]:[
 {width:1440},{width:1440,theme:'dark'},{width:1440,theme:'contrast'},
 {width:1024,lang:'en'},{width:390},{width:390,theme:'dark'},
];
for(const c of cases){
 for(let d=0;d<4;d++){
  const tag=`${c.width}-${c.theme??'light'}${c.lang==='en'?'-en':''}`;
  const page=await open({...c,d});
  await common(page,d,`${d+1} ${tag}`,c.lang);
  await shot(page,d,tag);
  if(!c.theme||c.theme==='light')await behaviour(page,d,c.width===390,c.lang);
  if(d>0&&(!c.theme||c.theme==='light'))await shot(page,d,`${tag}-after`);
  await page.close();
 }
}
await browser.close();
assert.deepEqual(errors,[],'console clean');
console.log(`ok: ${checks} checks, screenshots in ${out}`);
