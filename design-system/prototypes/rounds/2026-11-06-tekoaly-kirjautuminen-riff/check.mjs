// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. For
// every riff, in each of the four situations (Claude subscription expired,
// ChatGPT subscription expired, OpenAI API key revoked, Claude not
// answering), checks that the failed message waits in the field, walks the
// repair where the riff puts it (Settings › Tekoäly and back, or the window
// over the conversation), and sees the message leave by itself until the
// answer arrives. Screenshots at device scale factor 2, prefixed r2-: every
// default at 1440 px light; the Claude walk at 1440 light, 1440 dark and 390
// light (touch), the key walk also at 390; the defaults at 390 dark. The
// console must stay clean.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-06-tekoaly-kirjautuminen-riff';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['r2-b1-asetukset','r2-b2-ikkuna','r2-b3-selitys'];
const scenarios=['claude','chatgpt','key','outage'];
const MESSAGE='Tapaaminen oli. Tästä tunnin tapaamisesta ja siihen olleesta 30 min valmistautumisesta pitää kanssa merkitä tunnit.';
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const runs=[
 {width:1440,theme:'light',walk:scenarios,shots:'all'},
 {width:1440,theme:'dark',walk:['claude'],shots:'walk'},
 {width:390,theme:'light',walk:['claude','key'],shots:'walk'},
 {width:390,theme:'dark',walk:[],shots:'default'},
];
try{
for(const run of runs){
 const {width,theme}=run,mobile=width===390;
 const page=await browser.newPage({viewport:{width,height:mobile?844:900},deviceScaleFactor:2,reducedMotion:'reduce',isMobile:mobile,hasTouch:mobile});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 await checkPicker(page,round);
 const tag=`${width}-${theme}`;
 const capture=async name=>{await page.waitForTimeout(200);await page.screenshot({path:`${out}/${name}-${tag}.png`});};
 const fits=async()=>ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'document overflow');
 const where=async()=>{for(const s of ['rail-yours','rail-running','rail-quiet'])if(await page.getByTestId(s).getByText('Viikon tunnit',{exact:true}).count())return s;return 'none';};
 const drawer=async open=>{if(!mobile)return;
  if(open){if(!(await page.locator('.ah-mobile-open').count())){await page.getByTestId('navigation-open').click();await page.locator('.ah-mobile-open').waitFor();}}
  else if(await page.locator('.ah-mobile-open').count()){await page.keyboard.press('Escape');await page.locator('.ah-mobile-open').waitFor({state:'detached'});}
 };
 const field=()=>page.locator('.ah-cbox-field');
 const answered=()=>page.getByText('Viikon tunnit ovat nyt 31,5 h',{exact:false}).waitFor({timeout:8000});
 const openConv=async title=>{await drawer(true);await page.getByTestId('workspace-navigation').getByText(title,{exact:true}).click();await page.getByTestId('workspace-title').filter({hasText:title}).waitFor();await drawer(false);};
 const claudeSteps=async scope=>{
  await scope.getByTestId('claude-sign-in-link').click();
  await page.getByTestId('rq-toast').waitFor();checks++;
  const code=scope.getByTestId('claude-code-input');
  if(!(await code.inputValue()))await code.fill('proto-7f3a9c2e');
  await scope.getByTestId('claude-code-confirm').click();
 };
 const deviceSteps=async scope=>{await scope.locator('a[href^="https://auth.openai.com"]').click();};
 const keySteps=async scope=>{await scope.getByTestId('api-key-input').fill('sk-proj-NEWprototypeKey0000c3d4');await scope.getByTestId('api-key-save').click();};
 const steps={claude:claudeSteps,chatgpt:deviceSteps,key:keySteps};
 const pick=async(d,sc)=>{
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.rq-review.variant-${d}`).waitFor({state:'attached'});
  await page.locator('#scenario').selectOption(String(scenarios.indexOf(sc)));
  await page.locator(`.rq-review[data-scenario="${sc}"]`).waitFor({state:'attached'});
  await page.getByTestId('workspace-title').filter({hasText:'Viikon tunnit'}).waitFor();
 };
 const list=run.walk.length?scenarios:['claude'];
 for(const sc of list)for(const d of [0,1,2]){
  const walk=run.walk.includes(sc);
  if(!walk&&!(run.shots==='all'||run.shots==='default'))continue;
  await pick(d,sc);
  const n=`${names[d]}-${sc}`;
  assert.match(await page.getByTestId('direction-lines').locator('li[aria-current]').innerText(),new RegExp(`^B${d+1} `));checks++;
  // New this round, on every default view: the message waits in the field.
  await page.getByTestId('round-line').waitFor();checks++;
  assert.equal(await field().inputValue(),MESSAGE);checks++;
  await page.getByTestId('composer-waiting').waitFor();checks++;
  await page.getByTestId(d===2?'turn-explained':'turn-short').waitFor();checks++;
  assert.equal(await where(),sc==='outage'?'rail-running':'rail-yours');checks++;
  await fits();await capture(`${n}-0-oletus`);
  if(!walk)continue;
  const say=async name=>{await capture(`${n}-${name}`);};
  if(d===2&&sc==='claude'&&!mobile){
   await page.getByTestId('turn-raw').locator('summary').click();
   await page.getByText('OAuth session expired',{exact:false}).waitFor();checks++;
   await say('1-raaka');
  }
  if(sc==='outage'){
   await page.getByTestId('ai-outage').waitFor();checks++;
   ok(!(await page.getByTestId('status-bell').count()),'no bell for an outage');
   await page.getByTestId('rq-recover').click();
   await page.getByTestId('ai-sign-in-ok').waitFor();checks++;
   assert.equal(await field().inputValue(),'');checks++;
   await answered();checks++;await say('3-vastattu');
   continue;
  }
  await page.getByTestId('ai-sign-in-warning').waitFor();checks++;
  const bell=page.getByTestId('status-bell');
  assert.equal(await bell.getAttribute('data-tone'),'danger');checks++;
  if(!mobile&&d===0){await bell.click();await page.getByTestId('status-panel').waitFor();await say('1-kello');await page.keyboard.press('Escape');}
  // The person edits the waiting message; the edited text is what goes.
  await field().fill(`${MESSAGE} Kiitos!`);
  await page.getByTestId('composer-waiting').waitFor();checks++;
  if(sc!=='key'&&d===0){
   // Another conversation on the same provider: the warning, and a send there waits too.
   await openConv('Kesäajan virhe');
   await page.getByTestId('ai-sign-in-warning').waitFor();checks++;
   await field().fill('Korjaa kesäajan testit.');await field().press('Enter');
   await page.getByTestId('composer-waiting').waitFor();checks++;
   await say('1-toinen-keskustelu');
   await openConv('Viikon tunnit');
   assert.equal(await field().inputValue(),`${MESSAGE} Kiitos!`);checks++;
  }
  await page.getByTestId('ai-sign-in-fix').click();
  if(d===0){
   if(sc==='claude'){
    await page.locator('[data-settings-row="claude"]').waitFor();checks++;
    await say('2-asetukset');
    await page.getByTestId('claude-sign-in').getByTestId('claude-sign-in-start').click();
    await claudeSteps(page.getByTestId('claude-sign-in'));
   }else if(sc==='chatgpt'){
    await page.getByTestId('device-page').waitFor();checks++;
    await page.getByTestId('pi-attempt-start').click();
    await say('2-laitekoodi');
    await deviceSteps(page);
   }else{
    await page.getByTestId('api-key-row-openai').waitFor();checks++;
    await say('2-asetukset');
    await page.getByTestId('api-key-row-openai').getByTestId('api-key-add').click();
    await keySteps(page.getByTestId('api-key-dialog'));
   }
  }else{
   const w=page.getByTestId('sign-in-window');
   await w.waitFor();checks++;
   await say('2-ikkuna');
   await steps[sc](w);
   await w.waitFor({state:'detached',timeout:6000});checks++;
  }
  // Back online: the message left the field by itself.
  await page.getByTestId('ai-sign-in-ok').waitFor({timeout:8000});checks++;
  assert.equal(await field().inputValue(),'');checks++;
  ok(!(await page.getByTestId('status-bell').count()),'the bell leaves');
  ok(!(await page.getByTestId('composer-waiting').count()),'nothing waits');
  await page.getByText(`${MESSAGE} Kiitos!`,{exact:false}).first().waitFor();checks++;
  await fits();await say('3-lahti');
  await answered();checks++;await say('4-vastattu');
  if(sc!=='key'&&d===0){
   await openConv('Kesäajan virhe');
   await page.getByText('Korjaa kesäajan testit.',{exact:true}).waitFor();checks++;
   assert.equal(await field().inputValue(),'');checks++;
  }
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
