// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// The round directory first (no image, audio or HTML; nothing over 100 KB),
// then the three placements at 1280 and 390 px in Päivä, Yö and Korkea
// kontrasti: the picker passes the shared check; the page does not scroll
// sideways; the name shows once as the page's h1; the tiles, the primary
// action and the small buttons are visible; on the phone every action is
// hit 44 px wide (a point 1 px outside a 40 px button still reaches it) and
// neighbours' hit areas do not overlap; the header's height is recorded.
// At 1280 and 390 Päivä each direction's flows run: Kuvake opens
// production's icon editor and a choice reaches the heading and the rail;
// Nimi edits in place, Enter saves and Esc cancels; Ääni opens inside the
// viewport; the small buttons' tooltips appear on hover (desktop) and on
// keyboard focus, archive toggles to restore, a missing origin and blocked
// changes disable buttons that stay focusable and say why. The rules panel
// opens, shows every state in Päivä and Yö (hover, pressed differ from
// rest; focus has a ring) and closes with Esc. The page makes no request,
// opens no iframe and never navigates. The console stays clean.
// Screenshots: v<n>-<what>-<width>-<theme>.png. --quick runs 1280 Päivä only.
import {createRequire} from 'node:module';
import {dirname,resolve,join,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync,readdirSync,statSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-23-workspace-page-header-3';
const [input,out,flag]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <out-dir> [--quick]');process.exit(2);}
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
let checks=0;const errors=[];const heights=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
for(const f of readdirSync(here)){
 ok(!['.wav','.mp3','.ogg','.png','.jpg','.jpeg','.avif','.webp','.html'].includes(extname(f).toLowerCase()),`round directory holds ${f}`);
 ok(statSync(join(here,f)).size<100*1024,`${f} is over 100 KB`);
}
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['c2a-oikealla','c2b-vasemmalla','c2c-yksi-ryhma'];
let requests=0,navigations=0;
const settle=(page,ms=300)=>page.waitForTimeout(ms);
async function open(width,theme,d,s='oletus',extra=''){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:900},deviceScaleFactor:2,hasTouch:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto(`http://prototype.test/?v=${d+1}&s=${s}&theme=${theme}${extra}`);
 page.on('request',()=>{requests++;});
 page.on('framenavigated',f=>{if(f!==page.mainFrame()||!f.url().startsWith('http://prototype.test/'))navigations++;});
 await page.locator(`.rq-review[data-direction="${d}"]`).waitFor({state:'attached'});await page.getByTestId('page-head').first().waitFor();
 await settle(page,500);
 return page;
}
const tid=(page,id)=>page.getByTestId(id);
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const inView=async loc=>{const b=await loc.boundingBox();const v=loc.page().viewportSize();return b&&b.x>=-1&&b.y>=-1&&b.x+b.width<=v.width+1&&b.y+b.height<=v.height+1;};
const shot=(page,d,what,tag)=>page.screenshot({path:`${out}/v${d+1}-${names[d]}-${what}-${tag}.png`});
const railName=(page,n)=>page.locator('.ah-rail').getByText(n,{exact:true});
// Every action reachable 44 px wide on the phone: probe 1 px outside a
// side of a button under 44 px, and keep neighbours' areas apart.
async function hitAreas(page,tag){
 const r=await page.evaluate(()=>{
  const bs=[...document.querySelectorAll('[data-testid="workspace-actions"] button')];
  const out=[];
  for(const b of bs){const x=b.getBoundingClientRect();
   const probes=[[x.left-1,x.top+x.height/2],[x.right+1,x.top+x.height/2],[x.left+x.width/2,x.top-1],[x.left+x.width/2,x.bottom+1]];
   const hit=probes.every(([px,py])=>{const e=document.elementFromPoint(px,py);return e&&(e===b||b.contains(e));});
   out.push({id:b.dataset.testid,w:x.width,h:x.height,hit,left:x.left,right:x.right});}
  return out;});
 for(const b of r){ok(b.h>=40,`${tag} ${b.id}: ${b.h}px tall`);ok(b.hit,`${tag} ${b.id}: hit area does not reach 44 px`);}
 const xs=r.slice().sort((a,b)=>a.left-b.left);
 for(let i=1;i<xs.length;i++) ok(xs[i].left-xs[i-1].right>=4-0.5,`${tag} ${xs[i-1].id}/${xs[i].id}: hit areas overlap`);
}
const headHeight=page=>page.evaluate(()=>{
 const p=document.querySelector('[data-testid="workspace-page"]');const rest=p.querySelector('.ph-rest');
 return Math.round(rest.getBoundingClientRect().top-p.getBoundingClientRect().top);
});

for(const width of quick?[1280]:[1280,390]) for(const theme of quick?['light']:['light','dark','contrast']) for(let d=0;d<3;d++){
 const tag=`${width}-${theme}`;
 const page=await open(width,theme,d);
 await checkPicker(page,round);checks++;
 ok(await fits(page),`${tag} v${d+1}: scrolls sideways`);
 eq1(await page.locator('h1').count(),`${tag} v${d+1}: one h1`);
 ok((await page.locator('h1').innerText()).includes('aurinkokello'),`${tag} v${d+1}: h1 is the name`);
 for(const id of ['workspace-icon-picker','name-edit','sound-open','conversation-start','copy-path','new-worktree','open-github','workspace-archive','delete-workspace'])
  ok(await tid(page,id).first().isVisible(),`${tag} v${d+1}: ${id} visible`);
 if(width===390) await hitAreas(page,`${tag} v${d+1}`);
 if(theme==='light') heights.push({direction:names[d],width,header:await headHeight(page)});
 await shot(page,d,'oletus',tag);
 await page.close();
}
function eq1(n,m){assert.equal(n,1,m);checks++;}

for(const width of quick?[1280]:[1280,390]) for(let d=0;d<3;d++){
 const tag=`${width}-light`;
 // Kuvake: production's editor; an emoji reaches the heading and the rail.
 let page=await open(width,'light',d,'oletus');
 await tid(page,'workspace-icon-picker').click();
 const dialog=tid(page,'workspace-icon-dialog');
 await dialog.waitFor();await settle(page);
 ok(await inView(dialog),`${tag} v${d+1}: icon editor inside viewport`);
 await shot(page,d,'kuvake',tag);
 await dialog.getByTestId('workspace-icon-emoji').nth(3).click();
 await settle(page,500);
 ok((await page.locator('.ah-rail [data-testid="workspace-icon"]').first().getAttribute('data-kind'))==='emoji',`${tag} v${d+1}: rail icon follows`);
 ok((await page.locator('[data-testid="page-head"] [data-testid="workspace-icon"]').first().getAttribute('data-kind'))==='emoji',`${tag} v${d+1}: heading icon follows`);
 await page.keyboard.press('Escape');
 // Nimi in place: Enter saves, Esc cancels.
 await tid(page,'name-edit').click();
 const field=tid(page,'name-input');
 await field.waitFor();
 await field.fill('aurinko-sovellus');
 await shot(page,d,'nimi',tag);
 await field.press('Enter');await settle(page);
 ok((await page.locator('h1').innerText()).includes('aurinko-sovellus'),`${tag} v${d+1}: heading follows the rename`);
 ok(width===390?(await page.locator('.ah-mobile-toolbar').innerText()).includes('aurinko-sovellus'):await railName(page,'aurinko-sovellus').isVisible(),`${tag} v${d+1}: rail (phone: toolbar) follows the rename`);
 await tid(page,'name-edit').click();
 await field.fill('ei-tallenneta');await field.press('Escape');await settle(page);
 ok((await page.locator('h1').innerText()).includes('aurinko-sovellus'),`${tag} v${d+1}: Esc cancels`);
 // Ääni: inside the viewport, a choice changes the value.
 await tid(page,'sound-open').click();
 const sd=tid(page,'sound-dialog');await sd.waitFor();await settle(page);
 ok(await inView(sd.locator('.ph-sound header')),`${tag} v${d+1}: sound pop-up top inside viewport`);
 await shot(page,d,'aani',tag);
 await tid(page,'sound-marimba').click();await page.keyboard.press('Escape');await settle(page);
 ok((await tid(page,'sound-open').innerText()).includes('Marimba'),`${tag} v${d+1}: sound value follows`);
 await page.close();
 for(const s of ['oma','pitka','arkistoitu']){
  page=await open(width,'light',d,s);
  ok(await fits(page),`${tag} v${d+1} ${s}: scrolls sideways`);
  if(s==='arkistoitu') ok(await tid(page,'archived').isVisible(),`${tag} v${d+1}: archived note`);
  await shot(page,d,s,tag);
  await page.close();
 }
 // Small buttons: tooltip on hover (desktop) and on focus, archive toggles.
 page=await open(width,'light',d,'oletus');
 const gh=tid(page,'open-github');
 if(width===1280){
  await gh.hover();
  const tip=page.getByRole('tooltip');await tip.waitFor({timeout:4000});
  ok((await tip.innerText()).includes('Avaa GitHubissa'),`${tag} v${d+1}: GitHub tooltip`);
  ok(await inView(tip),`${tag} v${d+1}: tooltip inside viewport`);
  await shot(page,d,'vihje',tag);
  await page.mouse.move(5,890);await settle(page,400);
 }
 await tid(page,'conversation-start').focus();
 const at=()=>page.evaluate(()=>document.activeElement?.dataset?.testid);
 // Mirrored (C2b phone) the archive button comes before the primary.
 for(const key of ['Tab','Shift+Tab']){ await tid(page,'conversation-start').focus(); for(let i=0;i<6&&await at()!=='workspace-archive';i++) await page.keyboard.press(key); if(await at()==='workspace-archive') break; }
 ok(await page.evaluate(()=>document.activeElement?.dataset?.testid)==='workspace-archive',`${tag} v${d+1}: Tab reaches archive`);
 const tip2=page.getByRole('tooltip');await tip2.waitFor({timeout:4000});
 ok((await tip2.innerText()).includes('Arkistoi'),`${tag} v${d+1}: archive tooltip on focus`);
 ok(await page.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle)!=='none',`${tag} v${d+1}: focus ring`);
 await shot(page,d,'fokus',tag);
 await page.keyboard.press('Enter');await settle(page);
 ok(await tid(page,'workspace-restore').isVisible(),`${tag} v${d+1}: archive toggles to restore`);
 ok(await tid(page,'workspace-restore').getAttribute('aria-pressed')===null,`${tag} v${d+1}: toggle has no aria-pressed`);
 ok(await tid(page,'archived').isVisible(),`${tag} v${d+1}: archived note after toggle`);
 await page.close();
 // Disabled buttons stay, take focus and say why.
 for(const [s,id,why] of [['eiorigin','open-github','GitHub-originia'],['lukittu','delete-workspace','ei voi poistaa']]){
  page=await open(width,'light',d,s);
  const b=tid(page,id);
  ok(await b.isVisible()&&await b.isDisabled(),`${tag} v${d+1} ${s}: ${id} disabled and visible`);
  await b.locator('xpath=..').focus();
  const t=page.getByRole('tooltip');await t.waitFor({timeout:4000});
  ok((await t.innerText()).includes(why),`${tag} v${d+1} ${s}: tooltip says why`);
  await shot(page,d,s,tag);
  await page.close();
 }
 // The rules panel.
 page=await open(width,'light',d,'oletus');
 await tid(page,'rules-open').click();
 const panel=tid(page,'rules-panel');await panel.waitFor();await settle(page);
 ok(await fits(page),`${tag} v${d+1}: rules panel scrolls sideways`);
 for(const th of ['light','dark']){
  const bg=async st=>page.getByTestId(`rule-small-${st}-${th}`).evaluate(e=>getComputedStyle(e).backgroundColor);
  const rest=await bg('default');
  ok(rest!==await bg('hover'),`${tag} ${th}: hover differs from rest`);
  ok(rest!==await bg('pressed'),`${tag} ${th}: pressed differs from rest`);
  ok(await page.getByTestId(`rule-small-focus-${th}`).evaluate(e=>getComputedStyle(e).outlineStyle)!=='none',`${tag} ${th}: focus ring`);
  ok(await page.getByTestId(`rule-small-disabled-${th}`).isDisabled(),`${tag} ${th}: disabled`);
 }
 ok(await page.getByTestId('rule-small-default-light').evaluate(e=>getComputedStyle(e).backgroundColor)!==await page.getByTestId('rule-small-default-dark').evaluate(e=>getComputedStyle(e).backgroundColor),`${tag}: Päivä and Yö differ`);
 if(d===0) await shot(page,d,'saannot',tag);
 if(d===0){await panel.evaluate(e=>e.scrollTo(0,e.scrollHeight));await settle(page);await shot(page,d,'saannot-tilat',tag);}
 await panel.focus();await page.keyboard.press('Escape');await settle(page);
 ok(await panel.count()===0,`${tag} v${d+1}: Esc closes the rules panel`);
 await page.close();
}
await browser.close();
writeFileSync(join(out,'heights.json'),JSON.stringify(heights,null,1));
ok(requests===0,`page made ${requests} requests`);
ok(navigations===0,`page navigated ${navigations} times`);
ok(!html.includes('<iframe'),'page has an iframe');
ok(errors.length===0,`console errors:\n${errors.join('\n')}`);
console.log(`ok ${checks} checks`);console.log(JSON.stringify(heights));
