// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// The round directory first (no image or HTML; nothing over 100 KB), then
// both directions and every situation at 1440 and 390 px in Päivä and Yö
// (--quick: 1440 Päivä only), with reduced motion: the picker passes the
// shared check; nothing scrolls sideways; the situation shows what it
// promises (links off: A · oma sivu shows the page with the message
// read-only and an empty app, A · tyhjä kenttä an empty field and the
// notice; links on: the marked field holding the message, the own draft
// never replaced, the failure banners and pages, the sign-in notice, the
// link dialog; Settings: the section after Avaimet with one or three
// members, links off or on); nothing from the link has been sent.
// Then the Settings flows at every size and theme: allowing opens the
// warning, Peru and Escape keep it off, confirming turns it on, turning off
// is immediate with no dialog; a placeholder member switches on its own; a
// link opened while off leads to the section and back to the marked field.
// Then the link flows at 1440 and 390 Päivä: Send sends only on press, ×
// removes the message, the own draft keeps first, a missing workspace
// starts elsewhere, signing in continues, the menu opens the link dialog,
// whose link follows the text and refuses a message over the limit. No
// request leaves the page, it never navigates, and the console stays clean.
// Screenshots v<n>-<situation>-<tag>.png.
import {createRequire} from 'node:module';
import {dirname,resolve,join,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync,readdirSync,statSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-27-keskustelulinkit-2';
const [input,out,flag]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <out-dir> [--quick]');process.exit(2);}
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
for(const f of readdirSync(here)){
 ok(!['.png','.jpg','.jpeg','.avif','.webp','.html'].includes(extname(f).toLowerCase()),`round directory holds ${f}`);
 ok(statSync(join(here,f)).size<100*1024,`${f} is over 100 KB`);
}
const DRAFT='Yöajo 27.11. epäonnistui vaiheessa `npm test` (3 testiä punaisena, loki `logs/yoajo-2711.txt`). Selvitä syy ja ehdota korjaus, mutta älä vielä commitoi.';
const OWN='Katso vielä, miksi välimuistin avain vaihtuu joka ajossa –';
const SIDS=['pois','uusi','luonnos','piilotettu','eityotilaa','kirjaudu','pitka','tee','asetus','asetus3','paalla'];
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
let outside=0,navigations=0;
async function open(width,theme,d,s){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:900},deviceScaleFactor:phone?2:1,hasTouch:phone,reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(`${d}/${s}: ${e.message}`));page.on('console',m=>{if(m.type()==='error')errors.push(`${d}/${s}: ${m.text()}`);});
 await page.route('**/*',r=>r.request().url().startsWith('http://prototype.test/')?r.fulfill({contentType:'text/html',body:html}):(outside++,r.abort()));
 await page.goto(`http://prototype.test/?v=${d+1}&s=${s}&theme=${theme}`);
 page.on('framenavigated',f=>{if(f===page.mainFrame()&&!f.url().startsWith('http://prototype.test/'))navigations++;});
 await page.locator(`.rq-review[data-direction="${d}"][data-scenario="${s}"]`).waitFor({state:'attached'});await page.locator('.rq-bar').waitFor();
 await page.waitForTimeout(250);
 return page;
}
const tid=(p,id)=>p.getByTestId(id);
const field=p=>tid(p,'message-input').inputValue();
const visible=async(p,id,m)=>{await tid(p,id).first().waitFor({timeout:3000}).catch(()=>{});ok(await tid(p,id).first().isVisible(),m??`${id} visible`);};
const absent=async(p,id,m)=>{await tid(p,id).first().waitFor({state:'detached',timeout:3000}).catch(()=>{});ok(await tid(p,id).count()===0,m??`${id} absent`);};
const sentText=p=>p.locator('[data-testid="conversation-timeline"]').evaluate(el=>el.textContent).catch(()=>'');
const linksState=p=>tid(p,'risky-conversation-links-state').textContent();

async function situation(p,d,s,tag){
 ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${tag} ${d}/${s} scrolls sideways`);
 if(s.startsWith('asetus')||s==='paalla'){
  await visible(p,'settings-page');
  const nav=await p.locator('.s-nav-i').allTextContents();
  const i=nav.findIndex(t=>t.includes('Sallitut riskit'));
  ok(i>0&&nav[i-1].includes('Avaimet'),`${s}: section sits after Avaimet`);
  ok(!nav[i+1].includes('Kokeelliset'),`${s}: section apart from Kokeelliset`);
  ok(await p.locator('.rk-member').count()===(s==='asetus3'?3:1),`${s}: member count`);
  ok((await linksState(p)).includes(s==='paalla'?'Sallittu':'Ei sallittu'),`${s}: links state`);
  await absent(p,'allow-dialog');
  return;
 }
 if(s==='kirjaudu'){await visible(p,'signin-continue');return;}
 if(s==='eityotilaa'){await visible(p,'missing-workspace');ok((await p.getByText(DRAFT.slice(0,20)).count())>0,'missing page keeps the message');return;}
 if(s==='pois'&&d===0){
  await visible(p,'links-off');await absent(p,'conversation-view','off: nothing opened');
  ok((await tid(p,'links-off-text').textContent()).includes('npm test'),'off page shows the message read-only');
  ok(await p.locator('[data-testid="links-off"] textarea').count()===0,'off page has no field');
  return;
 }
 await visible(p,'conversation-view');
 ok(!(await sentText(p)).includes('npm test'),`${d}/${s}: nothing sent by the click`);
 if(s==='pois'){await visible(p,'banner-links-off');ok(await field(p)==='','off: field empty');await absent(p,'link-mark');ok(!(await p.locator('.cl-before').textContent()).includes('npm test'),'off notice hides the message');return;}
 if(s==='tee'){await visible(p,'link-dialog');return;}
 if(s==='pitka'){await visible(p,'banner-too-long');ok(await field(p)==='','too long: field empty');await absent(p,'link-mark');await absent(p,'link-card');return;}
 if(s==='luonnos'){await visible(p,'link-card');ok(await field(p)===OWN,'own draft stays');await absent(p,'link-mark');return;}
 await visible(p,'link-mark');ok(await field(p)===DRAFT,`${s}: draft in field`);
 ok((await tid(p,'link-mark').textContent()).includes('Mitään ei ole lähetetty'),'mark says nothing sent');
 ok(!/linkin mukaan|lähde/i.test(await tid(p,'link-mark').textContent()),'mark claims no source');
 if(s==='piilotettu')await visible(p,'banner-hidden');
}

const tags=quick?[[1440,'light']]:[[1440,'light'],[390,'light'],[1440,'dark'],[390,'dark']];
for(const [w,theme] of tags)for(let d=0;d<2;d++)for(const s of SIDS){
 if(d===1&&!['pois','uusi'].includes(s))continue; // the directions differ only while links are off
 const tag=`${w}-${theme}`;const p=await open(w,theme,d,s);
 if(d===0&&s==='pois')await checkPicker(p,round),checks++;
 await situation(p,d,s,tag);
 await p.screenshot({path:`${out}/v${d+1}-${s}-${tag}.png`});
 await p.close();
}

// Settings: on with the warning, off without one, at every size and theme.
for(const [w,theme] of tags){
 const tag=`${w}-${theme}`;
 let p=await open(w,theme,0,'asetus');
 await tid(p,'allow-conversation-links').click();await visible(p,'allow-dialog','allow opens the warning');
 const warn=await tid(p,'allow-warning').textContent();
 ok(warn.includes('Kuka tahansa')&&warn.includes('Kun tämä on päällä'),'warning says what it allows');
 await p.screenshot({path:`${out}/v1-asetus-confirm-${tag}.png`});
 await tid(p,'allow-cancel').click();await absent(p,'allow-dialog');ok((await linksState(p)).includes('Ei sallittu'),'Peru keeps it off');
 await tid(p,'allow-conversation-links').click();await visible(p,'allow-dialog');await p.keyboard.press('Escape');await absent(p,'allow-dialog','Escape closes');
 ok((await linksState(p)).includes('Ei sallittu'),'Escape keeps it off');
 await tid(p,'allow-conversation-links').click();await tid(p,'allow-confirm').click();await absent(p,'allow-dialog');
 ok((await linksState(p)).includes('Sallittu')&&!(await linksState(p)).includes('Ei'),'confirm turns it on');
 await visible(p,'risky-conversation-links-since');
 await p.screenshot({path:`${out}/v1-asetus-on-${tag}.png`});
 await tid(p,'disable-conversation-links').click();await absent(p,'allow-dialog','turning off asks nothing');
 ok((await linksState(p)).includes('Ei sallittu'),'off is immediate');await visible(p,'rq-toast');
 await p.screenshot({path:`${out}/v1-asetus-off-${tag}.png`});
 await p.close();
 p=await open(w,theme,0,'asetus3');
 await tid(p,'allow-placeholder-3').click();await visible(p,'allow-dialog');
 await p.screenshot({path:`${out}/v1-asetus3-confirm-${tag}.png`});
 await tid(p,'allow-confirm').click();
 ok((await tid(p,'risky-placeholder-3-state').textContent()).startsWith('Sallittu'),'placeholder on');
 ok((await linksState(p)).includes('Ei sallittu'),'links untouched by another member');
 ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${tag} asetus3 on scrolls sideways`);
 await p.screenshot({path:`${out}/v1-asetus3-on-${tag}.png`});
 await p.close();
}

// A link opened while off leads to the setting and back.
for(const w of quick?[1440]:[1440,390])for(let d=0;d<2;d++){
 const tag=`${w}-light`;
 const p=await open(w,'light',d,'pois');
 await tid(p,'off-open-settings').click();await visible(p,'from-link','settings know the link');
 ok(await p.evaluate(()=>document.activeElement?.dataset?.settingsRow==='conversation-links'),'links row focused');
 await tid(p,'allow-conversation-links').click();await tid(p,'allow-confirm').click();
 await p.screenshot({path:`${out}/v${d+1}-pois-allowed-${tag}.png`});
 await tid(p,'back-to-link').click();
 await visible(p,'link-mark','back at the link, message in the field');ok(await field(p)===DRAFT,'draft after allowing');
 ok(!(await sentText(p)).includes('npm test'),'still nothing sent');
 await p.close();
}

for(const w of quick?[1440]:[1440,390]){
 let p=await open(w,'light',0,'uusi');
 await tid(p,'send').click();
 ok((await sentText(p)).includes('npm test'),'Send sends the message');await absent(p,'link-mark','mark gone after send');
 await p.close();
 p=await open(w,'light',0,'uusi');
 await tid(p,'link-remove').click();ok(await field(p)==='','× empties the field');await absent(p,'link-mark');
 await p.close();
 p=await open(w,'light',0,'luonnos');
 await tid(p,'link-append').click();const v=await field(p);ok(v.startsWith(OWN)&&v.endsWith(DRAFT),'own draft kept, link appended');
 await p.close();
 p=await open(w,'light',0,'eityotilaa');
 await tid(p,'missing-ws-aurinkokello').click();await visible(p,'link-mark','missing ws: started elsewhere');
 ok((await p.locator('.rq-link code').textContent()).includes('/new/aurinkokello#'),'missing ws: new target');
 await p.close();
 p=await open(w,'light',0,'kirjaudu');
 await tid(p,'github-sign-in').click();await visible(p,'link-mark','sign-in continues to the target');
 await p.close();
 p=await open(w,'light',0,'tee');
 await tid(p,'link-close').click();await absent(p,'link-dialog');
 await tid(p,'round-conversation-menu').click();
 await p.getByRole('menuitem',{name:/Kopioi linkki/}).click();
 await visible(p,'link-dialog','menu opens link dialog');
 await tid(p,'link-text').fill('Tarkista julkaisu');
 const url=await tid(p,'link-url').textContent();
 ok(url.includes('/new/kotisivu#n=17&draft=Tarkista+julkaisu'),'link follows text');ok(!url.includes('from='),'no source in link');
 await p.screenshot({path:`${out}/v1-tee-filled-${w}-light.png`});
 await tid(p,'link-text').fill('x'.repeat(4001));ok(await tid(p,'link-copy').isDisabled(),'over limit refuses copy');
 await p.keyboard.press('Escape');await absent(p,'link-dialog','Escape closes dialog');
 await p.close();
}
await browser.close();
ok(outside===0,`${outside} requests left the page`);
ok(navigations===0,`${navigations} navigations`);
if(errors.length){console.error(errors.slice(0,20).join('\n'));process.exit(1);}
console.log(`ok: ${checks} checks, screenshots in ${out}`);
