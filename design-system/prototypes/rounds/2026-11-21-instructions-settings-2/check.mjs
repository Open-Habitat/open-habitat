// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic walkthrough check, not a host-backed acceptance test.
// Default view (both variants and every situation, 1440 and 390 px, Päivä,
// Yö and Kontrasti, reduced motion): no document overflow, the variant's line
// marked, production's Settings on Tili with the block after its card, the
// shared editor open in Esikatselu with nothing to save, the source line
// (path, Pi, whether Claude reads it), B1's agent button secondary beside a
// file and primary on an empty one, B2 without it, the empty state, and the
// self-written note (B2 also says to ask the agent for Claude's reference).
// Flows (1440 Päivä for both variants, B1 also at 390 Yö): edit as text,
// unsaved mark, Peru, edit again, Tallenna (one compare-and-swap write,
// "Päivitetty juuri"); write a missing file yourself (the file and Claude's
// file created); a file that changes meanwhile — a different line merges in
// and saves on the second try, the same line shows the conflict card and
// blocks Tallenna until a side is picked. B1 also: edit with the agent (a
// proposal, Tallenna, back to an updated editor), Claude's reference added
// to a self-written setup, and a missing file written by the agent.
// English last. Screenshots at device scale 2 into <out-dir>; console clean.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-21-instructions-settings-2';
const [input,out,flag]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <out-dir> [--quick]');process.exit(2);}
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['editori-ja-agentti','pelkka-editori'];
const scenarios=['habitat','missing','own','changed'];
const W={fi:{preview:'Esikatselu',edit:'Muokkaa',heading:'Ohjeet agentille',note:'Muistilappu agentille',edit1:'Muokkaa agentin kanssa',write1:'Kirjoita agentin kanssa'},
 en:{preview:'Preview',edit:'Edit',heading:'Agent instructions',note:'A note for my agent',edit1:'Edit with the agent',write1:'Write with the agent'}};
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};

async function open(width,theme,lang='fi'){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:1000},deviceScaleFactor:2,reducedMotion:'reduce',hasTouch:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto('http://prototype.test/'+(lang==='en'?'?lang=en':''));
 await page.locator('#theme').selectOption(theme);
 await ready(page);
 return page;
}
const settle=page=>page.waitForTimeout(200);
const tid=(page,id)=>page.getByTestId(id);
const ready=async page=>{await page.locator('.ii-section [data-testid^="direction-"]').waitFor();await settle(page);};
const pick=async(page,d)=>{await page.locator('.proto-picker-item').nth(d).click();await page.locator(`.ii-review[data-direction="${d}"]`).waitFor({state:'attached'});await ready(page);};
const sel=async(page,v)=>{await page.locator('#scenario').selectOption(v);await ready(page);};
const toBlock=page=>page.evaluate(()=>document.querySelector('.ii-wrap')?.scrollIntoView({block:'start'}));
const shot=(page,name)=>page.screenshot({path:`${out}/${name}.png`});
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const has=async(page,id)=>(await tid(page,id).count())>0;
const press=async(page,id,n=0)=>{await tid(page,id).nth(n).click();await settle(page);};
const chip=async(page,label)=>{await tid(page,'quick-reply').filter({hasText:label}).click();await settle(page);};
const tab=async(page,name)=>{await page.getByRole('tab',{name,exact:true}).click();await settle(page);};
const hostState=page=>page.evaluate(()=>window.__host());
const preview=async page=>(await tid(page,'editor-preview').textContent());
const raw=page=>tid(page,'editor-text');

async function defaultView(page,d,s,at,lang='fi'){
 const w=W[lang];
 ok(await fits(page),`${at}: document overflow`);
 eq(await page.locator('.ii-lines li[aria-current]').count(),1,`${at}: its line is marked`);
 eq(await page.locator('.s-main > .ii-section').count(),1,`${at}: block in production's Settings`);
 ok(await page.locator('.s-main .s-card').first().isVisible(),`${at}: Tili card`);
 eq((await tid(page,'instructions-heading').textContent()).trim(),w.heading,`${at}: heading`);
 eq(await page.getByRole('tab',{name:w.preview,exact:true}).getAttribute('aria-selected'),'true',`${at}: opens in Esikatselu`);
 eq(await has(page,'editor-save'),false,`${at}: nothing to save`);
 const src=await tid(page,'source').textContent();
 ok(src.includes('~/.pi/agent/AGENTS.md'),`${at}: path`);
 eq(await tid(page,'source-claude').getAttribute('data-claude'),{habitat:'imports',missing:'none',own:'own',changed:'imports'}[s],`${at}: Claude`);
 const agent=await has(page,'edit-with-agent');
 eq(agent,d===0,`${at}: agent button only in B1`);
 if(s==='missing'){
  ok(await tid(page,'missing').isVisible(),`${at}: empty state`);
  if(d===0){eq((await tid(page,'edit-with-agent').textContent()).trim(),w.write1,`${at}: write with the agent`);
  }
 }else{
  ok((await preview(page)).length>20,`${at}: rendered note`);
  if(d===0)eq((await tid(page,'edit-with-agent').textContent()).trim(),w.edit1,`${at}: edit with the agent`);
 }
 if(s==='own'){
  ok(await tid(page,'own-note').isVisible(),`${at}: self-written note`);
  if(d===1)ok((await tid(page,'own-note').textContent()).includes(lang==='fi'?'pyydä agenttia':'ask the agent'),`${at}: B2 says how Claude gets the reference`);
 }
 ok(await tid(page,'anywhere').isVisible(),`${at}: any conversation`);
}

async function editFlow(page,at){
 await tab(page,W.fi.edit);
 const before=await raw(page).inputValue();
 ok(before.startsWith('# Muistilappu agentille'),`${at}: raw Markdown`);
 await raw(page).fill(before+'\n\nPoistetaan.');await settle(page);
 ok(await has(page,'editor-unsaved'),`${at}: unsaved`);
 await press(page,'editor-cancel');
 eq(await has(page,'editor-unsaved'),false,`${at}: Peru`);
 ok(!(await preview(page)).includes('Poistetaan.'),`${at}: Peru dropped it`);
 await tab(page,W.fi.edit);
 await raw(page).fill(before+'\n\nKäytä esimerkeissä kirjastoaiheita.');await settle(page);
 await shot(page,`${at}-edit`);
 await press(page,'editor-save');
 ok(await has(page,'editor-saved'),`${at}: saved`);
 ok(await has(page,'updated-tag'),`${at}: updated`);
 ok((await preview(page)).includes('kirjastoaiheita'),`${at}: preview updated`);
 const h=await hostState(page);
 eq(h.writes.length,1,`${at}: one write`);eq(h.writes[0].created,false,`${at}: replace, not create`);
}

async function writeMissing(page,at){
 await tab(page,W.fi.edit);
 await raw(page).fill('# Muistilappu agentille\n\nOlen Aino. Vastaa lyhyesti.');await settle(page);
 await press(page,'editor-save');
 const h=await hostState(page);
 eq(h.writes.length,2,`${at}: file and Claude's file`);ok(h.writes.every(w=>w.created),`${at}: both created`);
 eq(await tid(page,'source-claude').getAttribute('data-claude'),'imports',`${at}: Claude now reads it`);
 ok((await preview(page)).includes('Vastaa lyhyesti'),`${at}: preview`);
}

async function changedMerge(page,at){
 await tab(page,W.fi.edit);
 const v=await raw(page).inputValue();
 await raw(page).fill(v.replace('Olen Aino Laine.','Olen Aino Laine, kutsu minua Ainoksi.'));await settle(page);
 await press(page,'editor-save');
 ok(await has(page,'editor-merged'),`${at}: refused save merged`);
 eq(await has(page,'editor-conflict'),false,`${at}: no conflict on a different line`);
 const merged=await raw(page).inputValue();
 ok(merged.includes('kutsu minua Ainoksi')&&merged.includes('uv:tä'),`${at}: both changes`);
 eq((await hostState(page)).writes.length,0,`${at}: nothing written yet`);
 await shot(page,`${at}-merged`);
 await press(page,'editor-save');
 eq((await hostState(page)).writes.length,1,`${at}: second save writes`);
 eq(await has(page,'editor-merged'),false,`${at}: notice gone`);
}

async function changedConflict(page,at){
 await tab(page,W.fi.edit);
 const v=await raw(page).inputValue();
 await raw(page).fill(v.replace('Kysy minulta ennen kuin julkaiset jotain tai lähetät muutoksia GitHubiin.','Kysy minulta aina ensin.'));await settle(page);
 await press(page,'editor-save');
 ok(await has(page,'editor-conflict'),`${at}: same line conflicts`);
 ok(await tid(page,'editor-save').isDisabled(),`${at}: save blocked`);
 await shot(page,`${at}-conflict`);
 await press(page,'pick-mine');
 eq(await has(page,'editor-conflict'),false,`${at}: picked`);
 const text=await raw(page).inputValue();
 ok(text.includes('Kysy minulta aina ensin.')&&text.includes('uv:tä'),`${at}: mine kept, the other change in`);
 await press(page,'editor-save');
 eq((await hostState(page)).writes.length,1,`${at}: saved`);
}

async function agentFlow(page,at){
 await press(page,'edit-with-agent');
 ok(await has(page,'conversation'),`${at}: conversation`);
 await shot(page,`${at}-chat`);
 await chip(page,'Vastaa lyhyemmin');
 ok(await has(page,'proposal'),`${at}: proposal`);
 await chip(page,'Tallenna');
 eq(await page.locator('[data-testid="ii-tool"]').count(),1,`${at}: one edit`);
 await press(page,'back-to-settings');await ready(page);
 ok((await preview(page)).includes('Vastaa lyhyesti ja suoraan.'),`${at}: editor shows the agent's change`);
 ok(await has(page,'updated-tag'),`${at}: updated`);
}

async function claudeFlow(page,at){
 await press(page,'edit-with-agent');
 await chip(page,'Lisää viittaus Claudelle');
 eq(await tid(page,'proposal').getAttribute('data-file'),'claude',`${at}: Claude's file`);
 await chip(page,'Tallenna');
 await press(page,'back-to-settings');await ready(page);
 eq(await tid(page,'source-claude').getAttribute('data-claude'),'imports',`${at}: Claude reads it now`);
}

async function agentMissing(page,at){
 await press(page,'edit-with-agent');
 await chip(page,'Selitä, mitä teet');
 await chip(page,'Tallenna');
 eq(await page.locator('[data-testid="ii-tool"]').count(),2,`${at}: both files written`);
 await press(page,'back-to-settings');await ready(page);
 ok((await preview(page)).includes('Muistilappu agentille'),`${at}: the new note`);
}

const themes=quick?['light']:['light','dark','contrast'];
for(const width of [1440,390]){
 for(const theme of themes){
  const page=await open(width,theme);
  await checkPicker(page,round);
  for(let d=0;d<2;d++){
   await pick(page,d);
   for(const s of scenarios){
    const at=`${names[d]} ${s} ${width}-${theme}`;
    await sel(page,s);
    await defaultView(page,d,s,at);
    await toBlock(page);await shot(page,`${d}-${names[d]}-${s}-${width}-${theme}`);
   }
   const flows=(width===1440&&theme==='light')||(width===390&&theme==='dark'&&d===0);
   if(!flows)continue;
   const tag=`${d}-${names[d]}-${width}-${theme}`;
   await sel(page,'habitat');await toBlock(page);await editFlow(page,`${tag}-habitat`);
   await sel(page,'missing');await toBlock(page);await writeMissing(page,`${tag}-missing`);
   await sel(page,'changed');await toBlock(page);await changedMerge(page,`${tag}-changed`);
   await sel(page,'changed');await toBlock(page);await changedConflict(page,`${tag}-changed-same`);
   if(d===0){
    await sel(page,'habitat');await agentFlow(page,`${tag}-agent`);
    await sel(page,'own');await claudeFlow(page,`${tag}-claude`);
    await sel(page,'missing');await agentMissing(page,`${tag}-agent-missing`);
   }
  }
  await page.close();
 }
}
// English last.
for(const width of [1440,390]){
 const page=await open(width,'dark','en');
 for(let d=0;d<2;d++){
  await pick(page,d);
  for(const s of scenarios){await sel(page,s);await defaultView(page,d,s,`${names[d]} ${s} en ${width}`,'en');}
  await sel(page,'habitat');await toBlock(page);await shot(page,`${d}-${names[d]}-habitat-${width}-en`);
 }
 await page.close();
}
await browser.close();
if(errors.length){console.error('console errors:\n'+[...new Set(errors)].join('\n'));process.exit(1);}
console.log(`${checks} checks passed, console clean; screenshots in ${out}`);
