// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. Serves
// the page under the Habitat view's sandbox CSP (opaque origin, scripts, no
// connect, no frames) and fails on any request besides the page itself, any
// iframe, or any change of address. Walks every direction at 1440 and 390 px
// in Päivä, Yö and Korkea kontrasti: the direction lines, the live
// conversation (corner control placement and touch size, the long quote
// inside the field, expand, jump, ✕, a new reply, send), the control matrix in
// light and dark, the quote matrix and the excerpt table (each rule's length,
// structure and what the agent receives). Screenshots at DPR 2; console clean.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-23-reply-to-message-3';
const [input,out]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <evidence-dir>');process.exit(2);}
mkdirSync(out,{recursive:true});
const html=readFileSync(input,'utf8');
const origin='https://view.test';
// The gateway's view CSP (internal/gateway/views_linux.go), self = the view host.
const csp=`sandbox allow-scripts; default-src 'none'; script-src ${origin} 'unsafe-inline' 'unsafe-eval'; style-src ${origin} 'unsafe-inline'; img-src ${origin} data: blob:; font-src ${origin} data:; media-src ${origin} data: blob:; connect-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none'; object-src 'none'; manifest-src 'none'; form-action 'none'; base-uri 'none'`;
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
let checks=0;const errors=[];const stray=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const dirs=['a','b','c'];
try{
for(const width of [1440,390])for(const theme of ['light','dark','contrast']){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:900},deviceScaleFactor:2,reducedMotion:'reduce',hasTouch:phone,isMobile:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 let served=0;
 await page.route('**/*',r=>{
  const u=r.request().url();
  if(u===`${origin}/view`&&served++===0)return r.fulfill({contentType:'text/html',headers:{'content-security-policy':csp},body:html});
  stray.push(u);return r.abort();
 });
 await page.goto(`${origin}/view`);
 await page.locator('#theme').selectOption(theme);
 await checkPicker(page,round);
 const tag=`${width}-${theme}`;
 const full=theme==='light';
 const capture=async(name,always=false,opts={})=>{if(!full&&!always)return;await page.waitForTimeout(120);await page.screenshot({path:`${out}/${name}-${tag}.png`,...opts});};
 const fits=async()=>ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${tag}: document overflow`);
 ok(await page.evaluate(()=>origin==='null'),`${tag}: runs in an opaque-origin sandbox`);
 ok(await page.locator('iframe, frame, object, embed').count()===0,`${tag}: no frames`);
 const live=page.getByTestId('conversation');
 const quote=live.getByTestId('composer-quote');
 for(const d of [0,1,2]){
  const n=dirs[d];
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.rp-review.variant-${d}`).waitFor({state:'attached'});
  await page.getByTestId('rp-reset').click();
  await page.evaluate(()=>scrollTo(0,0));
  // One line per direction for each study, the current one marked.
  for(const s of ['control','quote','excerpt'])ok(await page.getByTestId(`lines-${s}`).locator('li').count()===3,`${n}: ${s} has three lines`);
  ok((await page.getByTestId('lines-control').locator('li[aria-current]').innerText()).startsWith('ABC'[d]),`${n}: current control line`);
  ok((await page.getByTestId('lines-excerpt').locator('li[aria-current]').innerText()).startsWith('c '),`${n}: excerpt c current by default`);
  // The long quote sits inside the field box, field-wide.
  await quote.waitFor();
  ok(await quote.evaluate(el=>!!el.closest('.ah-cbox')),`${n}: quote inside the field box`);
  ok((await quote.innerText()).includes('9.20'),`${n}: quote names 9.20`);
  const qh=(await quote.boundingBox()).height;
  ok(qh<(phone?190:170),`${n}: collapsed quote stays small (${qh})`);
  const sides=await quote.evaluate(el=>{const s=getComputedStyle(el);return [s.borderLeftWidth,s.borderTopWidth,s.borderLeftColor,s.borderTopColor];});
  ok(sides[0]===sides[1]&&sides[2]===sides[3],`${n}: no left accent bar`);
  // The corner control: in the actions slot, after the time, top-right.
  const ctl=live.getByTestId('reply-a3');
  const place=await ctl.evaluate(el=>{const h=el.closest('header'),t=h?.querySelector('time'),c=h?.closest('.ah-message');
   const r=el.getBoundingClientRect(),cr=c.getBoundingClientRect();
   return {slot:!!el.closest('.ah-message-actions'),after:r.left>t.getBoundingClientRect().right,right:cr.right-r.right,size:[r.width,r.height]};});
  ok(place.slot&&place.after&&place.right<40,`${n}: control in the top-right corner (${JSON.stringify(place)})`);
  const want=phone?(d===0?40:32):(d===0?32:26);
  ok(Math.round(place.size[1])===want,`${n}: control height ${place.size[1]} ≠ ${want}`);
  if(d===2)ok(phone?place.size[0]===place.size[1]:place.size[0]>place.size[1]+20,`${n}: C carries its word on desktop only`);
  ok(await ctl.getAttribute('aria-pressed')==='true',`${n}: quoted message's control pressed`);
  const opacity=await live.getByTestId('reply-a4').evaluate(el=>getComputedStyle(el.closest('.rp-ctl')).opacity);
  ok((opacity==='0')===(d===1&&!phone),`${n}: control at rest ${opacity}`);
  // The default view: the latest message's corner control and the quote are
  // on screen (desktop), and the floating picker leaves the composer's row free.
  if(!phone){
   const vis=await live.getByTestId('reply-a4').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;});
   ok(vis,`${n}: latest message's control visible by default`);
   const crow=await live.locator('.ah-cbox').boundingBox(),pk=await page.locator('nav.proto-picker').boundingBox();
   ok(crow.y+crow.height<=pk.y,`${n}: picker clear of the composer`);
  }
  await fits();await capture(`${n}-1-oletus`,true);
  // Expand (B, C), and its bounded growth.
  if(d!==0){
   const more=quote.getByTestId('quote-more');
   ok(await more.count()===1,`${n}: long quote offers more`);
   await more.click();
   const open=(await quote.boundingBox()).height;
   ok(open>qh,`${n}: opening grows the quote`);
   const room=await live.evaluate(el=>el.getBoundingClientRect().height);
   ok(open<room*0.6,`${n}: open quote leaves the conversation room (${open}/${room})`);
   if(d===1)ok(await quote.locator('pre').count()===1,`${n}: B shows the whole message, code included`);
   if(d===2)ok((await quote.locator('.rp-q-body').innerText()).trim().endsWith('…'),`${n}: C opens to the excerpt only`);
   await capture(`${n}-2-avattu`);
   await quote.getByTestId('quote-more').click();
  }
  // Jump to the original within the conversation, not the page.
  const pageY=await page.evaluate(()=>scrollY);
  await live.locator('[data-item="u1"]').evaluate(el=>el.scrollIntoView({block:'start'}));
  await page.evaluate(y=>scrollTo(0,y),pageY);
  await quote.getByTestId('quote-jump').click();
  await page.waitForTimeout(150);
  ok(await live.locator('[data-item="a3"][data-flash]').count()===1,`${n}: original flashes`);
  ok(await live.locator('[data-item="a3"]').evaluate(el=>{const r=el.getBoundingClientRect(),b=el.closest('.rp-live').getBoundingClientRect();return r.bottom>b.top&&r.top<b.bottom;}),`${n}: original in view`);
  // ✕ keeps the draft; another control starts a new reply.
  await quote.getByTestId('quote-remove').click();
  ok(await quote.count()===0,`${n}: ✕ removes the quote`);
  ok((await live.locator('.ah-cbox-field').inputValue()).startsWith('Aloita'),`${n}: draft stays`);
  const other=live.getByTestId('reply-a2');
  await live.locator('[data-item="a2"]').evaluate(el=>el.scrollIntoView({block:'center'}));
  await live.locator('[data-item="a2"] .ah-message').hover().catch(()=>{});
  await other.click();
  await quote.waitFor();
  ok((await quote.innerText()).includes('9.18'),`${n}: control quotes 9.18`);
  if(d===2)ok(await quote.locator('.rp-q-code').count()===1,`${n}: code-first excerpt shows code`);
  // Send: the sent message carries the quote; the side shows what Pi got.
  await live.locator('.ah-cbox-field').fill('Hyvä testi.');
  await live.locator('.ah-cbox-field').press('Enter');
  await live.locator('[data-item^="r"]').first().waitFor();
  ok(await live.getByTestId('sent-quote').count()===1,`${n}: sent message carries the quote`);
  const side=await page.getByTestId('side-c').innerText();
  ok(side.startsWith('<reply-to entry="3e90b4c7">\n```python')&&side.endsWith('Hyvä testi.'),`${n}: side shows c's block and the text`);
  await fits();await capture(`${n}-3-lahetetty`,width===1440);
 }
 // Sections: the control matrix (both themes), the quote matrix, the excerpt table.
 const matrix=page.getByTestId('section-control');
 ok(await matrix.locator('[data-theme="dark"] .rp-cell').count()===18,`${tag}: dark matrix has every state`);
 const hover=await matrix.locator('[data-theme="light"] [data-direction="B"] [data-state="Osoitin"] .rp-ctl').evaluate(el=>getComputedStyle(el).opacity);
 ok(hover==='1',`${tag}: B shows under the pointer`);
 const touchC=await matrix.locator('[data-theme="light"] [data-direction="C"] [data-state="Puhelin"] .rp-ctl button').boundingBox();
 ok(Math.round(touchC.height)===32&&Math.round(touchC.width)===32,`${tag}: C on touch is a 32 px glyph`);
 const focus=await matrix.locator('[data-theme="dark"] [data-direction="A"] [data-state="Fokus"] .rp-ctl button').evaluate(el=>getComputedStyle(el).outlineStyle);
 ok(focus==='solid',`${tag}: focus state draws the ring`);
 await matrix.scrollIntoViewIfNeeded();
 if(full||width===1440)await matrix.screenshot({path:`${out}/s1-painike-${tag}.png`});
 const qs=page.getByTestId('section-quote');
 ok(await qs.getByTestId('composer-quote').count()===8,`${tag}: quote matrix has every state`);
 if(full)await qs.screenshot({path:`${out}/s2-lainaus-${tag}.png`});
 const ex=page.getByTestId('section-excerpt');
 const agent=async(id,e)=>ex.getByTestId(`agent-${id}-${e}`).innerText();
 for(const id of ['a4','a3','a2','a1'])for(const e of ['a','b','c']){
  const t=await agent(id,e);
  const body=t.split('\n').slice(1,-1).join('\n');
  ok(t.startsWith('<reply-to entry=')&&t.endsWith('</reply-to>'),`${id}${e}: block shape`);
  ok(body.length<=300,`${id}${e}: excerpt bounded (${body.length})`);
 }
 ok((await agent('a4','a'))===(await agent('a4','c')),`${tag}: short message identical in a and c`);
 ok(!(await agent('a2','a')).includes('\n```python\n'),`${tag}: a flattens the code block`);
 ok((await agent('a2','c')).includes('```python\ndef test_dst_march():'),`${tag}: c keeps the code block`);
 ok((await agent('a1','c')).includes('\n1. **zoneinfo**'),`${tag}: c keeps the list`);
 ok((await agent('a3','b')).includes('esim. …'),`${tag}: b stops at an abbreviation`);
 await ex.locator('input[value="a"]').check();
 ok((await page.getByTestId('lines-excerpt').locator('li[aria-current]').innerText()).startsWith('a '),`${tag}: picking a marks its line`);
 await ex.locator('input[value="c"]').check();
 if(full||width===1440)await ex.screenshot({path:`${out}/s3-ote-${tag}.png`});
 await fits();
 ok(served===1,`${tag}: one document load, no navigation`);
 ok(page.url()===`${origin}/view`,`${tag}: address unchanged (${page.url()})`);
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(stray,[],`requests besides the view:\n${stray.join('\n')}`);
assert.deepEqual(errors,[],`console errors:\n${errors.join('\n')}`);
console.log(`${checks} checks passed; screenshots in ${out}`);
