// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. Serves
// the page under the Habitat view's sandbox CSP (opaque origin, scripts, no
// connect, no frames) and fails on any request besides the page itself, any
// iframe, or any change of address. Walks every direction (Now, A, B, C) at
// 1440 and 390 px in Päivä, Yö and Korkea kontrasti with reduced motion, in
// Finnish, and once more in English, through the story's five steps: the
// message goes, one back, one arriving mid-turn (queued with its sender),
// several back, a quote. Checks attribution (never the person's bubble with
// the design), each direction's shape (letters, one thread with pointers,
// strip rows that open), quotes and what they lead to, links between the
// panes (scroll and still outline under reduced motion), what each Pi gets,
// and no overflow. Screenshots at DPR 2; console clean.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-24-agent-agent-message-2';
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
const names=['nyt','a','b','c'];
const steps=['sent','back','midturn','several','quote'];
const runs=[];
for(const width of [1440,390])for(const theme of ['light','dark','contrast'])runs.push({width,theme,lang:'fi'});
runs.push({width:1440,theme:'light',lang:'en'},{width:390,theme:'dark',lang:'en'});
// Messages each pane holds per step: [sender pane, receiver pane].
const held={sent:[1,1],back:[2,2],midturn:[2,3],several:[3,3],quote:[5,5]};
try{
for(const {width,theme,lang} of runs){
 const phone=width===390;
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
 const shot=async(name,always=false)=>{if(!full&&!always)return;await page.waitForTimeout(120);await page.screenshot({path:`${out}/${name}-${tag}.png`,fullPage:true});};
 const fits=async(m)=>ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${tag} ${m}: document overflow`);
 ok(await page.evaluate(()=>origin==='null'),`${tag}: opaque-origin sandbox`);
 ok(await page.locator('iframe, frame, object, embed').count()===0,`${tag}: no frames`);
 ok(await page.evaluate(()=>document.documentElement.lang)===lang,`${tag}: document language`);
 const en=lang==='en';
 const senderTitle=en?'Quarterly report':'Kvartaaliraportti',receiverTitle=en?'Charts':'Kaaviot';
 const m1=en?'The Q3 figures are ready':'Q3-luvut ovat valmiit tiedostossa';
 const m2=en?'Chart 2 is updated':'Kuvaaja 2 on päivitetty';
 const sender=page.getByTestId('sender'),receiver=page.getByTestId('receiver');
 const inView=loc=>loc.evaluate(el=>{const r=el.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight;});
 const still=loc=>loc.evaluate(el=>{const s=getComputedStyle(el);return el.hasAttribute('data-flash')&&s.animationName==='none'&&s.outlineStyle==='solid';});
 for(const d of [0,1,2,3]){
  const n=names[d];
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.aam-review.variant-${d}`).waitFor({state:'attached'});
  await page.getByTestId('reset').click();
  await page.evaluate(()=>scrollTo(0,0));
  ok(await page.getByTestId('lines').locator('li').count()===4,`${n}: four direction lines`);
  ok(await page.getByTestId('lines').locator('li').nth(d).getAttribute('aria-current')==='true',`${n}: current line`);
  // Attribution: today the relayed text is the person's bubble on both sides; never with the design.
  const bubble=(pane,text)=>pane.getByTestId('user-content').filter({hasText:text}).count();
  ok(await bubble(receiver,m1)===(d===0?1:0),`${n}: incoming m1 ${d?'not ':''}as the person's bubble`);
  ok(await bubble(sender,m2)===(d===0?1:0),`${n}: message back ${d?'not ':''}as the person's bubble`);
  // Each direction's shape at the last step.
  if(d===1){
   ok(await sender.getByTestId('agent-letter').count()===3&&await receiver.getByTestId('agent-letter').count()===2,`${n}: incoming letters 3 + 2`);
   ok(await sender.getByTestId('agent-sent').count()===2&&await receiver.getByTestId('agent-sent').count()===3,`${n}: sent letters 2 + 3`);
   ok((await receiver.getByTestId('agent-letter').first().innerText()).includes(senderTitle),`${n}: letter names the sender`);
   ok(await receiver.locator('li[data-kind="user"] [data-testid="agent-letter"]').count()===2,`${n}: letter on the person's side`);
   ok(await receiver.getByTestId('sent-queued').count()===1,`${n}: queued state on the mid-turn message`);
  }
  if(d===2){
   for(const p of [sender,receiver]){
    ok(await p.getByTestId('thread').count()===1,`${n}: one thread per pane`);
    ok(await p.getByTestId('thread-row').count()===5,`${n}: five messages in the thread`);
    ok(await p.getByTestId('pointer').count()===4,`${n}: four pointers`);
   }
   await receiver.getByTestId('pointer-jump').last().click();await page.waitForTimeout(150);
   ok(await still(receiver.locator('[data-msg="m5"]')),`${n}: pointer shows the message in the thread`);
  }
  if(d===3){
   ok(await sender.getByTestId('strip-row').count()===5&&await receiver.getByTestId('strip-row').count()===5,`${n}: five strip rows per pane`);
   const r4=receiver.locator('[data-testid="strip-row"][data-msg="m4"]');
   ok(await r4.getByTestId('msg-quote').count()===0,`${n}: row closed`);
   await r4.getByTestId('strip-toggle').click();
   ok(await r4.getByTestId('msg-quote').count()===1&&await r4.getByTestId('strip-toggle').getAttribute('aria-expanded')==='true',`${n}: row opens with its quote`);
  }
  // Quotes: m4 quotes m3, m5 quotes m4, and lead to the original in the same pane.
  if(d!==0){
   ok(await sender.getByTestId('msg-quote').count()>=(d===3?0:2),`${n}: quotes on the sender side`);
   const q=receiver.locator('[data-msg="m4"] [data-testid="msg-quote"]').first();
   if(await q.count()){
    ok((await q.innerText()).includes(en?'September is missing':'puuttuu syyskuu'),`${n}: quote shows the excerpt of m3`);
    await q.click();await page.waitForTimeout(150);
    const orig=receiver.locator('[data-msg="m3"]').first();
    ok(await still(orig),`${n}: quote shows the original, still outline under reduced motion`);
    ok(await inView(orig),`${n}: original in view`);
   }
   // Reading the other conversation: the name on a message opens the other pane at the same message.
   const link=sender.locator('a[href="#oh-receiver-m4"]').first();
   await link.scrollIntoViewIfNeeded();await link.click();await page.waitForTimeout(150);
   const hit=receiver.locator('[data-msg="m4"]').first();
   ok(await still(hit)&&await inView(hit),`${n}: link opens the other conversation at the message`);
   const back=receiver.locator('a[href="#oh-sender-m5"]').first();
   await back.scrollIntoViewIfNeeded();await back.click();await page.waitForTimeout(150);
   ok(await still(sender.locator('[data-msg="m5"]').first()),`${n}: link back to the sender`);
   ok(served===1&&page.url()===`${origin}/view`,`${n}: links do not navigate`);
  }
  // What the Pis get: the block with the quote's id and excerpt.
  const nat=await receiver.getByTestId('native-text').innerText();
  ok(nat.startsWith('<agent-message from="pi:')===(d!==0),`${n}: daemon block ${d?'present':'absent'}`);
  ok(nat.includes('<quote message="')===(d!==0),`${n}: quote in the native text`);
  await fits(`${n} quote`);await shot(`${n}-5-lainaus`,true);
  if(!full)continue;
  for(const [k,step] of steps.entries()){
   if(step==='quote')continue;
   await page.locator('#step').selectOption(step);await page.waitForTimeout(60);
   const [hs,hr]=held[step];
   if(d!==0){
    ok(await sender.locator('[data-msg]').evaluateAll(els=>new Set(els.map(e=>e.dataset.msg)).size)===hs,`${n} ${step}: sender holds ${hs}`);
    ok(await receiver.locator('[data-msg]').evaluateAll(els=>new Set(els.map(e=>e.dataset.msg)).size)===hr,`${n} ${step}: receiver holds ${hr}`);
   }
   const queue=sender.getByTestId('composer-queue');
   ok(await queue.count()===(step==='midturn'?1:0),`${n} ${step}: queue only mid-turn`);
   if(step==='midturn')ok((await queue.innerText()).includes(receiverTitle)===(d!==0),`${n}: queued message names its sender with the design`);
   await fits(`${n} ${step}`);await shot(`${n}-${k+1}-${step}`);
  }
  await page.locator('#step').selectOption('quote');
 }
 // Step buttons move one step.
 await page.getByTestId('reset').click();
 await page.getByTestId('prev').click();
 ok(await page.locator('#step').inputValue()==='several',`${tag}: previous step`);
 await page.getByTestId('next').click();
 ok(await page.locator('#step').inputValue()==='quote'&&await page.getByTestId('next').isDisabled(),`${tag}: next stops at the last step`);
 ok(served===1,`${tag}: one document load`);
 ok(page.url()===`${origin}/view`,`${tag}: address unchanged`);
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(stray,[],`requests besides the view:\n${stray.join('\n')}`);
assert.deepEqual(errors,[],`console errors:\n${errors.join('\n')}`);
console.log(`${checks} checks passed; screenshots in ${out}`);
