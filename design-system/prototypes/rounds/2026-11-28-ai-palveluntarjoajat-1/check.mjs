// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Both directions and every situation at 1440 light, 390 light, 1440 dark
// and 1440 light in English (--quick: 1440 light Finnish only), with reduced
// motion: asserts the situation's view, no document or dialog overflow, no
// running animation, a clean console, and adjacency: no two visible
// controls in the page (or the open dialog) closer than --ah-control-gap
// (bounding boxes, so touching and overlapping fail). Then at 1440 light:
// the add dialog's groups and a route's flow, the region switch changing
// Pi's provider id, the sign-in's round control, the picker's route list
// (A) or service groups (B), the China server's folded group in
// onboarding, the administrator's region and site-key form, and the
// prototype picker. Screenshots r1-<d>-<situation>-<tag>.png.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-28-ai-palveluntarjoajat-1';
const [input,out,flag]=process.argv.slice(2);
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const SITUATIONS=['asetukset','lisaa','tilaus','avain','valitsin','uusi','kayttoonotto','kayttoonotto-cn','yllapito'];
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
 await page.getByTestId('rq-page').first().waitFor();
 await page.waitForTimeout(300);
 return page;
}
const shot=(page,name)=>page.screenshot({path:`${out}/r1-${name}.png`,fullPage:true});
const noOverflow=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const dialogNoOverflow=page=>page.evaluate(()=>[...document.querySelectorAll('[role=dialog]')].every(d=>d.scrollWidth<=d.clientWidth+1));
const running=page=>page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running'&&!a.effect?.target?.closest?.('.proto-picker')).length);
const vis=async(page,id)=>(await page.getByTestId(id).count())>0&&await page.getByTestId(id).first().isVisible();

// Adjacency: every pair of visible controls in the open dialog, the open
// picker popover, or the page is at least --ah-control-gap apart.
async function spacing(page,what){
 const r=await page.evaluate(()=>{
  const px=v=>{const e=document.createElement('div');e.style.width=`var(${v})`;document.body.append(e);const w=e.getBoundingClientRect().width;e.remove();return w;};
  const min=px('--ah-control-gap');
  const dialogs=[...document.querySelectorAll('[role=dialog]')];
  const pop=document.querySelector('details[open] .md-pop');
  const scope=dialogs.at(-1)||pop||document.querySelector('[data-testid=rq-page]');
  const els=[...scope.querySelectorAll('button,a[href],input,select,textarea,[role=button],summary')].filter(e=>{const b=e.getBoundingClientRect();return b.width>0&&b.height>0&&getComputedStyle(e).visibility!=='hidden'&&!e.closest('.s-nav');});
  const name=e=>(e.dataset.testid||e.getAttribute('aria-label')||e.textContent||e.tagName).trim().slice(0,40);
  const gap=(a,b)=>{const p=a.getBoundingClientRect(),q=b.getBoundingClientRect();const gx=Math.max(q.left-p.right,p.left-q.right),gy=Math.max(q.top-p.bottom,p.top-q.bottom);return gx<0&&gy<0?Math.max(gx,gy):gx<0?gy:gy<0?gx:Math.max(gx,gy);};
  const bad=[];
  for(let i=0;i<els.length;i++)for(let j=i+1;j<els.length;j++){
   const a=els[i],b=els[j];if(a.contains(b)||b.contains(a))continue;
   // A radio or checkbox inside its own label is one control with its text.
   if(a.closest('label')&&a.closest('label')===b.closest('label'))continue;
   // Production's Segmented is one control whose segments touch by design.
   const seg=e=>e.closest('[data-ah-primitive=segmented]');if(seg(a)&&seg(a)===seg(b))continue;
   // Production's onboarding list (AIOfferList) is one list of touching full-width rows.
   if(a.matches('.ah-ai-option-head')&&b.matches('.ah-ai-option-head')&&a.closest('ul')===b.closest('ul'))continue;
   const g=gap(a,b);if(g<min-0.5)bad.push(`${name(a)} | ${name(b)}: ${g.toFixed(1)}px < ${min}`);
  }
  return bad;
 });
 eq(r.join('\n'),'',`${what}: spacing`);
}

async function assertView(page,d,s,what){
 ok(await noOverflow(page),`${what}: document overflow`);
 ok(await dialogNoOverflow(page),`${what}: dialog overflow`);
 eq(await running(page),0,`${what}: animation under reduced motion`);
 eq(await page.locator('.rq-review').getAttribute('data-scenario'),s,`${what}: situation`);
 const dialog=await vis(page,'rq-dialog');
 eq(dialog,['lisaa','tilaus','avain'].includes(s),`${what}: dialog ${dialog?'open':'closed'}`);
 if(s==='asetukset'){
  if(d===0){ok(await vis(page,'rq-subs'),`${what}: subscriptions`);ok(await vis(page,'rq-keys'),`${what}: keys`);eq(await page.locator('[data-testid=rq-subs] [data-testid^=rq-conn-]').count(),3,`${what}: three subscriptions incl. the plan`);}
  else{eq(await page.locator('[data-testid^=rq-svcrow-]').count(),4,`${what}: four services`);}
 }
 if(s==='lisaa'){
  if(d===0)eq(await page.locator('[data-testid^=rq-group-]').count(),3,`${what}: three ways`);
  else eq(await page.locator('[data-testid^=rq-svc-]').count(),9,`${what}: nine services`);
 }
 if(s==='tilaus')ok(await vis(page,'rq-signin')&&(await page.getByTestId('rq-code').innerText()).includes('KQ7M-4TXP'),`${what}: device code`);
 if(s==='avain'){
  eq(await page.getByTestId('rq-keyform').getAttribute('data-region'),'cn',`${what}: China region`);
  ok((await page.getByTestId('rq-pi-id').innerText()).includes('zai-coding-cn'),`${what}: Pi provider`);
 }
 if(s==='valitsin'||s==='usi'||s==='uusi'){
  ok(await vis(page,'rq-picker'),`${what}: picker open`);
  if(d===0)ok(await vis(page,'rq-route'),`${what}: route list`);
  else eq(await page.locator('[data-testid^=rq-pick-]:not([data-testid=rq-pick-groups])').count(),4,`${what}: four groups`);
 }
 if(s.startsWith('kayttoonotto')){
  ok(await vis(page,'ai-options'),`${what}: options`);
  if(s==='kayttoonotto-cn'){ok(await vis(page,'ai-suggestion'),`${what}: suggestion`);ok(await vis(page,'ai-others-toggle'),`${what}: unavailable folded`);ok(await vis(page,'rq-keyform'),`${what}: suggestion open`);}
 }
 if(s==='yllapito'){ok(await vis(page,'rq-server-region'),`${what}: region`);ok(await vis(page,'rq-sitekey'),`${what}: site key`);}
}

const tags=quick?[[1440,'light','fi']]:[[1440,'light','fi'],[390,'light','fi'],[1440,'dark','fi'],[1440,'light','en']];
for(const d of [0,1])for(const s of SITUATIONS)for(const [w,theme,lang] of tags){
 const tag=`${w}-${theme}${lang==='en'?'-en':''}`;
 const what=`${d} ${s} ${tag}`;
 const page=await open(w,theme,d,s,lang);
 await assertView(page,d,s,what);
 await spacing(page,what);
 if(w===1440&&theme==='light'&&lang==='fi'&&d===0&&s==='asetukset'){await checkPicker(page,round);checks++;}
 await shot(page,`${d}-${s}-${tag}`);
 await page.close();
}

// Interactions at 1440 light, Finnish.
for(const d of [0,1]){
 // Add → a route's key flow, region switch.
 let page=await open(1440,'light',d,'asetukset');
 await page.getByTestId(d===0?'rq-add-key':'rq-add-service').click();
 ok(await vis(page,'rq-dialog'),`${d}: add opens`);
 await page.getByTestId('rq-search').fill('minimax');
 if(d===0){eq(await page.locator('[data-testid^=rq-opt-]').count(),1,`${d}: search narrows`);await page.getByTestId('rq-opt-minimax-plan').click();}
 else{eq(await page.locator('[data-testid^=rq-svc-]').count(),1,`${d}: search narrows`);await page.getByTestId('rq-svc-minimax').click();}
 ok(await vis(page,'rq-keyform'),`${d}: key form`);
 ok((await page.getByTestId('rq-pi-id').innerText()).includes('minimax'),`${d}: global id`);
 await page.getByTestId('rq-region').getByTestId('segment-cn').click();
 ok((await page.getByTestId('rq-pi-id').innerText()).includes('minimax-cn'),`${d}: China id`);
 await spacing(page,`${d} add/minimax`);
 await shot(page,`${d}-flow-minimax-cn`);
 await page.getByTestId('rq-back').click();
 eq(await page.getByTestId('rq-dialog').getAttribute('data-step'),'list',`${d}: back to list`);
 await page.getByTestId('rq-cancel').focus();
 await page.keyboard.press('Escape');
 await page.waitForTimeout(200);
 eq(await vis(page,'rq-dialog'),false,`${d}: Escape closes`);
 // Qwen: editions change the provider id.
 await page.getByTestId(d===0?'rq-add-sub':'rq-add-service').click();
 await page.getByTestId(d===0?'rq-opt-qwen-plan':'rq-svc-qwen').click();
 ok((await page.getByTestId('rq-pi-id').innerText()).includes('qwen-token-plan-individual'),`${d}: Qwen personal`);
 await page.getByTestId('rq-edition').getByTestId('segment-team').click();
 eq((await page.getByTestId('rq-pi-id').innerText()).includes('individual'),false,`${d}: Qwen team`);
 await page.close();
 // Sign-in completes.
 page=await open(1440,'light',d,'tilaus');
 await page.getByTestId('rq-simulate').click();
 ok(await vis(page,'rq-signed'),`${d}: signed in`);
 await page.close();
 // Picker.
 page=await open(1440,'light',d,'valitsin');
 if(d===0){
  await page.getByTestId('rq-route').selectOption('deepseek');
  ok(await vis(page,'model-deepseek-v4-pro'),`${d}: route switches models`);
  eq(await page.locator('[data-testid^=model-]').count(),2,`${d}: only that route's models`);
 }else{
  await page.getByTestId('model-glm-5.3').check();
  eq(await page.locator('input[type=radio]:checked').count(),1,`${d}: one model chosen across groups`);
 }
 await spacing(page,`${d} picker`);
 await page.close();
 // China onboarding: the unavailable group unfolds.
 page=await open(1440,'light',d,'kayttoonotto-cn');
 await page.getByTestId('ai-others-toggle').click();
 ok(await page.locator('.rq-unavail').isVisible(),`${d}: unavailable shown`);
 ok(await page.locator(`[data-testid=ai-option-${d===0?'chatgpt':'openai'}]`).isVisible(),`${d}: US service in the folded group`);
 await shot(page,`${d}-onboarding-cn-open`);
 await page.close();
 // Admin.
 page=await open(1440,'light',d,'yllapito');
 await page.getByTestId('rq-server-region').getByTestId('segment-cn').click();
 if(d===1)eq(await page.locator('[data-testid^=rq-offer-svc-]').first().getAttribute('data-testid'),'rq-offer-svc-deepseek',`${d}: China services first`);
 await page.getByTestId('rq-site-replace').click();
 ok(await vis(page,'rq-site-form'),`${d}: site key form`);
 ok(await vis(page,'rq-site-region'),`${d}: site key region (GLM)`);
 await spacing(page,`${d} admin form`);
 await shot(page,`${d}-admin-cn-form`);
 await page.close();
 // Phone dialog.
 page=await open(390,'light',d,'avain');
 ok(await dialogNoOverflow(page),`${d}: phone dialog`);
 await page.close();
}

await browser.close();
eq(errors.join('\n'),'','console clean');
console.log(`${checks} checks passed`);
