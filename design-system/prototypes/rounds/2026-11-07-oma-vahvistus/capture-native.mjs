// xvfb-run -a -s "-screen 0 2880x1800x24" node capture-native.mjs <offline.html> <evidence-dir>
// Today's behaviour as the person sees it: Chromium's own window.confirm and
// beforeunload prompts. A headless screenshot never contains native dialogs,
// so this runs a headed Chromium on a virtual display at scale factor 2 and
// takes the whole screen with ImageMagick's import. The confirm text is the
// production catalog's (web/src/text/browserDocument.ts, workspaceEditor.ts),
// asked from the prototype's own view at the origin shown in the dialog.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const [input,out]=process.argv.slice(2);
if(!input||!out||!process.env.DISPLAY){console.error('usage: xvfb-run -a -s "-screen 0 2880x1800x24" node capture-native.mjs <offline.html> <evidence-dir>');process.exit(2);}
mkdirSync(out,{recursive:true});
const origin='https://open-habitat-test.example.test';
const browser=await chromium.launch({headless:false,args:['--force-device-scale-factor=2','--window-position=0,0','--window-size=1440,900','--disable-features=Translate']});
const grab=name=>execFileSync('import',['-window','root',`${out}/${name}.png`]);
try{
 for(const kase of ['close','phone']){
  const context=await browser.newContext({viewport:null});
  const page=await context.newPage();
  await page.route(origin+'/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));
  await page.goto(origin+'/');
  await page.locator('#case').selectOption(kase);
  await page.locator('#step').selectOption('edit');
  await page.waitForTimeout(800);
  // Leave the dialog pending: the listener answers only after the capture.
  const shown=new Promise(ok=>page.once('dialog',ok));
  page.getByTestId('native-confirm').click().catch(()=>{});
  const dialog=await shown;
  await new Promise(r=>setTimeout(r,700));
  grab(kase==='phone'?'r1-0-nyt-vscode-confirm':'r1-0-nyt-confirm');
  await dialog.dismiss();
  if(kase==='close'){
   // Typing gives the page the user activation a beforeunload prompt needs.
   await page.locator('.cm-content').click();
   await page.keyboard.type(' ');
   const left=new Promise(ok=>page.once('dialog',ok));
   page.close({runBeforeUnload:true}).catch(()=>{});
   const d=await Promise.race([left,new Promise(r=>setTimeout(()=>r(null),5000))]);
   if(d){await new Promise(r=>setTimeout(r,700));grab('r1-0-nyt-beforeunload');await d.dismiss();}
   else console.error('no beforeunload prompt');
  }
  await context.close().catch(()=>{});
 }
}finally{await browser.close();}
console.log(out);
