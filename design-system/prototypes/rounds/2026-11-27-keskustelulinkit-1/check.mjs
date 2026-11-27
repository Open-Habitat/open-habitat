// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// The round directory first (no image or HTML; nothing over 100 KB), then
// every direction and situation at 1440 and 390 px in Päivä and Yö
// (--quick: 1440 Päivä only), with reduced motion: the picker passes the
// shared check; nothing scrolls sideways; the situation shows what it
// promises (A the marked field holding the link's message, B the sheet
// with an empty field behind it, C the card above an empty field, the
// person's own draft never replaced, the failure banners and pages, the
// sign-in notice, the link dialog); nothing from the link has been sent.
// Then the flows at 1440 and 390 Päivä: A sends only on Send and removes
// the message on ×; B opens with or without the message; C moves the
// message into the field; with an own draft the link's message is appended
// after it; an archived conversation restores; a missing workspace starts
// the message elsewhere; signing in continues to the link's target; the
// menu opens the link dialog, whose link follows the text and refuses a
// message over the limit. No request leaves the page, it never navigates,
// and the console stays clean. Screenshots v<n>-<situation>-<tag>.png.
import {createRequire} from 'node:module';
import {dirname,resolve,join,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync,readdirSync,statSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-27-keskustelulinkit-1';
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
const SIDS=['uusi','nimetty','luonnos','kesken','piilotettu','eityotilaa','arkistoitu','eikeskustelua','kirjaudu','pitka','tee'];
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
 await page.locator(`.rq-review[data-direction="${d}"][data-scenario="${s}"]`).waitFor({state:"attached"});await page.locator(".rq-bar").waitFor();
 await page.waitForTimeout(250);
 return page;
}
const tid=(p,id)=>p.getByTestId(id);
const field=p=>tid(p,'message-input').inputValue();
const visible=async(p,id,m)=>{await tid(p,id).first().waitFor({timeout:3000}).catch(()=>{});ok(await tid(p,id).first().isVisible(),m??`${id} visible`);};
const absent=async(p,id,m)=>{await tid(p,id).first().waitFor({state:'detached',timeout:3000}).catch(()=>{});ok(await tid(p,id).count()===0,m??`${id} absent`);};
const sentText=p=>p.locator('[data-testid="conversation-timeline"]').evaluate(el=>el.textContent).catch(()=>'');

async function situation(p,d,s,tag){
 ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${tag} ${d}/${s} scrolls sideways`);
 if(s==='kirjaudu'){await visible(p,'signin-continue');return;}
 if(s==='eityotilaa'){await visible(p,'missing-workspace');ok((await p.getByText(DRAFT.slice(0,20)).count())>0,'missing page keeps the message');return;}
 await visible(p,'conversation-view');
 ok(!(await sentText(p)).includes('npm test'),`${d}/${s}: nothing sent by the click`);
 if(s==='tee'){await visible(p,'link-dialog');return;}
 if(s==='pitka'){await visible(p,'banner-too-long');ok(await field(p)==='','too long: field empty');await absent(p,'link-mark');await absent(p,'link-card');return;}
 const own=s==='luonnos';
 if(d===1){await visible(p,'confirm-sheet');ok(await field(p)===(own?OWN:''),`B ${s}: field before the sheet`);}
 else if(d===2||own){await visible(p,'link-card');ok(await field(p)===(own?OWN:''),`${d}/${s}: field stays own`);await absent(p,'link-mark');}
 else{await visible(p,'link-mark');ok(await field(p)===DRAFT,`A ${s}: draft in field`);}
 if(s==='piilotettu')await visible(p,'banner-hidden');
 if(s==='eikeskustelua')await visible(p,'banner-missing-conv');
 if(s==='arkistoitu')await visible(p,'banner-archived');
}

const tags=quick?[[1440,'light']]:[[1440,'light'],[390,'light'],[1440,'dark'],[390,'dark']];
for(const [w,theme] of tags)for(let d=0;d<3;d++)for(const s of SIDS){
 const tag=`${w}-${theme}`;const p=await open(w,theme,d,s);
 if(d===0&&s==='uusi')await checkPicker(p,round),checks++;
 await situation(p,d,s,tag);
 if(!['kirjaudu','eityotilaa'].includes(s))ok(await p.locator('.ah-header-more:visible').count()<=1,`${tag} ${d}/${s}: at most one conversation menu`);
 await p.screenshot({path:`${out}/v${d+1}-${s}-${tag}.png`});
 await p.close();
}

for(const w of quick?[1440]:[1440,390]){
 const tag=`${w}-light`;
 let p=await open(w,'light',0,'uusi');
 await tid(p,'send').click();
 ok((await sentText(p)).includes('npm test'),'A: Send sends the message');await absent(p,'link-mark','A: mark gone after send');
 await p.close();
 p=await open(w,'light',0,'nimetty');
 await tid(p,'link-remove').click();ok(await field(p)==='','A: × empties the field');await absent(p,'link-mark');
 await p.close();
 p=await open(w,'light',1,'uusi');
 await tid(p,'confirm-open').click();await visible(p,'link-mark','B: mark after open');ok(await field(p)===DRAFT,'B: draft in field after open');
 await p.screenshot({path:`${out}/v2-uusi-opened-${tag}.png`});await p.close();
 p=await open(w,'light',1,'nimetty');
 await tid(p,'confirm-plain').click();await absent(p,'confirm-sheet');ok(await field(p)==='','B: open without message');
 await p.close();
 p=await open(w,'light',2,'nimetty');
 await tid(p,'link-place').click();ok(await field(p)===DRAFT,'C: moved into field');await absent(p,'link-card');await absent(p,'link-mark');
 await p.close();
 p=await open(w,'light',0,'luonnos');
 await tid(p,'link-append').click();const v=await field(p);ok(v.startsWith(OWN)&&v.endsWith(DRAFT),'own draft kept, link appended');
 await p.close();
 p=await open(w,'light',0,'kesken');
 await visible(p,'link-mark');ok((await tid(p,'link-mark').textContent()).includes('kesken vuoron'),'mid-turn note');
 await p.close();
 p=await open(w,'light',0,'arkistoitu');
 await tid(p,'restore-conv').click();await absent(p,'banner-archived','archived: restored');
 await p.close();
 p=await open(w,'light',0,'eityotilaa');
 await tid(p,'missing-ws-aurinkokello').click();await visible(p,'link-mark','missing ws: started elsewhere');
 ok((await p.locator('.rq-link code').textContent()).includes('/new/aurinkokello'),'missing ws: new target');
 await p.close();
 p=await open(w,'light',0,'kirjaudu');
 await tid(p,'github-sign-in').click();await visible(p,'link-mark','sign-in continues to the target');
 await p.close();
 p=await open(w,'light',0,'nimetty');
 await tid(p,'round-conversation-menu').click();
 await p.getByRole('menuitem',{name:/Kopioi linkki/}).click();
 await visible(p,'link-dialog','menu opens link dialog');
 await tid(p,'link-text').fill('Tarkista julkaisu');
 ok((await tid(p,'link-url').textContent()).includes('/c/kotisivu/yoajot#')&&(await tid(p,'link-url').textContent()).includes('draft=Tarkista+julkaisu'),'link follows text');
 await tid(p,'kind-new').check();ok((await tid(p,'link-url').textContent()).includes('/new/kotisivu#'),'new-conversation link');
 await p.screenshot({path:`${out}/v1-tee-filled-${tag}.png`});
 await tid(p,'link-text').fill('x'.repeat(4001));ok(await tid(p,'link-copy').isDisabled(),'over limit refuses copy');
 await p.keyboard.press('Escape');await absent(p,'link-dialog','Escape closes dialog');
 await p.close();
}
await browser.close();
ok(outside===0,`${outside} requests left the page`);
ok(navigations===0,`${navigations} navigations`);
if(errors.length){console.error(errors.slice(0,20).join('\n'));process.exit(1);}
console.log(`ok: ${checks} checks, screenshots in ${out}`);
