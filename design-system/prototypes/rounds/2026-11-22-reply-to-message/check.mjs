// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. Walks
// every direction at 1440 and 390 px in Päivä, Yö and Korkea kontrasti: the
// default view (a reply in progress, one sent reply in history), the jump
// from the composer quote and from the sent quote, ✕, a new reply from a
// reply's corner control, sending, what the agent gets, and in B quoting a
// selected passage. Screenshots at device scale factor 2; console clean.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-22-reply-to-message';
const [input,out]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <evidence-dir>');process.exit(2);}
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['a-lainaus','b-kohta','c-kieleke'];
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
  // Default: reply to the 9.20 message in progress, one sent reply in history.
  await quote.waitFor();
  ok((await quote.innerText()).includes('9.20'),`${n}: quote names the time`);
  ok(await page.getByTestId('sent-quote').count()===1,`${n}: one sent reply in history`);
  ok(await page.locator('[data-item="a2"] .rp-corner[data-active]').count()===1,`${n}: quoted message's control is active`);
  if(d===1)ok(await page.waitForFunction(()=>CSS.highlights.has('rp-quote'),null,{timeout:2000}).then(()=>true,()=>false),`${tag} B: passage marked`);
  await page.waitForTimeout(200);
  ok(await inView('[data-testid="sent-quote"]'),`${tag} ${n}: opens at the latest, sent reply visible`);
  await fits();await capture(`${n}-1-oletus`,width===1440||theme==='light');
  // The composer quote jumps to the original and flashes it.
  await page.locator('[data-item="u1"]').evaluate(el=>el.scrollIntoView({block:'start'}));
  await page.getByTestId('quote-jump').click();
  await page.waitForTimeout(150);
  ok(await inView('[data-item="a2"]'),`${n}: jump brings the original into view`);
  if(d===1)ok(await page.evaluate(()=>CSS.highlights.has('rp-flash')),'B: jump flashes the passage');
  else ok(await page.locator('[data-item="a2"][data-flash]').count()===1,`${n}: original flashes`);
  await capture(`${n}-2-hyppy`);
  // The sent reply's quote jumps to its original too.
  await page.getByTestId('sent-quote').evaluate(el=>el.scrollIntoView({block:'center'}));
  await page.getByTestId('sent-quote').click();
  await page.waitForTimeout(150);
  ok(await inView('[data-item="a1"]'),`${n}: sent quote jumps to 9.14`);
  // ✕ removes the quote.
  await page.getByTestId('quote-remove').click();
  ok(await quote.count()===0,`${n}: ✕ removes the quote`);
  await capture(`${n}-3-poistettu`);
  // A reply's corner control starts a new reply.
  const ctl=page.getByTestId('reply-a3');
  await ctl.evaluate(el=>el.scrollIntoView({block:'center'}));
  await page.locator('[data-item="a3"]').hover().catch(()=>{});
  await ctl.click();
  await quote.waitFor();
  ok((await quote.innerText()).includes('9.26'),`${n}: corner control quotes 9.26`);
  ok(await page.waitForFunction(()=>document.activeElement?.classList.contains('ah-cbox-field'),null,{timeout:2000}).then(()=>true,()=>false),`${tag} ${n}: field focused`);
  await capture(`${n}-4-kulmasta`);
  if(d===1){
   // Select a passage in 9.31 and quote only it.
   await page.locator('[data-item="a4"]').evaluate(el=>el.scrollIntoView({block:'center'}));await page.waitForTimeout(100);
   await page.locator('[data-item="a4"] .ah-prose').evaluate(p=>{
    const w=document.createTreeWalker(p,NodeFilter.SHOW_TEXT);let t=w.nextNode();while(t&&!t.data.includes('Lisäisin'))t=w.nextNode();
    const s=t.data.indexOf('Lisäisin');const r=document.createRange();r.setStart(t,s);const last=t.parentElement.closest("p")??t.parentElement;r.setEnd(last,last.childNodes.length);
    const sel=getSelection();sel.removeAllRanges();sel.addRange(r);document.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
   });
   await page.getByTestId('passage-float').waitFor();
   await capture(`${n}-5-valinta`);
   await page.getByTestId('passage-reply').click();
   ok((await quote.innerText()).includes('Lisäisin testit'),'B: quote carries the selected passage');
   ok((await quote.innerText()).includes('9.31'),'B: passage quote names 9.31');
   await capture(`${n}-6-kohta`);
  }
  // Send: the sent message carries the reference; the agent gets id + excerpt.
  await page.locator('.ah-cbox-field').fill('Lisää tämä README:hen.');
  await page.locator('.ah-cbox-field').press('Enter');
  await page.locator('[data-item^="r"]').first().waitFor();
  ok(await page.getByTestId('sent-quote').count()===2,`${n}: sent message carries the quote`);
  ok(await quote.count()===0,`${n}: quote cleared after send`);
  await page.locator('#payload').check();
  const p=await page.getByTestId('payload').last().innerText();
  ok(p.includes(d===1?'entry="c2a9f810"':'entry="0d55e7b3"')&&p.includes('Lisää tämä README:hen.'),`${n}: payload has entry id and text`);
  await page.getByTestId('payload').last().evaluate(el=>el.scrollIntoView({block:'center'}));
  await fits();await capture(`${n}-7-lahetetty`,width===1440||theme==='light');
  await page.locator('#payload').uncheck();
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[],`console errors:\n${errors.join('\n')}`);
console.log(`${checks} checks passed; screenshots in ${out}`);
