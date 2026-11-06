// node check.mjs <offline.html> <evidence-dir> [filter]
// Authored synthetic component lab, not a host-backed acceptance test. Walks
// every riff light and dark at 1440 and 390 px: the default view, then the
// riff's own presses (1: back to source, render the short block, show all;
// 2: text, save to the workspace, close, open the short block; 3: render in
// place from the menu, then open the editor from it). Writes screenshots at
// device scale factor 2, prefixed r2-; the console must stay clean.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-06-md-lohkon-esikatselu-2';
const [input,out,only]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['nyt','1-paikallaan','2-editoriin','3-valikko'];
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
 const capture=async name=>{await page.waitForTimeout(250);await page.screenshot({path:`${out}/r2-${name}-${tag}.png`});};
 const fits=async()=>ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'document overflow');
 const draft=page.locator('[data-item="a2"]');
 const readme=page.locator('[data-item="a1"]');
 const center=async loc=>loc.first().evaluate(el=>el.scrollIntoView({block:'center'}));
 const top=async loc=>loc.first().evaluate(el=>el.scrollIntoView({block:'start'}));
 const phoneEditorTop=async()=>{if(width<=800)await page.locator('.ah-editor-open').evaluate(el=>{el.scrollTop=0;});};
 const pick=async d=>{
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.mdp-review.variant-${d}`).waitFor({state:'attached'});
  await page.locator('#start').selectOption('open');
  await draft.waitFor({state:'attached'});
  await page.waitForTimeout(800);
 };
 const railOrder=async loc=>loc.locator('.mdp-reply > .ah-markdown-code > .ah-output-box > .ah-bash-window > .ah-bash-rail button').evaluateAll(bs=>bs.map(b=>b.dataset.testid));
 for(const d of [0,1,2,3]){
  await pick(d);
  const n=names[d];
  assert.match(await page.getByTestId('direction-lines').locator('li[aria-current]').innerText(),new RegExp(`^${['Nyt:','1 ','2 ','3 '][d]}`));checks++;
  if(d===0){
   ok((await draft.locator('.ah-output-meta').innerText()).includes('markdown'),'today: language label');
   ok(await page.locator('.mdp-rail-group').count()===0,'today: no extra control');
   await center(draft.locator('.ah-markdown-code'));
   await fits();await capture(`${n}-1-oletus`);
  }
  if(d===1){
   const t=draft.getByTestId('md-toggle');
   ok(await t.getAttribute('aria-pressed')==='true','1: draft rendered');
   {const o=await railOrder(draft);ok(o[1]==='md-toggle','1: control right under copy'+' '+o.join(','));}
   ok(await draft.locator('[data-testid="md-rendered"] h1').count()===1,'1: heading rendered');
   ok(await draft.locator('.ah-output-meta').first().isVisible(),'1: label stays');
   ok(await readme.locator('.ah-output-viewport').count()===1,'1: short block still source');
   await fits();await capture(`${n}-1-oletus`);
   await draft.getByTestId('md-all').click();
   await center(draft.locator('table'));
   await capture(`${n}-2-kaikki`);
   const before=await t.boundingBox();
   await t.click();
   await draft.locator('.mdp-reply > .ah-markdown-code .ah-output-viewport').first().waitFor();
   const after=await t.boundingBox();
   ok(Math.abs(before.x-after.x)<1,'1: toggle stays under the pointer '+JSON.stringify([before,after]));
   ok(await draft.getByTestId('md-rendered').count()===0,'1: back to source');
   await center(draft.locator('.ah-markdown-code'));
   await capture(`${n}-3-lahde`);
   await readme.getByTestId('md-toggle').click();
   await readme.getByTestId('md-rendered').waitFor();
   await center(readme.locator('.ah-markdown-code'));
   await capture(`${n}-4-lyhyt`);
  }
  if(d===2){
   await page.locator('.ah-browser-editor [data-testid="editor-preview-toggle"][aria-pressed="true"]').waitFor();
   await page.locator('[data-testid="editor-preview"] h1').waitFor();
   ok((await page.locator('.ah-browser-filename').innerText()).includes('luonnos-julkaisu.md'),'2: draft name');
   ok(await draft.getByTestId('md-editor').getAttribute('aria-pressed')==='true','2: block shows open');
   {const o=await railOrder(draft);ok(o[1]==='md-editor','2: control right under copy'+' '+o.join(','));}
   await phoneEditorTop();
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
   ok((await page.locator('.ah-browser-filename').innerText()).includes('docs/julkaisu.md'),'2: saved path');
   await page.locator('[data-testid="close-editor"]').click();
   await page.locator('.ah-browser-editor').waitFor({state:'detached'});
   ok(await draft.getByTestId('md-editor').getAttribute('aria-pressed')==='false','2: closed');
   await center(readme.locator('.ah-markdown-code'));
   await fits();await capture(`${n}-4-suljettu`);
   await readme.getByTestId('md-editor').click();
   await page.locator('[data-testid="editor-preview"] h1').waitFor();
   await phoneEditorTop();
   ok((await page.locator('.ah-browser-filename').innerText()).includes('luonnos-readme.md'),'2: short block opens');
   await capture(`${n}-5-lyhyt`);
  }
  if(d===3){
   const menu=page.getByTestId('md-menu-popover');
   await menu.waitFor();
   ok(await menu.getByRole('menuitem').count()===2,'3: two actions');
   ok(await readme.getByTestId('md-rendered').count()===1,'3: short block rendered from the menu');
   {const o=await railOrder(draft);ok(o[1]==='md-menu','3: control right under copy'+' '+o.join(','));}
   await fits();await capture(`${n}-1-oletus`);
   await page.getByTestId('md-menu-here').click();
   await menu.waitFor({state:'detached'});
   await draft.getByTestId('md-rendered').waitFor();
   ok(await draft.getByTestId('md-menu').getAttribute('aria-pressed')==='true','3: pressed while rendered');
   await top(draft.locator('.ah-markdown-code'));
   await capture(`${n}-2-tassa`);
   await draft.getByTestId('md-menu').click();
   await menu.waitFor();
   ok((await page.getByTestId('md-menu-here').innerText()).includes('Näytä lähde'),'3: menu offers source back');
   await capture(`${n}-3-valikko-renderoity`);
   await page.getByTestId('md-menu-editor').click();
   await page.locator('[data-testid="editor-preview"] h1').waitFor();
   await phoneEditorTop();
   ok((await page.locator('.ah-browser-filename').innerText()).includes('luonnos-julkaisu.md'),'3: editor from menu');
   await capture(`${n}-4-editorissa`);
   await page.locator('[data-testid="close-editor"]').click();
   await page.locator('.ah-browser-editor').waitFor({state:'detached'});
   await draft.getByTestId('md-menu').click();
   await page.getByTestId('md-menu-here').click();
   await draft.locator('.mdp-reply > .ah-markdown-code .ah-output-viewport').first().waitFor();
   ok(await draft.getByTestId('md-rendered').count()===0,'3: back to source');
  }
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
