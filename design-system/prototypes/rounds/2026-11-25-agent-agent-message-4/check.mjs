// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. Serves
// the page under the Habitat view's sandbox CSP (opaque origin, scripts, no
// connect, no frames) and fails on any request besides the page itself, any
// iframe, or any change of address. Walks every direction (Now = round 3's
// A Mirror, A Minimal, B Quiet, C Contextual) at 1440 and 390 px in Päivä,
// Yö and Korkea kontrasti with reduced motion, in Finnish, and in English
// twice, through the story's five steps. Checks attribution (never the
// person's bubble), the same blocks in every direction, the words each
// direction's blocks say and do not say, the time right after the name in
// A–C, the one-line quote, the state only in Now and C, the queue prefix,
// quotes and links between the panes, what each Pi gets (no count), and no
// overflow. Screenshots at DPR 2; console clean.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-25-agent-agent-message-4';
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
const steps=['sent','back','midturn','several','quote'];
const runs=[];
for(const width of [1440,390])for(const theme of ['light','dark','contrast'])runs.push({width,theme,lang:'fi'});
runs.push({width:1440,theme:'light',lang:'en'},{width:390,theme:'dark',lang:'en'});
// Distinct messages each pane holds per step: [sender, receiver].
const held={sent:[1,1],back:[2,2],midturn:[2,3],several:[3,3],quote:[5,5]};
// Words of round 3's blocks that only Now still says.
const old={fi:['Tämä agentti','Viittaa viestiin','· agentti','Jonossa:'],en:['This agent','Refers to','· agent','Queued:']};
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
  ok(await sender.getByTestId('agent-letter').count()===3&&await receiver.getByTestId('agent-letter').count()===2,`${n}: incoming letters 3 + 2`);
  ok(await sender.getByTestId('out-mirror').count()===2&&await receiver.getByTestId('out-mirror').count()===3,`${n}: outgoing mirrors 2 + 3`);
  // The words: every block names its peer with a link; round 3's extra words only in Now.
  const blocks=page.locator('[data-testid="agent-letter"], [data-testid="out-mirror"]');
  ok(await blocks.count()===10&&await page.locator('article[data-msg] header [data-testid="peer-link"]').count()===10,`${n}: every block links its peer`);
  const heads=(await page.locator('article[data-msg]').evaluateAll(els=>els.map(e=>[...e.querySelectorAll('header, [data-testid="msg-quote"]')].map(x=>x.textContent).join(' ')))).join('\n');
  for(const w of old[lang])ok(heads.includes(w)===(d===0),`${n}: "${w}" ${d===0?'present':'gone'}`);
  // Quotes: Now full, A none, B and C one line.
  const quotes=page.locator('[data-testid="msg-quote"]');
  const want=d===1?0:4;
  ok(await quotes.count()===want,`${n}: ${want} quotes`);
  if(d>=2){
   ok(await page.locator('[data-quote="line"]').count()===4,`${n}: quotes are one line`);
   const hs=await page.locator('[data-quote="line"]').evaluateAll(els=>els.map(e=>e.getBoundingClientRect().height));
   ok(hs.every(h=>h>0&&h<26),`${n}: one line high (${hs.join(',')})`);
   ok(!(await page.locator('[data-quote="line"]').first().innerText()).match(/·|\d\.\d\d/),`${n}: the line says only the excerpt`);
  }
  // State: only when not delivered, only in Now and C.
  const st=receiver.getByTestId('sent-queued');
  ok(await st.count()===(d===0||d===3?1:0)&&await sender.getByTestId('sent-queued').count()===0,`${n}: queued state ${d===0||d===3?'once':'never'}`);
  if(d===3)ok((await st.innerText())===(en?'Queued':'Meni jonoon')&&!!(await st.getAttribute('title')),`${n}: one word, reason on hover`);
  // A–C: the time right after the name.
  if(d>0){
   const gaps=await page.locator('article[data-msg] > header').evaluateAll(hs=>hs.map(h=>{const a=h.querySelector('[data-testid="peer-link"]').getBoundingClientRect(),t=h.querySelector('time').getBoundingClientRect();return Math.abs(t.top-a.top)<12?t.left-a.right:0;}));
   ok(gaps.every(g=>g>=0&&g<32),`${n}: time right after the name (${gaps.join(',')})`);
  }
  if(d>0){
   const q=receiver.locator('[data-msg="m4"] [data-testid="msg-quote"]');
   ok(await q.count()===(d===1?0:1),`${n}: m4 quote on the receiver`);
  }
  if(d!==1){
   const q=receiver.locator('[data-msg="m4"] [data-testid="msg-quote"]').first();
   ok((await q.innerText()).includes(en?'September is missing':'puuttuu syyskuu'),`${n}: quote shows the excerpt of m3`);
   ok((await q.getAttribute('aria-label')).length>8,`${n}: quote has an accessible name`);
   await q.click();await page.waitForTimeout(150);
   const orig=receiver.locator('[data-msg="m3"]').first();
   ok(await still(orig)&&await inView(orig),`${n}: quote shows the original`);
  }
  const link=sender.locator('a[href="#oh-receiver-m4"]').first();
  await link.scrollIntoViewIfNeeded();await link.click();await page.waitForTimeout(150);
  const hit=receiver.locator('[data-msg="m4"]').first();
  ok(await still(hit)&&await inView(hit),`${n}: link opens the other conversation at the message`);
  const back=receiver.locator('a[href="#oh-sender-m5"]').first();
  await back.scrollIntoViewIfNeeded();await back.click();await page.waitForTimeout(150);
  ok(await still(sender.locator('[data-msg="m5"]').first()),`${n}: link back to the sender`);
  ok(served===1&&page.url()===`${origin}/view`,`${n}: links do not navigate`);
  const nat=await receiver.getByTestId('native-text').innerText();
  ok(nat.startsWith('<agent-message from="pi:')&&nat.includes('<quote message="')&&!/ (count|hop)=/.test(nat),`${n}: daemon block with quote, no count`);
  await fits(`${n} quote`);await shot(`${n}-5-lainaus`,true);
  if(full){
   for(const [k,s] of steps.entries()){
    await step(s);
    const [hs,hr]=held[s];
    ok(await distinct(sender)===hs,`${n} ${s}: sender holds ${hs}`);
    ok(await distinct(receiver)===hr,`${n} ${s}: receiver holds ${hr}`);
    const queue=sender.getByTestId('composer-queue');
    ok(await queue.count()===(s==='midturn'?1:0),`${n} ${s}: queue only mid-turn`);
    if(s==='midturn'){
     const qt=await queue.innerText();
     ok(qt.includes(receiverTitle),`${n}: queued message names its sender`);
     ok(qt.includes(en?'Agent from':'Agentti keskustelusta')===(d===0),`${n}: queue prefix ${d===0?'round 3':'name only'}`);
     await shot(`${n}-3-midturn`,true);
    }
    await fits(`${n} ${s}`);if(k<4&&s!=='midturn')await shot(`${n}-${k+1}-${s}`);
   }
  }
  await step('quote');
 }
 await page.getByTestId('reset').click();
 ok(await page.locator('#step').inputValue()==='quote'&&await page.getByTestId('next').isDisabled(),`${tag}: next stops at the last step`);
 await page.getByTestId('prev').click();
 ok(await page.locator('#step').inputValue()==='several',`${tag}: previous step`);
 ok(served===1,`${tag}: one document load`);
 ok(page.url()===`${origin}/view`,`${tag}: address unchanged`);
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(stray,[],`requests besides the view:\n${stray.join('\n')}`);
assert.deepEqual(errors,[],`console errors:\n${errors.join('\n')}`);
console.log(`${checks} checks passed; screenshots in ${out}`);
