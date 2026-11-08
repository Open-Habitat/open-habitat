// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. For
// "Nyt" (production unchanged) and each direction, at 1440 px and 390 px
// (touch), light and dark, device scale factor 2, named
// r1-<direction>-<step>-<width>-<theme>:
//   0-oletus      the default view, where the directions differ;
//   1 Lista       1-suodatus (filter "git"), 2-luku (a conversation opened
//                 read-only), 3-palautettu (restored, back on the page);
//   2 Oma näkymä  1-esikatselu (a conversation with a worker left on its
//                 branch), 2-haku ("avustaja" finds titles and recaps),
//                 3-luku (opened read-only), 4-tyotila (the entry line);
//   3 Sivupalkki  0-oletus-sivupalkki (the phone's drawer), 1-suodatus
//                 (the rail's filter, "git"), 2-palautettu.
// The console must stay clean and nothing may overflow sideways.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-08-keskustelujen-arkisto';
const [input,out]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <evidence-dir>');process.exit(2);}
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['0-nyt','1-lista','2-oma-nakyma','3-sivupalkki'];
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const runs=[{width:1440,theme:'light'},{width:1440,theme:'dark'},{width:390,theme:'light'},{width:390,theme:'dark'}];
try{
for(const {width,theme} of runs){
 const mobile=width===390,H=mobile?844:900;
 const page=await browser.newPage({viewport:{width,height:H},deviceScaleFactor:2,reducedMotion:'reduce',isMobile:mobile,hasTouch:mobile});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 await checkPicker(page,round);
 const tag=`${width}-${theme}`;
 const fits=async()=>ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'document overflow');
 const press=async(loc)=>{await loc.scrollIntoViewIfNeeded();await (mobile?loc.tap():loc.click());};
 const type=async(loc,text)=>{await loc.fill(text);await page.waitForTimeout(150);};
 for(const d of [0,1,2,3]){
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.rq-review.variant-${d}`).waitFor({state:'attached'});
  const shot=async(step)=>{await page.waitForTimeout(300);await fits();await page.screenshot({path:`${out}/r1-${names[d]}-${step}-${tag}.png`});};
  assert.match(await page.getByTestId('direction-lines').locator('li[aria-current]').innerText(),new RegExp(`^${d?d+' ':'Nyt'}`));checks++;
  if(d===0){
   await page.getByTestId('workspace-archive-panel').waitFor();checks++;
   ok(await page.getByTestId('restore-conversation').count()===13,'production: thirteen Palauta näkyviin');
   ok(await page.getByTestId('helper-archive-row').count()===2,'production: two helper blocks between the rows');
   await shot('0-oletus');
  }
  if(d===1){
   await page.getByTestId('ka-list').waitFor();checks++;
   ok(await page.getByTestId('ka-row').count()===13,'all thirteen rows');
   ok(await page.locator('.ka-group h3').count()===4,'four day groups');
   ok(/klo 18\.40/.test(await page.getByTestId('ka-row').first().innerText()),'newest first, dated');
   ok(await page.getByTestId('helper-archive-row').count()===0,'no helper status blocks in the list');
   await shot('0-oletus');
   await type(page.getByTestId('ka-filter'),'git');
   ok(await page.getByTestId('ka-row').count()===2,'title filter');
   await shot('1-suodatus');
   await type(page.getByTestId('ka-filter'),'');
   await press(page.getByTestId('ka-row-open').filter({hasText:'Kokeile testikoneella'}));
   await page.getByTestId('ka-readonly').waitFor();checks++;
   ok(await page.getByTestId('helper-archive-row').count()===1,'the helper in the read-only foot');
   await shot('2-luku');
   await press(page.getByTestId('ka-restore'));
   await page.getByTestId('ka-status').waitFor();checks++;
   ok(await page.getByTestId('ka-row').count()===12,'restored row leaves the archive');
   await shot('3-palautettu');
  }
  if(d===2){
   await page.getByTestId('ka-own').waitFor();checks++;
   ok(await page.getByTestId('ka-card').count()===13,'all thirteen cards');
   ok(await page.getByTestId('ka-preview').count()===(mobile?0:1),'desktop previews the first helper conversation');
   await shot('0-oletus');
   await press(page.getByTestId('ka-card').filter({hasText:'Testattavien toimintojen lista'}));
   await page.getByTestId('ka-preview').waitFor();checks++;
   ok(await page.getByTestId('ka-worker-row').count()===1,'the worker left on its branch');
   await shot('1-esikatselu');
   if(mobile) await press(page.getByTestId('ka-preview-back'));
   await type(page.getByTestId('ka-search'),'avustaja');
   const found=await page.getByTestId('ka-card').count();
   ok(found===3,`search over titles and recaps finds 3 (${found})`);
   await shot('2-haku');
   await press(page.getByTestId('ka-card').filter({hasText:'Kokeile testikoneella'}));
   await press(page.getByTestId('ka-preview-open'));
   await page.getByTestId('ka-readonly').waitFor();checks++;
   await shot('3-luku');
   await press(page.getByTestId('ka-back'));
   await press(page.getByTestId('ka-own-back'));
   await page.getByTestId('ka-entry').waitFor();checks++;
   ok(/13 keskustelua/.test(await page.getByTestId('ka-entry').innerText()),'one entry line on the workspace page');
   await shot('4-tyotila');
  }
  if(d===3){
   await page.getByTestId('ka-readonly').waitFor();checks++;
   if(!mobile) await page.getByTestId('ka-rail-archive').waitFor();
   await shot('0-oletus');
   if(mobile){
    await press(page.getByTestId('navigation-open'));
    await page.getByTestId('ka-rail-archive').waitFor();checks++;
    await shot('0-oletus-sivupalkki');
   }
   ok(await page.getByTestId('ka-rail-row').count()===13,'thirteen rows in the rail');
   await type(page.getByTestId('workspace-filter'),'git');
   ok(await page.getByTestId('ka-rail-row').count()===2,'the rail filter finds archived titles');
   await shot('1-suodatus');
   await type(page.getByTestId('workspace-filter'),'');
   if(mobile){await page.keyboard.press('Escape');await page.waitForTimeout(250);}
   await press(page.getByTestId('ka-restore'));
   await page.getByTestId('ka-status').waitFor();checks++;
   await shot('2-palautettu');
  }
  await press(page.getByTestId('rq-reset'));
  await page.waitForTimeout(150);
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
