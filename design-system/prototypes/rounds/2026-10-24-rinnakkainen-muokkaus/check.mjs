// node check.mjs <html-or-hosted-url> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-10-24-rinnakkainen-muokkaus',names=['Nykyinen','Valitse','Yhdistä','Tuo heti'];
const [input,out]=process.argv.slice(2),hosted=input.startsWith('https:');
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
let checks=0;const errors=[];
try{
for(const width of [1440,390])for(const theme of ['light','dark']){
 const page=await browser.newPage({viewport:{width,height:1100},reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('dialog',d=>d.accept());
 if(hosted)await page.goto(input);else{await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));await page.goto('http://prototype.test/');}
 const f=hosted?page.frameLocator('iframe').first():page;
 const id=x=>f.getByTestId(x).first();
 await f.locator('#theme').selectOption(theme);
 await checkPicker(f,round);
 const key=async value=>{await f.locator('.axis').click();await page.keyboard.press(value);};
 const variant=d=>f.locator(`.shell.variant-${d}`).waitFor();
 await key('4');await variant(3);
 await key('ArrowRight');await variant(0);
 await key('3');await variant(2);
 assert.equal(await f.locator('.proto-picker-item[data-active]').innerText(),names[2].replaceAll(' ','\u00a0'));
 assert.equal(await f.locator('body').evaluate(()=>new URL(location.href).searchParams.get('v')),'3');
 await id('agent-write').click();
 assert.equal(await id('agent-write').isDisabled(),true);
 await key('r');await variant(2);
 assert.equal(await id('agent-write').isDisabled(),false,'R remounts the scenario');
 if(hosted){await f.locator('body').evaluate(()=>{document.body.dataset.old='1';location.reload();});await f.locator('body:not([data-old])').waitFor();}else await page.reload();
 await variant(2);await f.locator('nav.proto-picker[data-ready]').waitFor();
 await f.locator('#theme').selectOption(theme);
 if(width===390)await f.locator('#phone').check();
 assert.equal(await f.locator('#theme').inputValue(),theme);

 const checkpoint=async()=>{
  assert.equal(await f.locator('.review').evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'document overflow');
  for(const el of await f.locator('.shell button:visible,.shell input:visible').all()){const b=await el.boundingBox();if(b)assert.ok(b.x>=-1&&b.x+b.width<=width+1,`control overflow ${JSON.stringify(b)}`);}
  checks++;
 };
 const capture=async(name)=>{
  if(hosted)return;
  const base=`${out}/${name}-${width}-${theme}`;
  await f.locator('.shell').screenshot({path:`${base}.png`});
  const html=await page.evaluate(()=>{const copy=document.documentElement.cloneNode(true);copy.querySelectorAll('script').forEach(e=>e.remove());copy.querySelectorAll('style').forEach(e=>e.textContent=e.textContent.replace(/@font-face\s*\{[^}]*\}/g,''));return '<!doctype html>'+copy.outerHTML;});
  writeFileSync(`${base}.html`,html);
 };
 const disk=async who=>await f.locator(`[data-testid=inspect-${who}] [data-testid=on-disk] [data-on]`).count();
 const shoot=width===1440&&theme==='light'||width===390&&theme==='dark';
 const setOverlap=async o=>{await id(`segment-${o}`).click();};
 const start=async(d,o)=>{await key(String(d+1));await variant(d);await setOverlap(o);await id('restart').click();await f.getByTestId('codemirror-editor').first().waitFor();};

 try{
 // 0 · Nykyinen: refused save, compare, adopt as base, save overwrites the agent.
 for(const o of ['separate','same']){
  await start(0,o);
  await id('agent-write').click();
  await id('editor-save').click();
  await id('editor-problem').waitFor();
  assert.equal(await id('editor-save').isDisabled(),true,'baseline blocks save after file_changed');
  await id('editor-compare').click();await id('editor-comparison').waitFor();
  if(o==='same'&&shoot)await capture('n0-compare');
  await id('editor-reconcile').click();
  await id('editor-save').click();await id('baseline-saved').waitFor();
  assert.equal(await disk('agent'),0,'baseline: the agent changes are overwritten');
  assert.equal(await disk('you'),2);
  await checkpoint();
 }
 // 1 · Valitse: notice at once; keep mine / take theirs (+ restore).
 await start(1,'separate');
 await id('agent-write').click();await id('conflict-banner').waitFor();
 if(shoot)await capture('v1-notice');
 await id('editor-save').click();await id('compare-view').waitFor();
 if(shoot)await capture('v1-compare');
 await checkpoint();
 await id('take-theirs').click();await id('undo-take').waitFor();
 assert.equal(await disk('agent'),2);
 await id('undo-take').click();await id('conflict-banner').waitFor();
 await id('open-compare').click();await id('keep-mine').click();await id('saved-banner').waitFor();
 assert.equal(await disk('agent'),0);assert.equal(await disk('you'),2);
 await checkpoint();
 // 2 · Yhdistä: refused save opens the merge; both changes land.
 for(const o of ['separate','same']){
  await start(2,o);
  await id('agent-write').click();
  assert.equal(await f.getByTestId('conflict-banner').count(),0,'direction 2 has no early notice');
  await id('editor-save').click();await id('merge-view').waitFor();
  if(o==='same'){
   assert.equal(await id('merge-save').isDisabled(),true,'an open conflict blocks the merge save');
   if(shoot)await capture('v2-conflict');
   await f.getByTestId('conflict-pick').first().getByTestId('segment-both').click();
  }else if(shoot)await capture('v2-merge');
  await checkpoint();
  await id('merge-save').click();await id('saved-banner').waitFor();
  assert.equal(await disk('agent'),2,`merge keeps the agent changes (${o})`);
  assert.equal(await disk('you'),2,`merge keeps your changes (${o})`);
 }
 // 3 · Tuo heti: imported into the buffer; conflict inline; undo import.
 await start(3,'separate');
 await id('agent-write').click();await id('import-banner').waitFor();
 assert.equal(await f.locator('.cm-line.cfe-mark-agent').count(),5,'agent lines are marked');
 const text=await f.locator('.cm-content').innerText();
 assert.ok(text.includes('Debian 13')&&text.includes('4 Gt muistia')&&text.includes('## Päivitys'),'buffer has both');
 if(shoot)await capture('v3-import');
 await checkpoint();
 await id('undo-import').click();await id('import-undone').waitFor();
 assert.ok(!(await f.locator('.cm-content').innerText()).includes('Debian 13'),'undo removes the agent text');
 await id('redo-import').click();await id('import-banner').waitFor();
 await id('editor-save').click();await id('saved-banner').waitFor();
 assert.equal(await disk('agent'),2);assert.equal(await disk('you'),2);
 await start(3,'same');
 await id('agent-write').click();await id('inline-conflict').waitFor();
 assert.equal(await id('editor-save').isDisabled(),true,'conflict blocks save');
 if(shoot)await capture('v3-conflict');
 await checkpoint();
 await id('resolve-theirs').click();
 await id('editor-save').click();await id('saved-banner').waitFor();
 assert.equal(await disk('agent'),2);assert.equal(await disk('you'),1);
 }catch(e){await page.screenshot({path:`${out}/../failure.png`,fullPage:true});throw e;}
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[],'console errors');
writeFileSync(`${out}/checks.json`,JSON.stringify({round,input:hosted?input:'local build',checks,errors},null,2));
console.log(`ok: ${checks} checkpoints, no console errors`);
