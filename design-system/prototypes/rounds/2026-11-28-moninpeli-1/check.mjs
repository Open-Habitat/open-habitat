// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Walks the three directions at 1440 and 390 px in Päivä and Yö (Kontrasti
// for the owner's view) with reduced motion, and in each the five areas:
//   1 Asetukset: the Moninpeli rows with a key, the unavailable notice and
//     Lisää avain without one, the administrator's server-key permission.
//   2 Aloitus: Moninpeli + where the direction puts it, adjacent to Uusi
//     keskustelu (or the kind choice), the start dialog offers only API-key
//     models and lands in a marked multiplayer conversation; an ordinary
//     conversation becomes one through the same button with the model move
//     said; without a key the button explains and leads to the AI settings.
//   3 Omistaja: band, mark, the waiting card's Salli kaikki / Hyväksy
//     yksitellen / Älä salli, a participant's new request, removing someone.
//   4 Osallistuja: invite with Liity, strip, the owner's decision arriving.
//   5 Kulmat: removed while the request waits (owner keeps the card, the
//     participant sees why), owner away, key stops working (held messages,
//     never a subscription), many participants, archived and restored.
// Every view: no horizontal overflow, clean console. Screenshots at device
// scale 2 into <out-dir>.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-28-moninpeli-1';
const [input,out,flag]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <out-dir> [--quick]');process.exit(2);}
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};

async function open(width,theme,q){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:1000},deviceScaleFactor:2,reducedMotion:'reduce',hasTouch:phone});
 page.on('pageerror',e=>errors.push(`${q}: ${e.message}`));
 page.on('console',m=>{if(m.type()==='error')errors.push(`${q}: ${m.text()}`);});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto(`http://prototype.test/?theme=${theme}&${q}`);
 await page.locator('.ra-review').waitFor({state:'attached'});
 await settle(page);
 return page;
}
const settle=page=>page.waitForTimeout(150);
const id=(page,t)=>page.getByTestId(t);
const vis=async(page,t)=>{const l=id(page,t);return (await l.count())>0&&await l.first().isVisible();};
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);
const click=async(page,t,n=0)=>{await id(page,t).nth(n).click();await settle(page);};
const shot=(page,name)=>page.screenshot({path:`${out}/${name}.png`});
const lines=page=>page.getByTestId('habitat-line').allInnerTexts();
// On a phone the rail is a drawer: open it before using its rows.
async function rail(page,phone){if(phone){const b=page.locator('.ah-navigation-open').first();if(await b.count()){await b.click();await settle(page);}}}

/** Two controls sit side by side on one row with an ordinary gap. */
async function adjacent(page,a,b,tag){
 const [x,y]=await Promise.all([id(page,a).first().boundingBox(),id(page,b).first().boundingBox()]);
 ok(x&&y,`${tag}: both controls drawn`);
 const gap=y.x-(x.x+x.width);
 ok(gap>=0&&gap<=12,`${tag}: ${b} right after ${a} (gap ${gap.toFixed(1)})`);
 ok(Math.abs((x.y+x.height/2)-(y.y+y.height/2))<=2,`${tag}: one row`);
}

async function config(d,width,theme){
 const tag=`config d${d} ${width} ${theme}`;
 let page=await open(width,theme,`v=${d+1}&scene=config&key=own`);
 ok(await vis(page,'settings-mp'),`${tag}: Moninpeli rows with a key`);
 ok((await id(page,'settings-mp-model').innerText()).includes('oma avain'),`${tag}: model names its key`);
 const opts=await page.locator('[data-testid="settings-mp-model"] option').allInnerTexts();
 ok(opts.every(o=>/avain/.test(o)),`${tag}: only API-key models`);
 ok(await fits(page),`${tag}: fits`);
 if(theme==='light')await shot(page,`d${d}-${width}-1-asetukset`);
 await page.locator('#key').selectOption('none');await settle(page);
 ok(await vis(page,'settings-mp-unavailable'),`${tag}: unavailable without a key`);
 ok(!(await vis(page,'settings-mp')),`${tag}: no model choice without a key`);
 await click(page,'settings-add-key');
 ok(await vis(page,'settings-mp'),`${tag}: Lisää avain brings the rows back`);
 await page.locator('#key').selectOption('none');await settle(page);
 await click(page,'segment-admin');
 ok(await vis(page,'settings-server'),`${tag}: administrator's server key`);
 await page.locator('[data-testid="settings-server-allow"] .ah-checkbox').click();await settle(page);
 ok((await id(page,'settings-server').innerText()).includes('pysähtyvät'),`${tag}: says what withdrawing does`);
 await click(page,'segment-person');
 ok((await id(page,'settings-mp-model').innerText()).includes('palvelimen avain'),`${tag}: server key now offered`);
 ok(await fits(page),`${tag}: fits after`);
 if(theme==='light'&&!quick)await shot(page,`d${d}-${width}-1b-asetukset-palvelin`);
 await page.close();
}

async function startFromWorkspace(page,d){
 if(d===2){await click(page,'conversation-start');ok(await vis(page,'empty-kind'),'d2: empty conversation asks the kind');await click(page,'kind-mp');}
 else await click(page,'mp-start');
}

async function start(d,width,theme){
 const tag=`start d${d} ${width} ${theme}`;
 const phone=width===390;
 let page=await open(width,theme,`v=${d+1}&scene=start&key=own`);
 ok(await vis(page,'workspace-page'),`${tag}: workspace page`);
 if(d<2){
  ok(await vis(page,'mp-start'),`${tag}: Moninpeli + on the workspace page`);
  await adjacent(page,'conversation-start','mp-start',tag);
  if(d===0)ok((await id(page,'mp-start').innerText()).includes('Moninpeli'),`${tag}: named button`);
  else ok((await id(page,'mp-start').getAttribute('aria-label'))==='Aloita moninpeli',`${tag}: icon is named for assistive tech`);
 } else ok(!(await vis(page,'mp-start')),`${tag}: no Moninpeli + on the workspace page`);
 ok(await fits(page),`${tag}: fits`);
 if(theme==='light')await shot(page,`d${d}-${width}-2a-tyotila`);
 await startFromWorkspace(page,d);
 if(d===2){
  await page.keyboard.press('Escape');await settle(page);
  await adjacent(page,'kind-ordinary','kind-mp',`${tag} kinds`);
  if(theme==='light')await shot(page,`d${d}-${width}-2a2-tyhja`);
  await click(page,'kind-mp');
 }
 ok(await vis(page,'start-dialog'),`${tag}: start dialog`);
 const opts=await page.locator('[data-testid="start-model"] option').allInnerTexts();
 eq(opts,['GPT-5.5 · oma avain','GPT-5.5 mini · oma avain'],`${tag}: only API-key models`);
 ok((await id(page,'start-model-help').innerText()).includes('API-avainta'),`${tag}: says why`);
 if(theme==='light')await shot(page,`d${d}-${width}-2b-aloita`);
 await click(page,'start-confirm');
 ok(await vis(page,'mp-mark'),`${tag}: the new conversation is marked`);
 const l=await lines(page);
 ok(l.some(x=>x.includes('Aloitit moninpelin. Malli: GPT-5.5')),`${tag}: started line names the model`);
 ok(l.some(x=>x.startsWith('Kutsuit')),`${tag}: invited line`);
 ok(await vis(page,'people-band'),`${tag}: people band`);
 ok(await fits(page),`${tag}: fits in the new conversation`);
 if(theme==='light')await shot(page,`d${d}-${width}-2c-uusi-moninpeli`);
 // An ordinary conversation becomes multiplayer through the same button.
 await rail(page,phone);
 await page.locator('[data-testid="agent-item-jasen"] a, [data-testid="agent-item-jasen"] [data-testid="agent-link"]').first().click();await settle(page);
 ok(!(await vis(page,'mp-mark')),`${tag}: ordinary conversation is not marked`);
 ok(await vis(page,'mp-start'),`${tag}: Moninpeli + in the ordinary conversation's header`);
 if(theme==='light'&&!quick)await shot(page,`d${d}-${width}-2d-tavallinen`);
 await click(page,'mp-start');
 ok((await id(page,'start-dialog').innerText()).includes('Tehdäänkö tästä moninpeli?'),`${tag}: convert dialog`);
 ok((await id(page,'start-model-help').innerText()).includes('gpt-5.5-codex → GPT-5.5'),`${tag}: says the model moves`);
 if(theme==='light'&&!quick)await shot(page,`d${d}-${width}-2e-muunna`);
 await click(page,'start-confirm');
 ok(await vis(page,'mp-mark'),`${tag}: converted conversation is marked`);
 ok((await lines(page)).some(x=>x.includes('Teit keskustelusta moninpelin')),`${tag}: converted line`);
 eq(await page.getByTestId('agent-reply').count(),1,`${tag}: history kept`);
 await page.close();
 // Without a key the button explains and points to the AI settings.
 page=await open(width,theme,`v=${d+1}&scene=start&key=none`);
 await startFromWorkspace(page,d);
 if(d===2){await page.keyboard.press('Escape');await settle(page);await click(page,'kind-mp');}
 ok(await vis(page,'nokey-dialog'),`${tag}: no-key dialog`);
 ok(!(await vis(page,'start-dialog')),`${tag}: no start without a key`);
 if(theme==='light')await shot(page,`d${d}-${width}-2f-ei-avainta`);
 await click(page,'nokey-settings');
 ok(await vis(page,'settings-mp-unavailable'),`${tag}: lands on the AI settings`);
 await page.close();
}

async function owner(d,width,theme){
 const tag=`owner d${d} ${width} ${theme}`;
 let page=await open(width,theme,`v=${d+1}&scene=owner`);
 await checkPicker(page,round);checks++;
 ok(await vis(page,'mp-mark'),`${tag}: mark in the header`);
 ok((await id(page,'people-here').innerText()).includes('3 paikalla'),`${tag}: band count`);
 eq(await page.getByTestId('participant-message').count(),2,`${tag}: two participants' messages`);
 ok(await vis(page,'waiting-card'),`${tag}: waiting card`);
 ok(await fits(page),`${tag}: fits`);
 await shot(page,`d${d}-${width}-${theme}-3-omistaja`);
 if(theme==='contrast'){await page.close();return;}
 await click(page,'card-allow-all');
 ok((await lines(page)).some(x=>x.includes('kaikilla työkaluilla')),`${tag}: continue line`);
 eq(await page.locator('[data-testid="waiting-card"][data-state="allowed"]').count(),1,`${tag}: card settled`);
 await click(page,'event-reset');
 await click(page,'card-each');
 await click(page,'op-allow-0');await click(page,'op-deny-1');
 ok((await lines(page)).some(x=>x.includes('hyväksytään erikseen')),`${tag}: each line`);
 ok(await page.locator('.ah-mp-rows li[data-answer="denied"]').count()>=1,`${tag}: denied row`);
 await click(page,'event-reset');
 await click(page,'card-decline');
 ok((await lines(page)).some(x=>x.includes('ei sallittu')),`${tag}: declined line`);
 await click(page,'event-ville');
 eq(await page.locator('[data-testid="waiting-card"][data-state="waiting"]').count(),1,`${tag}: Ville's new request waits`);
 await click(page,'event-maija');
 eq(await page.locator('[data-testid="waiting-card"][data-state="waiting"]').count(),1,`${tag}: Maija's question needs no tools`);
 await click(page,'people-band-open');
 ok(await vis(page,'people-panel'),`${tag}: panel`);
 await click(page,'remove-maija');await click(page,'people-close');
 ok((await lines(page)).some(x=>x.includes('Maija poistettiin')),`${tag}: removed line`);
 await page.locator('textarea').first().fill('Lisää esityslista.');await click(page,'send');
 ok((await page.getByTestId('agent-reply').last().innerText()).includes('esityslistan'),`${tag}: owner's message answered`);
 ok(await fits(page),`${tag}: fits after`);
 await page.close();
}

async function guest(d,width,theme){
 const tag=`guest d${d} ${width} ${theme}`;
 let page=await open(width,theme,`v=${d+1}&scene=guest`);
 ok(await vis(page,'shared-invite'),`${tag}: invite`);
 ok(!(await vis(page,'participant-message')),`${tag}: nothing before joining`);
 await adjacent(page,'invite-join','invite-later',tag);
 if(theme==='light')await shot(page,`d${d}-${width}-4a-kutsu`);
 await click(page,'invite-join');
 ok(await vis(page,'shared-strip'),`${tag}: strip`);
 ok((await id(page,'shared-strip-waiting').innerText()).includes('1 pyyntösi odottaa'),`${tag}: own request waits`);
 ok((await page.locator('[data-subject="ville"] header strong').first().innerText()).includes('(Sinä)'),`${tag}: own message`);
 ok(!(await vis(page,'card-allow-all')),`${tag}: no owner controls`);
 ok(await fits(page),`${tag}: fits`);
 await shot(page,`d${d}-${width}-${theme}-4b-osallistuja`);
 await click(page,'event-allow');
 ok(!(await vis(page,'shared-strip-waiting')),`${tag}: nothing waits after Aino allows`);
 await page.locator('textarea').first().fill('Lisää kartta.');await click(page,'send');
 ok(await vis(page,'shared-strip-waiting'),`${tag}: new request waits`);
 await click(page,'event-decline');
 ok((await lines(page)).some(x=>x.includes('ei sallittu')),`${tag}: declined reaches the participant`);
 await page.close();
}

async function corner(d,width,theme){
 const t=c=>`corner ${c} d${d} ${width} ${theme}`;
 const go=(c,v)=>open(width,theme,`v=${d+1}&scene=corner&corner=${c}&view=${v}`);
 const light=theme==='light';
 // Removed while the request waits.
 let page=await go('removed','owner');
 ok(await vis(page,'card-removed-note'),`${t('removed')}: owner keeps the request`);
 ok(!(await page.locator('[data-testid="people-member"]').count()),`${t('removed')}: panel closed`);
 if(light)await shot(page,`d${d}-${width}-5a-poistettu-omistaja`);
 await click(page,'card-allow-all');
 ok((await lines(page)).some(x=>x.includes('kaikilla työkaluilla')),`${t('removed')}: still releasable`);
 await page.close();
 page=await go('removed','guest');
 ok((await id(page,'shared-unavailable').innerText()).includes('poisti sinut'),`${t('removed')}: participant told why`);
 ok(!(await vis(page,'rail-shared')),`${t('removed')}: gone from Jaettu kanssasi`);
 if(light)await shot(page,`d${d}-${width}-5b-poistettu-osallistuja`);
 await page.close();
 // Owner away.
 page=await go('away','guest');
 ok((await id(page,'shared-strip').innerText()).includes('ei ole nyt paikalla'),`${t('away')}: strip says so`);
 ok(await page.locator('[data-subject="aino"][data-presence="away"], .ah-mp-avatar[data-presence="away"]').count()>=1,`${t('away')}: Aino away in the band`);
 if(light)await shot(page,`d${d}-${width}-5c-omistaja-poissa`);
 await page.close();
 page=await go('away','owner');
 ok(await vis(page,'away-note'),`${t('away')}: owner sees what happened`);
 ok((await id(page,'waiting-card').innerText()).includes('Odottanut 2 h'),`${t('away')}: how long it waited`);
 await page.close();
 // The key stops working.
 page=await go('nokey','owner');
 ok(await vis(page,'nokey-banner'),`${t('nokey')}: owner banner`);
 ok(!(await id(page,'nokey-banner').innerText()).includes('ChatGPT'),`${t('nokey')}: names no subscription`);
 ok(await vis(page,'held'),`${t('nokey')}: held message`);
 if(light)await shot(page,`d${d}-${width}-5d-avain-omistaja`);
 await click(page,'nokey-fix');
 ok(!(await vis(page,'nokey-banner')),`${t('nokey')}: banner gone`);
 ok(!(await vis(page,'held')),`${t('nokey')}: held delivered`);
 await page.close();
 page=await go('nokey','guest');
 ok((await id(page,'shared-strip').innerText()).includes('ei voi vastata'),`${t('nokey')}: participant strip`);
 ok(!/API|avain|tilau/i.test(await id(page,'shared-strip').innerText()),`${t('nokey')}: no key talk to the participant`);
 ok(await vis(page,'held-cancel'),`${t('nokey')}: own held message can be cancelled`);
 if(light)await shot(page,`d${d}-${width}-5e-avain-osallistuja`);
 await click(page,'held-cancel');
 ok(!(await vis(page,'held')),`${t('nokey')}: cancelled`);
 await page.close();
 // Many participants.
 page=await go('crowd','owner');
 eq(await id(page,'people-more').innerText(),'+7',`${t('crowd')}: overflow count`);
 ok((await id(page,'people-here').innerText()).includes('9 paikalla'),`${t('crowd')}: here count`);
 ok(await fits(page),`${t('crowd')}: fits`);
 if(light)await shot(page,`d${d}-${width}-5f-monta`);
 await click(page,'people-band-open');
 eq(await page.locator('[data-testid="people-member"]').count(),12,`${t('crowd')}: everyone in the panel`);
 if(light&&!quick)await shot(page,`d${d}-${width}-5g-monta-paneeli`);
 await page.close();
 // Archived.
 page=await go('archived','owner');
 ok(await vis(page,'archived-banner'),`${t('archived')}: banner`);
 ok(!(await page.locator('textarea').count()),`${t('archived')}: nobody writes`);
 ok(!(await vis(page,'card-allow-all')),`${t('archived')}: request kept but not released while archived`);
 if(light)await shot(page,`d${d}-${width}-5h-arkistoitu`);
 await click(page,'archived-restore');
 ok(await page.locator('textarea').count()>0,`${t('archived')}: restored`);
 ok(await vis(page,'card-allow-all'),`${t('archived')}: request actionable again`);
 await page.close();
 page=await go('archived','guest');
 ok((await id(page,'shared-unavailable').innerText()).includes('arkistoi'),`${t('archived')}: participant told`);
 await page.close();
}

for(const d of [0,1,2]){
 for(const width of [1440,390]){
  for(const theme of quick?['light']:['light','dark']){
   await config(d,width,theme);
   await start(d,width,theme);
   await owner(d,width,theme);
   await guest(d,width,theme);
   await corner(d,width,theme);
  }
  if(!quick)await owner(d,width,'contrast');
 }
}
await browser.close();
if(errors.length){console.error(errors.join('\n'));process.exit(1);}
console.log(`${checks} checks passed`);
