// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Both directions (Nyt, A2a), both top-bar views and every situation at
// 1440 light, 390 light, 1440 dark and 1440 light in English (--quick: 1440
// light Finnish only), with reduced motion: asserts the situation's view
// (the dialog closed by default, the step it opens), the Microsoft row with
// only Organisations and Levels, each with its count in the same pill and
// the set levels in Levels' accessible name (4/4 and 2/4), no document or
// dialog overflow, no running animation, a clean console and the picker.
// In every A2a state, and in the states only a click reaches (the Levels
// dialog, Lisätietoja open, the add step's errors), the spacing: no two
// visible controls in the page or the open dialog are closer than
// --ah-control-gap (bounding boxes, so touching and overlapping fail), and
// a removal stands at least --ah-s4 from the control before it. Then at
// 1440 light: Organisations opens the dialog with one row per organisation,
// its state and its row group; approval, adding (validation, consent
// follows) and removal happen as steps and return to the list in the same
// dialog; Escape closes it; Levels opens production's dialog. The person
// view connects the third organisation as a guest, and the device step's
// refusal names it. The dialog on a phone at 390.
// Screenshots r4-<d>-<view>-<situation>-<tag>.png.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-27-entra-organisaatiot-4';
const [input,out,flag]=process.argv.slice(2);
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const SITUATIONS={admin:['lista','osittain','auki','lisaa','hyvaksynta','poisto'],person:['henkilo','taso','koodi','valmis','kielto']};
const NOW={admin:['lista'],person:['henkilo','taso']};
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};

async function open(width,theme,d,view,s,lang='fi'){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:900},deviceScaleFactor:phone?2:1,reducedMotion:'reduce',hasTouch:phone});
 page.on('pageerror',e=>errors.push(`${d} ${view} ${s} ${lang}: ${e.message}`));
 page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errors.push(`${d} ${view} ${s} ${lang}: ${m.text()}`);});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto(`http://prototype.test/?v=${d+1}&view=${view}&s=${s}&theme=${theme}&lang=${lang}`);
 await page.locator(`.rq-review[data-direction="${d}"]`).waitFor({state:'attached'});
 await page.getByTestId('rq-page').waitFor();
 await page.waitForTimeout(300);
 return page;
}
const shot=(page,name)=>page.screenshot({path:`${out}/r4-${name}.png`,fullPage:true});
const noOverflow=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const dialogNoOverflow=page=>page.evaluate(()=>[...document.querySelectorAll('[role=dialog]')].every(d=>d.scrollWidth<=d.clientWidth+1));
const running=page=>page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running'&&!a.effect?.target?.closest?.('.proto-picker')).length);
const vis=async(page,id)=>(await page.getByTestId(id).count())>0&&await page.getByTestId(id).first().isVisible();
const count=page=>page.getByTestId('rq-rowline').getAttribute('data-count');

const rows=page=>page.locator('[data-testid^="rq-org-"]').count();

// Spacing. Every pair of visible controls in the open dialog (or the page
// when none is open) is at least --ah-control-gap apart: the gap is the
// distance between bounding boxes, negative when they overlap. A removal
// (.rq-destructive) is at least --ah-s4 from the control before it.
async function spacing(page,what){
 const r=await page.evaluate(()=>{
  const px=v=>{const e=document.createElement('div');e.style.width=`var(${v})`;document.body.append(e);const w=e.getBoundingClientRect().width;e.remove();return w;};
  const min=px('--ah-control-gap'),far=px('--ah-s4');
  const dialogs=[...document.querySelectorAll('[role=dialog]')];
  const scope=dialogs.at(-1)||document.querySelector('[data-testid=rq-page]');
  const els=[...scope.querySelectorAll('button,a[href],input,select,textarea,[role=button],summary')].filter(e=>{const b=e.getBoundingClientRect();return b.width>0&&b.height>0&&getComputedStyle(e).visibility!=='hidden';});
  const name=e=>(e.dataset.testid||e.getAttribute('aria-label')||e.textContent||e.tagName).trim().slice(0,40);
  const gap=(a,b)=>{const p=a.getBoundingClientRect(),q=b.getBoundingClientRect();const gx=Math.max(q.left-p.right,p.left-q.right),gy=Math.max(q.top-p.bottom,p.top-q.bottom);return gx<0&&gy<0?Math.max(gx,gy):gx<0?gy:gy<0?gx:Math.max(gx,gy);};
  const bad=[];let pairs=0;
  for(let i=0;i<els.length;i++)for(let j=i+1;j<els.length;j++){
   const a=els[i],b=els[j];if(a.contains(b)||b.contains(a))continue;pairs++;
   const g=gap(a,b);if(g<min-0.5)bad.push(`${name(a)} | ${name(b)}: ${g.toFixed(1)}px < ${min}`);
  }
  for(const d of scope.querySelectorAll('.rq-destructive')){
   const i=els.indexOf(d);if(i<1)continue;const g=gap(els[i-1],d);
   if(g<far-0.5)bad.push(`removal ${name(d)} after ${name(els[i-1])}: ${g.toFixed(1)}px < ${far}`);
  }
  return {bad,pairs,count:els.length,destructive:scope.querySelectorAll('.rq-destructive').length};
 });
 eq(r.bad.join('\n'),'',`${what}: spacing`);
 return r;
}
const step=page=>page.getByTestId('rq-orgs-dialog').getAttribute('data-step');

async function assertView(page,d,view,s,what,lang){
 ok(await noOverflow(page),`${what}: document overflow`);
 ok(await dialogNoOverflow(page),`${what}: dialog overflow`);
 eq(await running(page),0,`${what}: animation under reduced motion`);
 eq(await page.getByTestId(`rq-view-${view}`).getAttribute('aria-pressed'),'true',`${what}: view marked`);
 eq(await page.locator('.rq-review').getAttribute('data-scenario'),s,`${what}: situation`);
 if(d===0){
  if(view==='admin'){ok(await vis(page,'si-row-microsoft'),`${what}: production row`);eq(await page.getByTestId('rq-orgs-toggle').count(),0,`${what}: nothing added`);ok(await vis(page,'si-levels-microsoft'),`${what}: production disclosure`);}
  else{ok(await vis(page,'integration-account-microsoft'),`${what}: production card`);if(s==='taso')ok(await vis(page,'integration-dialog'),`${what}: production connect`);}
  return;
 }
 if(view==='admin'){
  eq(await page.getByTestId('rq-orgs-toggle').count(),1,`${what}: Organisations button`);
  ok(await vis(page,'rq-levels-toggle'),`${what}: Levels beside it`);
  eq(await vis(page,'si-levels-microsoft'),false,`${what}: levels disclosure hidden`);
  eq(await vis(page,'si-levels-note'),false,`${what}: levels line moved into the button`);
  eq(await vis(page,'si-setup-microsoft'),false,`${what}: production's button replaced`);
  const end=page.locator('[data-testid="si-row-microsoft"] .ah-people-end');
  eq(await end.locator('button:visible').count(),2,`${what}: only two buttons on the row`);
  eq(await end.locator('.rq-count').count(),2,`${what}: both carry the same count pill`);
  const partial=s==='osittain';
  eq(await page.getByTestId('rq-levels-toggle').getAttribute('data-count'),partial?'2/4':'4/4',`${what}: levels count`);
  const lname=await page.getByTestId('rq-levels-toggle').getAttribute('aria-label');
  ok(partial?lname.includes('2/4')&&lname.includes(lang==='fi'?'Vain luku':'Read only')&&!lname.includes(lang==='fi'?'Luonnokset':'Drafts')&&lname.includes(lang==='fi'?'puuttuvat':'missing')
    :lname.includes('4/4')&&lname.includes(lang==='fi'?'Ei lähetystä':'No sending'),`${what}: set levels in Levels' name: ${lname}`);
  ok((await page.getByTestId('rq-orgs-toggle').getAttribute('aria-label')).includes('Asiakas Kaksi Oy'),`${what}: organisations in the name`);
  if(partial)ok((await page.getByTestId('si-status-microsoft').innerText()).includes('2/4'),`${what}: partly offered`);
  const want={lista:null,osittain:null,auki:'list',lisaa:'add',hyvaksynta:'consent',poisto:'remove'}[s];
  eq(await vis(page,'rq-orgs-dialog'),want!==null,`${what}: dialog ${want?'open':'closed'}`);
  if(want)eq(await step(page),want,`${what}: step`);
  if(s==='auki'){
   eq(await rows(page),3,`${what}: three rows`);
   eq(await page.locator('.rq-orgs [role=group]').count(),3,`${what}: row groups`);
   ok((await page.getByTestId('rq-state-c1').innerText()).includes(lang==='fi'?'ei näy':'not visible'),`${what}: honest state`);
   ok(await vis(page,'rq-add-open'),`${what}: add at the bottom`);
   const h=await page.locator('[data-testid^="rq-org-"]').evaluateAll(l=>l.map(e=>Math.round(e.getBoundingClientRect().height)));
   if(!what.includes(' 390'))eq(new Set(h).size,1,`${what}: rows equally tall ${h}`);
  }
  if(s==='lisaa')ok(await vis(page,'rq-add-tenant'),`${what}: add step`);
  if(s==='hyvaksynta'){
   const m=await page.getByTestId('rq-message').innerText();
   ok(m.includes('Asiakas Yksi Oy')&&m.includes('adminconsent')&&m.includes(lang==='fi'?'vahvistamattomana':'unverified'),`${what}: message`);
   eq(await page.locator('[data-testid^="rq-link-"]').count(),4,`${what}: four level links`);
   eq(await vis(page,'rq-more-consent-body'),false,`${what}: explanations folded`);
  }
  if(s==='poisto')ok((await page.getByTestId('rq-remove').innerText()).includes(lang==='fi'?'Microsoftissa ei peruta mitään':'Nothing is revoked'),`${what}: removal`);
 } else {
  eq(await page.locator('[data-testid^="rq-card-"]').count(),2,`${what}: two connected organisations`);
  ok(await page.getByTestId('rq-row-c2').count()===1,`${what}: third not connected`);
  if(s==='henkilo'){ok(await vis(page,'rq-row-c2'),`${what}: row visible`);ok(await vis(page,'rq-guest-off'),`${what}: guest line`);eq(await page.locator('[role=dialog]').count(),0,`${what}: no dialog`);}
  if(s==='taso'||s==='koodi'||s==='valmis'){ok(await vis(page,'integration-dialog'),`${what}: production connect`);eq(await page.getByTestId('rq-orgline').getAttribute('data-org'),'c2',`${what}: organisation line`);}
  if(s==='koodi')ok((await page.getByText('R4TW9KQ2M').count())>0,`${what}: device code`);
  if(s==='valmis')ok(await vis(page,'rq-guest-files'),`${what}: files only`);
  if(s==='kielto'){ok(await vis(page,'rq-refusal-consent_required'),`${what}: refusal`);ok((await page.getByTestId('rq-refused').innerText()).includes('Asiakas Kaksi Oy'),`${what}: names it`);}
 }
}

const tags=quick?[[1440,'light','fi']]:[[1440,'light','fi'],[390,'light','fi'],[1440,'dark','fi'],[1440,'light','en']];
for(let d=0;d<=1;d++)for(const view of ['admin','person'])for(const s of (d===0?NOW:SITUATIONS)[view])for(const [w,theme,lang] of tags){
 const tag=`${w}-${theme}${lang==='en'?'-en':''}`;
 const page=await open(w,theme,d,view,s,lang);
 await assertView(page,d,view,s,`${d} ${view} ${s} ${tag}`,lang);
 if(d===1)await spacing(page,`${d} ${view} ${s} ${tag}`);
 if(d===0&&view==='admin'&&tag==='1440-light'){await checkPicker(page,round);checks++;}
 await shot(page,`${d}-${view}-${s}-${tag}`);
 await page.close();
}

// Spacing in the states only a click reaches, in every tag.
for(const [w,theme,lang] of tags){
 const tag=`${w}-${theme}${lang==='en'?'-en':''}`;
 for(const s of ['lista','osittain']){
  const page=await open(w,theme,1,'admin',s,lang);
  await page.getByTestId('rq-levels-toggle').click();
  ok(await vis(page,'ml-dialog'),`levels ${s} ${tag}: Levels opens production's dialog`);
  await spacing(page,`levels ${s} ${tag}`);
  await shot(page,`1-admin-${s}-tasot-${tag}`);
  await page.close();
 }
 let page=await open(w,theme,1,'admin','auki',lang);
 await page.getByTestId('rq-more-list-toggle').click();
 await spacing(page,`list more ${tag}`);
 await page.close();
 page=await open(w,theme,1,'admin','lisaa',lang);
 await page.getByTestId('rq-add-save').click();
 await page.getByTestId('rq-more-add-toggle').click();
 await spacing(page,`add errors ${tag}`);
 await shot(page,`1-admin-lisaa-virheet-${tag}`);
 await page.close();
 page=await open(w,theme,1,'admin','hyvaksynta',lang);
 await page.getByTestId('rq-more-consent-toggle').click();
 await spacing(page,`consent more ${tag}`);
 await page.close();
 page=await open(w,theme,1,'admin','poisto',lang);
 await page.getByTestId('rq-more-remove-toggle').click();
 const r=await spacing(page,`remove more ${tag}`);
 eq(r.destructive,1,`remove ${tag}: the confirmation is the removal`);
 await page.close();
}

// Flows, 1440 light.
for(let d=1;d<=1;d++){
 let page=await open(1440,'light',d,'admin','lista');
 await page.getByTestId('rq-orgs-toggle').click();
 eq(await step(page),'list',`${d}: dialog opens on the list`);
 await page.getByTestId('rq-more-list-toggle').click();
 ok(await vis(page,'rq-more-list-body'),`${d}: Lisätietoja opens`);
 await shot(page,`${d}-admin-auki-lisatietoja-1440-light`);
 // Approval from a row returns to the list.
 await page.getByTestId('rq-consent-open-c2').click();
 eq(await step(page),'consent',`${d}: approval step`);
 ok((await page.getByTestId('rq-message').innerText()).includes('Asiakas Kaksi Oy'),`${d}: approval for the row`);
 await page.getByTestId('rq-close').click();
 eq(await step(page),'list',`${d}: back on the list after approval`);
 eq(await page.evaluate(()=>document.activeElement?.dataset.testid),'rq-consent-open-c2',`${d}: focus back on the row`);
 // Adding.
 await page.getByTestId('rq-add-open').click();
 eq(await step(page),'add',`${d}: add step`);
 await page.getByTestId('rq-add-label').fill('Asiakas Kolme Oy');
 await page.getByTestId('rq-add-tenant').fill('asiakaskolme.example');
 await page.getByTestId('rq-add-save').click();
 ok((await page.getByTestId('rq-orgs-dialog').innerText()).includes('GUID'),`${d}: domain refused`);
 await page.getByTestId('rq-add-tenant').fill('9A4E7B21-5C3D-4F60-8E1A-7B2C9D0E4F35');
 await page.getByTestId('rq-add-save').click();
 ok((await page.getByTestId('rq-orgs-dialog').innerText()).includes('Asiakas Yksi Oy'),`${d}: duplicate named`);
 await page.getByTestId('rq-add-tenant').fill('4c2b8e61-0d7a-4e93-b5f2-8a1c6e9d3b70');
 await page.getByTestId('rq-add-save').click();
 ok((await page.getByTestId('rq-message').innerText()).includes('Asiakas Kolme Oy'),`${d}: consent for the new one`);
 await page.getByTestId('rq-message-copy').click();
 ok(await vis(page,'rq-toast'),`${d}: copy toast`);
 await page.getByTestId('rq-close').click();
 eq(await step(page),'list',`${d}: back on the list after adding`);
 eq(await rows(page),4,`${d}: four rows`);
 eq(await page.getByTestId('rq-orgs-toggle').getAttribute('data-count'),'4',`${d}: button counts four`);
 await shot(page,`${d}-admin-lisatty-1440-light`);
 // Back from the add step without saving.
 await page.getByTestId('rq-add-open').click();
 await page.getByTestId('rq-back').click();
 eq(await step(page),'list',`${d}: back from add`);
 // Removal, cancelled and then confirmed.
 await page.getByTestId('rq-remove-open-c2').click();
 eq(await step(page),'remove',`${d}: removal step`);
 await page.getByTestId('rq-remove-cancel').click();
 eq(await rows(page),4,`${d}: cancel keeps the row`);
 await page.getByTestId('rq-remove-open-c2').click();
 await page.getByTestId('rq-more-remove-toggle').click();
 ok(await vis(page,'rq-more-remove-body'),`${d}: removal Lisätietoja`);
 await page.getByTestId('rq-remove-confirm').click();
 eq(await step(page),'list',`${d}: back on the list after removal`);
 eq(await rows(page),3,`${d}: list shrank`);
 ok(await page.evaluate(()=>Boolean(document.activeElement?.closest('[data-testid="rq-orgs-dialog"]'))),`${d}: focus stays in the dialog`);
 await page.keyboard.press('Escape');
 await page.waitForTimeout(100);
 eq(await vis(page,'rq-orgs-dialog'),false,`${d}: Escape closes`);
 // Levels still opens production's dialog.
 await page.getByTestId('rq-levels-toggle').click();
 ok(await vis(page,'ml-dialog'),`${d}: Levels opens`);
 await page.close();
 page=await open(1440,'light',d,'admin','auki');
 await page.getByTestId('rq-close-list').click();
 eq(await vis(page,'rq-orgs-dialog'),false,`${d}: Valmis closes`);
 await page.close();
 // Person, reached from the top bar.
 page=await open(1440,'light',d,'admin','lista');
 await page.getByTestId('rq-view-person').click();
 await page.locator('[data-side="person"]').waitFor();
 eq(await page.getByTestId('rq-view-person').getAttribute('aria-pressed'),'true',`${d}: person view`);
 await page.getByTestId('rq-connect-row-c2').click();
 eq(await page.getByTestId('rq-orgline').getAttribute('data-org'),'c2',`${d}: level step names the organisation`);
 await page.locator('[data-testid="integration-dialog"] [data-testid="integration-continue"], [data-testid="integration-dialog"] button:has-text("Jatka")').first().click();
 ok((await page.getByText('R4TW9KQ2M').count())>0,`${d}: device code`);
 await page.getByTestId('rq-sim-guest').click();
 ok(await vis(page,'rq-guest-files'),`${d}: files only`);
 await page.getByTestId('integration-done').click();
 eq(await page.locator('[data-testid^="rq-card-"]').count(),3,`${d}: three connected`);
 ok((await page.getByTestId('rq-card-c2').getByTestId('rq-cardorg').innerText()).includes('Asiakas Kaksi Oy'),`${d}: card names it`);
 await page.close();
 page=await open(1440,'light',d,'person','koodi');
 await page.getByTestId('rq-sim-consent_required').click();
 ok(await vis(page,'rq-refusal-consent_required'),`${d}: refusal`);
 await page.getByTestId('rq-ask-copy').click();
 ok(await vis(page,'rq-toast'),`${d}: request copied`);
 await page.getByTestId('rq-restart').click();
 ok(await vis(page,'integration-dialog'),`${d}: restart to the level step`);
 await page.close();
}
// The dialog on a phone, opened from the row.
for(let d=1;d<=1;d++){
 const page=await open(390,'light',d,'admin','lista');
 await page.getByTestId('rq-orgs-toggle').click();
 eq(await step(page),'list',`${d} 390: dialog opens`);
 ok(await dialogNoOverflow(page),`${d} 390: dialog fits`);
 ok(await noOverflow(page),`${d} 390: page fits`);
 await page.getByTestId('rq-consent-open-c1').click();
 ok(await dialogNoOverflow(page),`${d} 390: approval fits`);
 await page.getByTestId('rq-close').click();
 eq(await step(page),'list',`${d} 390: back on the list`);
 await shot(page,`${d}-admin-auki-tap-390-light`);
 await page.close();
}
await browser.close();
assert.deepEqual(errors,[],'console clean');
console.log(`ok ${checks} checks`);
