// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Walks the three directions at 1440 and 390 px in Päivä, Yö and Kontrasti
// with reduced motion. Default view: the first question (delete the mail
// folder) is open with its title, account, Salli / Älä salli, and the header
// says the agent waits. Flow (Päivä and Yö): allow the first, deny the
// second (calendar share), the agent's reply says what it did and did not
// do, the waiting state ends; "Toinen pyyntö" raises a third question that
// is allowed. Icon sheet: five candidates at 16/20/24 px, the icon choice
// reaches the question. English last. Screenshots at device scale 2.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-21-account-action-permission';
const [input,out,flag]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <out-dir> [--quick]');process.exit(2);}
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['kortti','kentta','tyokalurivi'];
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};

async function open(width,theme,lang='fi'){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:1000},deviceScaleFactor:2,reducedMotion:'reduce',hasTouch:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 if(lang==='en')await page.locator('#language').selectOption('en');
 return page;
}
const settle=page=>page.waitForTimeout(150);
const pick=async(page,d)=>{await page.locator('.proto-picker-item').nth(d).click();await page.locator(`.ra-review[data-direction="${d}"]`).waitFor({state:'attached'});await settle(page);};
const shot=(page,name)=>page.screenshot({path:`${out}/${name}.png`});
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const count=(page,id)=>page.getByTestId(id).count();
const waiting=page=>page.getByTestId('conversation').getAttribute('data-waiting');
const reset=async page=>{await page.getByTestId('event-reset').click();await settle(page);};
const answer=async(page,which)=>{const b=page.getByTestId(which==='allow'?'perm-allow':'perm-deny');eq(await b.count(),1,'exactly one open question');await b.click();await settle(page);};

async function defaultView(page,d,at,word='Poista postikansio'){
 eq(await page.locator('.ra-lines li[aria-current]').count(),1,`${at}: its line is marked`);
 eq(await waiting(page),'true',`${at}: the agent waits`);
 ok((await page.locator('.ah-agent-header').textContent()).includes(word.startsWith('Poista')?'Odottaa lupaasi':'Waiting for your permission'),`${at}: header says waiting`);
 const title=page.getByTestId('perm-title');
 eq(await title.count(),1,`${at}: one question shown`);
 ok((await title.textContent()).includes(word),`${at}: question says the action`);
 ok(await page.getByTestId('perm-allow').isVisible(),`${at}: Salli visible`);
 ok(await page.getByTestId('perm-deny').isVisible(),`${at}: Älä salli visible`);
 ok(await page.locator('.ap-icon[data-icon="shieldAsk"]').first().isVisible(),`${at}: recommended icon in use`);
 eq(await count(page,'perm-dock'),d===1?1:0,`${at}: dock only in 2`);
 eq(await count(page,'perm-line'),d===1?1:0,`${at}: stream line only in 2`);
 eq(await count(page,'perm-toolrow'),d===2?1:0,`${at}: tool row question only in 3`);
 eq(await count(page,'perm-question'),d===2?0:1,`${at}: card or dock question in 1 and 2`);
 ok(await fits(page),`${at}: document overflow`);
}

async function flow(page,d,tag){
 const at=`${names[d]} ${tag} flow`;
 await page.getByTestId('perm-technical').first().locator('summary').click();
 ok((await page.getByTestId('perm-technical').first().textContent()).includes('delete-mail-folder'),`${at}: technical call names the tool`);
 await answer(page,'allow');
 ok((await page.getByTestId('perm-title').textContent()).includes('Jaa kalenteri'),`${at}: second question follows`);
 eq(await waiting(page),'true',`${at}: still waiting`);
 if(d===0)eq(await count(page,'perm-record'),1,`${at}: first card is a record`);
 if(d===1)eq(await count(page,'perm-line'),2,`${at}: two lines in the stream`);
 const decided=page.getByTestId('perm-decided');
 if(d!==2)ok((await decided.first().textContent()).includes('Sallit'),`${at}: allowed recorded`);
 await shot(page,`${d}-${names[d]}-${tag}-second`);
 await answer(page,'deny');
 eq(await waiting(page),null,`${at}: waiting ended`);
 eq(await count(page,'perm-allow'),0,`${at}: no open question`);
 eq(await count(page,'perm-dock'),0,`${at}: no dock`);
 const reply=await page.getByTestId('agent-reply').last().textContent();
 ok(reply.includes('Poistin kansion')&&reply.includes('en jakanut'),`${at}: reply says what was and was not done`);
 ok((await page.locator('[data-tool-name="create-calendar-permission"]').first().getAttribute('data-state'))==='blocked',`${at}: denied call blocked`);
 ok(await fits(page),`${at}: overflow after`);
 await shot(page,`${d}-${names[d]}-${tag}-done`);
 await page.getByTestId('event-again').click();await settle(page);
 ok((await page.getByTestId('perm-title').textContent()).includes('Hammaslääkäri'),`${at}: third question`);
 await answer(page,'allow');
 ok((await page.getByTestId('agent-reply').last().textContent()).includes('Poistin tapahtuman'),`${at}: third done`);
 await reset(page);
}

async function iconSheet(page,tag){
 await page.getByTestId('icon-sheet-open').click();await settle(page);
 const sheet=page.getByTestId('icon-sheet');
 ok(await sheet.isVisible(),`${tag}: icon sheet`);
 eq(await page.getByTestId('icon-candidate').count(),5,`${tag}: five candidates`);
 eq(await page.locator('[data-testid="icon-candidate"][data-recommended]').getAttribute('data-icon'),'shieldAsk',`${tag}: shield recommended`);
 for(const s of [16,20,24])ok(await sheet.locator(`.ap-sizes svg.ap-icon[width="${s}"]`).count()>=5,`${tag}: ${s} px shown`);
 ok(await fits(page),`${tag}: sheet overflow`);
 await shot(page,`icons-${tag}`);
 await page.getByTestId('icon-sheet-close').click();await settle(page);
 await page.locator('#icon').selectOption('hand');await settle(page);
 ok(await page.locator('.ap-icon[data-icon="hand"]').first().isVisible(),`${tag}: icon choice reaches the question`);
 await page.locator('#icon').selectOption('shieldAsk');
}

try{
for(const width of quick?[1440]:[1440,390])for(const theme of quick?['light']:['light','dark','contrast']){
 const tag=`${width}-${theme}`;
 const page=await open(width,theme);
 await checkPicker(page,round);
 eq(await page.getByTestId('recommendation').count(),1,'the recommendation is on the page');
 for(let d=0;d<3;d++){
  await pick(page,d);
  await defaultView(page,d,`${names[d]} ${tag}`);
  await shot(page,`${d}-${names[d]}-${tag}`);
  if(theme!=='contrast')await flow(page,d,tag);
 }
 await iconSheet(page,tag);
 await page.close();
}
for(const width of [1440,390]){
 const en=await open(width,width===390?'dark':'light','en');
 for(let d=0;d<3;d++){
  await pick(en,d);
  await defaultView(en,d,`English ${width} ${d}`,'Delete the mail folder');
  await shot(en,`en-${d}-${names[d]}-${width}`);
 }
 await en.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[],'console errors');
console.log(`${checks} checks passed`);
