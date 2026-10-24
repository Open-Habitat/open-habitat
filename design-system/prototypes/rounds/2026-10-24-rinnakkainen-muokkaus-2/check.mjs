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
const round='2026-10-24-rinnakkainen-muokkaus-2',names=['Ilmoitus','Hiljainen merkki','Rivimerkit'];
const [input,out]=process.argv.slice(2),hosted=input.startsWith('https:');
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
let checks=0;const errors=[];
try{
for(const width of [1440,390])for(const theme of ['light','dark']){
 const page=await browser.newPage({viewport:{width,height:1100},reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 if(hosted)await page.goto(input);else{await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));await page.goto('http://prototype.test/');}
 const f=hosted?page.frameLocator('iframe').first():page;
 const id=x=>f.getByTestId(x).first();
 await f.locator('#theme').selectOption(theme);
 await checkPicker(f,round);
 const key=async value=>{await f.locator('.axis').click();await page.keyboard.press(value);};
 const variant=d=>f.locator(`.shell.variant-${d}`).waitFor();
 await key('3');await variant(2);
 await key('ArrowRight');await variant(0);
 await key('2');await variant(1);
 assert.equal(await f.locator('.proto-picker-item[data-active]').innerText(),names[1].replaceAll(' ',' '));
 assert.equal(await f.locator('body').evaluate(()=>new URL(location.href).searchParams.get('v')),'2');
 await id('agent-write').click();
 assert.equal(await id('agent-write').isDisabled(),true);
 await key('r');await variant(1);
 assert.equal(await id('agent-write').isDisabled(),false,'R remounts the scenario');
 if(hosted){await f.locator('body').evaluate(()=>{document.body.dataset.old='1';location.reload();});await f.locator('body:not([data-old])').waitFor();}else await page.reload();
 await variant(1);await f.locator('nav.proto-picker[data-ready]').waitFor();
 await f.locator('#theme').selectOption(theme);
 if(width===390)await f.locator('#phone').check();
 assert.equal(await f.locator('#theme').inputValue(),theme);

 const checkpoint=async()=>{
  assert.equal(await f.locator('.review').evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'document overflow');
  for(const el of await f.locator('.shell button:visible,.shell-convo button:visible').all()){const b=await el.boundingBox();if(b)assert.ok(b.x>=-1&&b.x+b.width<=width+1,`control overflow ${JSON.stringify(b)}`);}
  checks++;
 };
 const shoot=width===1440&&theme==='light'||width===390&&theme==='dark';
 const capture=async(name,target='.shell')=>{
  if(hosted||!shoot)return;
  const base=`${out}/${name}-${width}-${theme}`;
  await f.locator(target).first().screenshot({path:`${base}.png`});
  const html=await page.evaluate(()=>{const copy=document.documentElement.cloneNode(true);copy.querySelectorAll('script').forEach(e=>e.remove());copy.querySelectorAll('style').forEach(e=>e.textContent=e.textContent.replace(/@font-face\s*\{[^}]*\}/g,''));return '<!doctype html>'+copy.outerHTML;});
  writeFileSync(`${base}.html`,html);
 };
 const disk=async who=>await f.locator(`[data-testid=inspect-${who}] [data-testid=on-disk] [data-on]`).count();
 const text=async()=>await f.locator('.cm-content').innerText();
 const start=async(d,{overlap='separate',source='agent',pause='1'}={})=>{
  await key(String(d+1));await variant(d);
  for(const s of [overlap,source,pause])await id(`segment-${s}`).click();
  await id('restart').click();await f.getByTestId('codemirror-editor').first().waitFor();
 };
 const pendingShown=async d=>{await id(d===0?'pending-banner':'pending-chip').waitFor();if(d===2)assert.ok(await f.locator('.cm-line.cfe-mark-pending').count()>=1,'landing lines are marked');};
 const importedShown=async d=>await id(d===0?'import-banner':'imported-chip').waitFor({timeout:8000});
 const undo=async(k='z')=>{await f.locator('.cm-content').click();await page.keyboard.press('End');await page.keyboard.press(k==='z'?'Control+z':'Control+y');};

 try{
 for(const d of [0,1,2]){
  // A · The person keeps typing; the agent saves mid-sentence. Nothing moves
  // under the fingers; the changes come in after the pause; Ctrl+Z undoes.
  await start(d);
  await id('type-and-write').click();
  await pendingShown(d);
  await page.waitForTimeout(600);
  assert.ok(!(await text()).includes('Debian 13'),'waiting: the agent text is not in the buffer yet');
  await capture(`d${d}-pending`);
  await checkpoint();
  await importedShown(d);
  const t=await text();
  assert.ok(t.includes('Debian 13')&&t.includes('## Päivitys')&&t.includes('kymmenen minuuttia')&&t.includes('4 Gt muistia'),'buffer has both and the typing');
  assert.equal(await f.locator('.cm-line.cfe-mark-agent').count(),5,'agent lines are marked');
  await capture(`d${d}-imported`);
  await checkpoint();
  await undo('z');
  await id('import-undone').waitFor();
  assert.ok(!(await text()).includes('Debian 13'),'Ctrl+Z removes the import');
  assert.ok((await text()).includes('kymmenen minuuttia'),'Ctrl+Z keeps the typing');
  assert.equal(await id('editor-save').innerText(),'Tallenna ja korvaa agentin versio');
  if(d===0)await capture(`d${d}-undone`);
  await undo('Z');await importedShown(d);
  await id('editor-save').click();await id('saved-banner').waitFor();
  assert.equal(await disk('agent'),2);assert.equal(await disk('you'),2);
  assert.equal(await f.getByTestId('replace-note').count(),0,'no note when nothing was replaced');
  await checkpoint();

  // B · Save while waiting brings the changes in and saves at once.
  await start(d);
  await id('agent-write').click();await pendingShown(d);
  await id('editor-save').click();await id('saved-banner').waitFor();
  assert.equal(await disk('agent'),2,'save brings the waiting changes');assert.equal(await disk('you'),2);

  // C · Same lines: per-line conflicts, then a replacement noted in the conversation.
  await start(d,{overlap:'same'});
  await id('agent-write').click();await pendingShown(d);
  await importedShown(d);
  assert.equal(await f.getByTestId('conflict').count(),2,'one card per conflicting line');
  assert.equal(await id('editor-save').isDisabled(),true,'open conflicts block save');
  await id(d===0?'import-banner':'save-reason').waitFor();
  await capture(`d${d}-conflict`);
  await checkpoint();
  await id('pick-theirs').click();
  await f.getByTestId('conflict').first().waitFor();
  assert.equal(await f.getByTestId('conflict').count(),1);
  await id('pick-mine').click();
  assert.equal(await f.getByTestId('conflict').count(),0);
  await id('editor-save').click();await id('saved-banner').waitFor();
  assert.equal(await disk('agent'),2,'virtuaalikone and Debian kept');assert.equal(await disk('you'),1,'4 Gt kept');
  await id('replace-note').waitFor();
  assert.ok((await id('replace-note').innerText()).includes('20 Gt levytilaa'));
  await id('tell-agent').click();
  const draft=await f.locator('.cfe-convo textarea, .cfe-convo [contenteditable=true]').first();
  await f.locator('.cfe-convo').first().getByText('Korvasin tallentaessani',{exact:false}).first().waitFor({state:'attached'}).catch(()=>{});
  const value=await draft.evaluate(e=>e.value??e.textContent);
  assert.ok(value.includes('Korvasin tallentaessani')&&value.includes('20 Gt levytilaa'),'Kerro agentille drafts the message');
  await capture(`d${d}-note`,width===390?'.shell-convo':'.shell');
  await checkpoint();

  // D · Not from a file tool call: neutral words, no conversation note.
  await start(d,{overlap:'same',source:'disk'});
  await id('agent-write').click();await pendingShown(d);
  if(d===0)assert.ok((await id('pending-banner').innerText()).includes('Tiedosto muuttui levyllä'));
  else assert.ok((await id('pending-chip').innerText()).includes('Levyn'));
  await importedShown(d);
  assert.ok((await id('conflict').innerText()).includes('Sama rivi muuttui levyllä'));
  if(d===0)await capture(`d${d}-neutral`);
  await id('pick-mine').click();await id('pick-mine').click();
  await id('editor-save').click();await id('saved-banner').waitFor();
  assert.equal(await f.getByTestId('replace-note').count(),0,'no agent note for a neutral change');
  await checkpoint();
 }
 }catch(e){await page.screenshot({path:`${out}/../failure.png`,fullPage:true});throw e;}
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[],'console errors');
writeFileSync(`${out}/checks.json`,JSON.stringify({round,input:hosted?input:'local build',checks,errors},null,2));
console.log(`ok: ${checks} checkpoints, no console errors`);
