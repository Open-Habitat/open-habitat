// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Every direction in every situation for Trello and Atlassian at 1440 light
// with reduced motion: asserts what the default view shows (the level
// described once, no administrator request before it is needed, the
// direction's own difference in view), then dark and 390 px for three
// situations, the flows clicked (new connection with a wrong and a right
// return address, the administrator request when the service asks for it,
// choosing again at the same level from the card, fixing a narrower grant,
// and production's disabled same-level change in Nyt), English, and no
// running animation with reduced motion. Screenshots at device scale 2 named
// r1-<d>-<direction>-<provider>-<case>-<width>-<theme>.png; --quick takes
// only the 1440 light situations.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-23-mcp-connect-dialog';
const [input,out,flag]=process.argv.slice(2);
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['nyt','esikatselu','vaiheet','kuitti'];
const scenarios=['uusi-luku','uusi-kirjoitus','paluuosoite','odottaa','yhdistetty','kapeampi','kapeampi-kortti','korjaus'];
const step={'uusi-luku':'intro','uusi-kirjoitus':'intro',paluuosoite:'paste',odottaa:'paste',yhdistetty:'result',kapeampi:'result'};
const SUM={trello:{read:'Lukevat ja hakevat tauluja',full:'Voivat myös luoda, siirtää'},atlassian:{read:'Hakevat ja lukevat Jira-tehtäviä',full:'Voivat myös luoda ja muokata tehtäviä'}};
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};

async function open(width,theme,d,p,s,{lang='fi'}={}){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:900},deviceScaleFactor:2,reducedMotion:'reduce',hasTouch:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto(`http://prototype.test/?v=${d+1}&p=${p}&s=${s}&theme=${theme}&lang=${lang}`);
 await page.locator(`.rq-review[data-direction="${d}"]`).waitFor({state:'attached'});
 await page.getByTestId('rq-page').waitFor();
 await page.waitForTimeout(450);
 return page;
}
const shot=(page,d,p,c,tag)=>page.screenshot({path:`${out}/r1-${d}-${names[d]}-${p}-${c}-${tag}.png`});
const noOverflow=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const dialog=d=>d===0?'[data-testid="integration-dialog"]':'[data-testid="rq-dialog"]';
const count=(hay,needle)=>hay.split(needle).length-1;

async function assertDefault(page,d,p,s,tag){
 const what=`${names[d]} ${p} ${s} ${tag}`;
 ok(await noOverflow(page),`${what}: document overflow`);
 eq(await page.locator('.rq-lines li[aria-current]').count(),1,`${what}: its line is marked`);
 const st=step[s];
 if(st){
  ok(await page.locator(dialog(d)).isVisible(),`${what}: dialog open`);
  if(d===0){
   // Nyt documents the problems the issue names.
   if(st==='intro'||st==='paste')eq(await page.getByTestId(`${p}-approval-request`).count(),1,`${what}: production shows the administrator request at once`);
   // Production repeats the read level's description under its card.
   if(s==='uusi-luku')eq(count(await page.locator(dialog(0)).innerText(),p==='trello'?'Pyydä vain lukuoikeuksia':'Pyydä luku- ja hakuoikeuksia'),2,`${what}: production repeats the level text`);
   return;
  }
  eq(await page.locator(dialog(d)).getAttribute('data-step'),st,`${what}: step`);
  const text=await page.locator(dialog(d)).innerText();
  eq(await page.getByTestId('rq-admin-request').count(),s==='odottaa'?1:0,`${what}: administrator request only when the service asks`);
  if(st==='intro'){
   const lvl=s==='uusi-luku'?'read':'full';
   eq(count(text,SUM[p][lvl]),1,`${what}: the chosen level is described once`);
   eq(await page.locator(`[data-testid="rq-level-${lvl}"][data-selected]`).count(),1,`${what}: level preselected`);
   eq(await page.getByTestId('rq-preview').count(),d===1?1:0,`${what}: preview only in Esikatselu`);
   eq(await page.getByTestId('rq-steps').count(),d===2?1:0,`${what}: steps only in Vaiheet`);
   eq(await page.getByTestId('rq-asks-line').count(),d===3?1:0,`${what}: one line in Kuitti`);
   if(d===1)eq(await page.getByTestId('rq-preview-write').count(),lvl==='full'?1:0,`${what}: the deciding permission is highlighted for writing`);
   // Vaiheet says these on its own step, checked in the flows.
   if(d!==2){ok(/Workspace|sivusto/i.test(text),`${what}: says what the service asks`);ok(/ei aukea/.test(text),`${what}: the closing error page is expected`);}
  }
  if(st==='result'){
   eq(await page.locator(dialog(d)).getByTestId('rq-receipt').count(),d===3?1:0,`${what}: receipt only in Kuitti`);
   if(s==='kapeampi'){
    ok(await page.locator(dialog(d)).getByTestId('rq-narrowed').isVisible(),`${what}: narrower grant explained`);
    ok(p==='trello'?/suostumussivulla jäi muokkaus hyväksymättä/.test(text)&&/ylläpitäjä/.test(text):/ylläpitäjä/.test(text)&&/Confluence/.test(text),`${what}: the service's own reasons`);
    ok(!/Google/.test(text),`${what}: no Google wording`);
    if(d===3)eq(await page.locator(dialog(d)).locator('tr[data-short]').count(),1,`${what}: one row short`);
   }else ok(await page.locator(dialog(d)).getByTestId('rq-connected').isVisible(),`${what}: connected`);
  }
  return;
 }
 if(d===0){ok(await page.getByTestId(`integration-account-${p}`).isVisible(),`${what}: production card`);return;}
 ok(await page.getByTestId('rq-card').isVisible(),`${what}: the round's card`);
 ok(!(await page.getByTestId(`integration-account-${p}`).isVisible()),`${what}: production card replaced`);
 const inView=await page.getByTestId('rq-card').evaluate(el=>el.getBoundingClientRect().top<innerHeight-60);
 ok(inView,`${what}: card in view`);
 if(s==='kapeampi-kortti')ok(await page.locator('[data-testid="rq-card"] [data-testid="rq-narrowed"]').isVisible(),`${what}: card explains the narrower grant`);
 if(s==='korjaus'){
  if(d===1)ok(await page.getByTestId('rq-change').isVisible(),`${what}: Muuta`);
  if(d===2)ok(await page.getByTestId('rq-reconsent').isVisible(),`${what}: re-consent row`);
  if(d===3)ok((await page.getByTestId('rq-where').innerText()).includes(p==='trello'?'Kotiremontti':'contoso-demo'),`${what}: card names the Workspace or site`);
 }
}

async function againFromCard(page,d){
 await page.getByTestId(d===1?'rq-change':'rq-again').first().click();
 await page.getByTestId('rq-dialog').waitFor();
}
/** From the intro to a finished consent, with a wrong address first. */
async function consent(page,d,wrong){
 if(d===2){await page.getByTestId('rq-continue').click();await page.getByTestId('rq-asks').waitFor();ok(/Workspace|sivusto/.test(await page.getByTestId('rq-asks').innerText())&&await page.getByTestId('rq-endpage').isVisible(),'vaiheet: its own step says what the service asks');await page.getByTestId('rq-open').click();}
 else await page.getByTestId('rq-continue').click();
 await page.getByTestId('rq-paste').waitFor();
 if(wrong){
  await page.getByTestId('rq-redirect').fill('https://trello.com/b/abc');
  await page.getByTestId('rq-connect').click();
  await page.getByTestId('rq-paste-error').waitFor();
  ok(/127\.0\.0\.1/.test(await page.getByTestId('rq-paste-error').innerText()),`${names[d]}: wrong address names the right start`);
 }
 await page.getByTestId('rq-redirect').fill('http://127.0.0.1:45678/callback?code=fixture&state=fixture');
 await page.getByTestId('rq-connect').click();
 await page.locator('[data-testid="rq-dialog"][data-step="result"]').waitFor();
}

try{
 for(const p of ['trello','atlassian'])for(let d=0;d<4;d++)for(const s of scenarios){
  const page=await open(1440,'light',d,p,s);
  if(d===0&&s==='uusi-luku'&&p==='trello')await checkPicker(page,round);
  await assertDefault(page,d,p,s,'1440-light');
  await shot(page,d,p,s,'1440-light');
  await page.close();
 }
 if(!quick){
  for(const [width,theme] of [[1440,'dark'],[390,'light'],[390,'dark']])for(const s of ['uusi-kirjoitus','kapeampi','korjaus'])for(let d=0;d<4;d++){
   const tag=`${width}-${theme}`;
   const page=await open(width,theme,d,'trello',s);
   await assertDefault(page,d,'trello',s,tag);
   await shot(page,d,'trello',s,tag);
   await page.close();
  }
  for(let d=1;d<4;d++){
   const page=await open(390,'light',d,'atlassian','odottaa');
   await assertDefault(page,d,'atlassian','odottaa','390-light');
   await shot(page,d,'atlassian','odottaa','390-light');
   await page.close();
  }
  for(const p of ['trello','atlassian'])for(let d=1;d<4;d++){
   // A new connection with writing, a wrong address, then the right one.
   let page=await open(1440,'light',d,p,'uusi-kirjoitus');
   await consent(page,d,true);
   ok(await page.getByTestId('rq-connected').isVisible(),`${names[d]} ${p}: connected`);
   await shot(page,d,p,'uusi-tulos','1440-light');
   await page.getByTestId('rq-done').click();
   await page.getByTestId('rq-card').waitFor();
   eq(await page.locator('[data-testid="rq-card"] [data-testid="rq-narrowed"]').count(),0,`${names[d]} ${p}: card at the requested level`);
   await page.close();
   // The service says an administrator must approve.
   page=await open(1440,'light',d,p,'paluuosoite');
   eq(await page.getByTestId('rq-admin-request').count(),0,`${names[d]} ${p}: no request before it is needed`);
   await page.getByTestId('rq-stuck').click();
   await page.getByTestId('rq-admin-request').waitFor();
   ok((await page.getByTestId('rq-admin-text').innerText()).includes('Connectors'),`${names[d]} ${p}: the request names the setting`);
   await page.getByTestId('rq-start-over').click();
   await page.locator('[data-testid="rq-dialog"][data-step="intro"]').waitFor();
   await page.close();
   // Choosing the Workspace or site again at the same level.
   page=await open(1440,'light',d,p,'korjaus');
   await againFromCard(page,d);
   const title=await page.getByTestId('rq-title').innerText();
   ok(/Valitse uudelleen/.test(title),`${names[d]} ${p}: re-choose title`);
   ok(await page.getByTestId('rq-again-note').isVisible(),`${names[d]} ${p}: says what the service asks again`);
   eq(await page.locator('[data-testid="rq-level-full"][data-selected]').count(),1,`${names[d]} ${p}: current level kept`);
   ok(await page.getByTestId('rq-continue').isEnabled(),`${names[d]} ${p}: same level can continue`);
   await shot(page,d,p,'uudelleen','1440-light');
   await consent(page,d,false);
   if(d===3)ok((await page.getByTestId('rq-where').first().innerText()).includes(p==='trello'?'Contoso Markkinointi':'contoso-demo'),`${names[d]} ${p}: the new Workspace shows`);
   await page.getByTestId('rq-done').click();
   await page.close();
   // Fixing a narrower grant from the card.
   page=await open(1440,'light',d,p,'kapeampi-kortti');
   await page.locator('[data-testid="rq-card"] [data-testid="rq-admin-open"]').click();
   await page.locator('[data-testid="rq-card"] [data-testid="rq-admin-request"]').waitFor();
   await shot(page,d,p,'kapeampi-pyynto','1440-light');
   await page.locator('[data-testid="rq-card"] [data-testid="rq-choose-again"]').click();
   await page.getByTestId('rq-dialog').waitFor();
   eq(await page.locator('[data-testid="rq-level-full"][data-selected]').count(),1,`${names[d]} ${p}: fixing keeps writing requested`);
   await consent(page,d,false);
   ok(await page.getByTestId('rq-connected').isVisible(),`${names[d]} ${p}: fixed`);
   await page.getByTestId('rq-done').click();
   eq(await page.locator('[data-testid="rq-card"] [data-testid="rq-narrowed"]').count(),0,`${names[d]} ${p}: card no longer narrowed`);
   await page.close();
   // Nothing animates with reduced motion, the dialog open.
   page=await open(1440,'light',d,p,'uusi-luku');
   await page.waitForTimeout(300);
   eq(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length),0,`${names[d]} ${p}: no running animation`);
   await page.close();
  }
  // Nyt: production cannot continue at the same level.
  for(const p of ['trello','atlassian']){
   const page=await open(1440,'light',0,p,'korjaus');
   await page.getByTestId(`integration-account-${p}`).getByTestId('integration-change-level').click();
   await page.getByTestId('integration-dialog').waitFor();
   ok(await page.getByTestId('integration-continue').isDisabled(),`nyt ${p}: same level cannot continue`);
   await shot(page,0,p,'vaihda-taso','1440-light');
   await page.close();
  }
  // English.
  for(let d=0;d<4;d++){
   const page=await open(1440,'light',d,'trello','kapeampi',{lang:'en'});
   const text=await page.locator(dialog(d)).innerText();
   ok(/Connect|Done|granted/i.test(text),`${names[d]}: English`);
   if(d)ok(/Trello granted read only/.test(text),`${names[d]}: English narrower text`);
   await shot(page,d,'trello','kapeampi-en','1440-light');
   await page.close();
  }
 }
 eq(errors.length,0,`console clean: ${errors.join(' | ')}`);
 console.log(`${checks} checks, console clean`);
}finally{await browser.close();}
