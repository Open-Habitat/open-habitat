// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic lab, not a host-backed acceptance test. For both
// directions (A · Ajastukset-paikka, B · Työtilan sivu) it opens every
// situation in Päivä and Yö at 1440 × 900 and at 390 × 844 (touch, reduced
// motion; Päivä only with --quick): the picker contract; the situation's own
// view is there; no horizontal overflow; the controls that sit in a row
// (the schedule's actions, the workspace section's actions, the proposal's
// and the form's actions) sit side by side without overlapping, inside their
// row, with even gaps, and on one row at desktop width (adjacency). Then the
// interactions, at desktop and phone: A has the Ajastukset place and B has
// none; a list row opens the schedule (on the phone the list gives way to
// the detail, with a back control); Keskeytä / Jatka change the state and
// the next run; Aja nyt adds a running run; Poista… asks and removes; Uusi
// ajastus… validates, creates and opens the new schedule; Muokkaa… saves;
// a run's Avaa keskustelu opens its conversation with Habitat's run line and
// the line's Avaa ajastus returns; the late and failed runs say so; the
// proposal card's Luo ajastus makes the schedule and Avaa ajastus opens it;
// the failed schedule's place count. No external requests, clean console.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-28-ajastetut-ajot-1';
const [input,out,flag]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <out-dir> [--quick]');process.exit(2);}
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
let checks=0;const errors=[];const external=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};

async function open(width,height,query){
 const phone=width<600;
 const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:phone?2:1,reducedMotion:'reduce',hasTouch:phone});
 page.on('pageerror',e=>errors.push(`${query}: ${e.message}`));page.on('console',m=>{if(m.type()==='error')errors.push(`${query}: ${m.text()}`);});
 await page.route('**/*',r=>{const u=r.request().url();
  if(u.startsWith('http://prototype.test/'))return r.fulfill({contentType:'text/html',body:html});
  if(u.startsWith('data:')||u.startsWith('blob:'))return r.continue();
  external.push(u);return r.abort();});
 await page.goto('http://prototype.test/'+query);
 await page.locator('.rq-review').waitFor({state:'attached'});
 await settle(page);
 return page;
}
const settle=page=>page.waitForTimeout(250);
const id=(page,t)=>page.getByTestId(t);
const vis=async(page,t)=>(await id(page,t).count())>0&&await id(page,t).first().isVisible();
const click=async(page,t)=>{await id(page,t).first().click();await settle(page);};
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const shot=(page,name)=>page.screenshot({path:`${out}/${name}.png`});
const openNav=async page=>{if(await vis(page,'navigation-open'))await click(page,'navigation-open');};

// Controls in one row sit side by side: none overlaps another or leaves the
// row; gaps between neighbours on the same line are equal; on a wide screen
// they share one line.
async function adjacent(page,t,tag,oneLine){
 if(!(await vis(page,t)))return;
 const r=await page.evaluate(t=>{
  const row=document.querySelector(`[data-testid="${t}"]`);const b=row.getBoundingClientRect();
  const items=[...row.children].filter(e=>e.getClientRects().length&&getComputedStyle(e).display!=='none').map(e=>{const x=e.getBoundingClientRect();return {l:x.left,r:x.right,t:x.top,b:x.bottom};});
  return {b:{l:b.left,r:b.right,t:b.top,b:b.bottom},items};
 },t);
 const {items}=r;
 for(let i=0;i<items.length;i++){
  const a=items[i];
  ok(a.l>=r.b.l-1&&a.r<=r.b.r+1,`${tag}: ${t} item ${i} leaves its row`);
  for(let j=i+1;j<items.length;j++){const c=items[j];
   const overlap=Math.min(a.r,c.r)-Math.max(a.l,c.l)>1&&Math.min(a.b,c.b)-Math.max(a.t,c.t)>1;
   ok(!overlap,`${tag}: ${t} items ${i} and ${j} overlap`);}
 }
 const gaps=[];for(let i=1;i<items.length;i++)if(Math.abs(items[i].t-items[i-1].t)<4)gaps.push(Math.round(items[i].l-items[i-1].r));
 if(gaps.length>1)ok(Math.max(...gaps)-Math.min(...gaps)<=1,`${tag}: ${t} uneven gaps ${gaps}`);
 gaps.forEach(g=>ok(g>=2&&g<=16,`${tag}: ${t} gap ${g}`));
 if(oneLine)ok(items.every(x=>Math.abs(x.t-items[0].t)<4),`${tag}: ${t} wraps at desktop width`);
}

const SITUATIONS={
 lista:['schedule-list'],tyotila:['workspace-schedules'],uusi:['schedule-form'],ajastus:['schedule-detail','run-list'],
 tauko:['schedule-resume'],virhe:['banner-failed'],keskeytyi:['banner-failures'],ohitettu:['banner-missed'],
 kaynnissa:['run-conversation'],ajo:['run-line'],ajovirhe:['run-after'],myohassa:['run-line'],ehdotus:['proposal-card'],
};
const sizes=quick?[['light',1440,900],['light',390,844]]:[['light',1440,900],['dark',1440,900],['light',390,844],['dark',390,844]];
for(const [v,vname] of [[1,'A'],[2,'B']]){
 for(const [theme,w,h] of sizes){
  const phone=w<600;
  for(const [s,need] of Object.entries(SITUATIONS)){
   const tag=`${vname} ${theme} ${w} ${s}`;
   const page=await open(w,h,`?v=${v}&s=${s}&theme=${theme}`);
   eq(await page.locator('.rq-review').getAttribute('data-direction'),String(v-1),`${tag}: direction`);
   eq(await page.evaluate(()=>document.documentElement.dataset.theme),theme,`${tag}: theme`);
   if(s==='lista')await checkPicker(page,round);
   // On the phone the list comes first; a schedule's page opens on a row.
   const want=phone&&v===1&&s==='lista'?['schedule-list']:need;
   for(const t of want)ok(await vis(page,t),`${tag}: ${t} visible`);
   if(v===1&&s==='lista'&&!phone)ok(await vis(page,'schedule-detail'),`${tag}: detail beside the list`);
   if(v===1&&s==='lista'&&phone)ok(!(await vis(page,'schedule-detail')),`${tag}: phone list alone`);
   ok(await fits(page),`${tag}: horizontal overflow`);
   for(const t of ['schedule-actions','proposal-actions'])await adjacent(page,t,tag,!phone);
   if(s==='uusi'){await adjacent(page,'form-cadence',tag,!phone);}
   await shot(page,`${vname}-${theme}-${w}-${s}`);
   await page.close();
  }
 }
}

// The place: A has it, B not; a failed schedule gives it a count.
for(const [w,h] of [[1440,900],[390,844]]){
 const phone=w<600;
 let page=await open(w,h,'?v=1&s=virhe&theme=light');
 if(phone){await click(page,'schedule-back');}
 await openNav(page);
 ok(await vis(page,'rail-schedules'),`A ${w}: Ajastukset place`);
 ok((await id(page,'rail-schedules').first().innerText()).includes('1'),`A ${w}: place count`);
 await page.close();
 page=await open(w,h,'?v=2&s=virhe&theme=light');
 await openNav(page);
 eq(await id(page,'rail-schedules').count(),0,`B ${w}: no place`);
 await page.close();
}

// Interactions on one schedule, both directions, desktop and phone.
for(const [v,vname] of [[1,'A'],[2,'B']])for(const [w,h] of [[1440,900],[390,844]]){
 const tag=`${vname} ${w}`;const phone=w<600;
 const page=await open(w,h,`?v=${v}&s=lista&theme=light`);
 if(v===2){// B: the schedule lives on its workspace's page; go there from the rail.
  await openNav(page);
  await page.locator('[data-testid="workspace-navigation"] a[href="/workspaces/ws_kirjasto-api"]').first().click();await settle(page);
  eq(await id(page,'workspace-title').innerText(),'kirjasto-api',`${tag}: workspace page`);
 }
 await click(page,'schedule-row-deps');
 ok(await vis(page,'schedule-detail'),`${tag}: row opens detail`);
 eq(await id(page,'schedule-detail').getAttribute('data-schedule'),'deps',`${tag}: right schedule`);
 if(phone||v===2){ok(await vis(page,'schedule-back'),`${tag}: back`);}
 ok(await vis(page,'banner-missed'),`${tag}: missed run explained`);
 ok((await id(page,'run-list').innerText()).includes('Ohitettu'),`${tag}: missed row`);
 ok((await id(page,'run-list').innerText()).includes('Myöhässä'),`${tag}: late row`);
 await click(page,'schedule-pause');
 eq(await page.locator('[data-testid="schedule-detail"] [data-testid="schedule-state"]').getAttribute('data-state'),'paused',`${tag}: paused`);
 ok((await id(page,'schedule-facts').innerText()).includes('keskeytit'),`${tag}: next run says paused`);
 ok(await vis(page,'rq-toast'),`${tag}: pause toast`);
 await click(page,'schedule-resume');
 eq(await page.locator('[data-testid="schedule-detail"] [data-testid="schedule-state"]').getAttribute('data-state'),'ok',`${tag}: resumed`);
 ok((await id(page,'schedule-facts').innerText()).includes('ti 1.12. klo 7.30'),`${tag}: next run after resume`);
 await click(page,'schedule-run-now');
 ok((await id(page,'run-0').innerText()).includes('Käynnissä'),`${tag}: run now adds a running run`);
 ok(await id(page,'schedule-run-now').isDisabled(),`${tag}: run now disabled while running`);
 // Edit
 await click(page,'schedule-more');await page.getByRole('menuitem',{name:'Muokkaa…'}).click();await settle(page);
 ok(await vis(page,'schedule-form'),`${tag}: edit form`);
 await id(page,'form-name').fill('Riippuvuudet');await click(page,'form-save');
 ok((await page.locator('#aa-detail-title').innerText()).includes('Riippuvuudet'),`${tag}: edit saved`);
 // Late run's conversation and back.
 await click(page,'run-open-5');
 ok(await vis(page,'run-conversation'),`${tag}: run opens`);
 ok(await id(page,'run-line').getAttribute('data-late')!==null,`${tag}: late line`);
 ok((await id(page,'run-line').innerText()).includes('vasta ti 24.11. klo 8.12'),`${tag}: late line text`);
 await click(page,'run-line-schedule');
 eq(await id(page,'schedule-detail').getAttribute('data-schedule'),'deps',`${tag}: line returns to schedule`);
 // Delete
 await click(page,'schedule-more');await page.getByRole('menuitem',{name:'Poista…'}).click();await settle(page);
 ok(await vis(page,'delete-dialog'),`${tag}: delete asks`);
 await click(page,'delete-confirm');
 eq(await id(page,'schedule-row-deps').count(),0,`${tag}: row gone`);
 await shot(page,`${vname}-${w}-after-delete`);
 await page.close();
}

// Create, from the list (A) or the workspace page (B).
for(const [v,vname] of [[1,'A'],[2,'B']])for(const [w,h] of [[1440,900],[390,844]]){
 const tag=`${vname} ${w} create`;
 const page=await open(w,h,`?v=${v}&s=lista&theme=light`);
 await click(page,'schedule-new');
 ok(await vis(page,'schedule-form'),`${tag}: form`);
 ok(await id(page,'form-save').isDisabled(),`${tag}: empty form cannot save`);
 await id(page,'form-name').fill('Saavutettavuus');
 await id(page,'form-prompt').fill('Aja axe-tarkistus kaikille sivuille ja listaa löydökset.');
 await click(page,'segment-daily');await click(page,'segment-weekly');
 await click(page,'form-day-1');// ma off -> none chosen
 ok(await id(page,'form-save').isDisabled(),`${tag}: weekly needs a day`);
 await click(page,'form-day-3');
 await id(page,'form-time').fill('25.00');await settle(page);
 ok((await id(page,'form-next').innerText()).includes('6.00'),`${tag}: bad time explained`);
 await id(page,'form-time').fill('10.15');await settle(page);
 eq(await id(page,'form-next').innerText(),'Ensimmäinen ajo ke 2.12. klo 10.15.',`${tag}: next run`);
 await adjacent(page,'form-days',tag,true);
 await shot(page,`${vname}-${w}-form`);
 await click(page,'form-save');
 ok(await vis(page,'schedule-detail'),`${tag}: opens new schedule`);
 ok((await page.locator('#aa-detail-title').innerText()).includes('Saavutettavuus'),`${tag}: new name`);
 ok((await id(page,'schedule-facts').innerText()).includes('Joka keskiviikko klo 10.15'),`${tag}: cadence words`);
 ok((await id(page,'run-list').innerText()).trim()==='',`${tag}: no runs yet`);
 await page.close();
}

// Runs as conversations; the proposal card.
for(const [v,vname] of [[1,'A'],[2,'B']]){
 let page=await open(1440,900,`?v=${v}&s=ajovirhe&theme=light`);
 ok((await id(page,'run-after').innerText()).includes('pe 4.12. klo 16.00'),`${vname}: failed run says next`);
 ok(await page.locator('[data-testid="workspace-navigation"]').getByText('Viikkokooste · pe 27.11.').count()>0,`${vname}: failed run row in rail`);
 await page.close();
 page=await open(1440,900,`?v=${v}&s=kaynnissa&theme=light`);
 eq(await id(page,'run-conversation').getAttribute('data-run'),'working',`${vname}: running`);
 ok(await page.locator('.ah-now').getByText('README-tarkistus · ma 30.11.').count()>0,`${vname}: running run in Käynnissä`);
 await page.close();
 page=await open(1440,900,`?v=${v}&s=ehdotus&theme=light`);
 eq(await id(page,'proposal-card').getAttribute('data-state'),'open',`${vname}: proposal open`);
 await click(page,'proposal-create');
 eq(await id(page,'proposal-card').getAttribute('data-state'),'made',`${vname}: proposal made`);
 await click(page,'proposal-open');
 eq(await id(page,'schedule-detail').getAttribute('data-schedule'),'links',`${vname}: proposal opens schedule`);
 ok((await id(page,'schedule-facts').innerText()).includes('agentin ehdotuksesta'),`${vname}: says proposed`);
 await page.close();
 page=await open(390,844,`?v=${v}&s=ehdotus&theme=light`);
 await click(page,'proposal-no');
 eq(await id(page,'proposal-card').getAttribute('data-state'),'no',`${vname}: proposal declined`);
 await page.close();
}

await browser.close();
eq(external,[],'external requests');
if(errors.length){console.error(errors.join('\n'));}
eq(errors,[],'console clean');
console.log(`ok: ${checks} checks, shots in ${out}`);
