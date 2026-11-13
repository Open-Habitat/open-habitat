// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Walks the three directions at 1440 and 390 px, light and dark, in every
// situation: no document overflow, the direction's line marked, the
// workflow permission in the state the situation names, and the token's
// scopes shown (or said to be unreadable). Then at 1440 light it clicks
// each direction's flow: allow -> github.com stand-in asking for workflow
// -> authorize -> allowed; cancel says nothing changed; remove; the missing
// permission's "Don't allow"; production's Reconnect keeping the opt-in;
// English. Screenshots at device scale 2 named
// v<n>-<direction>-<situation>-<width>-<theme>.png; --quick takes 1440 light.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-13-github-workflow-scope';
const [input,out,flag]=process.argv.slice(2);
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['rivi','luettelo','ikkuna'];
// The sign-in in progress is last: its github.com stand-in is open.
const cases={pois:'off',paalla:'on',kadonnut:'missing',tuntematon:'unknown',kaynnistyy:'pending'};
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};

async function open(width,theme){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:900},deviceScaleFactor:2,reducedMotion:'reduce',hasTouch:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 return page;
}
const settle=page=>page.waitForTimeout(250);
const closeModal=async page=>{if(await page.locator('.ah-overlay').count()){await page.keyboard.press('Escape');await settle(page);}};
const pick=async(page,d)=>{await closeModal(page);await page.locator('.proto-picker-item').nth(d).click();await page.locator(`.rq-review[data-direction="${d}"]`).waitFor({state:'attached'});await settle(page);};
const setCase=async(page,c)=>{await closeModal(page);await page.locator('#scenario').selectOption(c);await page.getByTestId('wf-row').waitFor({state:'attached'});await settle(page);};
const shot=(page,d,c,tag)=>page.screenshot({path:`${out}/v${d+1}-${names[d]}-${c}-${tag}.png`});
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const wf=page=>page.getByTestId('wf-row').getAttribute('data-wf');

try{
for(const width of quick?[1440]:[1440,390])for(const theme of quick?['light']:['light','dark']){
 const tag=`${width}-${theme}`;
 const page=await open(width,theme);
 await checkPicker(page,round);
 eq(await page.getByTestId('recommendation').count(),1,'the recommendation is on the page');
 for(let d=0;d<3;d++){
  await pick(page,d);
  for(const [c,state] of Object.entries(cases)){
   await setCase(page,c);
   const at=`${names[d]} ${c} ${tag}`;
   ok(await fits(page),`${at}: document overflow`);
   eq(await page.locator('.rq-lines li[aria-current]').count(),1,`${at}: its line is marked`);
   eq(await page.locator('[data-settings-row="github"]').count(),1,`${at}: production's GitHub row`);
   eq(await page.getByTestId('wf-row').count(),1,`${at}: one workflow permission`);
   eq(await wf(page),state,`${at}: state`);
   eq(await page.getByTestId('scope-chips').count(),1,`${at}: the token's scopes`);
   eq(await page.locator('[data-testid="scope-chips"][data-unknown]').count(),c==='tuntematon'?1:0,`${at}: unreadable scopes said`);
   ok((await page.getByTestId('wf-desc').innerText()).length>20,`${at}: the permission says what it means`);
   eq(await page.getByTestId('github-standin').count(),c==='kaynnistyy'?1:0,`${at}: github.com only while signing in`);
   if(c==='kaynnistyy')ok((await page.getByTestId('github-scopes').innerText()).includes('workflow'),`${at}: asks for workflow`);
   // The direction is where the permission sits.
   if(d===0)eq(await page.locator('.s-card > .rq-slot > [data-testid="wf-row"]').count(),1,`${at}: A's own row in the card`);
   if(d===1)eq(await page.locator('[data-settings-row="github"] [data-testid="scope-list"]').count(),1,`${at}: B's list in the GitHub row`);
   if(d===2){
    eq(await page.getByTestId('c-reconnect').count(),1,`${at}: C's reconnect`);
    eq(await page.locator('[data-testid="github-reconnect"]:visible').count(),0,`${at}: production's reconnect replaced`);
   }
   if(d!==2&&c!=='kaynnistyy'&&width===1440)ok(await page.getByTestId('wf-allow').or(page.getByTestId('wf-remove')).first().isVisible(),`${at}: the button is visible`);
   await shot(page,d,c,tag);
  }
 }
 await page.close();
}

// Flows at 1440 light.
const page=await open(1440,'light');
// A: allow, authorize, remove.
await pick(page,0);await setCase(page,'pois');
await page.getByTestId('wf-allow').click();await settle(page);
eq(await wf(page),'pending','A: allow starts the sign-in');
ok((await page.getByTestId('github-scopes').innerText()).includes('workflow'),'A: github asks workflow');
await page.getByTestId('github-authorize').click();await settle(page);
eq(await wf(page),'on','A: authorized -> allowed');
eq(await page.locator('[data-testid="scope-chips"] [data-scope="workflow"]').count(),1,'A: workflow chip');
ok(await page.getByTestId('wf-said').isVisible(),'A: says it');
await page.getByTestId('wf-remove').click();await page.waitForTimeout(700);
eq(await wf(page),'off','A: removed');
// A: cancel.
await page.getByTestId('wf-allow').click();await settle(page);
await page.getByTestId('github-cancel').click();await settle(page);
eq(await wf(page),'off','A: cancel leaves it off');
ok((await page.getByTestId('wf-said').innerText()).length>10,'A: cancel says nothing changed');
// A: production's Reconnect keeps the opt-in.
await setCase(page,'paalla');
await page.getByTestId('github-reconnect').click();await settle(page);
ok((await page.getByTestId('github-scopes').innerText()).includes('workflow'),'reconnect keeps workflow');
await page.getByTestId('github-authorize').click();await settle(page);
eq(await wf(page),'on','reconnect: still allowed');
await setCase(page,'pois');
await page.getByTestId('github-reconnect').click();await settle(page);
ok(!(await page.getByTestId('github-scopes').innerText()).includes('workflow'),'reconnect off asks no workflow');
await page.keyboard.press('Escape');await settle(page);
// A: missing -> Don't allow / Allow again.
await setCase(page,'kadonnut');
await page.getByTestId('wf-keep-off').click();await settle(page);
eq(await wf(page),'off','missing -> keep off');
await setCase(page,'kadonnut');
await page.getByTestId('wf-allow').click();await settle(page);
await page.getByTestId('github-authorize').click();await settle(page);
eq(await wf(page),'on','missing -> allowed again');
// B: allow.
await pick(page,1);await setCase(page,'pois');
await page.getByTestId('wf-allow').click();await settle(page);
await page.getByTestId('github-authorize').click();await settle(page);
eq(await wf(page),'on','B: allowed');
eq(await page.locator('[data-testid="scope-list"] [data-testid="wf-row"] [data-testid="wf-mark"]').count(),1,'B: mark in the list');
// C: the dialog's checkbox.
await pick(page,2);await setCase(page,'pois');
await page.getByTestId('c-reconnect').click();await settle(page);
eq(await page.getByTestId('c-dialog').count(),1,'C: dialog');
ok((await page.getByTestId('c-dialog').innerText()).includes('.github/workflows'),'C: the dialog explains');
await page.getByTestId('c-workflow').click();
await page.getByTestId('c-continue').click();await settle(page);
ok((await page.getByTestId('github-scopes').innerText()).includes('workflow'),'C: asks workflow');
await page.getByTestId('github-authorize').click();await settle(page);
eq(await wf(page),'on','C: allowed');
await shot(page,2,'sallittu-dialogista','1440-light');
await setCase(page,'kadonnut');
await page.getByTestId('c-reconnect').click();await settle(page);
ok(await page.locator('[data-testid="c-workflow"][data-selected]').count()===1,'C: missing pre-checks the box');
await shot(page,2,'kadonnut-dialogi','1440-light');
await page.getByTestId('c-cancel').click();await settle(page);
// English.
await pick(page,0);
await page.locator('#language').selectOption('en');await settle(page);await setCase(page,'pois');
ok((await page.getByTestId('wf-desc').innerText()).includes('secrets'),'English permission text');
await shot(page,0,'pois-en','1440-light');
await page.close();
}finally{await browser.close();}
assert.deepEqual(errors,[],`console: ${errors.join('\n')}`);
console.log(`${checks} checks, console clean`);
