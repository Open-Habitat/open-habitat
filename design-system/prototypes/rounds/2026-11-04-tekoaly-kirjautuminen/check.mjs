// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. For
// today and every direction, in each of the four situations (Claude
// subscription expired, ChatGPT subscription expired, OpenAI API key
// revoked, Claude not answering), walks the failed send, the repair where
// the direction puts it (in the turn, Settings › Tekoäly and back, the
// window), and the resend until the answer arrives. Screenshots at device
// scale factor 2: every default at 1440 px light; the Claude walk at 1440
// light, 1440 dark and 390 light (touch); the defaults at 390 dark. The
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
const round='2026-11-04-tekoaly-kirjautuminen';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['nyt','a-vuoro','b-kentta','c-odottaa'];
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
 const answered=()=>page.getByText('Viikon tunnit ovat nyt 31,5 h',{exact:false}).waitFor({timeout:8000});
 const sendField=async()=>{const f=page.locator('.ah-cbox-field');await f.press('Enter');};
 const typeAndSend=async()=>{const f=page.locator('.ah-cbox-field');await f.fill(MESSAGE);await f.press('Enter');};
 const openConv=async title=>{await drawer(true);await page.getByTestId('workspace-navigation').getByText(title,{exact:true}).click();await page.getByTestId('workspace-title').filter({hasText:title}).waitFor();await drawer(false);};
 const claudeSteps=async scope=>{
  await scope.getByTestId('claude-sign-in-link').click();
  await page.getByTestId('rq-toast').waitFor();checks++;
  const input=scope.getByTestId('claude-code-input');
  if(!(await input.inputValue()))await input.fill('proto-7f3a9c2e');
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
 for(const sc of list)for(const d of [0,1,2,3]){
  const walk=run.walk.includes(sc);
  if(!walk&&!(run.shots==='all'||run.shots==='default'))continue;
  await pick(d,sc);
  const n=`${names[d]}-${sc}`;
  const shoot=walk&&(run.shots!=='all'||sc==='claude'||true);
  assert.match(await page.getByTestId('direction-lines').locator('li[aria-current]').innerText(),d?/^[ABC] /:/^Nyt: /);checks++;
  await fits();await capture(`${n}-0-oletus`);
  if(!walk)continue;
  const say=async name=>{if(shoot)await capture(`${n}-${name}`);};
  // ---- Today ----
  if(d===0){
   if(sc==='claude'){
    assert.equal(await where(),'rail-running');checks++; // the stuck Käynnissä
    ok(await page.getByText('Failed to authenticate',{exact:false}).count()===1,'raw error shown');
   }
   if(sc==='chatgpt'||sc==='key'){
    await page.getByTestId('provider-auth-error').waitFor();checks++;
    await page.getByTestId('notice-action').click();
    await page.getByTestId('device-page').waitFor();checks++;
    await say('1-tekoalyvaihe');
    await page.getByTestId('pi-attempt-start').click();
    await deviceSteps(page);
    await page.locator('[data-testid="pi-sign-in-card"][data-phase="connected"]').waitFor();checks++;
    await page.getByTestId('device-back').click();
    await typeAndSend();
    if(sc==='key'){
     // Signing in to ChatGPT did not fix the key: the send fails again.
     await page.waitForTimeout(400);
     ok(!(await page.getByText('Viikon tunnit ovat nyt',{exact:false}).count()),'today: the key stays broken');
     continue;
    }
    await answered();checks++;await say('2-vastattu');
    continue;
   }
   if(sc==='claude'){
    // The fix Jari found: Settings › Tekoäly says Kirjautunut; sign in again.
    await drawer(true);
    await page.getByRole('button',{name:/Tilivalikko/}).click();
    await page.getByRole('menuitem',{name:'Asetukset'}).click();
    await page.locator('[data-testid="claude-login-state"][data-state="completed"]').waitFor();checks++;
    await drawer(false);
    await say('1-asetukset');
    await page.getByTestId('claude-sign-in').getByTestId('claude-sign-in-start').click();
    await claudeSteps(page.getByTestId('claude-sign-in'));
    await page.getByTestId('claude-sign-in').getByText('Kirjaudu uudelleen').waitFor({timeout:6000});checks++;
    await page.getByTestId('settings-close').click();
    await page.getByTestId('workspace-title').filter({hasText:'Viikon tunnit'}).waitFor();
   }
   await typeAndSend();await answered();checks++;await say('2-vastattu');
   continue;
  }
  // ---- A: in the turn ----
  if(d===1){
   assert.equal(await where(),'rail-yours');checks++;
   await page.getByTestId('turn-fix').waitFor();checks++;
   if(sc!=='outage'){
    await page.getByTestId('turn-sign-in').click();
    await page.getByTestId('sign-in-here').waitFor();checks++;
    await say('1-kirjautuminen');
    await steps[sc](page.getByTestId('sign-in-here'));
    await page.getByTestId('turn-fix-ok').waitFor({timeout:6000});checks++;
    await say('2-kirjautunut');
   }
   await page.getByTestId('resend').click();
   await answered();checks++;
   await page.getByTestId('turn-fix-done').waitFor();checks++;
   await fits();await say('3-vastattu');
   continue;
  }
  // ---- B: above the composer, the bell, Settings and back ----
  if(d===2){
   if(sc==='outage'){
    await page.getByTestId('ai-outage').waitFor();checks++;
    ok(!(await page.getByTestId('status-bell').count()),'B: no bell for an outage');
    assert.equal(await page.locator('.ah-cbox-field').inputValue(),MESSAGE);checks++;
    await sendField();await answered();checks++;await say('3-vastattu');
    continue;
   }
   await page.getByTestId('ai-sign-in-warning').waitFor();checks++;
   const bell=page.getByTestId('status-bell');
   assert.equal(await bell.getAttribute('data-tone'),'danger');checks++;
   if(!mobile){await bell.click();await page.getByTestId('status-panel').waitFor();await say('1-kello');await page.keyboard.press('Escape');}
   if(sc!=='key'){
    // Another conversation on the same provider says it too.
    await openConv('Kesäajan virhe');
    await page.getByTestId('ai-sign-in-warning').waitFor();checks++;
    await say('1-toinen-keskustelu');
    await openConv('Viikon tunnit');
   }
   await page.getByTestId('ai-sign-in-fix').click();
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
   // Back in the conversation with the message in the field.
   await page.getByTestId('ai-sign-in-ok').waitFor({timeout:8000});checks++;
   assert.equal(await page.locator('.ah-cbox-field').inputValue(),MESSAGE);checks++;
   ok(!(await page.getByTestId('status-bell').count()),'B: the bell leaves');
   await fits();await say('3-palattu');
   await sendField();await answered();checks++;await say('4-vastattu');
   continue;
  }
  // ---- C: the message waits ----
  if(sc==='outage'){
   await page.locator('[data-testid="held-line"][data-state="retrying"]').waitFor();checks++;
   ok(!(await page.getByTestId('ai-sign-in-strip').count()),'C: no strip for an outage');
   await answered();checks++;await say('3-vastattu');
   continue;
  }
  await page.getByTestId('ai-sign-in-strip').waitFor();checks++;
  assert.equal(await where(),'rail-yours');checks++;
  if(sc!=='key'){
   await openConv('Kesäajan virhe');
   await page.getByTestId('ai-sign-in-strip').waitFor();checks++;
   await say('1-toinen-keskustelu');
   await openConv('Viikon tunnit');
  }
  await page.getByTestId('held-sign-in').click();
  await page.getByTestId('sign-in-window').waitFor();checks++;
  await say('2-ikkuna');
  await steps[sc](page.getByTestId('sign-in-window'));
  await page.getByTestId('sign-in-window').waitFor({state:'detached',timeout:6000});checks++;
  await answered();checks++;
  ok(!(await page.getByTestId('ai-sign-in-strip').count()),'C: the strip leaves');
  await fits();await say('3-vastattu');
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
