// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. Walks
// every direction light, dark and at 390 px, clicks the flows, asserts the
// content each direction must show, and writes screenshots at scale 2.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-02-organisaation-paasy';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
let checks=0;const errors=[];
try{
for(const width of [1440,390])for(const theme of ['light','dark']){
 const page=await browser.newPage({viewport:{width,height:1000},deviceScaleFactor:2,reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 await checkPicker(page,round);
 if(width===390)await page.locator('#phone').check();
 const tag=`${width}-${theme}`,keep=theme==='light'||width===1440;
 const capture=async(name,full=true)=>{if(keep)await page.screenshot({path:`${out}/${name}-${tag}.png`,fullPage:full});};
 const fits=async()=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'document overflow');checks++;};
 const pick=async i=>{await page.locator('.proto-picker-item').nth(i).click();await page.locator(`.shell.variant-${i}`).waitFor();};
 const seg=async(t,label)=>{await page.getByTestId(t).getByRole('button',{name:label,exact:true}).click();};
 const id=x=>page.getByTestId(x).first();

 for(const d of [0,1,2]){
  await pick(d);
  // Default view: the leaver is visible and keeps the account and files.
  assert.match(await id('direction-lines').locator('li[aria-current]').innerText(),[/^Ryhmä listassa/,/^Lähteet erikseen/,/^Syy riveillä/][d]);
  assert.match(await id('kept-tuuli-h').innerText(),/Unix-tili tuuli ja tiedostot jäivät/);
  assert.equal(await id('row-tuuli-h').getAttribute('data-state'),'ended');
  // Through the team vs individually.
  if(d===0){await id('group-row').waitFor();assert.match(await id('source-maija-esim').innerText(),/Tiimin kehitys kautta/);assert.match(await id('source-aino-v').innerText(),/ja henkilönä/);assert.match(await id('source-olli-p').innerText(),/Sallittu henkilönä/);}
  if(d===1){await id('sources-card').waitFor();assert.match(await id('section-team').innerText(),/@maija-esim/);assert.match(await id('section-individual').innerText(),/@olli-p/);assert.match(await id('section-ended').innerText(),/@tuuli-h/);}
  if(d===2){await id('leaver-notice').waitFor();assert.match(await id('reasons-aino-v').innerText(),/northstar-demo\/kehitys[\s\S]*henkilönä/);assert.match(await id('reasons-tuuli-h').innerText(),/lähti 1\.11\./);}
  await fits();await capture(`d${d+1}-oletus`);

  // Restore the leaver individually.
  await id('allow-tuuli-h').click();
  assert.equal(await id('row-tuuli-h').getAttribute('data-state'),'joined');

  // Disconnect the team, keeping its members as individuals.
  await seg('scenario','Tuuli lähti tiimistä');
  await id('group-disconnect').click();await id('disconnect-dialog').waitFor();
  assert.match(await id('disconnect-dialog').innerText(),/4 henkilön pääsy päättyy/);
  await page.getByTestId('disconnect-keep').getByRole('checkbox').check({force:true});
  assert.match(await id('disconnect-dialog').innerText(),/4 henkilöä siirtyy sallituiksi henkilöinä/);
  await fits();if(d===1)await capture('irrota',false);
  await id('disconnect-confirm').click();await id('disconnect-dialog').waitFor({state:'detached'});
  assert.equal(await id('row-maija-esim').getAttribute('data-state'),'joined');

  // Before the team: connect it from the page's own entry point.
  await seg('scenario','Ennen tiimiä');
  if(d===2){await id('add-input').fill('northstar-demo/kehitys');await id('add-check').click();}
  else await id('connect-open').click();
  await id('connect-dialog').waitFor();
  assert.match(await id('connect-consequences').innerText(),/Unix-tili ja tiedostot jäävät/);
  assert.match(await id('connect-already').innerText(),/@maija-esim/);
  await fits();if(d===0)await capture('yhdista',false);
  await id('connect-confirm').click();await id('connect-dialog').waitFor({state:'detached'});
  assert.equal(await id('row-lauri-k').getAttribute('data-state'),'allowed');
  await seg('scenario','Tuuli lähti tiimistä');
 }

 // The sign-in screens are the same in every direction.
 for(const [label,name,re] of [['Kirjautuminen: ei pääsyä','kirjautuminen-ei-paasya',/@ville-x/],['Kirjautuminen: lähti tiimistä','kirjautuminen-lahti',/Tilisi ja tiedostosi ovat tallessa/]]){
  await seg('view',label);
  assert.match(await id('signin-notice').innerText(),re);assert.equal(await page.getByTestId('github-sign-in').innerText(),'Kirjaudu GitHubilla');
  assert.doesNotMatch(await id('signin-notice').innerText(),name.endsWith('paasya')?/northstar/:/^$/,'a stranger is not told the group');
  await fits();await capture(name);
 }
 await seg('view','Ylläpitäjän pääsysivu');
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
