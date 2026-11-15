// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Walks Nyt and the three directions on the start page at 1440 and 390 in
// Päivä, Yö and Kontrasti: each direction's line is marked, its default
// preview shows its own difference (Nyt goals as YAML source, 1 goal cards
// and quoted prompts, 2 a goals table with folded rows, 3 the production
// start page with three guides), and neither the document nor the preview
// overflows sideways. Then at 1440 Päivä: the deep front matter reaches its
// sixth level in 1 and 3 and behind Avaa kaikki in 2; a .yml file has no
// preview today and one in each direction; 2's table row opens; 3's goal card
// selects its guide and the broken page names the goal and the field; the
// text view holds the YAML. English last. Screenshots at device scale 2
// named <n>-<direction>-<file>-<tag>.png; --quick takes only 1440 light.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-15-frontmatter-preview';
const [input,out,flag]=process.argv.slice(2);
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['nyt','sisakkain','puu','sivuna'];
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};

async function open(width,theme,extra=''){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:900},deviceScaleFactor:2,reducedMotion:'reduce',hasTouch:phone,isMobile:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto(`http://prototype.test/?theme=${theme}${extra}`);
 await page.locator('#theme').selectOption(theme);
 return page;
}
const settle=page=>page.waitForTimeout(200);
const pick=async(page,d)=>{await page.locator('.proto-picker-item').nth(d).click();await page.locator(`.fmp-review[data-direction="${d}"]`).waitFor({state:'attached'});await page.waitForTimeout(300);};
const file=async(page,f)=>{await page.locator('#file').selectOption(f);await settle(page);};
const shot=(page,d,tag)=>page.screenshot({path:`${out}/${d+1}-${names[d]}-${tag}.png`});
const fits=page=>page.evaluate(()=>{
 const p=document.querySelector('.ah-browser-preview');
 return document.documentElement.scrollWidth<=innerWidth&&(!p||p.scrollWidth<=p.clientWidth+1);
});
const preview=page=>page.getByTestId('editor-preview');

try{
for(const width of quick?[1440]:[1440,390])for(const theme of quick?['light']:['light','dark','contrast']){
 const tag=`${width}-${theme}`;
 const page=await open(width,theme);
 await checkPicker(page,round);
 eq(await page.getByTestId('recommendation').count(),1,'the recommendation is on the page');
 for(let d=0;d<4;d++){
  await pick(page,d);
  const at=`${names[d]} ${tag}`;
  eq(await page.locator('.fmp-lines li[aria-current]').count(),1,`${at}: its line is marked`);
  ok(await preview(page).isVisible(),`${at}: the start page opens in the preview`);
  if(d===0){
   ok(await page.getByTestId('markdown-frontmatter').isVisible(),`${at}: today's front matter box`);
   ok((await page.locator('[data-testid="markdown-frontmatter"] pre').first().textContent()).includes('- title:'),`${at}: goals stay YAML source`);
  }else if(d===1){
   eq(await page.locator('.fmv-cards > .fmv-card').count(),3,`${at}: three goal cards`);
   ok(await page.locator('.fmv-card .fmv-block').count()>=1,`${at}: the multi-line prompt as a quoted block`);
   ok(await page.locator('.fmv-card .fmv-list').count()>=3,`${at}: steps as lists`);
  }else if(d===2){
   ok(await page.getByTestId('tree-table').isVisible(),`${at}: goals as a table`);
   eq(await page.locator('[data-testid="tree-table"] tbody > tr:not(.fmt-detail)').count(),3,`${at}: one row per goal`);
   eq(await page.locator('.fmt-detail').count(),0,`${at}: rows start folded`);
  }else{
   ok(await page.getByTestId('as-start-page').isVisible(),`${at}: the start page view`);
   eq(await page.getByTestId('starting-goal').count(),3,`${at}: the production goal cards`);
   eq(await page.getByTestId('goal-guide-preview').count(),3,`${at}: a guide per goal`);
   ok((await page.getByTestId('start-page-status').textContent()).includes('Kelpaa'),`${at}: valid`);
   ok(await page.locator('.fm3-placeholder').count()===1,`${at}: the placeholder marked`);
  }
  ok(await fits(page),`${at}: overflow`);
  await shot(page,d,`start-${tag}`);
 }
 await page.close();
}

{
 const page=await open(1440,'light');
 // Deep front matter.
 await file(page,'deep');
 for(const d of [1,3]){
  await pick(page,d);
  ok(await page.getByText('Avain hallituksella').isVisible(),`${names[d]}: the sixth level is shown`);
  ok(await page.locator('.fmv-empty').count()>=4,`${names[d]}: empty values named`);
  ok(await fits(page),`${names[d]} deep: overflow`);
  await shot(page,d,'deep-1440-light');
 }
 await pick(page,0);
 ok((await page.locator('[data-testid="markdown-frontmatter"] pre').count())>=3,'nyt: nested keys as source');
 await shot(page,0,'deep-1440-light');
 await pick(page,2);
 ok(await page.locator('.fmt-count').count()>=1,'puu: folded levels show counts');
 eq(await page.getByText('Avain hallituksella').count(),0,'puu: the sixth level starts folded');
 await shot(page,2,'deep-1440-light');
 await page.getByTestId('tree-open-all').click();await settle(page);
 ok(await page.getByText('Avain hallituksella').isVisible(),'puu: Avaa kaikki reaches the sixth level');
 await shot(page,2,'deep-open-1440-light');
 await page.getByTestId('tree-close-all').click();await settle(page);
 eq(await page.locator('.fmt-list .fmt-list').count(),0,'puu: Sulje kaikki folds to the top level');

 // Plain YAML.
 await file(page,'yaml');
 await pick(page,0);
 eq(await page.getByTestId('editor-preview-toggle').count(),0,'nyt: a .yml file has no preview');
 ok(await page.locator('.cm-content').isVisible(),'nyt: the .yml opens as text');
 await shot(page,0,'yaml-1440-light');
 for(const d of [1,2,3]){
  await pick(page,d);
  ok(await preview(page).isVisible(),`${names[d]}: a .yml file opens in its preview`);
  ok(await page.getByTestId('frontmatter-preview').isVisible(),`${names[d]}: the YAML document rendered`);
  if(d===2){eq(await preview(page).getByText('actions/checkout@v4').count(),0,'puu: workflow steps start folded (third level)');await page.getByTestId('tree-open-all').click();await settle(page);}
  ok(await preview(page).getByText('actions/checkout@v4').first().isVisible(),`${names[d]}: steps are visible`);
  ok(await fits(page),`${names[d]} yaml: overflow`);
  await shot(page,d,'yaml-1440-light');
 }

 // Interactions on the start page.
 await file(page,'start');
 await pick(page,2);
 await page.locator('[data-testid="tree-table"] .fmt-toggle').nth(1).click();await settle(page);
 eq(await page.locator('.fmt-detail').count(),1,'puu: a row opens');
 ok(await page.locator('.fmt-detail').getByText('[tapahtuman nimi, aika, paikka ja kuvaus]',{exact:false}).isVisible(),'puu: the row shows its prompt');
 await shot(page,2,'row-open-1440-light');
 await pick(page,3);
 await page.getByTestId('starting-goal').nth(1).click();await settle(page);
 ok(await page.locator('#fm3-goal-1[data-active]').isVisible(),'sivuna: the goal card selects its guide');
 await shot(page,3,'goal-1440-light');
 await page.getByTestId('editor-text-toggle').click();await settle(page);
 ok((await page.locator('.cm-content').textContent()).includes('goals:'),'the text view holds the YAML');
 eq(await preview(page).count(),0,'the text replaces the preview');
 await page.getByTestId('editor-preview-toggle').click();await settle(page);
 ok(await preview(page).isVisible(),'and back to the preview');
 await page.locator('#state').selectOption('broken');await settle(page);
 await pick(page,3);
 const status=await page.getByTestId('start-page-status').textContent();
 ok(!status.includes('Kelpaa ·'),'sivuna: the broken page is not valid');
 ok((await page.locator('#fm3-goal-1 .fm3-problem').textContent()).includes('when'),'sivuna: the guide names the missing field');
 ok((await page.locator('#fm3-goal-1 .fm3-problem').textContent()).includes('kuvaus'),'sivuna: and the unknown one');
 await shot(page,3,'broken-1440-light');
 await page.close();

 // Phone: deep and yaml in the recommended directions.
 const phone=await open(390,'dark');
 for(const f of ['deep','yaml']){
  await file(phone,f);
  for(const d of [1,3]){await pick(phone,d);ok(await fits(phone),`${names[d]} ${f} 390: overflow`);await shot(phone,d,`${f}-390-dark`);}
 }
 await phone.close();

 const en=await open(1440,'light','&lang=en');
 for(let d=0;d<4;d++){
  await pick(en,d);
  await shot(en,d,'start-en-1440-light');
 }
 ok((await en.getByTestId('start-page-status').textContent()).includes('Valid · 3 goals'),'English: status');
 ok((await en.locator('.ah-start-heading').textContent()).includes('What would you like to do?'),'English: production heading');
 await en.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[],'console errors');
console.log(`${checks} checks passed`);
