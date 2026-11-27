// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Nyt: production's admin row and the person's connect flow unchanged.
// Each direction in every situation at 1440 light, 390 light and 1440 dark
// (--quick: 1440 light only), plus every situation in English at 1440
// light: asserts the direction's default view (where the organisations
// appear), the dialog the situation opens, the Finnish/English wording
// present, no document overflow, reduced motion, console clean and the
// picker. Then the flows at 1440 light: adding an organisation (validation,
// consent opens, the list grows), removing one (confirmation, the list
// shrinks), the guide's two paths (own organisation hands over to
// production's levels dialog), and the person connecting a client as a
// guest from A's step, B's tab and C's row through production's level and
// device-code steps to the files-only card, and a refusal.
// Screenshots r1-<d>-<situation>-<width>-<theme>[-en].png.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-27-entra-organisaatiot';
const [input,out,flag]=process.argv.slice(2);
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const ADMIN=['lista','opas','lisaa','hyvaksynta','poisto'];
const PERSON=['henkilo','organisaatio','koodi','yhdistetty','kiellot'];
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};

async function open(width,theme,d,s,lang='fi'){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:900},deviceScaleFactor:phone?2:1,reducedMotion:'reduce',hasTouch:phone});
 page.on('pageerror',e=>errors.push(`${d} ${s} ${lang}: ${e.message}`));
 page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errors.push(`${d} ${s} ${lang}: ${m.text()}`);});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto(`http://prototype.test/?v=${d+1}&s=${s}&theme=${theme}&lang=${lang}`);
 await page.locator(`.rq-review[data-direction="${d}"]`).waitFor({state:'attached'});
 await page.getByTestId('rq-page').waitFor();
 await page.waitForTimeout(250);
 return page;
}
const shot=(page,d,s,tag)=>page.screenshot({path:`${out}/r1-${d}-${s}-${tag}.png`,fullPage:true});
const noOverflow=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const vis=async(page,id)=>(await page.getByTestId(id).count())>0&&await page.getByTestId(id).first().isVisible();
const dialogNoOverflow=page=>page.evaluate(()=>[...document.querySelectorAll('[role=dialog]')].every(d=>d.scrollWidth<=d.clientWidth+1));

// Nyt
{
 let page=await open(1440,'light',0,'yllapito');
 await checkPicker(page,round);checks++;
 ok(await vis(page,'si-row-microsoft'),'Nyt: production Microsoft row');
 eq(await page.getByTestId('rq-rowline').count(),0,'Nyt: no round line in the row');
 await shot(page,0,'yllapito','1440-light');
 await page.getByTestId('si-setup-microsoft').click();
 ok(await vis(page,'ml-dialog'),'Nyt: production levels dialog');
 await shot(page,0,'yllapito-levels','1440-light');
 await page.close();
 page=await open(1440,'light',0,'henkilo');
 ok(await vis(page,'integration-account-microsoft'),'Nyt: production Microsoft card');
 await shot(page,0,'henkilo','1440-light');
 await page.getByTestId('integration-add-microsoft').click();
 ok(await vis(page,'integration-dialog'),'Nyt: production connect dialog');
 await shot(page,0,'henkilo-taso','1440-light');
 await page.close();
 page=await open(390,'light',0,'henkilo');ok(await noOverflow(page),'Nyt 390: no overflow');await shot(page,0,'henkilo','390-light');await page.close();
}

const expectDialog=(d,s)=>({
 opas:'rq-guide', lisaa:d===3?'rq-orgs-dialog':'rq-add-dialog', hyvaksynta:d===3?'rq-orgs-dialog':'rq-consent-dialog', poisto:'rq-remove',
 organisaatio:d===1?'rq-org-step':'integration-dialog', koodi:'integration-dialog', yhdistetty:'integration-dialog',
}[s]??null);

async function assertDefault(page,d,s,tag,lang){
 const what=`${d} ${s} ${tag}`;
 ok(await noOverflow(page),`${what}: document overflow`);
 ok(await dialogNoOverflow(page),`${what}: dialog overflow`);
 eq(await page.locator('.rq-lines li[aria-current]').count(),1,`${what}: its line is marked`);
 const dlg=expectDialog(d,s);
 if(dlg)ok(await vis(page,dlg),`${what}: ${dlg} open`);
 else eq(await page.locator('[role=dialog]').count(),0,`${what}: no dialog`);
 if(ADMIN.includes(s)){
  ok((await page.getByTestId('rq-rowline').count())===1,`${what}: row line under Microsoft`);
  if(s==='lista'){
   if(d===1){ok(await vis(page,'rq-orgs'),`${what}: list in the row`);ok(await vis(page,'rq-limit'),`${what}: limitation in row`);}
   if(d===2){ok(await vis(page,'rq-orgs-section'),`${what}: own section`);ok(await vis(page,'rq-limit-card'),`${what}: limitation card`);}
   if(d===3)ok(await vis(page,'rq-orgs-open'),`${what}: dialog button`);
  }
  if(s==='hyvaksynta'){
   ok(await vis(page,'rq-message'),`${what}: message shown`);
   const m=await page.getByTestId('rq-message').innerText();
   ok(m.includes('Asiakas Yksi Oy')&&m.includes('adminconsent')&&(lang==='fi'?/vahvistamattomana|Assignment required/.test(m):/unverified/.test(m)),`${what}: message content`);
   eq(await page.locator('[data-testid^="rq-link-"]').count(),4,`${what}: four level links`);
   ok(await vis(page,'rq-consent-unknown'),`${what}: says approval cannot be seen`);
  }
  if(s==='poisto')ok((await page.getByTestId('rq-remove').innerText()).includes(lang==='fi'?'Mitään ei peruta Microsoftissa':'Nothing is revoked'),`${what}: removal says nothing revoked`);
 } else {
  if(s==='kiellot'){
   for(const c of ['consent_required','not_in_organisation','device_code_blocked','organisation_unavailable','expired'])ok(await vis(page,`rq-refusal-${c}`),`${what}: ${c}`);
   for(const c of ['consent_withdrawn','guest_removed','tenant_removed'])ok(await vis(page,`rq-card-problem-${c}`),`${what}: card ${c}`);
   eq(await page.getByTestId('integration-account-alignment').evaluateAll(n=>n.filter(e=>e.offsetParent).length),0,`${what}: production server-organisation line hidden`);
   return;
  }
  ok(await page.getByTestId('rq-ms').count()===1,`${what}: Microsoft section`);
  if(s==='henkilo'){
   ok(await vis(page,'rq-cardorg'),`${what}: card names the organisation`);
   if(d===1){eq(await page.locator('[data-testid^="rq-card-"]').count(),2,`${what}: two cards`);ok(await vis(page,'rq-connect-another'),`${what}: connect another`);}
   if(d===2){ok(await vis(page,'rq-tabs'),`${what}: tabs`);eq(await page.locator('[role=tab]').count(),3,`${what}: three tabs`);}
   if(d===3){ok(await vis(page,'rq-row-c2'),`${what}: unconnected organisation row`);eq(await page.locator('[data-testid^="rq-card-"]').count(),2,`${what}: two cards`);}
   if(d!==2)ok(await vis(page,'rq-off-mail'),`${what}: guest card has no mail`);
  }
  if(s==='organisaatio'&&d!==1)eq(await page.getByTestId('rq-orgline').getAttribute('data-org'),'c2',`${what}: level step names the organisation`);
  if(s==='koodi'){ok(await vis(page,'integration-device-code')||(await page.getByText('R4TW9KQ2M').count())>0,`${what}: device code`);ok(await vis(page,'rq-orgline'),`${what}: device org line`);}
  if(s==='yhdistetty')ok(await vis(page,'rq-guest-files'),`${what}: files-only note`);
 }
}

for(let d=1;d<=3;d++)for(const s of [...ADMIN,...PERSON]){
 const tags=quick?[[1440,'light','fi']]:[[1440,'light','fi'],[390,'light','fi'],[1440,'dark','fi'],[1440,'light','en']];
 for(const [w,theme,lang] of tags){
  const page=await open(w,theme,d,s,lang);
  await assertDefault(page,d,s,`${w}-${theme}-${lang}`,lang);
  if(s==='lista'&&w===1440&&theme==='light'&&lang==='fi'){await checkPicker(page,round);checks++;}
  await shot(page,d,s,`${w}-${theme}${lang==='en'?'-en':''}`);
  await page.close();
 }
}

// Flows, 1440 light.
for(let d=1;d<=3;d++){
 // Add with validation.
 let page=await open(1440,'light',d,'lisaa');
 await page.getByTestId('rq-add-label').fill('Asiakas Kolme Oy');
 await page.getByTestId('rq-add-tenant').fill('asiakaskolme.example');
 await page.getByTestId('rq-add-save').click();
 ok((await page.locator('[role=dialog]').innerText()).includes('GUID'),`${d}: domain refused`);
 await page.getByTestId('rq-add-tenant').fill('9A4E7B21-5C3D-4F60-8E1A-7B2C9D0E4F35');
 await page.getByTestId('rq-add-save').click();
 ok((await page.locator('[role=dialog]').innerText()).includes('Asiakas Yksi Oy'),`${d}: duplicate names the existing label`);
 await page.getByTestId('rq-add-tenant').fill('4c2b8e61-0d7a-4e93-b5f2-8a1c6e9d3b70');
 await page.getByTestId('rq-add-save').click();
 ok(await vis(page,'rq-consent'),`${d}: consent opens after adding`);
 ok((await page.getByTestId('rq-message').innerText()).includes('Asiakas Kolme Oy'),`${d}: message names the new organisation`);
 await shot(page,d,'lisaa-valmis','1440-light');
 if(d===3)await page.getByTestId('rq-close').click(); else await page.getByTestId('rq-close').click();
 eq(await page.getByTestId('rq-rowline').getAttribute('data-count'),'4',`${d}: list grew`);
 await page.close();
 // Remove.
 page=await open(1440,'light',d,'poisto');
 await page.getByTestId('rq-remove-confirm').click();
 eq(await page.getByTestId('rq-rowline').getAttribute('data-count'),'2',`${d}: list shrank`);
 ok(await vis(page,'rq-toast'),`${d}: removal toast`);
 await page.close();
 // Consent from the default view.
 page=await open(1440,'light',d,'lista');
 if(d===3){await page.getByTestId('rq-orgs-open').click();await page.getByTestId('rq-org-c2').click();}
 else await page.getByTestId('rq-consent-open-c2').click();
 ok((await page.getByTestId('rq-consent').getAttribute('data-org'))==='c2',`${d}: consent for the chosen organisation`);
 await page.getByTestId('rq-message-copy').click();
 ok(await vis(page,'rq-toast'),`${d}: copy toast`);
 if(d===1){await page.keyboard.press('Escape');await page.getByTestId('rq-limit-more').click();ok(await vis(page,'rq-limit-body'),'A: limitation opens');await shot(page,1,'lista-rajoitus','1440-light');}
 await page.close();
 // Guide: several organisations.
 page=await open(1440,'light',d,'opas');
 ok(await page.getByTestId('rq-guide-next').isDisabled(),`${d}: guide waits for a choice`);
 await page.getByTestId('rq-who-many').click();
 for(let i=0;i<4;i++){await page.getByTestId('rq-guide-next').click();if(i===1)await shot(page,d,'opas-julkaisija','1440-light');}
 ok(await vis(page,'rq-shortcut'),`${d}: shortcut explained`);
 await shot(page,d,'opas-tallennus','1440-light');
 await page.getByTestId('rq-guide-save').click();
 eq(await page.locator('[role=dialog]').count(),0,`${d}: guide closed`);
 await page.close();
 // Guide: own only hands over to production.
 page=await open(1440,'light',d,'opas');
 await page.getByTestId('rq-who-one').click();
 await page.getByTestId('rq-guide-next').click();
 ok(await vis(page,'ml-dialog'),`${d}: own organisation opens production levels dialog`);
 await page.close();
 // Person: connect Asiakas Kaksi as a guest.
 page=await open(1440,'light',d,'henkilo');
 if(d===1){await page.getByTestId('rq-connect-another').click();ok(await vis(page,'rq-org-step'),'A: organisation step');
  const opts=await page.locator('[data-testid^="rq-pick-"]').evaluateAll(n=>n.map(e=>e.dataset.testid));
  eq(opts[0],'rq-pick-own','A: own organisation first');
  await page.getByTestId('rq-pick-c2').click();await page.getByTestId('rq-org-continue').click();}
 if(d===2){await page.getByTestId('rq-tab-c2').click();ok(await vis(page,'rq-tab-empty'),'B: empty tab');await page.getByTestId('rq-connect-tab').click();}
 if(d===3)await page.getByTestId('rq-connect-row-c2').click();
 ok(await vis(page,'integration-dialog'),`${d}: production level step`);
 eq(await page.getByTestId('rq-orgline').getAttribute('data-org'),'c2',`${d}: level step for Asiakas Kaksi`);
 await page.locator('[data-testid="integration-dialog"] button:has-text("Jatka"), [data-testid="integration-dialog"] [data-testid="integration-continue"]').first().click();
 ok((await page.getByText('R4TW9KQ2M').count())>0,`${d}: device code shown`);
 await page.getByTestId('rq-sim-guest').click();
 ok(await vis(page,'rq-guest-files'),`${d}: completed, files only`);
 await page.getByTestId('integration-done').click();
 ok(await vis(page,'rq-card-c2'),`${d}: Asiakas Kaksi card`);
 ok((await page.getByTestId('rq-card-c2').locator('[data-testid="rq-cardorg"]').innerText()).includes('Asiakas Kaksi Oy'),`${d}: card names it`);
 await shot(page,d,'henkilo-kolme','1440-light');
 await page.close();
 // Refusal from the device step.
 page=await open(1440,'light',d,'koodi');
 await page.getByTestId('rq-sim-consent_required').click();
 ok(await vis(page,'rq-refusal-consent_required'),`${d}: consent refusal`);
 ok((await page.getByTestId('rq-refused').innerText()).includes('Asiakas Kaksi Oy'),`${d}: refusal names the organisation`);
 await page.getByTestId('rq-restart').click();
 ok(await vis(page,'integration-dialog'),`${d}: restart returns to the level step`);
 await page.close();
}
await browser.close();
assert.deepEqual(errors,[],'console clean');
console.log(`ok ${checks} checks`);
