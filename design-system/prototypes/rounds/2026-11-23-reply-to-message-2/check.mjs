// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. Walks
// every direction at 1440 and 390 px in Päivä, Yö and Korkea kontrasti: the
// default view (a reply in progress, one sent reply in history), the quote's
// place and the original's mark, the jump from the composer quote and from
// the sent quote, ✕, a new reply from another reply's control, sending and
// what the native session records. Screenshots at DPR 2; console clean.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-23-reply-to-message-2';
const [input,out]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <evidence-dir>');process.exit(2);}
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['a-liite','b-kentassa','c-jonorivi'];
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
try{
for(const width of [1440,390])for(const theme of ['light','dark','contrast']){
 const page=await browser.newPage({viewport:{width,height:width===390?844:900},deviceScaleFactor:2,reducedMotion:'reduce',hasTouch:width===390});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 await checkPicker(page,round);
 const tag=`${width}-${theme}`;
 const full=theme==='light';
 const capture=async(name,always=false)=>{if(!full&&!always)return;await page.waitForTimeout(120);await page.screenshot({path:`${out}/${name}-${tag}.png`});};
 const fits=async()=>ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${tag}: document overflow`);
 const quote=page.getByTestId('composer-quote');
 const inView=async sel=>page.locator(sel).first().evaluate(el=>{const r=el.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight;});
 for(const d of [0,1,2]){
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.rp-review.variant-${d}`).waitFor({state:'attached'});
  await page.getByTestId('rp-reset').click();
  const n=names[d];
  assert.match(await page.getByTestId('direction-lines').locator('li[aria-current]').innerText(),/^[ABC] /);checks++;
  await quote.waitFor();
  ok((await quote.innerText()).includes('9.20'),`${n}: quote names the time`);
  ok(await page.getByTestId('sent-quote').count()===1,`${n}: one sent reply in history`);
  // Where the quote sits: above the box (A, C) or inside it (B).
  const inside=await quote.evaluate(el=>!!el.closest('.ah-cbox'));
  const box=await page.locator('.ah-cbox').boundingBox(),qb=await quote.boundingBox();
  ok(qb.x>=box.x-1&&qb.x+qb.width<=box.x+box.width+1,`${n}: quote within the field's width`);
  ok(inside===(d===1),`${n}: quote ${d===1?'inside':'above'} the field box`);
  // No coloured bar: the quote's left border is no wider than its others.
  const sides=await quote.evaluate(el=>{const s=getComputedStyle(el);return [s.borderLeftWidth,s.borderTopWidth,s.borderLeftColor,s.borderTopColor];});
  ok(sides[0]===sides[1]&&sides[2]===sides[3],`${n}: no left accent bar (${sides})`);
  // The reply control's place.
  const place=await page.getByTestId('reply-a2').evaluate(el=>{
   const h=el.closest('header');if(!h)return el.closest('.rp-c-actions')?'below':'?';
   const x=e=>e.getBoundingClientRect().left;const copy=h.querySelector('[data-testid="message-copy"]'),time=h.querySelector('time');
   if(el.closest('.ah-message-actions'))return x(el)>x(time)?'corner':'corner?';
   return x(el)>x(copy)&&x(el)<x(time)?'beside':'beside?';});
  ok(place===['corner','beside','below'][d],`${n}: control ${place}`);
  ok(await page.getByTestId('reply-a2').getAttribute('aria-pressed')==='true',`${n}: quoted message's control is pressed`);
  // B, C mark the original while the reply is drafted.
  const bg=await page.locator('[data-item="a2"] .ah-message').evaluate(el=>getComputedStyle(el).backgroundColor);
  const plain=await page.locator('[data-item="a3"] .ah-message').evaluate(el=>getComputedStyle(el).backgroundColor);
  ok((bg!==plain)===(d!==0),`${n}: original ${d===0?'unmarked':'marked'} while drafting`);
  await page.waitForTimeout(200);
  ok(await inView('[data-testid="sent-quote"]'),`${tag} ${n}: opens at the latest, sent reply visible`);
  await fits();await capture(`${n}-1-oletus`,true);
  // The composer quote jumps to the original and flashes it.
  await page.locator('[data-item="u1"]').evaluate(el=>el.scrollIntoView({block:'start'}));
  await page.getByTestId('quote-jump').click();
  await page.waitForTimeout(150);
  ok(await inView('[data-item="a2"]'),`${n}: jump brings the original into view`);
  ok(await page.locator('[data-item="a2"][data-flash]').count()===1,`${n}: original flashes`);
  await capture(`${n}-2-hyppy`);
  // The sent reply's quote jumps to its original too.
  await page.getByTestId('sent-quote').evaluate(el=>el.scrollIntoView({block:'center'}));
  await page.getByTestId('sent-quote').click();
  await page.waitForTimeout(150);
  ok(await inView('[data-item="a1"]'),`${n}: sent quote jumps to 9.14`);
  // ✕ removes the quote; the draft stays.
  await page.getByTestId('quote-remove').click();
  ok(await quote.count()===0,`${n}: ✕ removes the quote`);
  ok((await page.locator('.ah-cbox-field').inputValue()).startsWith('Mennään'),`${n}: draft stays`);
  await capture(`${n}-3-poistettu`);
  // Another reply's control starts a new reply.
  const ctl=page.getByTestId('reply-a3');
  await ctl.evaluate(el=>el.scrollIntoView({block:'center'}));
  await page.locator('[data-item="a3"]').hover().catch(()=>{});
  await ctl.click();
  await quote.waitFor();
  ok((await quote.innerText()).includes('9.26'),`${n}: control quotes 9.26`);
  ok(await page.waitForFunction(()=>document.activeElement?.classList.contains('ah-cbox-field'),null,{timeout:2000}).then(()=>true,()=>false),`${tag} ${n}: field focused`);
  await capture(`${n}-4-kulmasta`);
  // Send: the sent message carries the quote; the session records id + excerpt.
  await page.locator('.ah-cbox-field').fill('Lisää tämä README:hen.');
  await page.locator('.ah-cbox-field').press('Enter');
  await page.locator('[data-item^="r"]').first().waitFor();
  ok(await page.getByTestId('sent-quote').count()===2,`${n}: sent message carries the quote`);
  ok(await quote.count()===0,`${n}: quote cleared after send`);
  await page.locator('#payload').check();
  const p=await page.getByTestId('payload').last().innerText();
  ok(p.includes('entry="0d55e7b3"')&&p.includes('Lisää tämä README:hen.'),`${n}: payload has entry id and text`);
  await page.getByTestId('payload').last().evaluate(el=>el.scrollIntoView({block:'center'}));
  await fits();await capture(`${n}-5-lahetetty`,width===1440||theme==='light');
  await page.locator('#payload').uncheck();
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[],`console errors:\n${errors.join('\n')}`);
console.log(`${checks} checks passed; screenshots in ${out}`);
