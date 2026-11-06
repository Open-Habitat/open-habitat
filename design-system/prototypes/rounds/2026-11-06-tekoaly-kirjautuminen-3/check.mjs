// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. For
// every riff it steps through the seven-step story (the message waits, the
// person edits it, a second Claude conversation waits too, the window, the
// sign-in done, a moment later, the second conversation afterwards) and
// checks what each step shows; then it walks the same story by hand through
// the real window and Claude's code steps and checks what the riff did with
// the two waiting messages. Screenshots at device scale factor 2, prefixed
// r3-: every step at 1440 light, 1440 dark and 390 light (touch); the default
// at 390 dark. The console must stay clean.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-06-tekoaly-kirjautuminen-3';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['r3-r1-lahtee-itse','r3-r2-kysyy-ensin','r3-r3-vain-koskematon'];
const stepNames=['1-odottaa','2-muokattu','3-toinen','4-ikkuna','5-kirjautunut','6-hetken-paasta','7-toinen-jalkeen'];
const MESSAGE='Tapaaminen oli. Tästä tunnin tapaamisesta ja siihen olleesta 30 min valmistautumisesta pitää kanssa merkitä tunnit.';
const EDITED=`${MESSAGE} Kiitos!`,SECOND='Korjaa kesäajan testit.';
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};
const runs=[
 {width:1440,theme:'light',steps:true,walk:true},
 {width:1440,theme:'dark',steps:true,walk:false},
 {width:390,theme:'light',steps:true,walk:true},
 {width:390,theme:'dark',steps:false,walk:false},
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
 const capture=async name=>{await page.waitForTimeout(250);await page.screenshot({path:`${out}/${name}-${tag}.png`});};
 const fits=async()=>ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'document overflow');
 const field=()=>page.locator('.ah-cbox-field');
 const title=t=>page.getByTestId('workspace-title').filter({hasText:t}).waitFor();
 const win=()=>page.getByTestId('sign-in-window');
 const drawer=async open=>{if(!mobile)return;
  if(open){if(!(await page.locator('.ah-mobile-open').count())){await page.getByTestId('navigation-open').click();await page.locator('.ah-mobile-open').waitFor();}}
  else if(await page.locator('.ah-mobile-open').count()){await page.keyboard.press('Escape');await page.locator('.ah-mobile-open').waitFor({state:'detached'});}
 };
 const openConv=async t=>{await drawer(true);await page.getByTestId('workspace-navigation').getByText(t,{exact:true}).click();await title(t);await drawer(false);};
 const fates=async()=>page.getByTestId('window-waiting').locator('li').evaluateAll(l=>l.map(x=>`${x.dataset.conv}:${x.dataset.fate}`).join(','));
 const answeredTunnit=()=>page.getByText('Viikon tunnit ovat nyt 31,5 h',{exact:false}).waitFor({timeout:8000});
 const answeredKesa=()=>page.getByText('Kaikki 43 testiä',{exact:false}).waitFor({timeout:8000});
 const pick=async d=>{
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.rq-review.variant-${d}`).waitFor({state:'attached'});
  await title('Viikon tunnit');
  assert.match(await page.getByTestId('direction-lines').locator('li[aria-current]').innerText(),new RegExp(`^R${d+1} `));checks++;
  await page.getByTestId('round-line').waitFor();
 };
 const toStep=async k=>{
  await page.getByTestId(`story-${k}`).click();
  await page.locator(`.rq-review[data-step="${k-1}"]`).waitFor({state:'attached'});
  eq(await page.getByTestId('story-caption').innerText().then(t=>t.startsWith(`${k}/7`)),true,'caption step');
 };
 for(const d of [0,1,2]){
  await pick(d);
  const n=names[d];
  // The default view: the message waits, and the riff's rule is on the line under it.
  eq(await field().inputValue(),MESSAGE,'default field');
  await page.getByTestId('composer-waiting').waitFor();checks++;
  await page.getByTestId('ai-sign-in-warning').waitFor();checks++;
  await page.getByTestId('turn-short').waitFor();checks++;
  const line=await page.getByTestId('composer-waiting').innerText();
  ok([/lähtee itse heti/,/kysytään/,/jos et muokkaa/][d].test(line),`default wait line ${line}`);
  await fits();
  if(!run.steps){await capture(`${n}-1-odottaa`);continue;}
  for(let k=1;k<=7;k++){
   await toStep(k);
   if(k===1){eq(await field().inputValue(),MESSAGE);}
   if(k===2){eq(await field().inputValue(),EDITED);eq(await page.getByTestId('composer-waiting').getAttribute('data-edited'),'true');
    ok([/lähtee itse tällaisenaan/,/kysytään/,/ei lähde itse/][d].test(await page.getByTestId('composer-waiting').innerText()),'edited line');}
   if(k===3){await title('Kesäajan virhe');eq(await field().inputValue(),SECOND);await page.getByTestId('composer-waiting').waitFor();checks++;
    await page.getByTestId('ai-sign-in-warning').waitFor();checks++;}
   if(k===4){await win().waitFor();checks++;
    eq(await fates(),['tunnit:lähtee,kesa:lähtee','tunnit:kysytään,kesa:kysytään','tunnit:jää kenttään,kesa:lähtee'][d]);}
   if(k===5){
    if(d===1){await win().and(page.locator('[data-asking="true"]')).waitFor();checks++;
     eq(await page.getByTestId('ask-tunnit').getAttribute('data-selected'),'true');eq(await page.getByTestId('ask-kesa').getAttribute('data-selected'),'true');}
    else{ok(!(await win().count()),'window closed');await page.getByTestId('ai-sign-in-ok').waitFor();checks++;
     ok(!(await page.getByTestId('status-bell').count()),'bell leaves');
     if(d===0){eq(await field().inputValue(),'');await page.getByText(EDITED,{exact:true}).first().waitFor();checks++;}
     else{eq(await field().inputValue(),EDITED);eq(await page.getByTestId('ai-sign-in-ok').getAttribute('data-state'),'kept');}}
   }
   if(k===6){await answeredTunnit();checks++;eq(await field().inputValue(),'');}
   if(k===7){await title('Kesäajan virhe');await answeredKesa();checks++;eq(await field().inputValue(),'');}
   await fits();await capture(`${n}-${stepNames[k-1]}`);
  }
  if(!run.walk)continue;
  // The same story by hand, through the real window.
  await page.getByTestId('rq-reset').click();
  await page.locator('.rq-review[data-step="0"]').waitFor({state:'attached'});await title('Viikon tunnit');
  eq(await field().inputValue(),MESSAGE);
  // Appended as a person types it; emptying the field would end the wait.
  await field().click();await field().press('Control+End');await field().pressSequentially(' Kiitos!');
  eq(await field().inputValue(),EDITED);
  eq(await page.getByTestId('composer-waiting').getAttribute('data-edited'),'true');
  await openConv('Kesäajan virhe');
  await field().fill(SECOND);await field().press('Enter');
  await page.getByTestId('composer-waiting').waitFor();checks++;
  eq(await page.getByTestId('composer-waiting').getAttribute('data-edited'),null);
  await openConv('Viikon tunnit');
  eq(await field().inputValue(),EDITED);
  await page.getByTestId('ai-sign-in-fix').click();
  await win().waitFor();checks++;
  await win().getByTestId('claude-sign-in-link').click();
  await page.getByTestId('rq-toast').waitFor();checks++;
  const code=win().getByTestId('claude-code-input');
  if(!(await code.inputValue()))await code.fill('proto-7f3a9c2e');
  await win().getByTestId('claude-code-confirm').click();
  if(d===0){
   await win().waitFor({state:'detached',timeout:6000});checks++;
   await page.getByTestId('ai-sign-in-ok').waitFor();checks++;
   await page.getByText(EDITED,{exact:true}).first().waitFor();checks++;
   await answeredTunnit();checks++;
   await openConv('Kesäajan virhe');await page.getByText(SECOND,{exact:true}).waitFor();checks++;await answeredKesa();checks++;
  }else if(d===1){
   await page.locator('[data-testid="sign-in-window"][data-asking="true"]').waitFor({timeout:6000});checks++;
   // Send only the edited one; the second stays in its field.
   await page.getByTestId('ask-kesa').click();
   eq(await page.getByTestId('ask-kesa').getAttribute('data-selected'),null);
   await page.getByTestId('ask-send').click();
   await win().waitFor({state:'detached'});checks++;
   await answeredTunnit();checks++;
   await openConv('Kesäajan virhe');
   eq(await field().inputValue(),SECOND);eq(await page.getByTestId('ai-sign-in-ok').getAttribute('data-state'),'kept');
   ok(!(await page.getByTestId('composer-waiting').count()),'nothing waits once signed in');
  }else{
   await win().waitFor({state:'detached',timeout:6000});checks++;
   eq(await field().inputValue(),EDITED);eq(await page.getByTestId('ai-sign-in-ok').getAttribute('data-state'),'kept');
   await field().press('Enter');
   await answeredTunnit();checks++;
   await openConv('Kesäajan virhe');await page.getByText(SECOND,{exact:true}).waitFor();checks++;await answeredKesa();checks++;
  }
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
