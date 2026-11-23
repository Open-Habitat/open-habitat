// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// The round directory first (no image, audio or HTML; nothing over 100 KB),
// then the three variations at 1280 and 390 px in Päivä, Yö and Korkea
// kontrasti: the picker passes the shared check; the page does not scroll
// sideways; the name shows once as the page's h1; Kuvake, Nimi and Ääni are
// reachable; the header's height is recorded. At 1280 and 390 Päivä each
// direction's flows run: Kuvake opens production's icon editor and an emoji
// choice reaches the heading and the rail; Nimi edits in place, Enter saves
// (heading and rail follow) and Esc cancels; Ääni opens inside the viewport
// and a choice changes its value; the long-name and archived scenarios fit.
// The console stays clean. Screenshots: v<n>-<what>-<width>-<theme>.png.
// --quick runs 1280 Päivä only.
import {createRequire} from 'node:module';
import {dirname,resolve,join,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync,readdirSync,statSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-23-workspace-page-header-2';
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
const names=['c1-matala','c2-toiminnot-sivulla','c3-sanat-nakyvissa'];
const settle=(page,ms=300)=>page.waitForTimeout(ms);
async function open(width,theme,d,s='oletus'){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:900},deviceScaleFactor:2,hasTouch:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto(`http://prototype.test/?v=${d+1}&s=${s}&theme=${theme}`);
 await page.locator(`.rq-review[data-direction="${d}"]`).waitFor({state:'attached'});await page.getByTestId('page-head').first().waitFor();
 await settle(page,500);
 return page;
}
const tid=(page,id)=>page.getByTestId(id);
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const inView=async loc=>{const b=await loc.boundingBox();const v=loc.page().viewportSize();return b&&b.x>=-1&&b.y>=-1&&b.x+b.width<=v.width+1&&b.y+b.height<=v.height+1;};
const shot=(page,d,what,tag)=>page.screenshot({path:`${out}/v${d+1}-${names[d]}-${what}-${tag}.png`});
const railName=(page,n)=>page.locator('.ah-rail').getByText(n,{exact:true});
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
 for(const id of ['workspace-icon-picker','name-edit','sound-open','conversation-start','copy-path'])
  ok(await tid(page,id).first().isVisible(),`${tag} v${d+1}: ${id} visible`);
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
}
await browser.close();
writeFileSync(join(out,'heights.json'),JSON.stringify(heights,null,1));
ok(errors.length===0,`console errors:\n${errors.join('\n')}`);
console.log(`ok ${checks} checks`);console.log(JSON.stringify(heights));
