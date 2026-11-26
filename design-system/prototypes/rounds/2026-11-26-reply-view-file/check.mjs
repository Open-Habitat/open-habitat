// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. Serves
// the page under the Habitat view's sandbox CSP (opaque origin, scripts, no
// connect, no frames) and fails on any request besides the page itself, any
// iframe, or any change of address. Walks every direction (Now, A Corner,
// B Row, C To the file) at 1440 and 390 px in Päivä, Yö and Korkea kontrasti
// with reduced motion, in Finnish, and twice in English: where the card's ↩
// sits and when it shows (pointer, focus, touch), the field's quote (head,
// title cut at two lines with "…", facts in B and C), the sent quote, the
// literal <reply-to> block, the jump to the card, ✕ keeping the draft, a
// reply to the package and (C) to one file of it from the panel's rows, a
// reply to an agent message beside them, sending, no overflow. Screenshots
// at DPR 2; console clean.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-26-reply-view-file';
const [input,out]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <evidence-dir>');process.exit(2);}
mkdirSync(out,{recursive:true});
const html=readFileSync(input,'utf8');
const origin='https://view.test';
// The gateway's view CSP (internal/gateway/views_linux.go), self = the view host.
const csp=`sandbox allow-scripts; default-src 'none'; script-src ${origin} 'unsafe-inline' 'unsafe-eval'; style-src ${origin} 'unsafe-inline'; img-src ${origin} data: blob:; font-src ${origin} data:; media-src ${origin} data: blob:; connect-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none'; object-src 'none'; manifest-src 'none'; form-action 'none'; base-uri 'none'`;
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
let checks=0;const errors=[];const stray=[];const facts=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const names=['nyt','a','b','c'];
const W={
 fi:{view:'Vastaat näkymään',pkg:'Vastaat tiedostopakettiin',file:'Vastaat tiedostoon',msg:'Vastaat agentin viestiin',viewFacts:'Näkymä · 12 tiedostoa · 7,5 Mt',inPkg:'paketista',sentFile:'Agentin tiedosto'},
 en:{view:'Replying to the view',pkg:'Replying to the file package',file:'Replying to the file',msg:"Replying to the agent's message",viewFacts:'View · 12 files · 7.5 MB',inPkg:'from the package',sentFile:"Agent's file"},
};
const runs=[];
for(const width of (process.env.WIDTHS?process.env.WIDTHS.split(',').map(Number):[1440,390]))for(const theme of ['light','dark','contrast'])runs.push({width,theme,lang:'fi'});
runs.push({width:1440,theme:'light',lang:'en'},{width:390,theme:'dark',lang:'en'});
try{
for(const {width,theme,lang} of runs){
 const phone=width===390,w=W[lang];
 const page=await browser.newPage({viewport:{width,height:phone?844:1000},deviceScaleFactor:2,reducedMotion:'reduce',hasTouch:phone,isMobile:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 let served=0;
 await page.route('**/*',r=>{
  const u=r.request().url();
  if(u===`${origin}/view`&&served++===0)return r.fulfill({contentType:'text/html',headers:{'content-security-policy':csp},body:html});
  stray.push(u);return r.abort();
 });
 await page.goto(`${origin}/view`);
 await page.locator('#theme').selectOption(theme);
 await page.locator('#lang').selectOption(lang);
 await checkPicker(page,round);
 const tag=`${width}-${theme}-${lang}`;
 const full=theme==='light'||lang==='en';
 // A full-page capture of an emulated phone resets Playwright's touch media
 // (hover: none stops matching), so a phone shot is the viewport at the
 // conversation's frame.
 const shot=async(name,always=false)=>{if(!full&&!always)return;
  if(phone)await page.evaluate(()=>document.querySelector('.or-frame').scrollIntoView({block:'start'}));else await page.mouse.move(1,1);
  await page.waitForTimeout(120);await page.screenshot({path:`${out}/${name}-${tag}.png`,fullPage:!phone});
  ok(await page.evaluate(()=>matchMedia('(hover: none)').matches)===phone,`${tag} ${name}: touch media kept`);};
 const fits=async(m)=>ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${tag} ${m}: document overflow`);
 ok(await page.evaluate(()=>origin==='null'),`${tag}: opaque-origin sandbox`);
 ok(await page.locator('iframe, frame, object, embed').count()===0,`${tag}: no frames`);
 ok(await page.evaluate(()=>document.documentElement.lang)===lang,`${tag}: document language`);
 const hover=await page.evaluate(()=>matchMedia('(hover: hover)').matches);
 ok(hover===!phone,`${tag}: hover media ${hover}`);
 ok(await page.evaluate(()=>matchMedia('(hover: none)').matches)===phone,`${tag}: hover none`);
 const frame=page.locator('.or-frame');
 const quote=page.getByTestId('composer-quote');
 const pending=page.getByTestId('agent-pending');
 const cardOf=c=>page.locator(`.or-cardwrap[data-card="${c}"]`);
 const visible=l=>l.evaluate(e=>{const s=getComputedStyle(e);return s.visibility!=='hidden'&&s.opacity!=='0'&&e.getClientRects().length>0;});
 const tapOrClick=l=>phone?l.tap():l.click();
 for(const d of (process.env.DIRS?process.env.DIRS.split(",").map(Number):[0,1,2,3])){
  const n=`${tag} ${names[d]}`;
  await tapOrClick(page.locator('.proto-picker-item').nth(d));
  await page.locator(`.or-review.variant-${d}`).waitFor({state:'attached'});
  await tapOrClick(page.getByTestId('reset'));
  await page.evaluate(()=>scrollTo(0,0));
  ok(await page.getByTestId('lines').locator('li').nth(d).getAttribute('aria-current')==='true',`${n}: current line`);
  ok(await page.getByTestId('view-offer').count()===1&&await page.getByTestId('file-offer').count()===2,`${n}: one view card, two file cards`);
  ok(await page.getByTestId('message-reply').count()===3,`${n}: the agent's three messages keep their ↩`);
  const replies=page.getByTestId('card-reply');
  if(d===0){
   ok(await replies.count()===0,`${n}: no ↩ on cards today`);
   ok(await quote.count()===0,`${n}: no quote`);
   ok(await page.getByTestId('sent-quote').count()===0,`${n}: no sent quote`);
   ok(await page.getByTestId('agent-pending-none').count()===1,`${n}: nothing pending`);
   ok(!(await page.getByTestId('agent-sent').first().innerText()).includes('<reply-to'),`${n}: today the agent gets only the text`);
   await fits(`${n} default`);await shot(`${names[d]}-1-oletus`,true);
   continue;
  }
  ok(await replies.count()===3,`${n}: ↩ on every card`);
  // Where ↩ sits, and when it shows.
  for(const c of ['view','pdf','pkg']){
   const r=cardOf(c).getByTestId('card-reply');
   const inRow=await r.evaluate(e=>!!e.closest('.ah-offer-icons'));
   ok(inRow===(d===2),`${n} ${c}: ↩ ${d===2?'in':'beside'} the card's icon row`);
   if(d!==2||phone)ok(await visible(r),`${n} ${c}: ↩ shown at rest ${await r.evaluate(e=>{const a=e.closest('.ah-offer-acts')||e;const s=getComputedStyle(e),t=getComputedStyle(a);const rules=[];const walk=(list,cond)=>{for(const r of list){if(r.cssRules&&r.media){walk(r.cssRules,r.media.mediaText);continue;}if(r.selectorText&&a.matches(r.selectorText)&&r.style.position)rules.push(cond+' '+r.selectorText+' '+r.style.position);}};for(const sh of document.styleSheets)walk(sh.cssRules,'');return [s.visibility,s.opacity,t.visibility,t.opacity,t.position,a.className,a.parentElement.className,rules.join(' | ')].join()})}`);
   else ok(!(await visible(r)),`${n} ${c}: ↩ hidden at rest on a desktop`);
  }
  const vr=cardOf('view').getByTestId('card-reply');
  if(d===2&&!phone){
   await cardOf('view').locator('.ah-offer').hover();
   ok(await visible(vr),`${n}: ↩ shown under the pointer`);
   await page.mouse.move(1,1);
   await cardOf('view').getByTestId('offer-open').focus();await page.keyboard.press('Tab');
   ok(await visible(vr),`${n}: ↩ shown with keyboard focus in the card`);
  }
  const card=await cardOf('view').locator('.ah-offer').boundingBox();
  if(d===2&&!phone)await cardOf('view').locator('.ah-offer').hover();
  const rb=await vr.boundingBox();
  facts.push(`${n}: card ↩ ${Math.round(rb.width)}×${Math.round(rb.height)} at ${Math.round(card.x+card.width-rb.x-rb.width)} px from the card's right, ${Math.round(rb.y-card.y)} px from its top`);
  if(d!==2){
   ok(card.x+card.width-(rb.x+rb.width)<=12&&rb.y-card.y<=12,`${n}: ↩ in the card's top-right corner`);
   const mb=await page.getByTestId('message-reply').first().boundingBox();
   ok(Math.round(rb.width)===Math.round(mb.width)&&Math.round(rb.height)===Math.round(mb.height),`${n}: ↩ the size of the message's ↩ (${rb.width} vs ${mb.width})`);
   // The title never runs under the corner control.
   const title=await cardOf('view').getByTestId('offer-title').boundingBox();
   ok(title.x+title.width<=rb.x+1,`${n}: title clear of ↩`);
  }else if(phone)ok(rb.y>card.y+card.height/2,`${n}: ↩ on the card's bottom row on touch`);
  if(!phone)await page.mouse.move(1,1);
  // The field's quote: replying to the view.
  ok(await quote.count()===1&&await quote.getAttribute('data-card')==='view',`${n}: the field quotes the view`);
  ok((await quote.getByTestId('quote-head').innerText())===w.view,`${n}: quote head`);
  ok(await vr.getAttribute('aria-pressed')==='true',`${n}: the view's ↩ stays pressed`);
  const qt=quote.getByTestId('quote-title');
  ok((await qt.evaluate(e=>getComputedStyle(e).webkitLineClamp))==='2',`${n}: title at most two lines`);
  if(phone)ok(await qt.evaluate(e=>e.scrollHeight>e.clientHeight+1),`${n}: the long title is cut ("…") on a phone`);
  ok(await quote.getByTestId('quote-facts').count()===(d===1?0:1),`${n}: facts in the quote only in B and C`);
  if(d!==1)ok((await quote.getByTestId('quote-facts').innerText())===w.viewFacts,`${n}: quote facts`);
  // What the agent would get.
  const p=await pending.innerText();
  ok(p.startsWith('<reply-to entry="4c1e9a07">\nView you offered: "')&&p.includes('view_id vk3qzm7d2xw4a6b5c7e2f3g4h5j')&&p.includes('Source: dist/ajat-3/'),`${n}: pending block ${p.slice(0,80)}`);
  // The sent reply to the PDF.
  const sq=page.getByTestId('sent-quote');
  ok(await sq.count()===1&&await sq.getAttribute('data-card')==='pdf',`${n}: the sent message quotes the PDF`);
  ok((await sq.innerText()).includes(w.sentFile)&&(await sq.innerText()).includes('vuosikertomus-2026.pdf'),`${n}: sent quote words`);
  const s0=await page.getByTestId('agent-sent').first().innerText();
  ok(s0.startsWith('<reply-to entry="9b20d4e1">\nFile you offered: "vuosikertomus-2026.pdf"'),`${n}: sent block`);
  await fits(`${n} default`);await shot(`${names[d]}-1-oletus`,true);
  // The quote leads to its card.
  await tapOrClick(quote.getByTestId('quote-jump'));
  ok(await cardOf('view').locator('.ah-offer[data-located]').count()===1,`${n}: jump lights the view card`);
  await tapOrClick(sq);
  ok(await cardOf('pdf').locator('.ah-offer[data-located]').count()===1,`${n}: the sent quote lights the PDF card`);
  await shot(`${names[d]}-2-hyppy`);
  // ✕ removes the quote and keeps the draft.
  const field=frame.locator('textarea');
  const draft=await field.inputValue();
  ok(draft.length>10,`${n}: a draft`);
  await tapOrClick(quote.getByTestId('quote-remove'));
  ok(await quote.count()===0&&await field.inputValue()===draft,`${n}: ✕ keeps the draft`);
  ok(await page.getByTestId('agent-pending-none').count()===1,`${n}: nothing pending after ✕`);
  // A reply to the whole package from its card.
  const pr=cardOf('pkg').getByTestId('card-reply');
  await pr.scrollIntoViewIfNeeded();
  if(d===2&&!phone)await cardOf('pkg').locator('.ah-offer').hover();
  await tapOrClick(pr);
  ok(await quote.getAttribute('data-card')==='pkg'&&!(await quote.getAttribute('data-path')),`${n}: the field quotes the package`);
  ok((await quote.getByTestId('quote-head').innerText())===w.pkg,`${n}: package head`);
  ok((await pending.innerText()).includes('<reply-to entry="d71f0c3a">\nFiles you offered: "Vuosikertomuksen liitteet"'),`${n}: package block`);
  await shot(`${names[d]}-3-paketti`);
  // The package's file list: rows have their own ↩ only in C.
  if(!(await page.getByTestId('pane').count())){
   const open=cardOf('pkg').getByTestId('offer-open');await (phone?open.tap({force:true}):open.click({force:true}));
  }
  await page.getByTestId('offer-folder').waitFor();
  const rows=page.getByTestId('row-reply');
  if(d===3)await rows.first().waitFor({state:'attached'});else await page.waitForTimeout(100);
  ok(await page.getByTestId('offer-folder-row').count()===3,`${n}: three files in the panel`);
  ok(await rows.count()===(d===3?3:0),`${n}: row ↩ count ${await rows.count()}`);
  if(d===3){
   // The row's own icons: under the pointer or focus on a desktop, always on touch.
   for(const r of await rows.all())ok(await visible(r)===phone,`${n}: row ↩ at rest follows the row's icons`);
   const csv=page.locator('[data-testid="row-reply"][data-path="henkilosto.csv"]');
   if(!phone){await page.locator('.ah-offer-folder-row:has([data-path="henkilosto.csv"])').hover();ok(await visible(csv),`${n}: row ↩ under the pointer`);}
   await shot(`${names[d]}-4-tiedostot`);
   if(!phone)await page.locator('.ah-offer-folder-row:has([data-path="henkilosto.csv"])').hover();
   await tapOrClick(csv);
   ok(await quote.getAttribute('data-path')==='henkilosto.csv',`${n}: the field quotes one file`);
   ok((await quote.getByTestId('quote-head').innerText())===w.file,`${n}: file head`);
   const f=await quote.getByTestId('quote-facts').innerText();
   ok(f.includes(w.inPkg)&&f.includes('18'),`${n}: file facts ${f}`);
   ok(await page.getByTestId('pane').count()===(phone?0:1),`${n}: a phone returns to the field`);
   const fp=await pending.innerText();
   ok(fp.includes('<reply-to entry="d71f0c3a">\nFile henkilosto.csv in the files you offered as')&&fp.includes('Source: liitteet/henkilosto.csv'),`${n}: file block`);
   await shot(`${names[d]}-5-tiedostoon`);
  }else{
   await tapOrClick(page.locator('.ah-offer-pane [data-testid="close-view"], .ah-offer-pane button[aria-label*="Sulje"], .ah-offer-pane button[aria-label*="Close"]').first());
   ok(await page.getByTestId('pane').count()===0,`${n}: panel closed`);
  }
  if(await page.getByTestId('pane').count())await tapOrClick(page.locator('.ah-offer-pane button[aria-label*="Sulje"], .ah-offer-pane button[aria-label*="Close"]').first());
  // A reply to an agent message beside the cards uses production's quote.
  const mr=page.getByTestId('message-reply').last();
  await mr.scrollIntoViewIfNeeded();await tapOrClick(mr);
  ok((await quote.innerText()).includes(w.msg),`${n}: message quote`);
  ok((await pending.innerText()).startsWith('<reply-to entry="c2b4e6f8">'),`${n}: message block`);
  // Back to the view, and send.
  await vr.scrollIntoViewIfNeeded();
  if(d===2&&!phone)await cardOf('view').locator('.ah-offer').hover();
  await tapOrClick(vr);
  await tapOrClick(frame.getByTestId('send'));
  ok(await page.getByTestId('sent-quote').count()===2,`${n}: the sent reply carries its quote`);
  ok(await page.getByTestId('sent-quote').last().getAttribute('data-card')==='view',`${n}: last sent quotes the view`);
  ok(await quote.count()===0,`${n}: the field is clear after sending`);
  ok((await page.getByTestId('agent-sent').first().innerText()).startsWith('<reply-to entry="4c1e9a07">'),`${n}: sent block for the view`);
  await fits(`${n} sent`);await shot(`${names[d]}-6-lahetetty`);
 }
 ok(served===1,`${tag}: one document load`);
 ok(page.url()===`${origin}/view`,`${tag}: address unchanged`);
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(stray,[],`requests besides the view:\n${stray.join('\n')}`);
assert.deepEqual(errors,[],`console errors:\n${errors.join('\n')}`);
console.log([...new Set(facts)].filter(f=>/1440-light-fi|390-light-fi/.test(f)).join('\n'));
console.log(`${checks} checks passed; screenshots in ${out}`);
