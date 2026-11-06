// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. Walks
// every direction light and dark at 1440 and 390 px: the default view, then
// the direction's own presses (A: open from the block, text and preview,
// save to the workspace, close; B: open, expand, the short block, close;
// C: source, show all, the short block). Writes screenshots at device scale
// factor 2; the console must stay clean.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-06-md-lohkon-esikatselu';
const [input,out,only]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['nyt','a-editorissa','b-paneelissa','c-paikallaan'];
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
try{
for(const width of [1440,390])for(const theme of ['light','dark']){
 if(only&&!`${width}-${theme}`.includes(only))continue;
 const page=await browser.newPage({viewport:{width,height:width===390?844:900},deviceScaleFactor:2,reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 await checkPicker(page,round);
 const tag=`${width}-${theme}`;
 const capture=async name=>{await page.waitForTimeout(250);await page.screenshot({path:`${out}/${name}-${tag}.png`});};
 const fits=async()=>ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'document overflow');
 const draft=page.locator('[data-item="a2"]');
 const readme=page.locator('[data-item="a1"]');
 const center=async loc=>loc.first().evaluate(el=>el.scrollIntoView({block:'center'}));
 const pick=async d=>{
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.mdp-review.variant-${d}`).waitFor({state:'attached'});
  await page.locator('#start').selectOption('open');
  await draft.waitFor({state:'attached'});
  await page.waitForTimeout(300);
 };
 for(const d of [0,1,2,3]){
  await pick(d);
  const n=names[d];
  assert.match(await page.getByTestId('direction-lines').locator('li[aria-current]').innerText(),new RegExp(`^${['Nyt:','A ','B ','C '][d]}`));checks++;
  if(d===0){
   ok((await draft.locator('.ah-output-meta').innerText()).includes('markdown'),'today: language label');
   ok(await page.getByTestId('md-open').count()===0,'today: no preview control');
   await center(draft.locator('.ah-markdown-code'));
   await fits();await capture(`${n}-1-oletus`);
  }
  if(d===1){
   await page.locator('.ah-browser-editor [data-testid="editor-preview-toggle"][aria-pressed="true"]').waitFor();
   await page.locator('[data-testid="editor-preview"] h1').waitFor();
   ok((await page.locator('.ah-browser-filename').innerText()).includes('luonnos-julkaisu.md'),'A: draft name');
   ok(await draft.getByTestId('md-open').getAttribute('aria-pressed')==='true','A: block shows open');
   await center(draft.getByTestId('md-open'));
   // A phone stacks the editor above the conversation in one scroller.
   if(width<=800)await page.locator('.ah-editor-open').evaluate(el=>{el.scrollTop=0;});
   await fits();await capture(`${n}-1-oletus`);
   await page.locator('[data-testid="editor-text-toggle"]').click();
   await page.locator('.ah-browser-editor .cm-content').waitFor();
   await capture(`${n}-2-teksti`);
   await page.locator('[data-testid="editor-preview-toggle"]').click();
   await page.locator('[data-testid="editor-save"]').click();
   await page.getByTestId('md-save').waitFor();
   assert.equal(await page.getByTestId('md-save').locator('input').inputValue(),'docs/julkaisu.md');checks++;
   await capture(`${n}-3-tallenna`);
   await page.getByTestId('md-save-go').click();
   await page.getByTestId('md-save').waitFor({state:'detached'});
   ok((await page.locator('.ah-browser-filename').innerText()).includes('docs/julkaisu.md'),'A: saved path');
   await capture(`${n}-4-tallennettu`);
   await page.locator('[data-testid="close-editor"]').click();
   await page.locator('.ah-browser-editor').waitFor({state:'detached'});
   ok(await draft.getByTestId('md-open').getAttribute('aria-pressed')==='false','A: closed');
   await center(readme.locator('.ah-markdown-code'));
   await fits();await capture(`${n}-5-suljettu`);
   await readme.getByTestId('md-open').click();
   await page.locator('[data-testid="editor-preview"] h1').waitFor();
   if(width<=800)await page.locator('.ah-editor-open').evaluate(el=>{el.scrollTop=0;});
   ok((await page.locator('.ah-browser-filename').innerText()).includes('luonnos-readme.md'),'A: short block opens');
   await capture(`${n}-6-lyhyt`);
  }
  if(d===2){
   await page.getByTestId('md-panel').waitFor();
   ok((await page.getByTestId('md-panel').locator('.ah-view-title').innerText())==='Sivuston julkaisu','B: title from heading');
   ok(await page.getByTestId('md-panel').locator('table').count()===1,'B: table rendered');
   await center(draft.getByTestId('md-open'));
   await fits();await capture(`${n}-1-oletus`);
   if(width>800){
    await page.getByTestId('md-panel-expand').click();
    await page.locator('.ah-view-expanded').waitFor();
    await capture(`${n}-2-laajennettu`);
    await page.getByTestId('md-panel-expand').click();
   }
   await page.getByTestId('md-panel-close').click();
   await page.getByTestId('md-panel').waitFor({state:'detached'});
   await center(readme.locator('.ah-markdown-code'));
   await fits();await capture(`${n}-3-suljettu`);
   await readme.getByTestId('md-open').click();
   await page.getByTestId('md-panel').waitFor();
   ok((await page.getByTestId('md-panel').locator('.ah-view-title').innerText())==='Kaarinan pyöräseura','B: short block opens');
   await capture(`${n}-4-lyhyt`);
  }
  if(d===3){
   const block=draft.getByTestId('md-inplace');
   ok(await block.locator('[data-testid="md-rendered"] h1').count()===1,'C: rendered in place');
   await center(block);
   await fits();await capture(`${n}-1-oletus`);
   await block.getByTestId('md-all').click();
   ok(await block.locator('.mdp-doc-clipped').count()===0,'C: show all');
   await center(block.locator('table'));
   await capture(`${n}-2-kaikki`);
   await block.getByTestId('segment-source').click();
   await block.locator('.ah-output-box').waitFor();
   await center(block);
   await capture(`${n}-3-lahde`);
   await center(readme.getByTestId('md-inplace'));
   await capture(`${n}-4-lyhyt`);
  }
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
