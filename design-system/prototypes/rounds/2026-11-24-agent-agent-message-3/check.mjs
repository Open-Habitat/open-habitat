// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. Serves
// the page under the Habitat view's sandbox CSP (opaque origin, scripts, no
// connect, no frames) and fails on any request besides the page itself, any
// iframe, or any change of address. Walks every direction (Now = round 2's A,
// A Mirror, B Line, C Folded) at 1440 and 390 px in Päivä, Yö and Korkea
// kontrasti with reduced motion, in Finnish, and in English twice, through
// the story's seven steps. Checks attribution (never the person's bubble),
// each direction's outgoing shape and where it sits (B under the reply, C
// inside the reply that links it, alone only before one does), quotes and
// links between the panes, the runaway guard (held in both conversations,
// one click continues, the message arrives with a fresh count, not sending
// works), round 2's hop limit under Now, what each Pi gets, and no overflow.
// Screenshots at DPR 2; console clean.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-24-agent-agent-message-3';
const [input,out]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <evidence-dir>');process.exit(2);}
mkdirSync(out,{recursive:true});
const html=readFileSync(input,'utf8');
const origin='https://view.test';
const csp=`sandbox allow-scripts; default-src 'none'; script-src ${origin} 'unsafe-inline' 'unsafe-eval'; style-src ${origin} 'unsafe-inline'; img-src ${origin} data: blob:; font-src ${origin} data:; media-src ${origin} data: blob:; connect-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none'; object-src 'none'; manifest-src 'none'; form-action 'none'; base-uri 'none'`;
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
let checks=0;const errors=[];const stray=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const names=['nyt','a','b','c'];
const steps=['sent','back','midturn','several','quote','guard','continued'];
const shape=['out-dashed','out-mirror','out-line','fold'];
const runs=[];
for(const width of [1440,390])for(const theme of ['light','dark','contrast'])runs.push({width,theme,lang:'fi'});
runs.push({width:1440,theme:'light',lang:'en'},{width:390,theme:'dark',lang:'en'});
// Distinct messages each pane holds per step: [sender, receiver]; the guard card stands for m14 on the receiver.
const held={sent:[1,1],back:[2,2],midturn:[2,3],several:[3,3],quote:[5,5],guard:[14,14],continued:[14,14]};
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
 const receiverTitle=en?'Charts':'Kaaviot';
 const m1=en?'The Q3 figures are ready':'Q3-luvut ovat valmiit tiedostossa';
 const m2=en?'Chart 2 is updated':'Kuvaaja 2 on päivitetty';
 const m3full=en?'The chart now shows only July and August':'Kuvaajassa on nyt vain heinä- ja elokuu';
 const sender=page.getByTestId('sender'),receiver=page.getByTestId('receiver');
 const inView=loc=>loc.evaluate(el=>{const r=el.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight;});
 const still=loc=>loc.evaluate(el=>{const s=getComputedStyle(el);return el.hasAttribute('data-flash')&&s.animationName==='none'&&s.outlineStyle==='solid';});
 const distinct=p=>p.locator('[data-msg]').evaluateAll(els=>new Set(els.map(e=>e.dataset.msg)).size);
 const step=async s=>{await page.locator('#step').selectOption(s);await page.waitForTimeout(60);};
 for(const d of [0,1,2,3]){
  const n=names[d];
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.aam-review.variant-${d}`).waitFor({state:'attached'});
  await page.getByTestId('reset').click();
  await page.evaluate(()=>scrollTo(0,0));
  ok(await page.getByTestId('lines').locator('li').count()===4,`${n}: four direction lines`);
  ok(await page.getByTestId('lines').locator('li').nth(d).getAttribute('aria-current')==='true',`${n}: current line`);
  // Attribution: never the person's bubble, in any direction.
  const bubble=(pane,text)=>pane.getByTestId('user-content').filter({hasText:text}).count();
  ok(await bubble(receiver,m1)===0&&await bubble(sender,m2)===0,`${n}: agent messages are never the person's bubble`);
  ok(await sender.getByTestId('agent-letter').count()===3&&await receiver.getByTestId('agent-letter').count()===2,`${n}: incoming letters 3 + 2 (round 2's A)`);
  // The outgoing shape: 2 sent from the sender, 3 from the receiver, and no other direction's shape.
  for(const [k,sh] of shape.entries()){
   const want=k===d;
   ok(await sender.getByTestId(sh).count()===(want?2:0)&&await receiver.getByTestId(sh).count()===(want?3:0),`${n}: ${sh} ${want?'2 + 3':'absent'}`);
  }
  ok(await sender.getByTestId('fold-alone').count()===0&&await receiver.getByTestId('fold-alone').count()===0,`${n}: nothing stands alone at the last step`);
  ok(await receiver.getByTestId('sent-queued').count()===1,`${n}: queued state on the mid-turn message`);
  if(d===2){
   // Under the reply: the line's row follows the reply (or another line under it).
   const prevKinds=await receiver.locator('li[data-kind="out"]').evaluateAll(els=>els.map(li=>{let p=li.previousElementSibling;while(p&&p.dataset.kind==='out')p=p.previousElementSibling;return p?.dataset.kind;}));
   ok(prevKinds.length===3&&prevKinds.every(k=>k==='assistant'),`${n}: lines sit under the reply`);
   const l3=receiver.locator('[data-testid="out-line"][data-msg="m3"]');
   ok(await l3.locator('.aam-line-body').count()===0&&await l3.evaluate(el=>el.getBoundingClientRect().height<40),`${n}: line shows only the start`);
   await l3.getByTestId('line-toggle').click();
   ok((await l3.locator('.aam-line-body').innerText()).includes(m3full)&&await l3.getByTestId('line-toggle').getAttribute('aria-expanded')==='true',`${n}: line opens to the whole message`);
  }
  if(d===3){
   ok(await receiver.locator('[data-kind="assistant"] [data-testid="fold"]').count()===3,`${n}: folds inside the replies`);
   ok(await receiver.locator('[data-kind="assistant"]').filter({has:page.locator('[data-msg="m2"]')}).locator('[data-msg="m3"]').count()===1,`${n}: one reply carries both messages it links`);
   ok((await receiver.locator('[data-msg="m3"]').innerText()).includes(m3full),`${n}: folded message reads in full`);
  }
  // Quotes: m4 quotes m3 and leads to the original in the same pane.
  const q=receiver.locator('[data-msg="m4"] [data-testid="msg-quote"]').first();
  ok((await q.innerText()).includes(en?'September is missing':'puuttuu syyskuu'),`${n}: quote shows the excerpt of m3`);
  await q.click();await page.waitForTimeout(150);
  const orig=receiver.locator('[data-msg="m3"]').first();
  ok(await still(orig)&&await inView(orig),`${n}: quote shows the original`);
  const link=sender.locator('a[href="#oh-receiver-m4"]').first();
  await link.scrollIntoViewIfNeeded();await link.click();await page.waitForTimeout(150);
  const hit=receiver.locator('[data-msg="m4"]').first();
  ok(await still(hit)&&await inView(hit),`${n}: link opens the other conversation at the message`);
  const back=receiver.locator('a[href="#oh-sender-m5"]').first();
  await back.scrollIntoViewIfNeeded();await back.click();await page.waitForTimeout(150);
  ok(await still(sender.locator('[data-msg="m5"]').first()),`${n}: link back to the sender`);
  ok(served===1&&page.url()===`${origin}/view`,`${n}: links do not navigate`);
  const nat=await receiver.getByTestId('native-text').innerText();
  ok(nat.startsWith('<agent-message from="pi:')&&nat.includes('<quote message="')&&nat.includes(d===0?' hop="1"':' count="1"'),`${n}: daemon block with quote`);
  await fits(`${n} quote`);await shot(`${n}-5-lainaus`,true);
  // C before the reply: the message stands alone where it went, then folds.
  if(d===3){
   await step('back');
   ok(await receiver.getByTestId('fold-alone').count()===1&&await receiver.locator('[data-testid="fold-alone"][data-msg="m2"]').count()===1,`${n}: alone before the reply mentions it`);
   await step('midturn');
   ok(await receiver.getByTestId('fold-alone').count()===0,`${n}: folds once the reply links it`);
  }
  // The runaway guard (Now: round 2's hop limit).
  await step('guard');
  if(d===0){
   ok(await sender.locator('.ah-tool-row[data-state="failed"]').count()===1,`${n}: hop limit refuses the send`);
   ok(await page.getByTestId('guard').count()===0&&await distinct(sender)===5,`${n}: no guard under the hop limit`);
   await fits(`${n} guard`);await shot(`${n}-6-hyppyraja`,true);
  }else{
   ok(await distinct(sender)===14&&await distinct(receiver)===14,`${n} guard: the exchange ran on`);
   ok(await sender.getByTestId('guard').count()===1&&await receiver.getByTestId('guard').count()===1,`${n}: guard in both conversations`);
   ok(await sender.getByTestId('sent-held').count()===1,`${n}: held message says it waits`);
   ok(await receiver.locator('[data-testid="agent-letter"][data-msg="m14"]').count()===0,`${n}: held message not delivered`);
   const why=await receiver.getByTestId('guard').innerText();
   ok(why.includes('10'),`${n}: guard names the count`);
   await fits(`${n} guard`);await shot(`${n}-6-vahti`,true);
   const show=receiver.getByTestId('guard-show');
   await show.click();await page.waitForTimeout(150);
   ok(await still(sender.locator('[data-msg="m14"]').first()),`${n}: guard shows the held message`);
   // Not sending: both conversations say so, nothing arrives.
   await sender.getByTestId('discard').click();await page.waitForTimeout(60);
   ok(await page.getByTestId('guard-line').count()===2&&await page.getByTestId('guard').count()===0,`${n}: not sent, both say so`);
   ok(await receiver.locator('[data-msg="m14"]').count()===0,`${n}: not-sent message never arrives`);
   await step('quote');await step('guard');
   await receiver.getByTestId('continue').click();await page.waitForTimeout(60);
   ok(await page.locator('#step').inputValue()==='continued',`${n}: one click continues`);
   ok(await page.getByTestId('guard-line').count()===2&&await sender.getByTestId('sent-held').count()===0,`${n}: continued in both`);
   ok(await receiver.locator('[data-testid="agent-letter"][data-msg="m14"]').count()===1,`${n}: the message arrives`);
   const nat14=await receiver.getByTestId('native-text').innerText();
   ok(nat14.includes(' count="1"')&&nat14.includes('let this message through'),`${n}: fresh count after continuing`);
   await fits(`${n} continued`);await shot(`${n}-7-jatkettu`,true);
  }
  if(full){
   for(const [k,s] of steps.entries()){
    await step(s);
    const [hs,hr]=held[s];
    if(d!==0||k<5){
     ok(await distinct(sender)===hs,`${n} ${s}: sender holds ${hs}`);
     ok(await distinct(receiver)===hr,`${n} ${s}: receiver holds ${hr}`);
    }
    const queue=sender.getByTestId('composer-queue');
    ok(await queue.count()===(s==='midturn'?1:0),`${n} ${s}: queue only mid-turn`);
    if(s==='midturn')ok((await queue.innerText()).includes(receiverTitle),`${n}: queued message names its sender`);
    await fits(`${n} ${s}`);if(k<4)await shot(`${n}-${k+1}-${s}`);
   }
  }
  await step('quote');
 }
 await page.getByTestId('reset').click();
 await page.getByTestId('next').click();await page.getByTestId('next').click();
 ok(await page.locator('#step').inputValue()==='continued'&&await page.getByTestId('next').isDisabled(),`${tag}: next stops at the last step`);
 await page.getByTestId('prev').click();
 ok(await page.locator('#step').inputValue()==='guard',`${tag}: previous step`);
 ok(served===1,`${tag}: one document load`);
 ok(page.url()===`${origin}/view`,`${tag}: address unchanged`);
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(stray,[],`requests besides the view:\n${stray.join('\n')}`);
assert.deepEqual(errors,[],`console errors:\n${errors.join('\n')}`);
console.log(`${checks} checks passed; screenshots in ${out}`);
