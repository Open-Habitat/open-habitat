// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. Serves
// the page under the Habitat view's sandbox CSP (opaque origin, scripts, no
// connect, no frames) and fails on any request besides the page itself, any
// iframe, or any change of address. Walks every direction (Now, A, B, C) at
// 1440 and 390 px in Päivä, Yö and Korkea kontrasti with reduced motion, in
// Finnish, and once more in English: attribution in the receiving pane (today
// the person's bubble; A and C a card, B a Habitat line, never the bubble),
// the sending side (C's card and its returning reply), the link between the
// panes (scroll and flash; still under reduced motion), the recipient states
// (busy queue, stopped, archived refusal), what the receiving Pi gets, no
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
const round='2026-11-24-agent-agent-message';
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
const runs=[];
for(const width of [1440,390])for(const theme of ['light','dark','contrast'])runs.push({width,theme,lang:'fi'});
runs.push({width:1440,theme:'light',lang:'en'},{width:390,theme:'dark',lang:'en'});
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
 const senderTitle=en?'Quarterly report':'Kvartaaliraportti';
 const msgStart=en?'The Q3 figures are ready':'Q3-luvut ovat valmiit tiedostossa';
 const sender=page.getByTestId('sender'),receiver=page.getByTestId('receiver');
 for(const d of [0,1,2,3]){
  const n=names[d];
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.aam-review.variant-${d}`).waitFor({state:'attached'});
  await page.getByTestId('reset').click();
  await page.evaluate(()=>scrollTo(0,0));
  ok(await page.getByTestId('lines').locator('li').count()===4,`${n}: four direction lines`);
  ok(await page.getByTestId('lines').locator('li').nth(d).getAttribute('aria-current')==='true',`${n}: current line`);
  // Attribution in the receiving pane.
  const bubble=receiver.getByTestId('user-content').filter({hasText:msgStart});
  const letter=receiver.getByTestId('agent-letter'),line=receiver.getByTestId('agent-line');
  if(d===0){
   ok(await bubble.count()===1,`${n}: today the relayed text is the person's bubble`);
   ok(await letter.count()+await line.count()===0,`${n}: today nothing marks it`);
  }else{
   ok(await bubble.count()===0,`${n}: never the person's bubble`);
   const inc=d===2?line:letter;
   ok(await inc.count()===1,`${n}: incoming ${d===2?'line':'card'}`);
   ok((await inc.innerText()).includes(senderTitle),`${n}: names the sending conversation`);
   ok(await inc.locator('[data-testid="workspace-icon"]').count()===(d===2?0:1),`${n}: sender icon in the card`);
  }
  // The reply knows its source with the design; today it answers "you".
  const reply=await receiver.locator('[data-item="r-a2"]').innerText();
  ok(reply.includes(senderTitle)===(d!==0),`${n}: receiving agent names the source`);
  // The sending side.
  const said=await sender.locator('[data-item="s-a1"]').innerText();
  ok(said.includes('pi:7d2e41c0')===(d===0),`${n}: today the sender shows a UUID, the design a name`);
  ok(await sender.getByTestId('sent-line').count()===(d===2?1:0),`${n}: sent line only in B`);
  ok(await sender.getByTestId('sent-card').count()===(d===3?1:0),`${n}: sent card only in C`);
  if(d===3){
   ok(await sender.getByTestId('sent-reply').count()===1,`${n}: reply returns into the card`);
   ok(await receiver.getByTestId('reply-tag').count()===1,`${n}: reply tagged on the receiving side`);
  }
  // What the receiving Pi gets.
  const nat=await page.getByTestId('native-text').innerText();
  ok(nat.startsWith('<agent-message from="pi:')===(d!==0),`${n}: daemon block ${d?'present':'absent'}`);
  ok(nat.trim().endsWith(en?'keep the colour Q2 used.':'käytä samaa väriä kuin Q2:ssa.'),`${n}: the agent's text follows`);
  await fits(`${n} default`);await shot(`${n}-1-oletus`,true);
  // The link between the panes: the receiving entry flashes and is in view;
  // reduced motion gives a still outline, no animation.
  if(d!==0){
   const link=sender.locator('a[href="#oh-receiver"]').first();
   await link.scrollIntoViewIfNeeded();await link.click();await page.waitForTimeout(200);
   ok(await receiver.getAttribute('data-flash')!==null,`${n}: receiving pane flashes`);
   const hit=receiver.locator('[data-item="r-in"] > *').first();
   const st=await hit.evaluate(el=>{const s=getComputedStyle(el);return [s.animationName,s.outlineStyle];});
   ok(st[0]==='none'&&st[1]==='solid',`${n}: reduced motion keeps a still outline (${st})`);
   ok(await hit.evaluate(el=>{const r=el.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight;}),`${n}: incoming entry in view`);
   ok(served===1&&page.url()===`${origin}/view`,`${n}: link does not navigate`);
   // And back from the card or line to the sender.
   await receiver.getByTestId('letter-link').click();await page.waitForTimeout(200);
   ok(await sender.getAttribute('data-flash')!==null,`${n}: back-link flashes the sender`);
  }
  if(!full)continue;
  // Step: sent. C shows a waiting state, nobody has replied yet.
  await page.locator('#step').selectOption('sent');
  ok(await receiver.locator('[data-item="r-a2"]').count()===0,`${n}: no reply yet`);
  if(d===3)ok(await sender.getByTestId('sent-reply').count()===0,`${n}: card waits`);
  await shot(`${n}-2-lahetetty`);
  // Busy recipient: the message waits in Pi's queue (production card).
  await page.locator('#target').selectOption('busy');
  const q=receiver.getByTestId('composer-queue');
  ok(await q.count()===1,`${n}: busy recipient shows the queue`);
  ok((await q.innerText()).includes(senderTitle)===(d!==0),`${n}: queued item names its sender with the design`);
  ok(d===2?(await sender.getByTestId('sent-line').innerText()).includes(en?'queued':'jonossa'):(await sender.innerText()).includes('--delivery follow-up'),`${n}: busy target gets a follow-up`);
  await fits(`${n} busy`);await shot(`${n}-3-kesken`);
  await page.locator('#step').selectOption('answered');
  ok(await receiver.getByTestId('composer-queue').count()===0,`${n}: queue empties once delivered`);
  // Stopped: held until Pi starts.
  await page.locator('#target').selectOption('stopped');await page.locator('#step').selectOption('sent');
  ok(d===0?await receiver.getByTestId('waiting-message').count()===1:await receiver.getByTestId('letter-waiting').count()+await receiver.getByText(en?'Waiting: the conversation is starting':'Odottaa: keskustelu käynnistyy').count()>=1,`${n}: stopped target shows the held message`);
  await shot(`${n}-4-pysahtynyt`);
  // Archived: refused; nothing reaches the receiver.
  await page.locator('#target').selectOption('archived');
  ok(await receiver.locator('[data-item="r-in"]').count()===0,`${n}: archived receives nothing`);
  ok(await sender.locator('[data-testid="tool-row"].ah-tool-error[data-state="failed"]').filter({hasText:'message create'}).count()===1,`${n}: refusal shown on the tool row`);
  ok((await page.getByTestId('native-text').innerText()).length<120,`${n}: Pi gets nothing`);
  await fits(`${n} archived`);await shot(`${n}-5-arkistoitu`);
 }
 ok(served===1,`${tag}: one document load`);
 ok(page.url()===`${origin}/view`,`${tag}: address unchanged`);
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(stray,[],`requests besides the view:\n${stray.join('\n')}`);
assert.deepEqual(errors,[],`console errors:\n${errors.join('\n')}`);
console.log(`${checks} checks passed; screenshots in ${out}`);
