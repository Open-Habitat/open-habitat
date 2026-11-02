// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. Walks
// every direction light, dark and at 390 px, asserts what each state must
// say, clicks the Atlassian sign-in, the Trello token form, the approval,
// a level change and removal, and writes screenshots at scale 2.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-02-atlassian-trello';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
let checks=0;const errors=[];
const states=[['none','Ei yhdistetty'],['pending','Odottaa hyväksyntää'],['refused','Hylätty'],['read','Vain luku'],['write','Kirjoitus sallittu'],['expired','Vanhentunut tai peruttu']];
try{
for(const width of [1440,390])for(const theme of ['light','dark']){
 const page=await browser.newPage({viewport:{width,height:1000},deviceScaleFactor:2,reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 await checkPicker(page,round);
 if(width===390)await page.locator('#phone').check();
 const tag=`${width}-${theme}`,keep=theme==='light'||width===1440,all=width===1440&&theme==='light';
 const capture=async(name,full=true)=>{if(keep)await page.screenshot({path:`${out}/${name}-${tag}.png`,fullPage:full});};
 const fits=async()=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'document overflow');checks++;};
 const pick=async i=>{await page.locator('.proto-picker-item').nth(i).click();await page.locator(`.shell.variant-${i}`).waitFor();};
 const seg=async label=>{await page.getByTestId('scenario').getByRole('button',{name:label,exact:true}).click();};
 const id=x=>page.getByTestId(x).first();
 const text=async x=>await id(x).innerText();

 for(const d of [0,1,2]){
  const where=['card','table','path'][d];
  await pick(d);
  assert.match(await id('direction-lines').locator('li[aria-current]').innerText(),[/^Tilikortti/,/^Oikeustaulu/,/^Hyväksyntäpolku/][d]);
  // Default view: Atlassian waits for Contoso, Trello reads only.
  assert.equal(await id('atl-card').getAttribute('data-state'),'pending');
  if(d===0){assert.match(await text('atl-pending'),/Odottaa Contosoin hyväksyntää/);assert.match(await text('trello-pill'),/Vain luku/);}
  if(d===1){assert.equal(await id('row-jira').getAttribute('data-conn'),'pending');assert.match(await text('limit-trello'),/tokenin oikeus on read/);}
  if(d===2){assert.equal(await id('step-atl-org').getAttribute('data-state'),'now');assert.match(await text('admin-request'),/Connectors › Atlassian MCP server/);assert.equal(await id('step-trello-write').getAttribute('data-state'),'off');}
  assert.match(await id('agent-knows').textContent(),d===0?/Agentti ei vielä tiedä|personal-data/:/Trello-tilin @ainovirtanen/);
  await fits();await capture(`d${d+1}-oletus`);

  // Every state, for the review set.
  if(all)for(const [k,label] of states){if(k==='pending')continue;await seg(label);await fits();await capture(`d${d+1}-${k}`);}

  // Approval arrives: Tarkista turns the pending connection into read-only.
  await seg('Odottaa hyväksyntää');
  await id(`atl-check-${where}`).click();
  assert.equal(await id('atl-card').getAttribute('data-state'),'read');
  if(d===1)assert.match(await text('limit-jira'),/myönsit vain luvun/);

  // Level change: sign in again asking for write; Contoso allows Jira only.
  await id(`atl-level-${where}`).click();await id('atl-dialog').waitFor();
  await id('picks-atl-level').getByText('Lue, hae ja kirjoita').click();
  await id('atl-continue').click();await id('atl-open').click();
  await page.getByTestId('atl-return').fill('http://localhost:33418/callback?code=synthetic&state=x');
  await id('atl-submit').click();
  assert.equal(await id('atl-result').getAttribute('data-outcome'),'write');
  await id('atl-done').click();await id('atl-dialog').waitFor({state:'detached'});
  assert.equal(await id('atl-card').getAttribute('data-state'),'write');

  // First connection from nothing: the Atlassian sign-in ends waiting for Contoso.
  await seg('Ei yhdistetty');
  await id('atl-connect').click();await id('atl-dialog').waitFor();
  assert.match(await text('atl-approval-note'),/Contosoin hyväksyntä/);
  await fits();if(d===0)await capture('atl-yhdista',false);
  await id('atl-continue').click();await id('atl-open').click();
  await id('atl-submit').click();
  assert.match(await page.getByTestId('atl-dialog').innerText(),/Osoitteen pitää alkaa/);
  await page.getByTestId('atl-return').fill('http://localhost:33418/callback?code=synthetic&state=x');
  await fits();if(d===0)await capture('atl-paluuosoite',false);
  await id('atl-submit').click();
  assert.equal(await id('atl-result').getAttribute('data-outcome'),'pending');
  assert.match(await page.getByTestId('atl-dialog').innerText(),/Kopioi pyyntö ylläpitäjälle/);
  await fits();if(d===0)await capture('atl-odottaa',false);
  await id('atl-done').click();
  assert.equal(await id('atl-card').getAttribute('data-state'),'pending');

  // Trello token in the settings form, never in a conversation.
  await id('trello-connect').click();await id('trello-dialog').waitFor();
  assert.match(await page.getByTestId('trello-dialog').innerText(),/Älä liitä sitä keskusteluun/);
  assert.match(await id('trello-authorize').getAttribute('href'),/scope=read&/);
  assert.equal(await page.getByTestId('trello-token').getAttribute('type'),'password');
  await id('trello-submit').click();assert.match(await text('trello-error'),/Liitä token/);
  await page.getByTestId('trello-token').fill('ATTAsynthetic0000');
  await fits();if(d===0)await capture('trello-token',false);
  await id('trello-submit').click();
  assert.match(await text('trello-facts'),/Trello vahvisti tokenin oikeudeksi read/);
  await fits();if(d===0)await capture('trello-yhdistetty',false);
  await id('trello-done').click();
  assert.equal(await id('trello-card').getAttribute('data-state'),'read');

  // Expired token: renew; then removal revokes at Trello by default.
  await seg('Vanhentunut tai peruttu');
  assert.equal(await id('trello-card').getAttribute('data-state'),'expired');
  assert.equal(await id('atl-card').getAttribute('data-state'),'revoked');
  await id(`trello-replace-${where}`).click();await id('trello-dialog').waitFor();
  await page.getByTestId('trello-token').fill('ATTAsynthetic0001');await id('trello-submit').click();await id('trello-done').click();
  assert.equal(await id('trello-card').getAttribute('data-state'),'read');
  await id(`trello-remove-${where}`).click();await id('remove-dialog').waitFor();
  assert.equal(await id('remove-revoke').getByRole('checkbox').isChecked(),true);
  await fits();if(d===0)await capture('trello-poista',false);
  await id('remove-confirm').click();await id('remove-dialog').waitFor({state:'detached'});
  await id('tile-trello').waitFor();
  await seg('Odottaa hyväksyntää');
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
