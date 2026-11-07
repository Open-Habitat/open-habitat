// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. Walks
// every direction at 1440 and 390 px, light and dark: closing the editor,
// switching file, switching to another workspace's conversation, the VS Code
// to phone-editor question and a save that fails, each answered once, and
// the same in English (light). The VS Code question is also taken at 780 px,
// a narrowed desktop window, where it actually arises. Screenshots at device
// scale factor 2 with the round prefix r1; the console must stay clean.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-07-oma-vahvistus';
const [input,out]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <evidence-dir>');process.exit(2);}
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['r1-a-ikkuna','r1-b-palkki','r1-c-ei-kysy'];
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
try{
for(const [width,themes] of [[1440,['light','dark']],[390,['light','dark']],[780,['light']]])for(const theme of themes){
 const page=await browser.newPage({viewport:{width,height:width===390?844:900},deviceScaleFactor:2,reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('dialog',d=>d.dismiss());
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 await checkPicker(page,round);
 const tag=`${width}-${theme}`;
 const capture=async name=>{await page.waitForTimeout(200);await page.screenshot({path:`${out}/${name}-${tag}.png`});};
 const fits=async()=>ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'document overflow');
 // The review bar and the picker stay usable while the modal is open.
 const set=async(id,v)=>{await page.locator(id).selectOption(v);await page.waitForTimeout(250);};
 const editorOpen=async()=>(await page.locator('.ah-editor-open').count())>0;
 const asked=async d=>d===1?page.getByTestId('ask-bar'):page.getByTestId('ask-dialog');
 const title=async()=>(await page.locator('.ah-agent-header h1, .ah-agent-header [data-testid="agent-title"]').first().innerText().catch(()=>''));
 for(const d of [0,1,2]){
  await page.waitForTimeout(200);await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.dlg-review.variant-${d}`).waitFor({state:'attached'});
  await set('#lang','fi');await set('#save','ok');await set('#step','ask');
  assert.match(await page.getByTestId('direction-lines').locator('li[aria-current]').innerText(),/^[ABC] /);checks++;
  const n=names[d];
  const cases=width===780?['phone']:theme==='dark'?['close','phone']:['close','file','conversation','phone'];
  for(const k of cases){
   await set('#case',k);
   const shot=`${n}-${({close:'1-sulje',file:'2-tiedosto',conversation:'3-keskustelu',phone:'4-vscode'})[k]}`;
   if(d===2){
    // C asks nothing: the default view is the result and its notice.
    const toast=page.getByTestId('toast');await toast.waitFor();
    const text=await toast.innerText();
    if(k==='phone')ok(text.includes('VS Coden muutokset tallennettiin'),'C phone notice');
    else ok(text.includes('Tallennettu asennus.md'),`C saved notice ${k}`);
    ok(await page.getByTestId('ask-dialog').count()===0,'C asks nothing');
    await fits();await capture(shot);
    if(k==='close'){
     ok(!(await editorOpen()),'C closed the editor');
     await page.getByTestId('toast-undo').click();
     ok(await editorOpen(),'C undo reopens the editor');
     ok((await page.getByTestId('toast').innerText()).includes('kumottu'),'C undo notice');
     if(width===1440)await capture(`${n}-1b-kumottu`);
    }
    if(k==='conversation')ok((await page.locator('.ah-editor-open').count())===0&&(await page.getByText('Kotisivun kuvat').count())>0,'C went to the conversation');
    continue;
   }
   const q=await asked(d);await q.waitFor();
   const text=await q.innerText();
   if(k==='phone')ok(/VS Code/.test(text),'phone question');
   else ok(text.includes('asennus.md'),`question names the file ${k}`);
   if(d===0&&k==='close')assert.equal((await page.getByTestId('ask-save').innerText()).trim(),'Tallenna ja sulje'),checks++;
   if(d===1&&k==='close')assert.equal((await page.getByTestId('ask-save').innerText()).trim(),'Tallenna'),checks++;
   if(d===1)ok(await page.locator('[role="dialog"],[role="alertdialog"]').count()===0,'B is not modal');
   await fits();await capture(shot);
   // Answer once per situation, a different answer each time.
   if(k==='close'){await page.getByTestId('ask-save').click();ok(!(await editorOpen()),'saved and closed');}
   if(k==='file'){await page.getByTestId('ask-discard').click();await page.waitForTimeout(300);ok((await page.locator('.cm-content').innerText()).includes('Käyttäjät'),'discarded and opened');}
   if(k==='conversation'){await page.getByTestId('ask-keep').click();await q.waitFor({state:'detached'});ok(await editorOpen(),'kept editing');}
   if(k==='phone'){await page.getByTestId('ask-discard').click();ok(await page.locator('.dlg-vscode').count()===0,'switched to the phone editor');}
  }
  if(width===780)continue;
  // A save that fails: A and B say so and keep the text; C asks.
  if(theme==='light'){
   await set('#save','fail');await set('#case','close');
   if(d===2){await page.getByTestId('ask-dialog').waitFor();ok((await page.getByTestId('ask-dialog').innerText()).includes('ei voitu tallentaa'),'C asks on failure');}
   else{await (await asked(d)).waitFor();await page.getByTestId('ask-save').click();await page.locator('text=Tallennus ei onnistunut').first().waitFor();checks++;}
   await fits();await capture(`${n}-5-ei-tallennu`);
   await page.getByTestId('ask-keep').click();ok(await editorOpen(),'text kept after failure');
   await set('#save','ok');
   // English wording, every situation.
   await set('#lang','en');
   for(const k of ['close','file','conversation','phone']){
    await set('#case',k);
    const el=d===2?page.getByTestId('toast'):await asked(d);await el.waitFor();
    const t=await el.innerText();
    ok(!/[äö]|Tallenna|Hylkää/.test(t.replace(/kayttajat|asennus|kotisivu|Kotisivun kuvat/g,'')),`English text ${d} ${k}: ${t}`);
    await fits();await capture(`${n}-${({close:'6',file:'7',conversation:'8',phone:'9'})[k]}-en-${k}`);
   }
   await set('#lang','fi');
  }
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
